import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'brave-radar-deep-'));
const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

const proc = spawn(bravePath, [
  '--headless=new',
  '--remote-debugging-port=9225',
  `--user-data-dir=${tempDir}`,
  '--no-first-run',
  'http://localhost:3000'
], { stdio: 'ignore' });

await new Promise(r => setTimeout(r, 2000));

try {
  const res = await fetch('http://127.0.0.1:9225/json');
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
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://localhost:3000' });

  await new Promise(r => setTimeout(r, 5000));

  // Inspect React component state or MapLibre instance
  const evalResult = await send('Runtime.evaluate', {
    expression: `(() => {
      const el = document.querySelector('.radar-map-canvas');
      const canvas = document.querySelector('.maplibregl-canvas');
      return {
        canvasExists: !!canvas,
        canvasWidth: canvas ? canvas.width : 0,
        canvasHeight: canvas ? canvas.height : 0,
        canvasVisible: canvas ? (canvas.offsetParent !== null) : false,
        radarCardText: document.querySelector('.radar-card')?.innerText,
      };
    })()`,
    returnByValue: true
  });

  console.log('EVAL RESULT:', evalResult.result.value);
  ws.close();
} finally {
  proc.kill();
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
}
