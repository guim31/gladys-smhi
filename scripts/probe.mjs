#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Read-only probe of the real SMHI API, through the integration's own client.
//
//   node scripts/probe.mjs <latitude> <longitude>
//   node scripts/probe.mjs 59.3293 18.0686
//
// Checks what the tests can only assume from published fixtures: the shape of
// the snow1g answer, the units, the missing values, the coverage of the model
// (its polygon, and the answer outside it), and the shape of the warnings
// (levels, GeoJSON areas, county ids). Prints counts and shapes, never the
// warning texts in full; the coordinates are shown rounded to 0.1°.
// -----------------------------------------------------------------------------

import { FORECAST_URL, WARNINGS_URL, fetchForecast, forecastUrl } from '../src/smhi/client.js';
import { currentStep, dailySummaries } from '../src/smhi/forecast.js';
import { parseWarnings, warningsFor } from '../src/smhi/warnings.js';
import { parseCoordinate } from '../src/config.js';

const latitude = parseCoordinate(process.argv[2] ?? '59.3293', 90);
const longitude = parseCoordinate(process.argv[3] ?? '18.0686', 180);
if (latitude === null || longitude === null) {
  console.error('Usage: node scripts/probe.mjs <latitude> <longitude> (decimal degrees)');
  process.exit(2);
}

const EXPECTED = [
  'air_temperature',
  'relative_humidity',
  'air_pressure_at_mean_sea_level',
  'wind_speed',
  'wind_speed_of_gust',
  'wind_from_direction',
  'cloud_area_fraction',
  'precipitation_amount_mean',
  'predominant_precipitation_type_at_surface',
  'visibility_in_air',
  'thunderstorm_probability',
  'symbol_code',
];

const get = async (url) => {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  return { status: response.status, json: response.ok ? await response.json() : null };
};
const section = (title) => console.log(`\n== ${title}`);
const round1 = (value) => Math.round(value * 10) / 10;

section(`Forecast near ${round1(latitude)}, ${round1(longitude)}`);
const raw = await get(forecastUrl(latitude, longitude));
console.log(`HTTP ${raw.status}`);
if (raw.json) {
  const series = raw.json.timeSeries ?? [];
  console.log('top-level keys:', Object.keys(raw.json).join(', '));
  console.log('createdTime:', raw.json.createdTime, 'referenceTime:', raw.json.referenceTime);
  console.log('steps:', series.length, 'from', series[0]?.time, 'to', series.at(-1)?.time);
  const gaps = {};
  for (let i = 1; i < series.length; i += 1) {
    const hours = (Date.parse(series[i].time) - Date.parse(series[i - 1].time)) / 3_600_000;
    gaps[hours] = (gaps[hours] ?? 0) + 1;
  }
  console.log('step lengths (hours: count):', JSON.stringify(gaps));
  const keys = new Set(series.flatMap((step) => Object.keys(step.data ?? {})));
  console.log('parameters:', [...keys].sort().join(', '));
  console.log(
    'missing expected parameters:',
    EXPECTED.filter((key) => !keys.has(key)).join(', ') || 'none',
  );
  const sentinels = {};
  for (const step of series) {
    for (const [key, value] of Object.entries(step.data ?? {})) {
      if (value === 9999 || value === -9 || value === null) {
        sentinels[`${key}=${value}`] = (sentinels[`${key}=${value}`] ?? 0) + 1;
      }
    }
  }
  console.log('sentinel values:', JSON.stringify(sentinels));
  const ranges = {};
  for (const key of EXPECTED) {
    const values = series
      .map((step) => step.data?.[key])
      .filter((v) => typeof v === 'number' && v !== 9999);
    ranges[key] = values.length ? [Math.min(...values), Math.max(...values)] : null;
  }
  console.log('ranges (check the units: octas 0-8, mm/h, km, %):', JSON.stringify(ranges));
  console.log(
    'intervalParametersStartTime present:',
    series.every((s) => s.intervalParametersStartTime),
  );

  const forecast = await fetchForecast(latitude, longitude);
  const now = currentStep(forecast, new Date());
  console.log('current step through the client:', JSON.stringify({ ...now, time: now?.time }));
  console.log('days:', dailySummaries(forecast, new Date()).length);
}

section('Coverage of the model');
const polygon = await get(FORECAST_URL.replace('/geotype/point', '/geotype/polygon.json'));
console.log(`HTTP ${polygon.status}`);
if (polygon.json) {
  const points = JSON.stringify(polygon.json).match(/-?\d+\.?\d*,\s*-?\d+\.?\d*/g) ?? [];
  const pairs = points.map((text) => text.split(',').map(Number));
  const lons = pairs.map(([lon]) => lon);
  const lats = pairs.map(([, lat]) => lat);
  console.log('type:', polygon.json.type, 'positions:', pairs.length);
  console.log(
    'bounding box: lon',
    Math.min(...lons),
    'to',
    Math.max(...lons),
    '/ lat',
    Math.min(...lats),
    'to',
    Math.max(...lats),
  );
}
for (const [name, lat, lon] of [
  ['Paris', 48.8566, 2.3522],
  ['Reykjavik', 64.1466, -21.9426],
  ['Tromsø', 69.6492, 18.9553],
  ['Vilnius', 54.6872, 25.2797],
]) {
  const answer = await get(forecastUrl(lat, lon));
  console.log(`${name}: HTTP ${answer.status}`);
}

section('Warnings');
const warnings = await get(WARNINGS_URL);
console.log(`HTTP ${warnings.status}`);
if (warnings.json) {
  const list = warnings.json;
  console.log('warnings:', Array.isArray(list) ? list.length : typeof list);
  const areas = (Array.isArray(list) ? list : []).flatMap((w) => w.warningAreas ?? []);
  console.log('warning areas:', areas.length);
  const codes = {};
  const geometry = {};
  for (const area of areas) {
    codes[area.warningLevel?.code] = (codes[area.warningLevel?.code] ?? 0) + 1;
    const type = area.area?.type ?? 'none';
    geometry[type] = (geometry[type] ?? 0) + 1;
  }
  console.log('level codes:', JSON.stringify(codes));
  console.log('area geometry types:', JSON.stringify(geometry));
  if (list[0]) {
    console.log('warning keys:', Object.keys(list[0]).join(', '));
    console.log('event:', JSON.stringify(list[0].event));
  }
  if (areas[0]) {
    console.log('warning area keys:', Object.keys(areas[0]).join(', '));
    console.log('affected area sample:', JSON.stringify(areas[0].affectedAreas?.slice(0, 3)));
  }
  const parsed = parseWarnings(list);
  console.log('kept by the integration:', parsed.length);
  console.log(
    'for this place:',
    warningsFor(parsed, { latitude, longitude }).map((a) => `${a.level} ${a.event}`),
  );
}
