// -----------------------------------------------------------------------------
// The container refreshes by itself (Gladys#3198), the core's onPoll is a
// fallback, only changes and heartbeats are published, logs stay quiet.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORECAST, HOUSE, NOW, createFakeSmhi, createWorld, settle } from './helpers/world.js';
import { STATE_HEARTBEAT_MS } from '../src/hub.js';

const MINUTE = 60_000;

/** A forecast whose values never change, whatever the hour: steps around `now`. */
function steadyForecast(now, data = FORECAST.timeSeries[0].data) {
  const start = Math.floor(now / 3_600_000) * 3_600_000 - 3_600_000;
  return {
    createdTime: new Date(now).toISOString(),
    referenceTime: new Date(now).toISOString(),
    geometry: FORECAST.geometry,
    timeSeries: Array.from({ length: 60 }, (_, i) => ({
      time: new Date(start + i * 3_600_000).toISOString(),
      intervalParametersStartTime: new Date(start + (i - 1) * 3_600_000).toISOString(),
      data: { ...data },
    })),
  };
}

/** Mocked clock and console; the world reads the mocked Date. */
function setup(t, { logLevel } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: NOW });
  const previous = process.env.LOG_LEVEL;
  if (logLevel === undefined) {
    delete process.env.LOG_LEVEL;
  } else {
    process.env.LOG_LEVEL = logLevel;
  }
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  const lines = [];
  for (const stream of ['log', 'info', 'warn', 'error', 'debug']) {
    t.mock.method(console, stream, (...args) => lines.push(args.join(' ')));
  }
  return { lines, now: () => Date.now() };
}

async function tick(t, ms) {
  t.mock.timers.tick(ms);
  await settle();
}

test('the container refreshes an added place by itself, every period, without onPoll (Gladys#3198)', async (t) => {
  const { now } = setup(t, { logLevel: 'silent' });
  let temperature = 10.4;
  const smhi = createFakeSmhi({
    forecast: () =>
      steadyForecast(Date.now(), { ...FORECAST.timeSeries[0].data, air_temperature: temperature }),
  });
  const { gladys, app, id } = await createWorld({ smhi, timers: true, now });
  t.after(() => app.stop());
  assert.equal(smhi.forecastCalls(), 1, 'read at once');
  assert.equal(smhi.warningCalls(), 1);
  assert.equal(gladys.fake.lastState(id('temperature')), 10.4);

  temperature = 7.9;
  await tick(t, 30 * MINUTE);
  assert.equal(smhi.forecastCalls(), 2, 'read again after one period, no onPoll involved');
  assert.equal(smhi.warningCalls(), 2);
  assert.equal(gladys.fake.lastState(id('temperature')), 7.9);
  assert.ok(gladys.fake.widgetRefreshes.includes('forecast'), 'the widget is nudged');

  await tick(t, 30 * MINUTE);
  assert.equal(smhi.forecastCalls(), 3);
});

test('the refresh interval of the configuration is followed', async (t) => {
  const { now } = setup(t, { logLevel: 'silent' });
  const smhi = createFakeSmhi({ forecast: () => steadyForecast(Date.now()) });
  const { app } = await createWorld({ smhi, timers: true, now, config: { refresh_minutes: '60' } });
  t.after(() => app.stop());
  await tick(t, 30 * MINUTE);
  assert.equal(smhi.forecastCalls(), 1);
  await tick(t, 30 * MINUTE);
  assert.equal(smhi.forecastCalls(), 2);
});

test("the core's onPoll is a fallback: it never reads SMHI twice in a period", async (t) => {
  const { now } = setup(t, { logLevel: 'silent' });
  const smhi = createFakeSmhi({ forecast: () => steadyForecast(Date.now()) });
  const { gladys, app, devices } = await createWorld({ smhi, timers: true, now });
  t.after(() => app.stop());
  const [device] = devices;

  // The core polls every minute: nothing to read while the timer runs.
  for (let i = 0; i < 29; i += 1) {
    t.mock.timers.tick(MINUTE);
    assert.deepEqual(await gladys.fake.poll(device), { success: true });
  }
  assert.equal(smhi.forecastCalls(), 1);
  await tick(t, MINUTE);
  assert.equal(smhi.forecastCalls(), 2, 'the timer');

  // The timer stalls: the core takes over, once 1.2 periods have passed.
  app.stop();
  t.mock.timers.tick(35 * MINUTE);
  await gladys.fake.poll(device);
  assert.equal(smhi.forecastCalls(), 2);
  t.mock.timers.tick(MINUTE);
  await gladys.fake.poll(device);
  assert.equal(smhi.forecastCalls(), 3);
});

