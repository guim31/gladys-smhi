// -----------------------------------------------------------------------------
// Integration configuration: defaults (mirroring the manifest `config_schema`)
// and normalization, so the rest of the code never deals with `undefined` or
// with the strings a form sends.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// The Swedish counties (län) as the SMHI warnings API numbers them in
// `affectedAreas` (the official county codes).
export const COUNTIES = {
  1: 'Stockholms län',
  3: 'Uppsala län',
  4: 'Södermanlands län',
  5: 'Östergötlands län',
  6: 'Jönköpings län',
  7: 'Kronobergs län',
  8: 'Kalmar län',
  9: 'Gotlands län',
  10: 'Blekinge län',
  12: 'Skåne län',
  13: 'Hallands län',
  14: 'Västra Götalands län',
  17: 'Värmlands län',
  18: 'Örebro län',
  19: 'Västmanlands län',
  20: 'Dalarnas län',
  21: 'Gävleborgs län',
  22: 'Västernorrlands län',
  23: 'Jämtlands län',
  24: 'Västerbottens län',
  25: 'Norrbottens län',
};

export const REFRESH_MINUTES = ['15', '30', '60'];

// Defaults: they MUST stay equal to the `default` values of the manifest
// (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  use_houses: true,
  latitude: '',
  longitude: '',
  place_name: '',
  warning_county: 'auto',
  refresh_minutes: '30',
  language: 'fr',
};

/**
 * Parse a coordinate typed by hand: "59.3293", "59,3293", " 18.07 ".
 * @param {unknown} raw
 * @param {number} limit 90 for a latitude, 180 for a longitude
 * @returns {number | null} null when empty or invalid
 */
export function parseCoordinate(raw, limit) {
  const text = String(raw ?? '')
    .trim()
    .replace(',', '.');
  if (text === '' || !/^[-+]?\d+(\.\d+)?$/.test(text)) {
    return null;
  }
  const value = Number(text);
  return Number.isFinite(value) && Math.abs(value) <= limit ? value : null;
}

/**
 * @param {Record<string, unknown>} [raw] config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const config = { ...DEFAULT_CONFIG, ...raw };
  const language = String(config.language);
  const refresh = String(config.refresh_minutes);
  const county = String(config.warning_county);
  const latitudeText = String(config.latitude ?? '').trim();
  const longitudeText = String(config.longitude ?? '').trim();
  const latitude = parseCoordinate(latitudeText, 90);
  const longitude = parseCoordinate(longitudeText, 180);
  return {
    use_houses: config.use_houses !== false && config.use_houses !== 'false',
    latitude,
    longitude,
    // Something was typed but cannot be read: said in the logs and the status.
    coordinatesInvalid:
      (latitudeText !== '' || longitudeText !== '') && (latitude === null || longitude === null),
    place_name: String(config.place_name ?? '')
      .trim()
      .slice(0, 60),
    warning_county: county in COUNTIES ? county : 'auto',
    refresh_minutes: Number(REFRESH_MINUTES.includes(refresh) ? refresh : '30'),
    language: LANGUAGES.includes(language) ? language : DEFAULT_CONFIG.language,
  };
}
