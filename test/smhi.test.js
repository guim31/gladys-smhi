// -----------------------------------------------------------------------------
// The SMHI parsers, on a real snow1g answer (pysmhi / Home Assistant fixture)
// and on warnings shaped like the IBWW API.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORECAST, FORECAST_SHORT, NOW, WARNINGS } from './helpers/world.js';
import {
  apparentTemperature,
  currentStep,
  dailySummaries,
  hourlySteps,
  parseForecast,
} from '../src/smhi/forecast.js';
import { containsPoint, highestLevel, parseWarnings, warningsFor } from '../src/smhi/warnings.js';
import { SmhiError, fetchForecast, fetchWarnings, forecastUrl } from '../src/smhi/client.js';

const TZ = 'Europe/Stockholm';

test('the forecast is read step by step, sentinels as missing values', () => {
  const forecast = parseForecast(FORECAST);
  assert.equal(forecast.steps.length, 83);
  assert.equal(forecast.createdAt.toISOString(), '2026-04-02T11:01:32.000Z');
  const first = forecast.steps[0];
  assert.deepEqual(
    {
      temperature: first.temperature,
      humidity: first.humidity,
      pressure: first.pressure,
      windSpeed: first.windSpeed,
      windGust: first.windGust,
      windDirection: first.windDirection,
      cloudCover: first.cloudCover,
      precipitation: first.precipitation,
      precipitationType: first.precipitationType,
      visibility: first.visibility,
      thunderProbability: first.thunderProbability,
      symbol: first.symbol,
      hours: first.hours,
    },
    {
      temperature: 10.4,
      humidity: 80,
      pressure: 1011.5,
      windSpeed: 3.4,
      windGust: 6.8,
      windDirection: 255,
      cloudCover: 100, // 8 octas
      precipitation: 0,
      precipitationType: 1,
      visibility: 17.9,
      thunderProbability: 0,
      symbol: 6,
      hours: 1,
    },
  );
  // The 12-hour steps at the end cover 12 hours of precipitation.
  assert.equal(forecast.steps.at(-1).hours, 12);
});

test('a missing value (9999) is null, never published as a number', () => {
  const json = structuredClone(FORECAST_SHORT);
  json.timeSeries[0].data.air_temperature = 9999;
  json.timeSeries[0].data.visibility_in_air = 9999;
  delete json.timeSeries[0].data.thunderstorm_probability;
  const [step] = parseForecast(json).steps;
  assert.equal(step.temperature, null);
  assert.equal(step.visibility, null);
  assert.equal(step.thunderProbability, null);
  assert.equal(step.apparentTemperature, null);
  assert.equal(step.humidity, 80);
});

test('an answer without time series is refused', () => {
  assert.throws(() => parseForecast({}), /no forecast/);
  assert.throws(() => parseForecast({ timeSeries: [] }), /no forecast/);
  assert.throws(() => parseForecast(null), /no forecast/);
});

test('the feels-like temperature follows the Steadman formula', () => {
  // 10.4 °C, 80 %, 3.4 m/s: e = 0.8 × 6.105 × exp(17.27 × 10.4 / 248.1) = 10.12 hPa
  assert.equal(apparentTemperature(10.4, 80, 3.4), 7.3);
  // Calm and humid summer day: warmer than the air.
  assert.equal(apparentTemperature(28, 70, 0), 32.7);
  // Windy winter: much colder.
  assert.equal(apparentTemperature(-5, 85, 10), -14.8);
  assert.equal(apparentTemperature(null, 80, 3), null);
});

test('"now" is the step of the hour in progress, null past the forecast', () => {
  const forecast = parseForecast(FORECAST);
  assert.equal(currentStep(forecast, new Date(NOW)).time.toISOString(), '2026-04-02T11:00:00.000Z');
  assert.equal(
    currentStep(forecast, new Date('2026-04-02T11:40:00Z')).time.toISOString(),
    '2026-04-02T12:00:00.000Z',
  );
  // Before the first step: the first one.
  assert.equal(
    currentStep(forecast, new Date('2026-04-01T00:00:00Z')).time.toISOString(),
    '2026-04-02T11:00:00.000Z',
  );
  assert.equal(currentStep(forecast, new Date('2026-04-20T00:00:00Z')), null);
});

test('the next 24 hours', () => {
  const hours = hourlySteps(parseForecast(FORECAST), new Date(NOW), 24);
  assert.equal(hours.length, 24);
  assert.equal(hours[0].time.toISOString(), '2026-04-02T11:00:00.000Z');
  assert.equal(hours.at(-1).time.toISOString(), '2026-04-03T10:00:00.000Z');
});

