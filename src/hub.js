// -----------------------------------------------------------------------------
// The SMHI hub: the places, their forecasts and warnings, the container's own
// refresh timer, the states, the scene trigger and the connection status.
//
// Refresh. The devices are published with `should_poll: true` and a valid
// `poll_frequency`, but the core cannot be trusted to call onPoll: a device
// created without these fields is never polled, even once the core is fixed
// (GladysAssistant/Gladys#3198, still open in 5.2.1). So the container
// refreshes by itself, every `refresh_minutes`, and the core's onPoll is a
// fallback that only reads SMHI when the timer has not done it for 1.2
// periods (the timer stalled): polled every minute, it never doubles a read. Only the places whose device the user added are read: Gladys drops
// the states of a device it does not know.
//
// Quotas. SMHI publishes no quota for its open data; the model runs about
// once an hour. One request per place and one for the warnings (all of
// Sweden at once) per period — every 30 minutes by default, as Home
// Assistant does.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { buildDevice, buildStates } from './devices.js';
import { STATUS } from './i18n.js';
import { createIssueLog } from './issues.js';
import { resolvePlaces } from './places.js';
import { fetchForecast, fetchWarnings } from './smhi/client.js';
import { LEVEL_KEYS, warningsFor } from './smhi/warnings.js';

const logger = createLogger({ name: 'smhi' });

export const WIDGET_KEY = 'forecast';
export const TRIGGER_KEY = 'warning_issued';
// An unchanged value is sent again at least this often: Gladys shows "no
// recent value" after 48 h, and the heartbeat must stay under 12 h.
export const STATE_HEARTBEAT_MS = 6 * 3_600_000;
// A forecast older than this is not used for the current values any more.
const MAX_FORECAST_AGE_MS = 12 * 3_600_000;

export class SmhiHub {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
   * @param {import('./store.js').Store} options.store
   * @param {typeof fetch} [options.fetch]
   * @param {boolean} [options.timers] run the refresh timer (tests may turn it off)
   * @param {() => number} [options.now]
   * @param {string} [options.timeZone] default: TZ, set by the Gladys supervisor
   */
  constructor({ gladys, store, fetch: fetchImpl, timers = true, now, timeZone }) {
    this.gladys = gladys;
    this.store = store;
    this.fetch = fetchImpl ?? ((...args) => globalThis.fetch(...args));
    this.timers = timers;
    this.now = now ?? (() => Date.now());
    this.timeZone = timeZone ?? (process.env.TZ || undefined);
    this.issues = createIssueLog(logger);
    this.config = null;
    this.places = [];
    /** By platformId: { forecast, fetchedAt, attemptedAt, error } */
    this.data = new Map();
    /** { areas, fetchedAt } once read, null before. */
    this.warnings = null;
    this.warningsAttemptedAt = undefined;
    this.announced = {};
    this.timer = null;
    this.stopped = false;
    this.running = null;
    this.lastStatus = null;
  }

  get periodMs() {
    return (this.config?.refresh_minutes ?? 30) * 60_000;
  }

  /** First start: what was announced, the places, the devices, a first refresh. */
  async start(config) {
    this.announced = (await this.store.load()).announced;
    await this.reconfigure(config);
  }

  /** New configuration, or a reconnection: Gladys may have lost what we sent. */
  async reconfigure(config) {
    this.config = config;
    this.stopped = false;
    if (config.coordinatesInvalid) {
      logger.warn('The coordinates of the configuration cannot be read: they are ignored');
    }
    const houses = await this.readHouses();
    const before = this.places.map((place) => place.platformId).join(',');
    this.places = resolvePlaces(config, houses);
    if (this.places.map((place) => place.platformId).join(',') !== before) {
      logger.info(
        this.places.length > 0
          ? `Forecasting ${this.places.length} place(s): ${this.places.map((p) => p.name).join(', ')}`
          : 'No place to forecast: no located house, no coordinates',
      );
    }
    for (const platformId of this.data.keys()) {
      if (!this.places.some((place) => place.platformId === platformId)) {
        this.data.delete(platformId);
      }
    }
    await this.publishDevices();
    this.gladys.forgetPublishedStates?.();
    this.schedule();
    await this.refresh({ force: true });
  }

  async readHouses() {
    if (!this.config.use_houses) {
      return [];
    }
    try {
      const houses = await this.gladys.getHouses();
      this.issues.ok('houses', 'The houses of Gladys can be read again');
      return houses;
    } catch (err) {
      this.issues.fail('houses', `Cannot read the houses of Gladys (${err.message})`);
      return [];
    }
  }