test('a place the user did not add is never read by the timer', async (t) => {
  const { now } = setup(t, { logLevel: 'silent' });
  const smhi = createFakeSmhi({ forecast: () => steadyForecast(Date.now()) });
  const { gladys, app } = await createWorld({ smhi, timers: true, now, created: false });
  t.after(() => app.stop());
  await tick(t, 60 * MINUTE);
  assert.equal(smhi.calls.length, 0);
  assert.equal(gladys.fake.states.length, 0);
  assert.equal(gladys.fake.discoveredDevices.length, 1, 'still offered in the Discovery tab');
});

test('only the values that changed are published, and everything again once per heartbeat', async (t) => {
  const { now } = setup(t, { logLevel: 'silent' });
  const smhi = createFakeSmhi({ forecast: () => steadyForecast(Date.now()) });
  const { gladys, app } = await createWorld({ smhi, timers: true, now });
  t.after(() => app.stop());
  const first = gladys.fake.states.length;
  assert.equal(first, 15, 'every feature at once');

  await tick(t, 30 * MINUTE);
  await tick(t, 30 * MINUTE);
  assert.equal(gladys.fake.states.length, first, 'nothing changed, nothing sent');

  assert.ok(STATE_HEARTBEAT_MS <= 12 * 3_600_000);
  for (let elapsed = 60 * MINUTE; elapsed <= STATE_HEARTBEAT_MS; elapsed += 30 * MINUTE) {
    await tick(t, 30 * MINUTE);
  }
  assert.equal(gladys.fake.states.length, first * 2, 'everything sent again within the heartbeat');
});

test('a device just added gets all its states at once', async (t) => {
  const { now } = setup(t, { logLevel: 'silent' });
  const smhi = createFakeSmhi({ forecast: () => steadyForecast(Date.now()) });
  const { gladys, app, devices } = await createWorld({ smhi, timers: true, now });
  t.after(() => app.stop());
  const first = gladys.fake.states.length;
  const nudges = gladys.fake.widgetRefreshes.length;

  // Deleted then added again a few minutes later: the SDK forgot what it
  // sent, Gladys has nothing; no new SMHI read is needed.
  await tick(t, 5 * MINUTE);
  await gladys.fake.deviceDeleted(devices[0]);
  await gladys.fake.deviceCreated(devices[0]);
  assert.equal(gladys.fake.states.length, first * 2);
  assert.equal(smhi.forecastCalls(), 1);
  assert.ok(gladys.fake.widgetRefreshes.length > nudges, 'the widget is nudged');
});

test('a device added before any forecast was read reads SMHI at once', async (t) => {
  const { now } = setup(t, { logLevel: 'silent' });
  const smhi = createFakeSmhi({ forecast: () => steadyForecast(Date.now()) });
  const { gladys, app } = await createWorld({ smhi, timers: true, now, created: false });
  t.after(() => app.stop());
  const [device] = gladys.fake.discoveredDevices;
  await gladys.fake.deviceCreated(device);
  assert.equal(smhi.forecastCalls(), 1);
  assert.equal(gladys.fake.states.length, 15);
});

test('SMHI down: one warning, the last forecast kept, one line on its return', async (t) => {
  const { lines, now } = setup(t);
  let down = false;
  const smhi = createFakeSmhi({
    forecast: () => (down ? 503 : steadyForecast(Date.now())),
    warnings: () => (down ? 503 : []),
  });
  const { gladys, app, id } = await createWorld({ smhi, timers: true, now });
  t.after(() => app.stop());
  lines.length = 0;

  down = true;
  for (let i = 0; i < 4; i += 1) {
    await tick(t, 30 * MINUTE);
  }
  const warnings = lines.filter((line) => line.includes('[WARN]'));
  assert.deepEqual(
    warnings.map((line) => line.replace(/^.*\[WARN\]\s*(\[[^\]]+\]\s*)?/, '')),
    [
      'SMHI Home: forecast unavailable (SMHI answered HTTP 503)',
      'SMHI warnings unavailable (SMHI answered HTTP 503)',
    ],
  );
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /does not answer/);
  assert.equal(gladys.fake.lastState(id('temperature')), 10.4, 'the forecast still covers now');

  down = false;
  await tick(t, 30 * MINUTE);
  await tick(t, 30 * MINUTE);
  const infos = lines.filter((line) => line.includes('[INFO]'));
  assert.equal(infos.length, 2, infos.join('\n'));
  assert.match(infos.join('\n'), /SMHI Home: the forecast is back/);
  assert.match(infos.join('\n'), /The SMHI warnings are back/);
  assert.deepEqual(gladys.fake.connectionStatus, { connected: true });
});

