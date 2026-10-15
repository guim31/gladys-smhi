// -----------------------------------------------------------------------------
// The two public SMHI Open Data endpoints the integration reads. No account,
// no key. Licence: Creative Commons Attribution 4.0 (credit "SMHI").
// -----------------------------------------------------------------------------

import { parseForecast } from './forecast.js';
import { parseWarnings } from './warnings.js';

export const FORECAST_URL =
  'https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point';
export const WARNINGS_URL =
  'https://opendata-download-warnings.smhi.se/ibww/api/version/1/warning.json';

const TIMEOUT_MS = 15_000;
const USER_AGENT = 'gladys-smhi (+https://github.com/guim31/gladys-smhi)';

export class SmhiError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, outOfArea?: boolean }} [details]
   */
  constructor(message, { status, outOfArea = false } = {}) {
    super(message);
    this.name = 'SmhiError';
    this.status = status;
    this.outOfArea = outOfArea;
  }
}

/** The API takes at most six decimals. */
const coordinate = (value) => String(Math.round(value * 1e6) / 1e6);

export function forecastUrl(latitude, longitude) {
  return `${FORECAST_URL}/lon/${coordinate(longitude)}/lat/${coordinate(latitude)}/data.json`;
}

async function getJson(url, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    // Never the URL: it carries the coordinates of the home.
    const reason = err?.name === 'TimeoutError' ? 'no answer within 15 s' : err?.message;
    throw new SmhiError(`SMHI unreachable (${reason})`);
  }
  if (!response.ok) {
    throw new SmhiError(`SMHI answered HTTP ${response.status}`, {
      status: response.status,
      // A point outside the model grid is a 404 ("out of bounds").
      outOfArea: response.status === 404,
    });
  }
  try {
    return await response.json();
  } catch {
    throw new SmhiError('SMHI sent an unreadable answer');
  }
}

/**
 * @param {number} latitude
 * @param {number} longitude
 * @param {{ fetch?: typeof fetch }} [options]
 */
export async function fetchForecast(latitude, longitude, { fetch: fetchImpl = fetch } = {}) {
  const json = await getJson(forecastUrl(latitude, longitude), fetchImpl);
  try {
    return parseForecast(json);
  } catch (err) {
    throw new SmhiError(`SMHI forecast: ${err.message}`);
  }
}

/** @param {{ fetch?: typeof fetch }} [options] */
export async function fetchWarnings({ fetch: fetchImpl = fetch } = {}) {
  const json = await getJson(WARNINGS_URL, fetchImpl);
  try {
    return parseWarnings(json);
  } catch (err) {
    throw new SmhiError(`SMHI warnings: ${err.message}`);
  }
}