  async publishDevices() {
    await this.gladys.publishDiscoveredDevices(this.devices());
  }

  devices() {
    return this.places.map((place) => buildDevice(this.gladys, place, this.config.language));
  }

  /** @returns {string} the device external_id of a place */
  deviceId(place) {
    return this.gladys.externalIds('place', place.platformId).device;
  }

  placeByDevice(externalId) {
    return this.places.find((place) => this.deviceId(place) === externalId) ?? null;
  }

  /** The places whose device the user added to Gladys. */
  createdPlaces() {
    const created = new Set((this.gladys.devices ?? []).map((device) => device.external_id));
    return this.places.filter((place) => created.has(this.deviceId(place)));
  }

  schedule() {
    clearTimeout(this.timer);
    this.timer = null;
    if (!this.timers || this.stopped) {
      return;
    }
    this.timer = setTimeout(async () => {
      this.timer = null;
      try {
        await this.refresh();
      } catch (err) {
        logger.error(`Refresh failed (${err.message})`);
      } finally {
        this.schedule();
      }
    }, this.periodMs);
    this.timer.unref?.();
  }

  /**
   * One refresh of the added places; one at a time, a caller arriving during
   * a refresh waits for it then runs its own when forced.
   * @param {{ force?: boolean, places?: object[], minGap?: number }} [options]
   */
  async refresh(options = {}) {
    while (this.running) {
      await this.running.catch(() => {});
      if (!options.force) {
        // The refresh that just ended did the work.
        return;
      }
    }
    this.running = this.doRefresh(options);
    try {
      await this.running;
    } finally {
      this.running = null;
    }
  }

  async doRefresh({ force = false, places, minGap = 0.5 } = {}) {
    if (this.gladys.connected === false) {
      logger.debug('Gladys unreachable: refresh skipped');
      return;
    }
    const targets = places ?? this.createdPlaces();
    const now = this.now();
    const due = (attemptedAt) =>
      force || attemptedAt === undefined || now - attemptedAt >= this.periodMs * minGap;

    await Promise.all(
      targets
        .filter((place) => due(this.data.get(place.platformId)?.attemptedAt))
        .map((place) => this.readForecast(place)),
    );
    if (targets.length > 0 && due(this.warningsAttemptedAt)) {
      await this.readWarnings();
    }
    // The "check" action reads places the user has not added: no states for them.
    const created = this.createdPlaces();
    const publishable = targets.filter((place) => created.includes(place));
    await this.publishStates(publishable);
    await this.announceWarnings(publishable);
    await this.updateStatus();
  }

  async readForecast(place) {
    const entry = this.data.get(place.platformId) ?? {};
    entry.attemptedAt = this.now();
    this.data.set(place.platformId, entry);
    try {
      entry.forecast = await fetchForecast(place.latitude, place.longitude, { fetch: this.fetch });
      entry.fetchedAt = this.now();
      entry.error = null;
      logger.debug(`${place.name}: forecast read (${entry.forecast.steps.length} steps)`);
      this.issues.ok(`forecast:${place.platformId}`, `${place.name}: the forecast is back`);
    } catch (err) {
      entry.error = err;
      const hint = err.outOfArea ? ', outside the SMHI forecast area' : '';
      this.issues.fail(
        `forecast:${place.platformId}`,
        `${place.name}: forecast unavailable (${err.message}${hint})`,
      );
    }
  }

  async readWarnings() {
    this.warningsAttemptedAt = this.now();
    try {
      const areas = await fetchWarnings({ fetch: this.fetch });
      this.warnings = { areas, fetchedAt: this.now() };
      logger.debug(`Warnings read: ${areas.length} warning area(s) in Sweden`);
      this.issues.ok('warnings', 'The SMHI warnings are back');
    } catch (err) {
      this.issues.fail('warnings', `SMHI warnings unavailable (${err.message})`);
    }
  }

  /** The forecast of a place, unless too old to describe the present. */
  forecastOf(place) {
    const entry = this.data.get(place.platformId);
    if (!entry?.forecast || this.now() - entry.fetchedAt > MAX_FORECAST_AGE_MS) {
      return null;
    }
    return entry.forecast;
  }

  /** The warning areas of a place, null when the warnings were never read. */
  warningsOf(place) {
    if (!this.warnings) {
      return null;
    }
    return warningsFor(this.warnings.areas, place, this.config.warning_county);
  }

