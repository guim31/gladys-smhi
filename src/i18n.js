// -----------------------------------------------------------------------------
// Every text the integration produces, in the four languages of the Gladys
// interface. German says "du", Spanish "usted" (test/i18n.test.js checks the
// tables). The warnings themselves come from SMHI in Swedish and English
// only: their event names and descriptions stay in English.
// -----------------------------------------------------------------------------

/** One entry per language, picked with a fallback to English. */
export const pick = (table, language) => table[language] ?? table.en;

// SMHI weather symbols (`symbol_code`, 1 to 27).
export const SYMBOLS = {
  en: {
    1: 'Clear sky',
    2: 'Nearly clear sky',
    3: 'Variable cloudiness',
    4: 'Partly cloudy',
    5: 'Cloudy',
    6: 'Overcast',
    7: 'Fog',
    8: 'Light rain showers',
    9: 'Moderate rain showers',
    10: 'Heavy rain showers',
    11: 'Thunderstorm',
    12: 'Light sleet showers',
    13: 'Moderate sleet showers',
    14: 'Heavy sleet showers',
    15: 'Light snow showers',
    16: 'Moderate snow showers',
    17: 'Heavy snow showers',
    18: 'Light rain',
    19: 'Moderate rain',
    20: 'Heavy rain',
    21: 'Thunder',
    22: 'Light sleet',
    23: 'Moderate sleet',
    24: 'Heavy sleet',
    25: 'Light snowfall',
    26: 'Moderate snowfall',
    27: 'Heavy snowfall',
  },
  fr: {
    1: 'Ciel dégagé',
    2: 'Ciel presque dégagé',
    3: 'Nuageux par moments',
    4: 'Partiellement nuageux',
    5: 'Nuageux',
    6: 'Couvert',
    7: 'Brouillard',
    8: 'Faibles averses',
    9: 'Averses modérées',
    10: 'Fortes averses',
    11: 'Orage',
    12: 'Faibles averses de neige mouillée',
    13: 'Averses de neige mouillée',
    14: 'Fortes averses de neige mouillée',
    15: 'Faibles averses de neige',
    16: 'Averses de neige',
    17: 'Fortes averses de neige',
    18: 'Pluie faible',
    19: 'Pluie modérée',
    20: 'Forte pluie',
    21: 'Tonnerre',
    22: 'Faible neige mouillée',
    23: 'Neige mouillée',
    24: 'Forte neige mouillée',
    25: 'Faibles chutes de neige',
    26: 'Chutes de neige',
    27: 'Fortes chutes de neige',
  },
  de: {
    1: 'Klarer Himmel',
    2: 'Fast klarer Himmel',
    3: 'Wechselnd bewölkt',
    4: 'Teilweise bewölkt',
    5: 'Bewölkt',
    6: 'Bedeckt',
    7: 'Nebel',
    8: 'Leichte Regenschauer',
    9: 'Mäßige Regenschauer',
    10: 'Starke Regenschauer',
    11: 'Gewitter',
    12: 'Leichte Schneeregenschauer',
    13: 'Mäßige Schneeregenschauer',
    14: 'Starke Schneeregenschauer',
    15: 'Leichte Schneeschauer',
    16: 'Mäßige Schneeschauer',
    17: 'Starke Schneeschauer',
    18: 'Leichter Regen',
    19: 'Mäßiger Regen',
    20: 'Starker Regen',
    21: 'Donner',
    22: 'Leichter Schneeregen',
    23: 'Mäßiger Schneeregen',
    24: 'Starker Schneeregen',
    25: 'Leichter Schneefall',
    26: 'Mäßiger Schneefall',
    27: 'Starker Schneefall',
  },
  es: {
    1: 'Cielo despejado',
    2: 'Cielo casi despejado',
    3: 'Nubosidad variable',
    4: 'Parcialmente nublado',
    5: 'Nublado',
    6: 'Cubierto',
    7: 'Niebla',
    8: 'Chubascos débiles',
    9: 'Chubascos moderados',
    10: 'Chubascos fuertes',
    11: 'Tormenta',
    12: 'Chubascos débiles de aguanieve',
    13: 'Chubascos de aguanieve',
    14: 'Chubascos fuertes de aguanieve',
    15: 'Chubascos débiles de nieve',
    16: 'Chubascos de nieve',
    17: 'Chubascos fuertes de nieve',
    18: 'Lluvia débil',
    19: 'Lluvia moderada',
    20: 'Lluvia fuerte',
    21: 'Truenos',
    22: 'Aguanieve débil',
    23: 'Aguanieve moderada',
    24: 'Aguanieve fuerte',
    25: 'Nevada débil',
    26: 'Nevada moderada',
    27: 'Nevada fuerte',
  },
};

