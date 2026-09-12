import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function check() {
  const tempDir = mkdtempSync(join(tmpdir(), 'brave-check2-'));
  const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

  const proc = spawn(bravePath, [
    '--headless=new',
    '--remote-debugging-port=9233',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--window-size=1280,950',
    'http://localhost:3000'
  ], { stdio: 'ignore' });

  await new Promise(r => setTimeout(r, 2000));
  const res = await fetch('http://127.0.0.1:9233/json');
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
  await send('Network.enable');

  const allRequests = [];
  ws.addEventListener('message', (e) => {
    const d = JSON.parse(e.data);
    if (d.method === 'Network.requestWillBeSent') {
      allRequests.push(d.params.request.url);
    }
    if (d.method === 'Runtime.consoleAPICalled') {
      console.log('[BROWSER LOG]', d.params.type, d.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' '));
    }
    if (d.method === 'Runtime.exceptionThrown') {
      console.error('[BROWSER EXCEPTION]', d.params.exceptionDetails);
    }
  });

  await send('Page.navigate', { url: 'http://localhost:3000' });
  await new Promise(r => setTimeout(r, 7000));

  const status = await send('Runtime.evaluate', {
    expression: `(() => {
      const map = window.__radarMap;
      if (!map) return 'No map';
      return {
        countryLoaded: map.isSourceLoaded('country-boundaries'),
        stateLoaded: map.isSourceLoaded('state-boundaries'),
        omtLoaded: map.isSourceLoaded('openmaptiles'),
        radarLoaded: map.isSourceLoaded('rainviewer-radar-source'),
        countryFeatures: map.queryRenderedFeatures(undefined, { layers: ['country-boundary-layer'] }).length,
        stateFeatures: map.queryRenderedFeatures(undefined, { layers: ['state-boundary-layer'] }).length,
        radarFeatures: map.queryRenderedFeatures(undefined, { layers: ['rainviewer-radar-layer'] }).length,
        totalRenderedFeatures: map.queryRenderedFeatures().length,
      };
    })()`,
    returnByValue: true
  });

  console.log('STATUS:', JSON.stringify(status.result.value, null, 2));
  console.log('ALL REQUESTS (count: ' + allRequests.length + '):', allRequests.filter(u => !u.startsWith('data:')));

  ws.close();
  proc.kill();
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
}
check();
