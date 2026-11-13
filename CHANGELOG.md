# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.2] - 2026-11-13

### Changed

- Declared for Sweden, Norway, Finland, Denmark, Estonia, Latvia and Lithuania only (`countries: ["SE", "NO", "FI", "DK", "EE", "LV", "LT"]`): the Gladys catalog of an
  instance located elsewhere no longer lists it in its browse views (the
  search still finds it). Requires Gladys 5.3.0 or later.

## [1.0.1] - 2026-10-15

### Added

- SMHI weather in Gladys, from the public SMHI open data (no account): one
  device per Gladys house with a location, and one for coordinates typed in
  the configuration.
- Current weather of each place, refreshed by the integration every 15, 30 or
  60 minutes: temperature, feels-like temperature, humidity, pressure, wind
  speed, gusts and direction, cloud cover, precipitation intensity and type,
  visibility, thunder probability and the weather in words.
- SMHI weather warnings for Sweden: the warning level (0 to 3) and text of
  each place, and the "New SMHI weather warning" scene trigger, fired once per
  warning and level, restarts included.
- "SMHI forecast" dashboard widget: current weather, the next 24 hours, the
  warnings and six days, in the language and units of the user.
- "Read the SMHI forecast" scene action: minimum and maximum temperature,
  precipitation, strongest gust, thunder probability, weather and a summary
  sentence for today, tomorrow or the day after.
- "Check the forecast" button in the configuration.
- Texts and documentation in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-smhi/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/guim31/gladys-smhi/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/guim31/gladys-smhi/releases/tag/v1.0.1
