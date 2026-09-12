import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function inspectSource() {
  const tempDir = mkdtempSync(join(tmpdir(), 'brave-source-'));
  const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

  const proc = spawn(bravePath, [
    '--headless=new',
    '--remote-debugging-port=9235',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    'http://localhost:3000'
  ], { stdio: 'ignore' });

  await new Promise(r => setTimeout(r, 2000));
  const res = await fetch('http://127.0.0.1:9235/json');
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

  const sourceDetails = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const map = window.__radarMap;
        const cSource = map.getSource('country-boundaries');
        return {
          type: cSource?.type,
          _data: typeof cSource?._data === 'string' ? cSource._data : (cSource?._data ? 'object' : null),
          loaded: cSource?.loaded(),
          workerOptions: cSource?.workerOptions,
          hasWorker: !!map.dispatcher,
        };
      })()
    `,
    returnByValue: true
  });

  console.log('SOURCE DETAILS:', sourceDetails.result.value);

  ws.close();
  proc.kill();
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
}
inspectSource();
