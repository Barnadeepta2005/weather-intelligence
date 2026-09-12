# Natural Earth Boundary Datasets

## Overview
This directory contains static, optimized vector boundary datasets in GeoJSON format used by the radar map in the Weather Intelligence application.

- **`countries.geojson`**: Admin 0 international and country boundary lines.
  - Source: [Natural Earth](https://www.naturalearthdata.com/) `ne_50m_admin_0_boundary_lines_land`
  - Resolution: 1:50,000,000 (Medium Scale)
  - Features: 390 international boundary line segments
  - Optimization: Coordinate rounding to 4 decimal places (~10m precision), metadata pruning for high performance.
  - Size: 404.0 KB

- **`states.geojson`**: Admin 1 states, provinces, and internal administrative boundaries.
  - Source: [Natural Earth](https://www.naturalearthdata.com/) `ne_50m_admin_1_states_provinces_lines` supplemented with Admin 1 lines for the United Kingdom and Japan from `ne_10m_admin_1_states_provinces_lines`.
  - Features: 1282 state/provincial boundary line segments
  - Coverage: India (states & union territories), United States, Australia, Canada, Brazil, Russia, China, United Kingdom, Japan, South Africa.
  - Optimization: Coordinate rounding to 4 decimal places, metadata pruning.
  - Size: 705.7 KB

## License & Attribution
- Natural Earth vector map data is in the **Public Domain**.
- Cartographic attribution: Natural Earth (naturalearthdata.com), Nathaniel Vaughn Kelso.
