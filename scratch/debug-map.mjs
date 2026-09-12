import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function check() {
  const tempDir = mkdtempSync(join(tmpdir(), 'brave-debug-'));
  const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

  const proc = spawn(bravePath, [
    '--headless=new',
    '--remote-debugging-port=9232',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--window-size=1280,950',
    'http://localhost:3000'
  ], { stdio: 'ignore' });

  await new Promise(r => setTimeout(r, 2000));
  const res = await fetch('http://127.0.0.1:9232/json');
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

  ws.addEventListener('message', (e) => {
    const data = JSON.parse(e.data);
    if (data.method === 'Runtime.consoleAPICalled') {
      console.log('[BROWSER CONSOLE]', data.params.type, data.params.args.map(a => a.value || a.description).join(' '));
    }
  });

  await send('Page.navigate', { url: 'http://localhost:3000' });
  await new Promise(r => setTimeout(r, 6000));

  const debugInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const map = window.__radarMap;
      if (!map) return 'No map';
      
      return {
        zoom: map.getZoom(),
        center: map.getCenter(),
        bounds: map.getBounds(),
        countrySourceLoaded: map.isSourceLoaded('country-boundaries'),
        stateSourceLoaded: map.isSourceLoaded('state-boundaries'),
        openMapTilesLoaded: map.isSourceLoaded('openmaptiles'),
        countryFeaturesInView: map.queryRenderedFeatures(undefined, { layers: ['country-boundary-layer'] }).length,
        stateFeaturesInView: map.queryRenderedFeatures(undefined, { layers: ['state-boundary-layer'] }).length,
        countryLayerPaint: map.getLayer('country-boundary-layer')?.paint,
        stateLayerPaint: map.getLayer('state-boundary-layer')?.paint,
      };
    })()`,
    returnByValue: true
  });

  console.log('DEBUG INFO:', JSON.stringify(debugInfo.result.value, null, 2));

  ws.close();
  proc.kill();
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
}
check();
