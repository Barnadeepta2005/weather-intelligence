import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'brave-map-audit-'));
const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

const proc = spawn(bravePath, [
  '--headless=new',
  '--remote-debugging-port=9230',
  `--user-data-dir=${tempDir}`,
  '--no-first-run',
  '--window-size=1280,950',
  'http://localhost:3000'
], { stdio: 'ignore' });

await new Promise(r => setTimeout(r, 2500));

try {
  const res = await fetch('http://127.0.0.1:9230/json');
  const targets = await res.json();
  const pageTarget = targets.find(t => t.type === 'page');
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let id = 1;
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = id++;
      const handler = (event) => {
        const data = JSON.parse(event.data);
        if (data.id === msgId) {
          ws.removeEventListener('message', handler);
          resolve(data.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable');
  await send('Runtime.enable');

  // Test Locations
  const cities = [
    { name: 'Kolkata', country: 'India', lat: 22.5726, lon: 88.3639, tz: 'Asia/Kolkata', file: 'scratch/map-kolkata.png' },
    { name: 'Mumbai', country: 'India', lat: 19.0760, lon: 72.8777, tz: 'Asia/Kolkata', file: 'scratch/map-mumbai.png' },
    { name: 'Delhi', country: 'India', lat: 28.6139, lon: 77.2090, tz: 'Asia/Kolkata', file: 'scratch/map-delhi.png' },
    { name: 'London', country: 'UK', lat: 51.5074, lon: -0.1278, tz: 'Europe/London', file: 'scratch/map-london.png' },
    { name: 'Tokyo', country: 'Japan', lat: 35.6895, lon: 139.6917, tz: 'Asia/Tokyo', file: 'scratch/map-tokyo.png' },
    { name: 'New York', country: 'USA', lat: 40.7128, lon: -74.0060, tz: 'America/New_York', file: 'scratch/map-newyork.png' },
    { name: 'Sydney', country: 'Australia', lat: -33.8688, lon: 151.2093, tz: 'Australia/Sydney', file: 'scratch/map-sydney.png' },
  ];

  let diagnosticChecked = false;
  const auditResults = [];

  for (const c of cities) {
    console.log(`\nTesting location: ${c.name}, ${c.country}...`);
    const url = `http://localhost:3000/?lat=${c.lat}&lon=${c.lon}&city=${encodeURIComponent(c.name)}&country=${encodeURIComponent(c.country)}&tz=${encodeURIComponent(c.tz)}`;
    await send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, 4500));

    // Scroll to radar map
    await send('Runtime.evaluate', {
      expression: `document.querySelector('.radar-card')?.scrollIntoView({ behavior: 'instant', block: 'center' })`
    });
    await new Promise(r => setTimeout(r, 1200));

    // Run MapLibre Diagnostics on first location
    if (!diagnosticChecked) {
      const diag = await send('Runtime.evaluate', {
        expression: `(() => {
          const map = window.__radarMap;
          if (!map) return { error: 'No __radarMap on window' };
          const style = map.getStyle();
          const sourceKeys = Object.keys(style.sources || {});
          const layers = style.layers || [];
          const layerIds = layers.map(l => l.id);

          const radarIdx = layerIds.indexOf('rainviewer-radar-layer');
          const stateBoundaryIdx = layerIds.indexOf('state-boundary-layer');
          const countryBoundaryIdx = layerIds.indexOf('country-boundary-layer');
          const firstLabelIdx = layerIds.findIndex(id => id.startsWith('label_'));

          return {
            sources: sourceKeys,
            hasCountryBoundariesSource: map.getSource('country-boundaries') !== undefined,
            hasStateBoundariesSource: map.getSource('state-boundaries') !== undefined,
            hasOpenMapTilesSource: map.getSource('openmaptiles') !== undefined,
            hasRadarSource: map.getSource('rainviewer-radar-source') !== undefined,
            hasCountryLayer: map.getLayer('country-boundary-layer') !== undefined,
            hasStateLayer: map.getLayer('state-boundary-layer') !== undefined,
            hasRadarLayer: map.getLayer('rainviewer-radar-layer') !== undefined,
            order: {
              radarIdx,
              stateBoundaryIdx,
              countryBoundaryIdx,
              firstLabelIdx,
              orderingCorrect: radarIdx < stateBoundaryIdx && stateBoundaryIdx < countryBoundaryIdx && countryBoundaryIdx < firstLabelIdx,
            },
            totalLayers: layerIds.length
          };
        })()`,
        returnByValue: true
      });
      console.log('MAPLIBRE DIAGNOSTIC AUDIT:', JSON.stringify(diag.result.value, null, 2));
      diagnosticChecked = true;
    }

    // Inspect DOM values
    const domCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        return {
          markerBadge: document.querySelector('.radar-marker-label')?.innerText,
          heading: document.querySelector('.radar-heading h2')?.innerText,
          aqiText: document.querySelector('.air-card')?.innerText?.replace(/\\s+/g, ' '),
          uvText: document.querySelector('.uv-card')?.innerText?.replace(/\\s+/g, ' '),
        };
      })()`,
      returnByValue: true
    });

    auditResults.push({
      city: c.name,
      country: c.country,
      dom: domCheck.result.value,
    });

    // Capture screenshot
    const ss = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(c.file, Buffer.from(ss.data, 'base64'));
    console.log(`Saved screenshot: ${c.file} (marker: ${domCheck.result.value?.markerBadge})`);
  }

  // Mobile Viewport Check (375px)
  console.log('\nTesting Mobile Viewport (375px width)...');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 812,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await new Promise(r => setTimeout(r, 1500));
  const ssMobile = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('scratch/map-mobile-375.png', Buffer.from(ssMobile.data, 'base64'));
  console.log('Saved screenshot: scratch/map-mobile-375.png');

  console.log('\nAUDIT RESULTS SUMMARY:');
  console.log(JSON.stringify(auditResults, null, 2));

  ws.close();
} finally {
  proc.kill();
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
}
