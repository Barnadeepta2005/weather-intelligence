import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'brave-debug-'));
const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

const proc = spawn(bravePath, [
  '--headless=new',
  '--remote-debugging-port=9223',
  `--user-data-dir=${tempDir}`,
  '--no-first-run',
  'http://localhost:3000'
], { stdio: 'ignore' });

await new Promise(r => setTimeout(r, 2500));

try {
  const res = await fetch('http://127.0.0.1:9223/json');
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

  await send('Runtime.enable');
  await send('Network.enable');

  ws.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.method === 'Runtime.consoleAPICalled') {
      console.log('[BROWSER CONSOLE]', data.params.type, ...data.params.args.map(a => a.value ?? a.description ?? a));
    }
    if (data.method === 'Runtime.exceptionThrown') {
      console.log('[BROWSER EXCEPTION]', data.params.exceptionDetails);
    }
    if (data.method === 'Network.requestWillBeSent') {
      const u = data.params.request.url;
      if (u.includes('api/') || u.includes('openfreemap') || u.includes('rainviewer')) {
        console.log('[NET REQ]', data.params.request.method, u);
      }
    }
    if (data.method === 'Network.responseReceived') {
      const u = data.params.response.url;
      if (u.includes('api/') || u.includes('openfreemap') || u.includes('rainviewer')) {
        console.log('[NET RES]', data.params.response.status, u);
      }
    }
  });

  // Navigate and wait
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://localhost:3000' });

  await new Promise(r => setTimeout(r, 6000));

  // Wait 4 more seconds to allow radar tiles to fetch
  await new Promise(r => setTimeout(r, 4000));

  const diag = await send('Runtime.evaluate', {
    expression: `(() => {
      const canvasEl = document.querySelector('.radar-map-canvas');
      const container = document.querySelector('.radar-map');
      const loadingOverlay = Array.from(document.querySelectorAll('*')).find(d => d.textContent?.includes('INITIALIZING RADAR MAP'));
      const errorOverlay = Array.from(document.querySelectorAll('*')).find(d => d.textContent?.includes('MAP UNAVAILABLE'));
      const map = window.__radarMap;
      
      return {
        hasLoadingOverlay: !!loadingOverlay,
        hasErrorOverlay: !!errorOverlay,
        container: container ? {
          clientWidth: container.clientWidth,
          clientHeight: container.clientHeight,
        } : null,
        canvas: canvasEl ? {
          clientWidth: canvasEl.clientWidth,
          clientHeight: canvasEl.clientHeight,
        } : null,
        maplibreglCanvas: !!document.querySelector('.maplibregl-canvas'),
        mapInstanceExists: !!map,
        isStyleLoaded: map ? map.isStyleLoaded() : null,
        isMapLoaded: map ? map.loaded() : null,
        hasRadarSource: map ? !!map.getSource('rainviewer-radar-source') : null,
        hasRadarLayer: map ? !!map.getLayer('rainviewer-radar-layer') : null,
      };
    })()`,
    returnByValue: true
  });

  console.log('DIAGNOSTICS:', JSON.stringify(diag.result.value, null, 2));

  ws.close();
} finally {
  proc.kill();
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
}
