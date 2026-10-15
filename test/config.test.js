import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig, parseCoordinate } from '../src/config.js';
import { resolvePlaces } from '../src/places.js';

test('coordinates typed by hand: comma, spaces, sign, range', () => {
  assert.equal(parseCoordinate('59,3293', 90), 59.3293);
  assert.equal(parseCoordinate(' 18.0686 ', 180), 18.0686);
  assert.equal(parseCoordinate('-1.145', 180), -1.145);
  assert.equal(parseCoordinate('91', 90), null);
  assert.equal(parseCoordinate('59°19′', 90), null);
  assert.equal(parseCoordinate('', 90), null);
  assert.equal(parseCoordinate(undefined, 90), null);
});

test('the defaults, and what a form sends', () => {
  assert.deepEqual(normalizeConfig(), {
    use_houses: true,
    latitude: null,
    longitude: null,
    coordinatesInvalid: false,
    place_name: '',
    warning_county: 'auto',
    refresh_minutes: 30,
    language: 'fr',
  });
  const config = normalizeConfig({
    use_houses: 'false',
    latitude: '67,8558',
    longitude: '20.2253',
    place_name: ' Kiruna ',
    warning_county: '25',
    refresh_minutes: '60',
    language: 'de',
  });
  assert.equal(config.use_houses, false);
  assert.equal(config.latitude, 67.8558);
  assert.equal(config.place_name, 'Kiruna');
  assert.equal(config.warning_county, '25');
  assert.equal(config.refresh_minutes, 60);
  assert.equal(config.language, 'de');
  // Unknown values fall back to the defaults.
  const odd = normalizeConfig({ warning_county: '99', refresh_minutes: '1', language: 'it' });
  assert.equal(odd.warning_county, 'auto');
  assert.equal(odd.refresh_minutes, 30);
  assert.equal(odd.language, DEFAULT_CONFIG.language);
  // Typed but unreadable: flagged.
  assert.equal(normalizeConfig({ latitude: '59.3', longitude: 'east' }).coordinatesInvalid, true);
  assert.equal(normalizeConfig({ latitude: '59.3' }).coordinatesInvalid, true);
});

test('one place per located house, plus the typed coordinates', () => {
  const houses = [
    { name: 'Home', selector: 'home', latitude: 59.33, longitude: 18.07 },
    { name: 'Nowhere', selector: 'nowhere', latitude: null, longitude: null },
  ];
  assert.deepEqual(
    resolvePlaces(normalizeConfig({ latitude: '60.1282', longitude: '-1.145' }), houses),
    [
      { platformId: 'house-home', name: 'SMHI Home', latitude: 59.33, longitude: 18.07 },
      { platformId: 'point-601282_m11450', name: 'SMHI', latitude: 60.1282, longitude: -1.145 },
    ],
  );
  assert.deepEqual(
    resolvePlaces(normalizeConfig({ use_houses: false }), houses),
    [],
    'houses turned off, no coordinates',
  );
  // Renaming a house keeps its id (the selector).
  assert.equal(
    resolvePlaces(normalizeConfig(), [{ ...houses[0], name: 'Villa' }])[0].platformId,
    'house-home',
  );
});