// Feather icon of each symbol (dashboard widget).
const SYMBOL_ICONS = {
  sun: [1, 2],
  'cloud-drizzle': [8, 18],
  'cloud-rain': [9, 10, 19, 20],
  'cloud-lightning': [11, 21],
  // Sleet and snow.
  'cloud-snow': [12, 13, 14, 15, 16, 17, 22, 23, 24, 25, 26, 27],
};

export function symbolIcon(symbol) {
  return Object.keys(SYMBOL_ICONS).find((icon) => SYMBOL_ICONS[icon].includes(symbol)) ?? 'cloud';
}

// Predominant precipitation type at the surface (snow1g codes 0 to 12).
export const PRECIPITATION_TYPES = {
  en: {
    0: 'No precipitation',
    1: 'Rain',
    2: 'Thunderstorm',
    3: 'Freezing rain',
    4: 'Mixed ice',
    5: 'Snow',
    6: 'Wet snow',
    7: 'Rain and snow',
    8: 'Ice pellets',
    9: 'Graupel',
    10: 'Hail',
    11: 'Drizzle',
    12: 'Freezing drizzle',
  },
  fr: {
    0: 'Pas de précipitations',
    1: 'Pluie',
    2: 'Orage',
    3: 'Pluie verglaçante',
    4: 'Mélange glacé',
    5: 'Neige',
    6: 'Neige mouillée',
    7: 'Pluie et neige',
    8: 'Granules de glace',
    9: 'Neige roulée',
    10: 'Grêle',
    11: 'Bruine',
    12: 'Bruine verglaçante',
  },
  de: {
    0: 'Kein Niederschlag',
    1: 'Regen',
    2: 'Gewitter',
    3: 'Gefrierender Regen',
    4: 'Eisgemisch',
    5: 'Schnee',
    6: 'Nassschnee',
    7: 'Regen und Schnee',
    8: 'Eiskörner',
    9: 'Graupel',
    10: 'Hagel',
    11: 'Nieselregen',
    12: 'Gefrierender Nieselregen',
  },
  es: {
    0: 'Sin precipitación',
    1: 'Lluvia',
    2: 'Tormenta',
    3: 'Lluvia helada',
    4: 'Mezcla helada',
    5: 'Nieve',
    6: 'Nieve húmeda',
    7: 'Lluvia y nieve',
    8: 'Gránulos de hielo',
    9: 'Nieve granulada',
    10: 'Granizo',
    11: 'Llovizna',
    12: 'Llovizna helada',
  },
};

// Warning levels (1 yellow, 2 orange, 3 red), and 0 for none.
export const WARNING_LEVELS = {
  en: { 0: 'No warning', 1: 'Yellow', 2: 'Orange', 3: 'Red' },
  fr: { 0: 'Aucun avertissement', 1: 'Jaune', 2: 'Orange', 3: 'Rouge' },
  de: { 0: 'Keine Warnung', 1: 'Gelb', 2: 'Orange', 3: 'Rot' },
  es: { 0: 'Ningún aviso', 1: 'Amarillo', 2: 'Naranja', 3: 'Rojo' },
};

