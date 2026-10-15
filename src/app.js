// -----------------------------------------------------------------------------
// Registers every SDK handler on a GladysIntegration (or the SDK's fake
// Gladys) and returns the hub, so index.js stays a few lines and the tests
// drive the very same wiring.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { LANGUAGES, normalizeConfig } from './config.js';
import { SmhiHub } from './hub.js';
import { STATUS, SYMBOLS, TEXT, WARNING_LEVELS, pick } from './i18n.js';
import { createSceneActions } from './scenes.js';
import { currentStep } from './smhi/forecast.js';
import { Store } from './store.js';
import { createWidgets } from './widgets.js';

const logger = createLogger({ name: 'smhi-app' });

// Pieces of the "Check the forecast" report.
export const CHECK_TEXT = {
  en: { outside: 'outside the SMHI forecast area', failed: 'no answer from SMHI' },
  fr: { outside: 'hors de la zone de prévision du SMHI', failed: 'pas de réponse du SMHI' },
  de: { outside: 'außerhalb des SMHI-Vorhersagegebiets', failed: 'keine Antwort von SMHI' },
  es: { outside: 'fuera de la zona de previsión del SMHI', failed: 'sin respuesta del SMHI' },
};

/**
 * The report of the "Check the forecast" action, in the four languages.
 * @param {{ place, forecast, error, warnings }[]} results
 * @param {Date} now
 */
export function checkMessage(results, now) {
  const message = {};
  for (const language of LANGUAGES) {
    if (results.length === 0) {
      message[language] = pick(TEXT, language).noPlaceAction;
      continue;
    }
    const check = pick(CHECK_TEXT, language);
    message[language] = results
      .map(({ place, forecast, error, warnings }) => {
        const step = forecast ? currentStep(forecast, now) : null;
        if (!step) {
          return `${place.name}: ${error?.outOfArea ? check.outside : check.failed}.`;
        }
        const level = (warnings ?? []).reduce((max, area) => Math.max(max, area.level), 0);
        const parts = [
          step.temperature === null ? null : `${step.temperature} °C`,
          pick(SYMBOLS, language)[step.symbol],
          warnings === null
            ? null
            : level === 0
              ? pick(WARNING_LEVELS, language)[0]
              : `${pick(TEXT, language).warning}: ${pick(WARNING_LEVELS, language)[level]}`,
        ].filter(Boolean);
        return `${place.name}: ${parts.join(', ')}.`;
      })
      .join(' ');
  }
  return message;
}

/**
 * @param {object} gladys GladysIntegration instance
 * @param {object} [options] test seams: store, fetch, timers, now, timeZone
 */
export function registerHandlers(gladys, options = {}) {
  const hub = new SmhiHub({
    gladys,
    store: options.store ?? new Store(),
    fetch: options.fetch,
    timers: options.timers ?? true,
    now: options.now,
    timeZone: options.timeZone,
  });

  // Resolved once the hub has started: a command arriving during the first
  // refresh waits for it.
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });
  let started = false;
  const whenReady =
    (fn) =>
    async (...args) => {
      await ready;
      return fn(...args);
    };

  gladys.on('connected', async () => {
    try {
      const config = normalizeConfig(await gladys.getConfig());
      if (started) {
        // A reconnection (Gladys restarted): the houses may have moved, and
        // Gladys may have lost what was sent.
        await hub.reconfigure(config);
        return;
      }
      started = true;
      await hub.start(config);
    } catch (err) {
      logger.error('Initialization failed', err);
      await gladys.setConnectionStatus(false, STATUS.initFailed).catch(() => {});
    } finally {
      resolveReady();
    }
  });

  gladys.on('disconnected', () => hub.stop());

  gladys.onScanRequest(
    whenReady(async () => hub.reconfigure(normalizeConfig(await gladys.getConfig()))),
  );

  // Read-only devices: nothing to command.
  gladys.onSetValue(async (device) => {
    throw new Error(`${device.external_id} is read-only`);
  });

  gladys.onPoll(whenReady((device) => hub.poll(device)));
  gladys.onDeviceCreated(whenReady((device) => hub.onDeviceCreated(device)));
  gladys.onDeviceUpdated(whenReady((device) => hub.onDeviceCreated(device)));

  gladys.onConfigUpdated(
    whenReady(async (raw) => {
      logger.info('New configuration');
      await hub.reconfigure(normalizeConfig(raw));
      gladys.requestWidgetRefresh('forecast');
    }),
  );

  gladys.onAction(
    'check',
    whenReady(async () => {
      logger.info('Action: check the forecast');
      return checkMessage(await hub.check(), new Date(hub.now()));
    }),
  );

  for (const [key, handler] of Object.entries(createSceneActions(hub))) {
    gladys.onSceneAction(key, whenReady(handler));
  }

  for (const [key, widget] of Object.entries(createWidgets(hub))) {
    gladys.onWidgetGet(key, whenReady(widget.get));
  }

  return {
    hub,
    ready,
    stop: () => hub.stop(),
  };
}