test('a normal cycle writes nothing at info level, and the coordinates never reach the logs', async (t) => {
  const { lines, now } = setup(t, { logLevel: 'debug' });
  const smhi = createFakeSmhi({ forecast: () => steadyForecast(Date.now()) });
  const { app } = await createWorld({
    smhi,
    timers: true,
    now,
    config: { latitude: '67,85581', longitude: '20,22531', place_name: 'Kiruna' },
  });
  t.after(() => app.stop());
  const startup = lines.length;
  await tick(t, 30 * MINUTE);
  await tick(t, 30 * MINUTE);
  const cycle = lines.slice(startup);
  assert.ok(cycle.length > 0, 'debug shows the cycle');
  assert.deepEqual(
    cycle.filter((line) => !line.includes('[DEBUG]')),
    [],
    'nothing above debug for a normal cycle',
  );
  for (const line of lines) {
    for (const secret of ['58.5778', '16.1585', '67.855', '67,855', '20.225', '20,225']) {
      assert.ok(!line.includes(secret), `a coordinate in the logs: ${line}`);
    }
  }
});

test('outside the forecast area: said in the status and in the check action', async (t) => {
  setup(t, { logLevel: 'silent' });
  const smhi = createFakeSmhi({ forecast: () => 404 });
  const { gladys, app } = await createWorld({
    smhi,
    houses: [{ ...HOUSE, name: 'Paris', latitude: 48.8566, longitude: 2.3522 }],
  });
  t.after(() => app.stop());
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /Hors de la zone de prévision/);
  const ack = await gladys.fake.action('check');
  assert.equal(ack.data.message.en, 'SMHI Paris: outside the SMHI forecast area.');
  assert.equal(ack.data.message.de, 'SMHI Paris: außerhalb des SMHI-Vorhersagegebiets.');
});

test('no place, or unreadable coordinates: the status says what to do', async (t) => {
  setup(t, { logLevel: 'silent' });
  const none = await createWorld({ houses: [], created: false });
  t.after(() => none.app.stop());
  assert.equal(none.gladys.fake.connectionStatus.connected, false);
  assert.match(none.gladys.fake.connectionStatus.message.en, /No location/);
  assert.match(
    (await none.gladys.fake.action('check')).data.message.es,
    /Ningún lugar que comprobar/,
  );

  const typo = await createWorld({
    houses: [],
    created: false,
    config: { latitude: '59.3293', longitude: '18°04′' },
  });
  t.after(() => typo.app.stop());
  assert.match(typo.gladys.fake.connectionStatus.message.en, /cannot be read/);
});

test('the check action reads every place, added or not, and reports it', async (t) => {
  setup(t, { logLevel: 'silent' });
  const smhi = createFakeSmhi();
  const { gladys, app } = await createWorld({ smhi, created: false });
  t.after(() => app.stop());
  const ack = await gladys.fake.action('check');
  assert.equal(ack.success, true);
  assert.equal(ack.data.message.en, 'SMHI Home: 10.4 °C, Overcast, Warning: Orange.');
  assert.equal(ack.data.message.fr, 'SMHI Home: 10.4 °C, Couvert, Avertissement: Orange.');
  assert.equal(gladys.fake.states.length, 0, 'no state for a device Gladys does not have');
  assert.equal(gladys.fake.sceneEvents.length, 0, 'no trigger either');
});

test('a new configuration re-publishes the devices and reads again', async (t) => {
  setup(t, { logLevel: 'silent' });
  const smhi = createFakeSmhi();
  const { gladys, app } = await createWorld({ smhi });
  t.after(() => app.stop());
  const calls = smhi.forecastCalls();
  await gladys.fake.configUpdated({ language: 'en', latitude: '57.7089', longitude: '11.9746' });
  const names = gladys.fake.discoveredDevices.map((device) => device.name);
  assert.deepEqual(names, ['SMHI Home', 'SMHI']);
  assert.equal(gladys.fake.discoveredDevices[0].features[0].name, 'Temperature');
  assert.equal(smhi.forecastCalls(), calls + 1, 'the added place only');
});
