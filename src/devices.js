// -----------------------------------------------------------------------------
// The SMHI device of a place: its features, and the states computed from the
// forecast and the warnings.
//
// Feature keys are part of the external ids: never rename one. Every feature
// is read-only. The couples category/type are ones the Gladys front knows
// (test/gladys-rules.test.js); min/max are display bounds (gauges).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
  DEVICE_FEATURE_UNITS as U,
  DEVICE_POLL_FREQUENCIES,
} from '@gladysassistant/integration-sdk';
import {
  NAMES,
  PRECIPITATION_TYPES,
  SYMBOLS,
  TEXT,
  WARNING_LEVELS,
  dateTimeLabel,
  pick,
} from './i18n.js';
import { currentStep } from './smhi/forecast.js';

export const DEVICE_TYPE = 'place';

const sensor = (category, type, unit, min, max) => ({ category, type, unit, min, max });
const text = () => ({ category: C.TEXT, type: T.TEXT.TEXT, min: 0, max: 0, text: true });

// In display order. `value(step)` reads the current forecast step.
export const FEATURES = [
  {
    key: 'temperature',
    ...sensor(C.TEMPERATURE_SENSOR, T.SENSOR.DECIMAL, U.CELSIUS, -50, 40),
    value: (step) => step.temperature,
  },
  {
    key: 'apparent-temperature',
    ...sensor(C.TEMPERATURE_SENSOR, T.SENSOR.DECIMAL, U.CELSIUS, -60, 40),
    value: (step) => step.apparentTemperature,
  },
  {
    key: 'humidity',
    ...sensor(C.HUMIDITY_SENSOR, T.SENSOR.DECIMAL, U.PERCENT, 0, 100),
    value: (step) => step.humidity,
  },
  {
    key: 'pressure',
    ...sensor(C.PRESSURE_SENSOR, T.SENSOR.DECIMAL, U.HECTO_PASCAL, 950, 1050),
    value: (step) => step.pressure,
  },
  {
    key: 'wind-speed',
    ...sensor(C.SPEED_SENSOR, T.SENSOR.DECIMAL, U.METER_PER_SECOND, 0, 40),
    value: (step) => step.windSpeed,
  },
  {
    key: 'wind-gust',
    ...sensor(C.SPEED_SENSOR, T.SENSOR.DECIMAL, U.METER_PER_SECOND, 0, 50),
    value: (step) => step.windGust,
  },
  {
    key: 'wind-direction',
    ...sensor(C.ANGLE_SENSOR, T.SENSOR.INTEGER, U.DEGREE, 0, 360),
    value: (step) => step.windDirection,
  },
  {
    // No cloud category in Gladys: a percentage sensor, drawn with a drop.
    key: 'cloud-cover',
    ...sensor(C.LEVEL_SENSOR, T.LEVEL_SENSOR.LIQUID_LEVEL_PERCENT, U.PERCENT, 0, 100),
    value: (step) => step.cloudCover,
  },
  {
    key: 'precipitation',
    ...sensor(C.PRECIPITATION_SENSOR, T.SENSOR.DECIMAL, U.MILLIMETER_PER_HOUR, 0, 20),
    value: (step) => step.precipitation,
  },
  { key: 'precipitation-type', ...text() },
  {
    key: 'visibility',
    ...sensor(C.DISTANCE_SENSOR, T.SENSOR.DECIMAL, U.KM, 0, 50),
    value: (step) => step.visibility,
  },
  {
    key: 'thunder-probability',
    ...sensor(C.RISK, T.RISK.INTEGER, U.PERCENT, 0, 100),
    value: (step) => step.thunderProbability,
  },
  { key: 'weather', ...text() },
  // 0 none, 1 yellow, 2 orange, 3 red: a number scenes can compare.
  { key: 'warning-level', ...sensor(C.RISK, T.RISK.INTEGER, undefined, 0, 3) },
  { key: 'warning', ...text() },
];

/**
 * @param {object} gladys GladysIntegration
 * @param {{ platformId: string, name: string }} place
 * @param {string} language language of the feature names
 */
export function buildDevice(gladys, place, language) {
  const ids = gladys.externalIds(DEVICE_TYPE, place.platformId);
  const names = pick(NAMES, language);
  return {
    name: place.name,
    external_id: ids.device,
    // The container refreshes by itself (src/hub.js): Gladys may not poll a
    // device created without these fields (Gladys#3198). Once a minute is
    // the slowest pace Gladys schedules; onPoll skips what is fresh.
    should_poll: true,
    poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_MINUTES,
    features: FEATURES.map((feature) => {
      const published = {
        name: names[feature.key],
        external_id: ids.feature(feature.key),
        category: feature.category,
        type: feature.type,
        read_only: true,
        has_feedback: false,
        keep_history: !feature.text,
        min: feature.min,
        max: feature.max,
      };
      if (feature.unit) {
        published.unit = feature.unit;
      }
      return published;
    }),
  };
}

/** The current step with values, null when the forecast does not cover now. */
export function stepNow(forecast, now) {
  return forecast ? currentStep(forecast, now) : null;
}

/** The warning text of a place: "Orange: Wind (until Fri 3, 18:00); Yellow: Rain". */
export function warningText(areas, language, timeZone) {
  if (areas.length === 0) {
    return pick(WARNING_LEVELS, language)[0];
  }
  const levels = pick(WARNING_LEVELS, language);
  const sorted = [...areas].sort((a, b) => b.level - a.level);
  const parts = sorted.map((area, index) => {
    const end = index === 0 && area.end ? new Date(area.end) : null;
    const until =
      end && !Number.isNaN(end.getTime())
        ? ` (${pick(TEXT, language).until} ${dateTimeLabel(end, language, timeZone)})`
        : '';
    return `${levels[area.level]}: ${area.event}${until}`;
  });
  const joined = parts.join('; ');
  return joined.length > 250 ? `${joined.slice(0, 249)}…` : joined;
}

/**
 * The states of a place, in the publishChangedStates format.
 * @param {object} gladys
 * @param {{ platformId: string }} place
 * @param {{ forecast?: object, warnings?: object[] | null }} data warnings null: unknown
 * @param {{ language: string, now: Date, timeZone?: string }} options
 */
export function buildStates(gladys, place, data, { language, now, timeZone }) {
  const ids = gladys.externalIds(DEVICE_TYPE, place.platformId);
  const states = [];
  const step = stepNow(data.forecast, now);
  if (step) {
    for (const feature of FEATURES) {
      if (!feature.value) {
        continue;
      }
      const value = feature.value(step);
      if (value !== null && value !== undefined) {
        states.push({ device_feature_external_id: ids.feature(feature.key), state: value });
      }
    }
    if (step.symbol !== null && pick(SYMBOLS, language)[step.symbol]) {
      states.push({
        device_feature_external_id: ids.feature('weather'),
        text: pick(SYMBOLS, language)[step.symbol],
      });
    }
    // SMHI names a predominant type even when nothing falls: say "none" then.
    const type = step.precipitation > 0 ? step.precipitationType : 0;
    if (type !== null && pick(PRECIPITATION_TYPES, language)[type]) {
      states.push({
        device_feature_external_id: ids.feature('precipitation-type'),
        text: pick(PRECIPITATION_TYPES, language)[type],
      });
    }
  }
  if (Array.isArray(data.warnings)) {
    states.push({
      device_feature_external_id: ids.feature('warning-level'),
      state: data.warnings.reduce((max, area) => Math.max(max, area.level), 0),
    });
    states.push({
      device_feature_external_id: ids.feature('warning'),
      text: warningText(data.warnings, language, timeZone),
    });
  }
  return states;
}
