// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers — these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { COUNTIES, DEFAULT_CONFIG, LANGUAGES, REFRESH_MINUTES } from '../src/config.js';
import { TRIGGER_KEY, WIDGET_KEY } from '../src/hub.js';
import { DAYS } from '../src/scenes.js';
import { LEVEL_KEYS } from '../src/smhi/warnings.js';
import { createWorld } from './helpers/world.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

// Every list of form fields the manifest can declare (same field grammar).
const allFields = [
  ...(manifest.config_schema ?? []),
  ...[
    ...(manifest.actions ?? []),
    ...(manifest.scene_triggers ?? []),
    ...(manifest.scene_actions ?? []),
  ].flatMap((item) => item.fields ?? []),
  ...(manifest.widgets ?? []).flatMap((widget) => widget.settings ?? []),
];

const keysOf = (list) => (list ?? []).map((entry) => entry.key);
const field = (key) => manifest.config_schema.find((f) => f.key === key);
const values = (f) => f.options.map((option) => option.value);

function minGladysVersion() {
  const match = manifest.gladys_version.match(/>=\s*(\d+)\.(\d+)\.(\d+)/);
  assert.ok(match, 'gladys_version must declare a minimum version');
  return match.slice(1).map(Number);
}

function isAtLeast(version, required) {
  for (let i = 0; i < required.length; i += 1) {
    if (version[i] !== required[i]) {
      return version[i] > required[i];
    }
  }
  return true;
}

test('the identity of the integration', () => {
  assert.equal(manifest.name, 'SMHI');
  assert.equal(manifest.type, 'device');
  assert.deepEqual(manifest.transports, ['cloud']);
  assert.deepEqual(manifest.categories, ['environment']);
  // getHouses() answers 403 without it.
  assert.equal(manifest.location, true);
  assert.equal(manifest.docker_image, `ghcr.io/guim31/gladys-smhi:${manifest.version}`);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/guim31/gladys-smhi/main/cover.png',
  );
});

test('widgets, scene triggers and scene actions require Gladys >= 5.1.0', () => {
  assert.ok(isAtLeast(minGladysVersion(), [5, 1, 0]), manifest.gladys_version);
  // No widget button opening a form (5.2.0), no `houses` source (5.2.0).
  assert.ok(!allFields.some((f) => f.source === 'houses'));
});

test('every manifest action, scene action and widget has its handler', async () => {
  const { gladys, app, devices } = await createWorld();
  try {
    assert.deepEqual(keysOf(manifest.actions), ['check']);
    assert.equal((await gladys.fake.action('check')).success, true);

    assert.deepEqual(keysOf(manifest.scene_actions), ['get_forecast']);
    const ack = await gladys.fake.sceneAction('get_forecast', {
      device: devices[0].external_id,
      day: 'today',
    });
    assert.deepEqual(
      Object.keys(ack.data.outputs).sort(),
      keysOf(manifest.scene_actions[0].outputs).sort(),
      'the outputs are the declared ones',
    );

    assert.deepEqual(keysOf(manifest.widgets), [WIDGET_KEY]);
    assert.equal((await gladys.fake.widgetGet(WIDGET_KEY)).success, true);
  } finally {
    app.stop();
  }
});

test('the scene trigger the code fires is the declared one, with the declared data', async () => {
  const { gladys, app } = await createWorld();
  try {
    assert.deepEqual(keysOf(manifest.scene_triggers), [TRIGGER_KEY]);
    const [event] = gladys.fake.sceneEvents;
    assert.equal(event.key, TRIGGER_KEY);
    const trigger = manifest.scene_triggers[0];
    const declared = [...keysOf(trigger.fields), ...keysOf(trigger.variables)];
    assert.deepEqual(Object.keys(event.data).sort(), [...new Set(declared)].sort());
    assert.deepEqual(values(trigger.fields[1]), Object.values(LEVEL_KEYS));
  } finally {
    app.stop();
  }
});

test('config_schema defaults and options stay consistent with the code', () => {
  for (const f of manifest.config_schema) {
    if (f.default !== undefined) {
      assert.equal(DEFAULT_CONFIG[f.key], f.default, `DEFAULT_CONFIG.${f.key}`);
    }
  }
  const stored = manifest.config_schema.filter((f) => f.type !== 'section').map((f) => f.key);
  assert.deepEqual(stored.sort(), Object.keys(DEFAULT_CONFIG).sort());
  assert.deepEqual(values(field('warning_county')), ['auto', ...Object.keys(COUNTIES)]);
  assert.deepEqual(values(field('refresh_minutes')), REFRESH_MINUTES);
  assert.deepEqual(values(field('language')), LANGUAGES);
  assert.deepEqual(values(manifest.scene_actions[0].fields[1]), DAYS);
});

test('section fields are purely presentational', () => {
  const sections = manifest.config_schema.filter((f) => f.type === 'section');
  assert.equal(sections.length, 1);
  for (const section of sections) {
    assert.equal(section.required, undefined);
    assert.equal(section.default, undefined);
    assert.equal(section.placeholder, undefined);
    assert.ok(!(section.key in DEFAULT_CONFIG));
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//, 'section links must be https');
    }
  }
});

test('dynamic selects declare the devices source and no static options', () => {
  const dynamicSelects = allFields.filter((f) => f.source !== undefined);
  assert.equal(dynamicSelects.length, 3, 'trigger, scene action, widget');
  for (const f of dynamicSelects) {
    assert.equal(f.source, 'devices');
    assert.equal(f.options, undefined);
    assert.equal(f.default, undefined, 'no default with a source');
  }
});

test('no secret field: the integration needs no account', () => {
  assert.ok(!allFields.some((f) => f.type === 'secret'));
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version, 'manifest version must match package.json');
  assert.ok(manifest.docker_image.endsWith(`:${manifest.version}`));
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(
      text.length >= 10 && text.length <= 100,
      `description.${lang} has ${text.length} characters (10 to 100 allowed)`,
    );
  }
});

test('field placeholders are multi-language objects', () => {
  const withPlaceholder = allFields.filter((f) => f.placeholder !== undefined);
  assert.ok(withPlaceholder.length > 0);
  for (const f of withPlaceholder) {
    assert.equal(typeof f.placeholder, 'object', `field "${f.key}": placeholder`);
    assert.ok(f.placeholder.en);
  }
});
