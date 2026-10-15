// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake SMHI answering the
// recorded fixtures, a temporary /data, and the integration wired on top
// through registerHandlers.
// -----------------------------------------------------------------------------

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { Store } from '../../src/store.js';

// The integration logs its lifecycle; keep the test output readable
// (LOG_LEVEL is read on every log call). LOG_LEVEL=debug npm test shows them.
process.env.LOG_LEVEL ??= 'silent';

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/smhi/${name}`, import.meta.url), 'utf8'));

export const FORECAST = fixture('forecast-norrkoping.json');
export const FORECAST_SHORT = fixture('forecast-short.json');
export const WARNINGS = fixture('warnings.json');

/** Prefix the SDK fake puts in front of every external id. */
export const ID_PREFIX = 'ext:test-integration:';

/** Within the fixture: 20 minutes after its creation. */
export const NOW = Date.parse('2026-04-02T11:20:00Z');

// The point of the fixture (Norrköping area), as a Gladys house.
export const HOUSE = {
  id: 'a1b2c3',
  name: 'Home',
  selector: 'home',
  latitude: 58.577821,
  longitude: 16.158549,
};

export const settle = async () => {
  for (let i = 0; i < 50; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};

/**
 * A fake SMHI. `forecast(lat, lon)` and `warnings()` return a body, a number
 * (an HTTP error status) or throw (network error).
 */
export function createFakeSmhi({ forecast = () => FORECAST, warnings = () => WARNINGS } = {}) {
  const calls = [];
  const fakeFetch = async (url) => {
    const text = String(url);
    calls.push(text);
    let body;
    const point = text.match(/\/geotype\/point\/lon\/([-\d.]+)\/lat\/([-\d.]+)\/data\.json$/);
    if (point) {
      body = forecast(Number(point[2]), Number(point[1]));
    } else if (text.endsWith('/ibww/api/version/1/warning.json')) {
      body = warnings();
    } else {
      throw new Error(`Unexpected SMHI call: ${text}`);
    }
    if (typeof body === 'number') {
      return { ok: false, status: body, json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => structuredClone(body) };
  };
  return {
    fetch: fakeFetch,
    calls,
    forecastCalls: () => calls.filter((url) => url.includes('/geotype/point/')).length,
    warningCalls: () => calls.filter((url) => url.includes('warning.json')).length,
  };
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {object[]} [options.houses]
 * @param {boolean} [options.created] the user added every discovered device
 * @param {object} [options.smhi] from createFakeSmhi
 * @param {boolean} [options.timers]
 * @param {() => number} [options.now]
 * @param {string} [options.dataDir]
 */
export async function createWorld({
  config = {},
  houses = [HOUSE],
  created = true,
  smhi = createFakeSmhi(),
  timers = false,
  now = () => NOW,
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-smhi-')),
} = {}) {
  // First pass: what the integration would discover, to "create" it.
  let devices = [];
  if (created) {
    const probe = createFakeGladys({ config, houses });
    const probeApp = registerHandlers(probe, {
      fetch: smhi.fetch,
      store: new Store(dataDir),
      timers: false,
      now,
      timeZone: 'Europe/Stockholm',
    });
    await probe.connect();
    devices = probe.fake.discoveredDevices;
    probeApp.stop();
    await probe.disconnect();
    smhi.calls.length = 0;
  }
  const gladys = createFakeGladys({ config, houses, devices });
  const app = registerHandlers(gladys, {
    fetch: smhi.fetch,
    store: new Store(dataDir),
    timers,
    now,
    timeZone: 'Europe/Stockholm',
  });
  await gladys.connect();
  await app.ready;
  const id = (key, platformId = 'house-home') => `${ID_PREFIX}place:${platformId}:${key}`;
  return { gladys, app, smhi, dataDir, id, devices };
}
