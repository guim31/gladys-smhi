// -----------------------------------------------------------------------------
// SMHI impact-based weather warnings (IBWW, version 1).
//
// `warning.json` is an array of warnings (one weather event each, `event`
// named in Swedish and English); each warning holds `warningAreas`, the
// areas it covers, with their own level (`warningLevel.code`: YELLOW,
// ORANGE, RED), period, descriptions, the counties they touch
// (`affectedAreas`) and their outline (`area`, GeoJSON). The answer covers
// the whole of Sweden: the integration keeps the areas of each place.
// -----------------------------------------------------------------------------

export const LEVELS = { YELLOW: 1, ORANGE: 2, RED: 3 };
export const LEVEL_KEYS = { 1: 'yellow', 2: 'orange', 3: 'red' };

const text = (value, lang = 'en') =>
  value && typeof value === 'object'
    ? String(value[lang] ?? value.en ?? value.sv ?? '').trim()
    : typeof value === 'string'
      ? value.trim()
      : '';

/**
 * Flatten the answer into warning areas, keeping only the three warning
 * levels (any other code, a plain message, is left out).
 * @param {any} json
 * @returns {object[]}
 * @throws when the body is not a list of warnings
 */
export function parseWarnings(json) {
  if (!Array.isArray(json)) {
    throw new Error('the answer is not a list of warnings');
  }
  const areas = [];
  for (const warning of json) {
    for (const area of warning?.warningAreas ?? []) {
      const code = String(area?.warningLevel?.code ?? '').toUpperCase();
      const level = LEVELS[code];
      if (!level) {
        continue;
      }
      const descriptions = (area.descriptions ?? [])
        .map((item) => {
          const title = text(item?.title);
          const body = text(item?.text);
          return title && body ? `${title}: ${body}` : body || title;
        })
        .filter(Boolean);
      areas.push({
        key: `${warning.id ?? '?'}/${area.id ?? '?'}`,
        level,
        event: text(warning.event) || text(area.eventDescription) || 'Warning',
        eventSv: text(warning.event, 'sv'),
        areaName: text(area.areaName),
        start: area.approximateStart ?? null,
        end: area.approximateEnd ?? null,
        description: descriptions.join('\n'),
        counties: (area.affectedAreas ?? []).map((affected) => String(affected?.id)),
        geometry: area.area ?? null,
      });
    }
  }
  return areas;
}

/** Ray casting on one ring of [lon, lat] positions. */
function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function inPolygon(lon, lat, rings) {
  if (!Array.isArray(rings) || rings.length === 0 || !inRing(lon, lat, rings[0])) {
    return false;
  }
  // The other rings are holes.
  return !rings.slice(1).some((hole) => inRing(lon, lat, hole));
}

/**
 * Does a GeoJSON object (geometry, Feature, FeatureCollection,
 * GeometryCollection) contain the point?
 * @returns {boolean | null} null when there is no usable geometry
 */
export function containsPoint(geojson, latitude, longitude) {
  if (!geojson || typeof geojson !== 'object') {
    return null;
  }
  switch (geojson.type) {
    case 'FeatureCollection': {
      const results = (geojson.features ?? []).map((feature) =>
        containsPoint(feature, latitude, longitude),
      );
      return results.every((result) => result === null) ? null : results.includes(true);
    }
    case 'Feature':
      return containsPoint(geojson.geometry, latitude, longitude);
    case 'GeometryCollection': {
      const results = (geojson.geometries ?? []).map((geometry) =>
        containsPoint(geometry, latitude, longitude),
      );
      return results.every((result) => result === null) ? null : results.includes(true);
    }
    case 'Polygon':
      return inPolygon(longitude, latitude, geojson.coordinates);
    case 'MultiPolygon':
      return (geojson.coordinates ?? []).some((polygon) => inPolygon(longitude, latitude, polygon));
    default:
      return null;
  }
}

/**
 * The warning areas concerning a place: its point inside the outline, or
 * its county among the affected ones when the user chose a county.
 * @param {object[]} areas from parseWarnings
 * @param {{ latitude: number, longitude: number }} place
 * @param {string} county county code, or 'auto'
 */
export function warningsFor(areas, place, county = 'auto') {
  return areas.filter(
    (area) =>
      containsPoint(area.geometry, place.latitude, place.longitude) === true ||
      (county !== 'auto' && area.counties.includes(county)),
  );
}

/** The highest level among the areas, 0 when none. */
export function highestLevel(areas) {
  return areas.reduce((max, area) => Math.max(max, area.level), 0);
}
