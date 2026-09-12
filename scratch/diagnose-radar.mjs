import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'brave-radar-events-'));
const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

const proc = spawn(bravePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  `--user-data-dir=${tempDir}`,
  '--no-first-run',
  '--disable-gpu',
  'http://localhost:3000'
], { stdio: 'ignore' });

await new Promise(r => setTimeout(r, 3000));

try {
  const res = await fetch('http://127.0.0.1:9222/json');
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

  const networkRequests = [];
  ws.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.method === 'Network.requestWillBeSent') {
      const url = data.params.request.url;
      if (url.includes('openfreemap') || url.includes('rainviewer') || url.includes('api/radar')) {
        networkRequests.push(url);
        console.log('[NET REQUEST]:', url);
      }
    }
  });

  // Wait 6 seconds
  await new Promise(r => setTimeout(r, 6000));

  // Check the global React state or DOM
  const checkState = await send('Runtime.evaluate', {
    expression: `(() => {
      const mapContainer = document.querySelector('.radar-map-canvas');
      const loadingOverlay = Array.from(document.querySelectorAll('.radar-map div')).find(d => d.textContent.includes('INITIALIZING RADAR MAP'));
      const errorOverlay = Array.from(document.querySelectorAll('.radar-map div')).find(d => d.textContent.includes('MAP UNAVAILABLE'));
      return {
        hasLoadingOverlay: !!loadingOverlay,
        hasErrorOverlay: !!errorOverlay,
        loadingOverlayVisible: loadingOverlay ? window.getComputedStyle(loadingOverlay).display : 'none',
      };
    })()`,
    returnByValue: true,
  });

  console.log('Overlay state:', checkState.result.value);
  console.log('Total Map / Radar Network Requests:', networkRequests.length);

  ws.close();
} catch (e) {
  console.error('Error during test:', e);
} finally {
  proc.kill();
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {}
}
