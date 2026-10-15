# SMHI for Gladys Assistant

Official weather forecasts and weather warnings of the **Swedish Meteorological
and Hydrological Institute (SMHI)** in
[Gladys Assistant](https://gladysassistant.com), through SMHI's public open
data: no account, no API key.

> Not affiliated with SMHI. Developed without a live test against SMHI (the
> development environment could not reach it): feedback welcome.

## What it does

- **One device per place**: every Gladys house that has a location, plus an
  optional place given by its coordinates.
- **Current weather**, refreshed every 30 minutes by the integration itself:
  temperature, feels-like temperature, humidity, pressure, wind speed, gusts
  and direction, cloud cover, precipitation intensity and type, visibility,
  thunder probability, weather in words.
- **SMHI weather warnings** (yellow, orange, red) whose area covers the place:
  a level (0 to 3) scenes can compare, a text, and the **New SMHI weather
  warning** scene trigger.
- **SMHI forecast** dashboard widget: the next 24 hours and six days.
- **Read the SMHI forecast** scene action: today, tomorrow or the day after,
  as outputs (minimum and maximum temperature, precipitation, gusts, thunder,
  weather, a summary sentence).
- **Check the forecast** configuration action.
- Every text in English, French, German and Spanish.

Coverage: the SMHI forecast model covers the Nordic countries and the Baltic
region (Sweden, Norway, Finland, Denmark, the Baltic states and the seas
around them); outside, SMHI answers "out of bounds" and the integration says
so. The warnings exist for Sweden only.

## Requirements

- Gladys Assistant **5.1.0** or later.
- Outbound HTTPS to `opendata-download-metfcst.smhi.se` and
  `opendata-download-warnings.smhi.se`.
- A location on a Gladys house (Settings → Houses), or coordinates typed in
  the configuration.

## Installation

In Gladys: **Integrations → Install from GitHub**, then
`https://github.com/guim31/gladys-smhi` (or install **SMHI** from the store).
Accept the access to the house locations, then add the devices from the
**Discovery** tab.

The full user documentation, in four languages, is in [`docs/`](./docs):
[English](./docs/en.md), [Français](./docs/fr.md), [Deutsch](./docs/de.md),
[Español](./docs/es.md).

## How it works

- API: the snow1g point forecast
  (`/api/category/snow1g/version/1/geotype/point/lon/<lon>/lat/<lat>/data.json`,
  which replaced pmp3g in 2026) and the impact-based warnings
  (`/ibww/api/version/1/warning.json`).
- One request per added place and one for the warnings (all of Sweden) per
  refresh. Places whose device was not added are not read.
- The container refreshes by itself: Gladys does not reliably poll external
  devices (GladysAssistant/Gladys#3198). `onPoll` stays as a fallback.
- Warnings are matched to a place by their GeoJSON outline, or by county when
  one is chosen. The trigger fires once per warning and level; what was
  announced is kept in `/data/smhi-state.json` across restarts.

## Limits

- A model forecast for the nearest grid point (about 2.5 km), not a weather
  station measurement.
- Warning events and descriptions come in English (SMHI publishes Swedish and
  English only).
- No UV index, pollen or fire risk.

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
node scripts/probe.mjs 59.3293 18.0686   # read-only check of the real API
```

## Credits

- Data: © [SMHI](https://www.smhi.se/), Creative Commons Attribution 4.0.
- The reading of the API follows the Home Assistant
  [`smhi`](https://www.home-assistant.io/integrations/smhi) integration
  (Apache 2.0) and the [`pysmhi`](https://github.com/gjohansson-ST/pysmhi)
  library by G Johansson (MIT), whose recorded snow1g answer is the main test
  fixture.
- The warnings format follows the
  [`smhialert`](https://github.com/lallassu/smhialert) component (MIT).
- Built from the official
  [Gladys integration template](https://github.com/GladysAssistant/integration-template-js).

## License

[Apache 2.0](./LICENSE).
