import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const mapsDir = path.resolve(process.cwd(), 'public/maps');
  if (!fs.existsSync(mapsDir)) {
    fs.mkdirSync(mapsDir, { recursive: true });
  }

  const u0 = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_boundary_lines_land.geojson';
  const u1_50 = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces_lines.geojson';
  const u1_10 = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces_lines.geojson';

  console.log('Fetching Natural Earth boundary datasets...');
  const [d0, d1_50, d1_10] = await Promise.all([
    fetch(u0).then(r => r.json()),
    fetch(u1_50).then(r => r.json()),
    fetch(u1_10).then(r => r.json()),
  ]);

  function roundCoords(coords) {
    if (typeof coords[0] === 'number') {
      return [Math.round(coords[0] * 10000) / 10000, Math.round(coords[1] * 10000) / 10000];
    }
    return coords.map(roundCoords);
  }

  // 1. Process Countries (Admin 0)
  const countriesFeatures = d0.features.map(f => ({
    type: 'Feature',
    properties: {
      featurecla: f.properties.FEATURECLA || 'International boundary',
      min_zoom: f.properties.MIN_ZOOM || 0,
    },
    geometry: {
      type: f.geometry.type,
      coordinates: roundCoords(f.geometry.coordinates),
    },
  }));

  const countriesGeojson = {
    type: 'FeatureCollection',
    features: countriesFeatures,
  };

  const countriesPath = path.join(mapsDir, 'countries.geojson');
  fs.writeFileSync(countriesPath, JSON.stringify(countriesGeojson));
  const countriesSize = fs.statSync(countriesPath).size;
  console.log(`Saved countries.geojson (${(countriesSize / 1024).toFixed(1)} KB, ${countriesFeatures.length} features)`);

  // 2. Process States / Provinces (Admin 1)
  // Include 50m major federations (India, USA, Australia, Brazil, Canada, Russia, China, South Africa)
  // and supplement with 10m Admin 1 for UK and Japan
  const extraStates = d1_10.features.filter(f => f.properties.ADM0_A3 === 'GBR' || f.properties.ADM0_A3 === 'JPN');
  const allStateFeatures = [...d1_50.features, ...extraStates].map(f => ({
    type: 'Feature',
    properties: {
      name: f.properties.name || f.properties.NAME || null,
      adm0_name: f.properties.adm0_name || f.properties.ADM0_NAME || null,
      adm0_a3: f.properties.adm0_a3 || f.properties.ADM0_A3 || null,
      min_zoom: f.properties.min_zoom || f.properties.MIN_ZOOM || 3,
    },
    geometry: {
      type: f.geometry.type,
      coordinates: roundCoords(f.geometry.coordinates),
    },
  }));

  const statesGeojson = {
    type: 'FeatureCollection',
    features: allStateFeatures,
  };

  const statesPath = path.join(mapsDir, 'states.geojson');
  fs.writeFileSync(statesPath, JSON.stringify(statesGeojson));
  const statesSize = fs.statSync(statesPath).size;
  console.log(`Saved states.geojson (${(statesSize / 1024).toFixed(1)} KB, ${allStateFeatures.length} features)`);

  // 3. Write documentation README.md
  const readmeContent = `# Natural Earth Boundary Datasets

## Overview
This directory contains static, optimized vector boundary datasets in GeoJSON format used by the radar map in the Weather Intelligence application.

- **\`countries.geojson\`**: Admin 0 international and country boundary lines.
  - Source: [Natural Earth](https://www.naturalearthdata.com/) \`ne_50m_admin_0_boundary_lines_land\`
  - Resolution: 1:50,000,000 (Medium Scale)
  - Features: ${countriesFeatures.length} international boundary line segments
  - Optimization: Coordinate rounding to 4 decimal places (~10m precision), metadata pruning for high performance.
  - Size: ${(countriesSize / 1024).toFixed(1)} KB

- **\`states.geojson\`**: Admin 1 states, provinces, and internal administrative boundaries.
  - Source: [Natural Earth](https://www.naturalearthdata.com/) \`ne_50m_admin_1_states_provinces_lines\` supplemented with Admin 1 lines for the United Kingdom and Japan from \`ne_10m_admin_1_states_provinces_lines\`.
  - Features: ${allStateFeatures.length} state/provincial boundary line segments
  - Coverage: India (states & union territories), United States, Australia, Canada, Brazil, Russia, China, United Kingdom, Japan, South Africa.
  - Optimization: Coordinate rounding to 4 decimal places, metadata pruning.
  - Size: ${(statesSize / 1024).toFixed(1)} KB

## License & Attribution
- Natural Earth vector map data is in the **Public Domain**.
- Cartographic attribution: Natural Earth (naturalearthdata.com), Nathaniel Vaughn Kelso.
`;

  fs.writeFileSync(path.join(mapsDir, 'README.md'), readmeContent);
  console.log('Wrote public/maps/README.md');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