test('one summary per day of the Gladys time zone', () => {
  const days = dailySummaries(parseForecast(FORECAST), new Date(NOW), TZ);
  assert.deepEqual(
    days.map((day) => day.date),
    [
      '2026-04-02',
      '2026-04-03',
      '2026-04-04',
      '2026-04-05',
      '2026-04-06',
      '2026-04-07',
      '2026-04-08',
      '2026-04-09',
      '2026-04-10',
      '2026-04-11',
      '2026-04-12',
    ],
  );
  const [today, tomorrow] = days;
  assert.equal(today.temperatureMax, 10.4);
  assert.ok(today.temperatureMin < today.temperatureMax);
  // Tomorrow: a rainy day of the fixture.
  assert.equal(tomorrow.temperatureMin, 1.9);
  assert.equal(tomorrow.temperatureMax, 5.9);
  assert.equal(tomorrow.precipitation, 4.1);
  assert.equal(tomorrow.symbol, 18);
  for (const day of days) {
    assert.ok(day.precipitation >= 0, `${day.date}: precipitation`);
  }
});

test('warnings: the three levels are kept, a plain message is not', () => {
  const areas = parseWarnings(WARNINGS);
  assert.deepEqual(
    areas.map((area) => [area.key, area.level, area.event]),
    [
      ['9101/91011', 2, 'Wind'],
      ['9102/91021', 1, 'Rain'],
    ],
  );
  assert.equal(
    areas[0].description,
    'What happens: Wind gusts of 25-30 m/s.\nWhere: Along the coast.',
  );
  assert.deepEqual(areas[1].counties, ['14', '5']);
  assert.deepEqual(parseWarnings([]), []);
  assert.throws(() => parseWarnings({ message: 'error' }), /not a list/);
});

test('a place is concerned by the warnings whose outline contains it', () => {
  const areas = parseWarnings(WARNINGS);
  const norrkoping = { latitude: 58.5878, longitude: 16.1924 };
  const gothenburg = { latitude: 57.7089, longitude: 11.9746 };
  const kiruna = { latitude: 67.8558, longitude: 20.2253 };
  assert.deepEqual(
    warningsFor(areas, norrkoping).map((area) => area.event),
    ['Wind'],
  );
  assert.deepEqual(
    warningsFor(areas, gothenburg).map((area) => area.event),
    ['Rain'],
  );
  assert.deepEqual(warningsFor(areas, kiruna), []);
  // The county option adds every warning touching the county.
  assert.deepEqual(
    warningsFor(areas, norrkoping, '5').map((area) => area.event),
    ['Wind', 'Rain'],
  );
  assert.deepEqual(warningsFor(areas, kiruna, '25'), []);
  assert.equal(highestLevel(warningsFor(areas, norrkoping, '5')), 2);
  assert.equal(highestLevel([]), 0);
});

test('point in polygon: holes, multipolygons, unknown geometries', () => {
  const square = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 0],
  ];
  const hole = [
    [4, 4],
    [6, 4],
    [6, 6],
    [4, 6],
    [4, 4],
  ];
  const polygon = { type: 'Polygon', coordinates: [square, hole] };
  assert.equal(containsPoint(polygon, 2, 2), true);
  assert.equal(containsPoint(polygon, 5, 5), false, 'inside the hole');
  assert.equal(containsPoint(polygon, 20, 2), false);
  const multi = {
    type: 'MultiPolygon',
    coordinates: [[square], [hole.map(([x, y]) => [x + 20, y])]],
  };
  assert.equal(containsPoint(multi, 5, 25), true);
  assert.equal(
    containsPoint({ type: 'Feature', geometry: { type: 'Point', coordinates: [1, 1] } }, 1, 1),
    null,
  );
  assert.equal(containsPoint(null, 1, 1), null);
  assert.equal(containsPoint({ type: 'FeatureCollection', features: [] }, 1, 1), null);
});

test('the client asks for six decimals at most, and tells an area error from an outage', async () => {
  assert.equal(
    forecastUrl(59.329323456, 18.068581234),
    'https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/18.068581/lat/59.329323/data.json',
  );
  const answer = (status, body) => async () => ({
    ok: status === 200,
    status,
    json: async () => body,
  });

  const forecast = await fetchForecast(58.58, 16.16, { fetch: answer(200, FORECAST) });
  assert.equal(forecast.steps.length, 83);

  await assert.rejects(fetchForecast(48.85, 2.35, { fetch: answer(404) }), (err) => {
    assert.ok(err instanceof SmhiError);
    assert.equal(err.outOfArea, true);
    return true;
  });
  await assert.rejects(fetchForecast(58.58, 16.16, { fetch: answer(503) }), (err) => {
    assert.equal(err.outOfArea, false);
    assert.match(err.message, /HTTP 503/);
    return true;
  });
  await assert.rejects(
    fetchForecast(58.58, 16.16, {
      fetch: async () => {
        throw new TypeError('fetch failed');
      },
    }),
    (err) => {
      assert.match(err.message, /SMHI unreachable \(fetch failed\)/);
      assert.doesNotMatch(err.message, /58\.58|16\.16/, 'the coordinates stay out of the message');
      return true;
    },
  );
  assert.equal((await fetchWarnings({ fetch: answer(200, WARNINGS) })).length, 2);
  await assert.rejects(fetchWarnings({ fetch: answer(200, { oops: true }) }), /not a list/);
});
