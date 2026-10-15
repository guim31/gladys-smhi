// -----------------------------------------------------------------------------
// The "SMHI forecast" dashboard widget: the place, the current weather, the
// next 24 hours and the coming days, with the warnings in progress.
//
// Budget of the core (8 components, 2 texts, 6 tiles, 1 focal, 1 status):
// 2 texts + 3 tiles + 1 chart + 1 status. The content is cached by the core
// per settings, language and units: it is localized here.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { dailySummaries, hourlySteps } from './smhi/forecast.js';
import { stepNow } from './devices.js';
import {
  NAMES,
  SYMBOLS,
  TEXT,
  WARNING_LEVELS,
  dayLabel,
  pick,
  symbolIcon,
  timeLabel,
} from './i18n.js';

const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
const round1 = (value) => Math.round(value * 10) / 10;

/** Values in the unit system of the user ('metric' or 'us'). */
export function unitsFor(units) {
  const us = units === 'us';
  return {
    temperature: (c) => (us ? round1((c * 9) / 5 + 32) : round1(c)),
    temperatureUnit: us ? '°F' : '°C',
    speed: (ms) => (us ? round1(ms * 2.236936) : round1(ms)),
    speedUnit: us ? 'mph' : 'm/s',
    amount: (mm) => (us ? Math.round((mm / 25.4) * 100) / 100 : round1(mm)),
    amountUnit: us ? 'in' : 'mm',
  };
}

const LEVEL_COLORS = {
  1: WIDGET_COLORS.WARNING,
  2: WIDGET_COLORS.WARNING,
  3: WIDGET_COLORS.DANGER,
};

/**
 * @param {object} options
 * @param {{ name: string } | null} options.place
 * @param {object | null} options.forecast
 * @param {object[] | null} options.warnings
 * @param {Date} options.now
 * @param {number} [options.fetchedAt]
 * @param {string} options.language
 * @param {string} options.units
 * @param {string} [options.timeZone]
 */
export function buildForecastContent({
  place,
  forecast,
  warnings,
  now,
  fetchedAt,
  language,
  units,
  timeZone,
}) {
  const text = pick(TEXT, language);
  if (!place) {
    return {
      ttl_seconds: 300,
      components: [{ type: 'text', variant: 'body', text: text.noDevice }],
    };
  }
  const heading = { type: 'text', variant: 'heading', text: truncate(place.name, 40) };
  const step = stepNow(forecast, now);
  if (!step) {
    return {
      ttl_seconds: 300,
      components: [heading, { type: 'text', variant: 'body', text: text.noData }],
    };
  }
  const u = unitsFor(units);
  const names = pick(NAMES, language);
  const symbols = pick(SYMBOLS, language);
  const components = [heading];

  const condition = symbols[step.symbol] ?? '';
  const updated = fetchedAt
    ? `${text.updated} ${timeLabel(new Date(fetchedAt), language, timeZone)}`
    : '';
  components.push({
    type: 'text',
    variant: 'caption',
    text: truncate([condition, updated].filter(Boolean).join(' · '), 80),
  });

  if (step.temperature !== null) {
    components.push({
      type: 'value',
      value: u.temperature(step.temperature),
      unit: u.temperatureUnit,
      label: truncate(names.temperature, 24),
      icon: 'thermometer',
    });
  }
  if (step.apparentTemperature !== null) {
    components.push({
      type: 'value',
      value: u.temperature(step.apparentTemperature),
      unit: u.temperatureUnit,
      label: truncate(text.feelsLike, 24),
      icon: 'user',
    });
  }
  if (step.windSpeed !== null) {
    components.push({
      type: 'value',
      value: u.speed(step.windSpeed),
      unit: u.speedUnit,
      label: truncate(text.wind, 24),
      icon: 'wind',
    });
  }

  const points = hourlySteps(forecast, now, 24)
    .filter((hour) => hour.temperature !== null)
    .map((hour) => ({ t: hour.time.toISOString(), v: u.temperature(hour.temperature) }));
  if (points.length >= 2) {
    components.push({
      type: 'chart',
      chart_type: 'line',
      title: text.next24h,
      unit: u.temperatureUnit,
      series: [{ name: names.temperature, points }],
    });
  }

  const items = [];
  const levels = pick(WARNING_LEVELS, language);
  for (const area of [...(warnings ?? [])].sort((a, b) => b.level - a.level).slice(0, 2)) {
    items.push({
      label: truncate(`${text.warning} · ${levels[area.level]}`, 40),
      value: truncate(area.event, 40),
      icon: 'alert-triangle',
      color: LEVEL_COLORS[area.level],
    });
  }
  for (const day of dailySummaries(forecast, now, timeZone).slice(0, 6)) {
    if (day.temperatureMin === null || day.temperatureMax === null) {
      continue;
    }
    const precipitation =
      day.precipitation > 0 ? ` · ${u.amount(day.precipitation)} ${u.amountUnit}` : '';
    items.push({
      label: truncate(`${dayLabel(day.date, language)} · ${symbols[day.symbol] ?? ''}`, 40),
      value: truncate(
        `${Math.round(u.temperature(day.temperatureMin))}° / ${Math.round(u.temperature(day.temperatureMax))}°${precipitation}`,
        40,
      ),
      icon: symbolIcon(day.symbol),
    });
  }
  if (items.length > 0) {
    components.push({ type: 'status', items });
  }
  return { ttl_seconds: 900, components };
}

/**
 * @param {import('./hub.js').SmhiHub} hub
 */
export function createWidgets(hub) {
  return {
    forecast: {
      async get({ settings = {}, language = 'en', units = 'metric' }) {
        const created = hub.createdPlaces();
        const place =
          (settings.device && created.find((p) => hub.deviceId(p) === settings.device)) ??
          created[0] ??
          null;
        return buildForecastContent({
          place,
          forecast: place ? hub.forecastOf(place) : null,
          warnings: place ? hub.warningsOf(place) : null,
          fetchedAt: place ? hub.data.get(place.platformId)?.fetchedAt : undefined,
          now: new Date(hub.now()),
          language,
          units,
          timeZone: hub.timeZone,
        });
      },
    },
  };
}