  async publishStates(places) {
    const states = places.flatMap((place) =>
      buildStates(
        this.gladys,
        place,
        { forecast: this.forecastOf(place), warnings: this.warningsOf(place) },
        { language: this.config.language, now: new Date(this.now()), timeZone: this.timeZone },
      ),
    );
    if (states.length === 0) {
      return;
    }
    try {
      const { count } = await this.gladys.publishChangedStates(states, {
        heartbeat: STATE_HEARTBEAT_MS,
      });
      this.issues.ok('states', 'Gladys accepts the states again');
      if (count > 0) {
        logger.debug(`${count} state(s) published`);
        this.gladys.requestWidgetRefresh(WIDGET_KEY);
      }
    } catch (err) {
      // Not remembered by the SDK: sent again by the next refresh.
      this.issues.fail('states', `Gladys refused the states (${err.message})`);
    }
  }

  /** Fire the scene trigger for every warning (or higher level) new to a place. */
  async announceWarnings(places) {
    if (!this.warnings) {
      return;
    }
    let changed = false;
    for (const place of places) {
      const areas = this.warningsOf(place);
      const known = new Set(this.announced[place.platformId] ?? []);
      const current = areas.map((area) => `${area.key}:${area.level}`);
      for (const area of areas) {
        if (known.has(`${area.key}:${area.level}`)) {
          continue;
        }
        try {
          await this.gladys.publishSceneEvent(TRIGGER_KEY, {
            device: this.deviceId(place),
            level: LEVEL_KEYS[area.level],
            event: area.event.slice(0, 1000),
            area: area.areaName.slice(0, 1000),
            description: area.description.slice(0, 1000),
            starts_at: area.start,
            ends_at: area.end,
          });
          logger.info(`${place.name}: new ${LEVEL_KEYS[area.level]} warning, ${area.event}`);
        } catch (err) {
          // Not remembered: announced again by the next refresh.
          current.splice(current.indexOf(`${area.key}:${area.level}`), 1);
          logger.warn(`${place.name}: the warning could not reach the scenes (${err.message})`);
        }
      }
      const previous = this.announced[place.platformId] ?? [];
      if (current.join() !== previous.join()) {
        this.announced[place.platformId] = current;
        changed = true;
      }
    }
    if (changed) {
      try {
        await this.store.save({ announced: this.announced });
        this.issues.ok('store', 'The state can be written to /data again');
      } catch (err) {
        this.issues.fail('store', `Cannot write to /data (${err.message})`);
      }
    }
  }

  /** The connection status of the Configuration screen, sent when it changes. */
  async updateStatus() {
    let status = { connected: true };
    if (this.places.length === 0) {
      status = {
        connected: false,
        message: this.config.coordinatesInvalid ? STATUS.invalidCoordinates : STATUS.noPlace,
      };
    } else {
      const attempted = this.createdPlaces()
        .map((place) => this.data.get(place.platformId))
        .filter((entry) => entry?.attemptedAt !== undefined);
      if (attempted.length > 0 && attempted.every((entry) => entry.error)) {
        status = {
          connected: false,
          message: attempted.every((entry) => entry.error.outOfArea)
            ? STATUS.outOfArea
            : STATUS.unreachable,
        };
      }
    }
    const key = JSON.stringify(status);
    if (key === this.lastStatus) {
      return;
    }
    try {
      await this.gladys.setConnectionStatus(status.connected, status.message);
      this.lastStatus = key;
    } catch (err) {
      logger.debug(`Connection status not sent (${err.message})`);
    }
  }

  /** The core's onPoll: a fallback for when the timer stalls. */
  async poll(device) {
    const place = this.placeByDevice(device.external_id);
    if (!place) {
      logger.debug(`onPoll ignored for ${device.external_id}`);
      return;
    }
    await this.refresh({ places: [place], minGap: 1.2 });
  }

  /** A device was just added: Gladys has none of its states yet, send them all now. */
  async onDeviceCreated(device) {
    const place = this.placeByDevice(device.external_id);
    if (!place) {
      return;
    }
    this.gladys.forgetPublishedStates?.(device.external_id);
    const fresh = this.data.get(place.platformId)?.fetchedAt !== undefined;
    await this.refresh({ places: [place], force: !fresh });
    // Already fresh: the refresh above was skipped, publish from memory.
    if (fresh) {
      await this.publishStates([place]);
      await this.announceWarnings([place]);
    }
    this.gladys.requestWidgetRefresh(WIDGET_KEY);
  }

  /** "Check the forecast" action: read every place now, added or not. */
  async check() {
    await this.refresh({ places: this.places, force: true });
    return this.places.map((place) => ({
      place,
      forecast: this.forecastOf(place),
      error: this.data.get(place.platformId)?.error ?? null,
      warnings: this.warningsOf(place),
    }));
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.timer = null;
  }
}
