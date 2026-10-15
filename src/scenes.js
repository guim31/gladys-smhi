// -----------------------------------------------------------------------------
// Scene action "Read the SMHI forecast": the summary of today, tomorrow or the
// day after for one place, as outputs the next actions of the scene use (a
// morning message, "if tomorrow drops below 0 °C, notify me").
//
// A scene action does not receive the user's language: the summary text
// follows the `language` of the configuration. Values are metric.
// -----------------------------------------------------------------------------

import { dailySummaries, localDate } from './smhi/forecast.js';
import { SYMBOLS, TEXT, pick } from './i18n.js';

export const DAYS = ['today', 'tomorrow', 'day_after'];

export const DAY_NAMES = {
  en: { today: 'Today', tomorrow: 'Tomorrow', day_after: 'The day after tomorrow' },
  fr: { today: "Aujourd'hui", tomorrow: 'Demain', day_after: 'Après-demain' },
  de: { today: 'Heute', tomorrow: 'Morgen', day_after: 'Übermorgen' },
  es: { today: 'Hoy', tomorrow: 'Mañana', day_after: 'Pasado mañana' },
};

export const ERRORS = {
  unknownDevice: {
    en: 'This SMHI device is unknown: pick it again in the scene.',
    fr: 'Cet appareil SMHI est inconnu : choisissez-le de nouveau dans la scène.',
    de: 'Dieses SMHI-Gerät ist unbekannt: Wähl es in der Szene erneut aus.',
    es: 'Este dispositivo SMHI es desconocido: elíjalo de nuevo en la escena.',
  },
  noForecast: {
    en: 'No forecast for this day yet.',
    fr: 'Pas encore de prévision pour ce jour.',
    de: 'Noch keine Vorhersage für diesen Tag.',
    es: 'Todavía no hay previsión para este día.',
  },
};

/** One sentence: "Tomorrow in SMHI Home: Cloudy, 3 to 9 °C, 1.2 mm of precipitation." */
export function summarySentence(day, dayKey, placeName, language) {
  const text = pick(TEXT, language);
  const names = pick(DAY_NAMES, language);
  const condition = pick(SYMBOLS, language)[day.symbol] ?? '';
  const temperatures = `${Math.round(day.temperatureMin)} ${text.to} ${Math.round(day.temperatureMax)} °C`;
  const precipitation = `${day.precipitation ?? 0} ${text.precipitationMm}`;
  return `${names[dayKey]} ${text.in} ${placeName}: ${[condition, temperatures, precipitation].filter(Boolean).join(', ')}.`;
}

/**
 * @param {import('./hub.js').SmhiHub} hub
 */
export function createSceneActions(hub) {
  return {
    async get_forecast(fields) {
      const language = hub.config?.language ?? 'fr';
      const place = hub.placeByDevice(fields.device);
      if (!place) {
        throw new Error(pick(ERRORS.unknownDevice, language));
      }
      if (!hub.forecastOf(place)) {
        await hub.refresh({ places: [place], force: true });
      }
      const dayKey = DAYS.includes(fields.day) ? fields.day : 'today';
      const now = new Date(hub.now());
      const target = new Date(now.getTime() + DAYS.indexOf(dayKey) * 86_400_000);
      const forecast = hub.forecastOf(place);
      const day = forecast
        ? dailySummaries(forecast, now, hub.timeZone).find(
            (summary) => summary.date === localDate(target, hub.timeZone),
          )
        : null;
      if (!day || day.temperatureMin === null) {
        throw new Error(pick(ERRORS.noForecast, language));
      }
      return {
        temperature_min: day.temperatureMin,
        temperature_max: day.temperatureMax,
        precipitation: day.precipitation ?? 0,
        wind_gust_max: day.windGustMax ?? 0,
        thunder_probability_max: day.thunderProbabilityMax ?? 0,
        condition: pick(SYMBOLS, language)[day.symbol] ?? '',
        summary: summarySentence(day, dayKey, place.name, language),
      };
    },
  };
}
