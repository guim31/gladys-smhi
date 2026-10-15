// -----------------------------------------------------------------------------
// The warnings of a place: its states, and the "new SMHI weather warning"
// scene trigger, fired once per warning and level, restarts included.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WARNINGS, createFakeSmhi, createWorld } from './helpers/world.js';

const withLevel = (code) => {
  const warnings = structuredClone(WARNINGS);
  warnings[0].warningAreas[0].warningLevel.code = code;
  return warnings;
};

test('a warning on the place: its level and its text, the scene trigger fired once', async () => {
  const smhi = createFakeSmhi();
  const { gladys, app, id, devices } = await createWorld({ smhi, config: { language: 'en' } });
  try {
    assert.equal(gladys.fake.lastState(id('warning-level')), 2);
    assert.equal(gladys.fake.lastState(id('warning')), 'Orange: Wind (until Fri 3, 08:00)');
    assert.deepEqual(gladys.fake.sceneEvents, [
      {
        key: 'warning_issued',
        data: {
          device: devices[0].external_id,
          level: 'orange',
          event: 'Wind',
          area: 'Coast of Östergötland',
          description: 'What happens: Wind gusts of 25-30 m/s.\nWhere: Along the coast.',
          starts_at: '2026-04-02T09:00:00.000Z',
          ends_at: '2026-04-03T06:00:00.000Z',
        },
      },
    ]);

    // Read again: the same warning is not announced twice.
    await gladys.fake.action('check');
    await gladys.fake.poll(devices[0]);
    await app.hub.refresh({ force: true });
    assert.equal(gladys.fake.sceneEvents.length, 1);
  } finally {
    app.stop();
  }
});

test('a restart does not announce a warning in progress again (/data)', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'gladys-smhi-'));
  const first = await createWorld({ dataDir });
  first.app.stop();
  assert.equal(first.gladys.fake.sceneEvents.length, 1);

  const second = await createWorld({ dataDir });
  try {
    assert.equal(second.gladys.fake.sceneEvents.length, 0);
    assert.equal(second.gladys.fake.lastState(second.id('warning-level')), 2, 'the state is sent');
  } finally {
    second.app.stop();
  }
});

test('a higher level is announced again; an ended warning goes back to 0', async () => {
  let warnings = withLevel('YELLOW');
  const smhi = createFakeSmhi({ warnings: () => warnings });
  const { gladys, app, id } = await createWorld({ smhi });
  try {
    assert.deepEqual(
      gladys.fake.sceneEvents.map((event) => event.data.level),
      ['yellow'],
    );
    assert.equal(gladys.fake.lastState(id('warning')), "Jaune: Wind (jusqu'à ven. 3 08:00)");

    warnings = withLevel('ORANGE');
    await app.hub.refresh({ force: true });
    assert.deepEqual(
      gladys.fake.sceneEvents.map((event) => event.data.level),
      ['yellow', 'orange'],
    );
    assert.equal(gladys.fake.lastState(id('warning-level')), 2);

    warnings = [];
    await app.hub.refresh({ force: true });
    assert.equal(gladys.fake.lastState(id('warning-level')), 0);
    assert.equal(gladys.fake.lastState(id('warning')), 'Aucun avertissement');
    assert.equal(gladys.fake.sceneEvents.length, 2);
  } finally {
    app.stop();
  }
});

test('the county option adds the warnings touching the county', async () => {
  const { gladys, app, id } = await createWorld({
    config: { warning_county: '5', language: 'de' },
  });
  try {
    assert.deepEqual(
      gladys.fake.sceneEvents.map((event) => [event.data.level, event.data.event]),
      [
        ['orange', 'Wind'],
        ['yellow', 'Rain'],
      ],
    );
    assert.equal(
      gladys.fake.lastState(id('warning')),
      'Orange: Wind (bis Fr., 3., 08:00); Gelb: Rain',
    );
  } finally {
    app.stop();
  }
});

test('warnings unavailable: the forecast states still go out, the warning ones wait', async () => {
  const smhi = createFakeSmhi({ warnings: () => 500 });
  const { gladys, app, id } = await createWorld({ smhi });
  try {
    assert.equal(gladys.fake.lastState(id('temperature')), 10.4);
    assert.equal(gladys.fake.lastState(id('warning-level')), undefined);
    assert.equal(gladys.fake.sceneEvents.length, 0);
    assert.deepEqual(gladys.fake.connectionStatus, { connected: true });
  } finally {
    app.stop();
  }
});
