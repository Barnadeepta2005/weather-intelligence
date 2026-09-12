import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function inspectWorker() {
  const tempDir = mkdtempSync(join(tmpdir(), 'brave-worker-'));
  const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

  const proc = spawn(bravePath, [
    '--headless=new',
    '--remote-debugging-port=9236',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    'http://localhost:3000'
  ], { stdio: 'ignore' });

  await new Promise(r => setTimeout(r, 2000));
  const res = await fetch('http://127.0.0.1:9236/json');
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

  await send('Page.navigate', { url: 'http://localhost:3000' });
  await new Promise(r => setTimeout(r, 5000));

  const info = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const map = window.__radarMap;
        const cSource = map.getSource('country-boundaries');
        return {
          workerPool: map._workerPool ? {
            numWorkers: map._workerPool.workers?.length,
            ready: map._workerPool.ready
          } : 'No worker pool',
          dispatcher: map.style?.dispatcher ? {
            hasActors: !!map.style.dispatcher.actors
          } : 'No style dispatcher',
          cSourceState: {
            loaded: cSource.loaded(),
            data: typeof cSource._data,
            hasData: !!cSource._data
          }
        };
      })()
    `,
    returnByValue: true
  });

  console.log('WORKER INFO:', JSON.stringify(info.result.value, null, 2));

  ws.close();
  proc.kill();
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
}
inspectWorker();
