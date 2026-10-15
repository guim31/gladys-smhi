// -----------------------------------------------------------------------------
// SMHI point forecast (snow1g, version 1): parsing and the views built on it.
//
// The answer is `{ createdTime, referenceTime, geometry, timeSeries }`, one
// entry per valid time: hourly for about two and a half days, then every 2,
// 6 and 12 hours up to ten days. Each entry carries a flat `data` object.
// The interval parameters (precipitation) cover
// `intervalParametersStartTime` → `time`. Missing values are sentinels: 9999
// on every parameter, -9 on `precipitation_frozen_part`.
// -----------------------------------------------------------------------------

const MISSING = new Set([9999, -9999]);

/** A number, or null when absent or a missing-value sentinel. */
function num(value) {
  return typeof value === 'number' && Number.isFinite(value) && !MISSING.has(value) ? value : null;
}

const round = (value, digits = 1) =>
  value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits;

/**
 * Feels-like temperature (Steadman, as used by the Australian Bureau of
 * Meteorology): air temperature, humidity and wind at 10 m. SMHI does not
 * publish one.
 * @returns {number | null} °C, one decimal
 */
export function apparentTemperature(temperature, humidity, windSpeed) {
  if (temperature === null || humidity === null || windSpeed === null) {
    return null;
  }
  const vapourPressure =
    (humidity / 100) * 6.105 * Math.exp((17.27 * temperature) / (237.7 + temperature));
  return round(temperature + 0.33 * vapourPressure - 0.7 * windSpeed - 4);
}

/**
 * @param {any} json body of the point forecast
 * @returns {{ createdAt: Date, steps: object[] }}
 * @throws when the body is not a forecast
 */
export function parseForecast(json) {
  if (!json || !Array.isArray(json.timeSeries) || json.timeSeries.length === 0) {
    throw new Error('the answer holds no forecast');
  }
  const steps = [];
  let previous = null;
  for (const entry of json.timeSeries) {
    const time = new Date(entry.time);
    const data = entry.data ?? {};
    if (Number.isNaN(time.getTime())) {
      continue;
    }
    const start = new Date(entry.intervalParametersStartTime ?? NaN);
    const hours = !Number.isNaN(start.getTime())
      ? (time - start) / 3_600_000
      : previous
        ? (time - previous) / 3_600_000
        : 1;
    const temperature = num(data.air_temperature);
    const humidity = num(data.relative_humidity);
    const windSpeed = num(data.wind_speed);
    const octas = num(data.cloud_area_fraction);
    const rate = num(data.precipitation_amount_mean);
    steps.push({
      time,
      hours: hours > 0 ? hours : 1,
      temperature,
      apparentTemperature: apparentTemperature(temperature, humidity, windSpeed),
      humidity,
      pressure: num(data.air_pressure_at_mean_sea_level),
      windSpeed,
      windGust: num(data.wind_speed_of_gust),
      windDirection: num(data.wind_from_direction),
      // Eighths of the sky (octas) → percent.
      cloudCover: octas === null ? null : Math.round((Math.min(Math.max(octas, 0), 8) * 100) / 8),
      // Mean intensity over the interval, mm/h.
      precipitation: rate === null ? null : Math.max(rate, 0),
      precipitationProbability: num(data.probability_of_precipitation),
      precipitationType: num(data.predominant_precipitation_type_at_surface),
      visibility: num(data.visibility_in_air),
      thunderProbability: num(data.thunderstorm_probability),
      symbol: num(data.symbol_code),
    });
    previous = time;
  }
  if (steps.length === 0) {
    throw new Error('the answer holds no forecast');
  }
  steps.sort((a, b) => a.time - b.time);
  const createdAt = new Date(json.createdTime ?? json.referenceTime ?? steps[0].time);
  return { createdAt: Number.isNaN(createdAt.getTime()) ? steps[0].time : createdAt, steps };
}

/**
 * The step describing "now": the first one whose interval reaches now (the
 * hour in progress), the first step when the forecast starts later.
 * @returns {object | null} null once the forecast is entirely in the past
 */
export function currentStep(forecast, now = new Date()) {
  const at = now.getTime();
  return forecast.steps.find((step) => step.time.getTime() >= at - 30 * 60_000) ?? null;
}

/** The hourly steps from the current one, at most `count`. */
export function hourlySteps(forecast, now = new Date(), count = 24) {
  const first = currentStep(forecast, now);
  if (!first) {
    return [];
  }
  const from = forecast.steps.indexOf(first);
  const until = first.time.getTime() + count * 3_600_000;
  return forecast.steps.slice(from).filter((step) => step.time.getTime() < until);
}

/** The calendar date of an instant in a time zone, 'YYYY-MM-DD'. */
export function localDate(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function localHour(date, timeZone) {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(date),
  );
}

const maxOf = (values) => {
  const known = values.filter((value) => value !== null);
  return known.length > 0 ? Math.max(...known) : null;
};
const minOf = (values) => {
  const known = values.filter((value) => value !== null);
  return known.length > 0 ? Math.min(...known) : null;
};

/**
 * One summary per local day, from today (the hours still to come) on.
 * @returns {{ date: string, temperatureMin, temperatureMax, precipitation, windSpeedMax,
 *   windGustMax, thunderProbabilityMax, symbol }[]}
 */
export function dailySummaries(forecast, now = new Date(), timeZone = undefined) {
  const first = currentStep(forecast, now);
  if (!first) {
    return [];
  }
  const days = new Map();
  for (const step of forecast.steps.slice(forecast.steps.indexOf(first))) {
    const date = localDate(step.time, timeZone);
    if (!days.has(date)) {
      days.set(date, []);
    }
    days.get(date).push(step);
  }
  return [...days].map(([date, steps]) => {
    // The weather of the day is the one of early afternoon (as pysmhi), or
    // of the last hours left when the afternoon is over.
    const midday = steps.find((step) => localHour(step.time, timeZone) >= 12) ?? steps.at(-1);
    const amounts = steps.map((step) =>
      step.precipitation === null ? null : step.precipitation * step.hours,
    );
    const known = amounts.filter((amount) => amount !== null);
    return {
      date,
      temperatureMin: minOf(steps.map((step) => step.temperature)),
      temperatureMax: maxOf(steps.map((step) => step.temperature)),
      precipitation: known.length > 0 ? round(known.reduce((sum, value) => sum + value, 0)) : null,
      windSpeedMax: maxOf(steps.map((step) => step.windSpeed)),
      windGustMax: maxOf(steps.map((step) => step.windGust)),
      thunderProbabilityMax: maxOf(steps.map((step) => step.thunderProbability)),
      symbol: midday.symbol,
    };
  });
}
