import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'brave-events-'));
const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

const proc = spawn(bravePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  `--user-data-dir=${tempDir}`,
  '--no-first-run',
  '--disable-gpu',
  'http://localhost:3000'
], { stdio: 'ignore' });

await new Promise(r => setTimeout(r, 2500));

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

  // Let's create an isolated MapLibre map on the page and listen to all events!
  const eventsReport = await send('Runtime.evaluate', {
    expression: `(async () => {
      return new Promise((resolve) => {
        const eventsFired = [];
        const div = document.createElement('div');
        div.style.width = '500px';
        div.style.height = '400px';
        document.body.appendChild(div);

        // MapLibre is on window or we can check window.map
        // Let's see what MapLibre constructor exists:
        // We can inspect the existing canvas element's parent to find MapLibre instance if possible
        resolve({
          scripts: Array.from(document.querySelectorAll('script')).map(s => s.src),
        });
      });
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  console.log('Scripts report:', eventsReport.result.value);

  ws.close();
} catch (e) {
  console.error('Error during test:', e);
} finally {
  proc.kill();
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {}
}
