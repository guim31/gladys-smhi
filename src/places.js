// -----------------------------------------------------------------------------
// The places the integration forecasts: one per Gladys house that has a
// location (read with `location: true`), plus the coordinates typed in the
// configuration. One Gladys device per place.
// -----------------------------------------------------------------------------

/** Four decimals (about 10 m) as an id fragment: 59.32934 → "593293", -3.5 → "m35000". */
const idFragment = (value) => {
  const scaled = Math.round(value * 1e4);
  return scaled < 0 ? `m${-scaled}` : String(scaled);
};

/**
 * @param {ReturnType<import('./config.js').normalizeConfig>} config
 * @param {{ name: string, selector: string, latitude: number|null, longitude: number|null }[]} houses
 * @returns {{ platformId: string, name: string, latitude: number, longitude: number }[]}
 */
export function resolvePlaces(config, houses = []) {
  const places = [];
  if (config.use_houses) {
    for (const house of houses) {
      if (
        typeof house?.latitude !== 'number' ||
        typeof house?.longitude !== 'number' ||
        !house.selector
      ) {
        continue;
      }
      places.push({
        // The selector, not the name: renaming the house keeps the device.
        platformId: `house-${house.selector}`,
        name: `SMHI ${house.name ?? house.selector}`.slice(0, 60),
        latitude: house.latitude,
        longitude: house.longitude,
      });
    }
  }
  if (config.latitude !== null && config.longitude !== null) {
    // Typed coordinates: the id follows them, other coordinates are another
    // place (and another device, with its own history).
    places.push({
      platformId: `point-${idFragment(config.latitude)}_${idFragment(config.longitude)}`,
      name: config.place_name || 'SMHI',
      latitude: config.latitude,
      longitude: config.longitude,
    });
  }
  return places;
}