// Feature names, frozen when the user adds the device.
export const NAMES = {
  en: {
    temperature: 'Temperature',
    'apparent-temperature': 'Feels like',
    humidity: 'Humidity',
    pressure: 'Pressure',
    'wind-speed': 'Wind speed',
    'wind-gust': 'Wind gusts',
    'wind-direction': 'Wind direction',
    'cloud-cover': 'Cloud cover',
    precipitation: 'Precipitation',
    'precipitation-type': 'Precipitation type',
    visibility: 'Visibility',
    'thunder-probability': 'Thunder probability',
    weather: 'Weather',
    'warning-level': 'Warning level',
    warning: 'Warnings',
  },
  fr: {
    temperature: 'Température',
    'apparent-temperature': 'Ressenti',
    humidity: 'Humidité',
    pressure: 'Pression',
    'wind-speed': 'Vitesse du vent',
    'wind-gust': 'Rafales',
    'wind-direction': 'Direction du vent',
    'cloud-cover': 'Nébulosité',
    precipitation: 'Précipitations',
    'precipitation-type': 'Type de précipitations',
    visibility: 'Visibilité',
    'thunder-probability': "Probabilité d'orage",
    weather: 'Temps',
    'warning-level': "Niveau d'avertissement",
    warning: 'Avertissements',
  },
  de: {
    temperature: 'Temperatur',
    'apparent-temperature': 'Gefühlte Temperatur',
    humidity: 'Luftfeuchtigkeit',
    pressure: 'Luftdruck',
    'wind-speed': 'Windgeschwindigkeit',
    'wind-gust': 'Windböen',
    'wind-direction': 'Windrichtung',
    'cloud-cover': 'Bewölkung',
    precipitation: 'Niederschlag',
    'precipitation-type': 'Niederschlagsart',
    visibility: 'Sichtweite',
    'thunder-probability': 'Gewitterwahrscheinlichkeit',
    weather: 'Wetter',
    'warning-level': 'Warnstufe',
    warning: 'Warnungen',
  },
  es: {
    temperature: 'Temperatura',
    'apparent-temperature': 'Sensación térmica',
    humidity: 'Humedad',
    pressure: 'Presión',
    'wind-speed': 'Velocidad del viento',
    'wind-gust': 'Rachas de viento',
    'wind-direction': 'Dirección del viento',
    'cloud-cover': 'Nubosidad',
    precipitation: 'Precipitación',
    'precipitation-type': 'Tipo de precipitación',
    visibility: 'Visibilidad',
    'thunder-probability': 'Probabilidad de tormenta',
    weather: 'Tiempo',
    'warning-level': 'Nivel de aviso',
    warning: 'Avisos',
  },
};

// Connection status shown in the Configuration screen.
export const STATUS = {
  noPlace: {
    en: 'No location: give a house a location in Gladys, or enter coordinates.',
    fr: 'Aucun lieu : localisez une maison dans Gladys, ou saisissez des coordonnées.',
    de: 'Kein Ort: Gib einem Haus in Gladys einen Standort oder trag Koordinaten ein.',
    es: 'Ningún lugar: ubique una casa en Gladys o introduzca coordenadas.',
  },
  invalidCoordinates: {
    en: 'The coordinates cannot be read: use decimal degrees, e.g. 59.3293 and 18.0686.',
    fr: 'Coordonnées illisibles : utilisez des degrés décimaux, ex. 59.3293 et 18.0686.',
    de: 'Koordinaten nicht lesbar: Verwende Dezimalgrad, z. B. 59.3293 und 18.0686.',
    es: 'Coordenadas ilegibles: utilice grados decimales, p. ej. 59.3293 y 18.0686.',
  },
  outOfArea: {
    en: 'Outside the SMHI forecast area (Nordic and Baltic countries).',
    fr: 'Hors de la zone de prévision du SMHI (pays nordiques et baltes).',
    de: 'Außerhalb des SMHI-Vorhersagegebiets (nordische und baltische Länder).',
    es: 'Fuera de la zona de previsión del SMHI (países nórdicos y bálticos).',
  },
  unreachable: {
    en: 'SMHI does not answer: the last forecast is kept, a new try follows.',
    fr: 'Le SMHI ne répond pas : la dernière prévision est conservée, nouvel essai à suivre.',
    de: 'SMHI antwortet nicht: Die letzte Vorhersage bleibt, ein neuer Versuch folgt.',
    es: 'El SMHI no responde: se conserva la última previsión, se volverá a intentar.',
  },
  initFailed: {
    en: 'Initialization failed, check the integration logs.',
    fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
    de: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
    es: 'La inicialización ha fallado, consulte los registros de la integración.',
  },
};

