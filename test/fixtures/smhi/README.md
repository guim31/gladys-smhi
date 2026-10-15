# SMHI fixtures

- `forecast-norrkoping.json`: a real answer of the snow1g point forecast
  (`/api/category/snow1g/version/1/geotype/point/lon/16.158549/lat/58.577821/data.json`),
  created 2026-04-02 11:01 UTC. Copied from the tests of
  [`gjohansson-ST/pysmhi`](https://github.com/gjohansson-ST/pysmhi) (MIT), where
  Home Assistant's `smhi` tests use it too. 83 steps: hourly, then every 2, 6
  and 12 hours; `-9` and `9999` sentinels on some parameters.
- `forecast-short.json`: the one-step answer of Home Assistant's `smhi` tests
  (Apache-2.0).
- `warnings.json`: **built for the tests, not captured**. Its shape follows the
  SMHI documentation of the impact-based warnings (IBWW v1: `warningAreas` with
  `warningLevel.code`, `affectedAreas`, GeoJSON `area`) and what the
  [`lallassu/smhialert`](https://github.com/lallassu/smhialert) component (MIT)
  reads from the live API. The ids, areas and texts are invented. The session
  that wrote the integration could not reach SMHI: `scripts/probe.mjs` checks
  the real answer.