// Short texts of the widget, the action and the scene action.
export const TEXT = {
  en: {
    noDevice: 'Add an SMHI device in Gladys first.',
    noData: 'No forecast yet.',
    feelsLike: 'Feels like',
    wind: 'Wind',
    next24h: 'Next 24 hours',
    warning: 'Warning',
    until: 'until',
    updated: 'updated',
    noPlaceAction: 'No location to check: give a house a location in Gladys, or enter coordinates.',
    precipitationMm: 'mm of precipitation',
    to: 'to',
    in: 'in',
  },
  fr: {
    noDevice: "Ajoutez d'abord un appareil SMHI dans Gladys.",
    noData: 'Pas encore de prévision.',
    feelsLike: 'Ressenti',
    wind: 'Vent',
    next24h: 'Prochaines 24 heures',
    warning: 'Avertissement',
    until: "jusqu'à",
    updated: 'mise à jour',
    noPlaceAction:
      'Aucun lieu à vérifier : localisez une maison dans Gladys, ou saisissez des coordonnées.',
    precipitationMm: 'mm de précipitations',
    to: 'à',
    in: 'à',
  },
  de: {
    noDevice: 'Füg zuerst ein SMHI-Gerät in Gladys hinzu.',
    noData: 'Noch keine Vorhersage.',
    feelsLike: 'Gefühlt',
    wind: 'Wind',
    next24h: 'Nächste 24 Stunden',
    warning: 'Warnung',
    until: 'bis',
    updated: 'aktualisiert',
    noPlaceAction:
      'Kein Ort zu prüfen: Gib einem Haus in Gladys einen Standort oder trag Koordinaten ein.',
    precipitationMm: 'mm Niederschlag',
    to: 'bis',
    in: 'in',
  },
  es: {
    noDevice: 'Añada primero un dispositivo SMHI en Gladys.',
    noData: 'Todavía no hay previsión.',
    feelsLike: 'Sensación',
    wind: 'Viento',
    next24h: 'Próximas 24 horas',
    warning: 'Aviso',
    until: 'hasta',
    updated: 'actualizado',
    noPlaceAction:
      'Ningún lugar que comprobar: ubique una casa en Gladys o introduzca coordenadas.',
    precipitationMm: 'mm de precipitación',
    to: 'a',
    in: 'en',
  },
};

const LOCALES = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };

/** "Thu 2", "jeu. 2"... for a 'YYYY-MM-DD' date. */
export function dayLabel(date, language) {
  // Noon UTC: the same calendar day in every time zone of the forecast area.
  return new Intl.DateTimeFormat(LOCALES[language] ?? LOCALES.en, {
    weekday: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

/** "14:00" in the time zone of Gladys. */
export function timeLabel(date, language, timeZone) {
  return new Intl.DateTimeFormat(LOCALES[language] ?? LOCALES.en, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(date);
}

/** "Fri 3, 18:00" in the time zone of Gladys. */
export function dateTimeLabel(date, language, timeZone) {
  return new Intl.DateTimeFormat(LOCALES[language] ?? LOCALES.en, {
    weekday: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(date);
}
