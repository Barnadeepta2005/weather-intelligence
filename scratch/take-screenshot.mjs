import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'brave-screenshot-'));
const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

const proc = spawn(bravePath, [
  '--headless=new',
  '--remote-debugging-port=9228',
  `--user-data-dir=${tempDir}`,
  '--no-first-run',
  '--window-size=1280,900',
  'http://localhost:3000'
], { stdio: 'ignore' });

await new Promise(r => setTimeout(r, 2500));

try {
  const res = await fetch('http://127.0.0.1:9228/json');
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
  await send('Page.navigate', { url: 'http://localhost:3000' });

  // Wait 6 seconds for full map and radar tiles to render
  await new Promise(r => setTimeout(r, 6000));

  // Scroll down to the radar card
  await send('Runtime.evaluate', {
    expression: `document.querySelector('.radar-card')?.scrollIntoView({ behavior: 'instant', block: 'center' })`
  });

  // Wait 1.5 seconds after scroll
  await new Promise(r => setTimeout(r, 1500));

  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const buffer = Buffer.from(screenshot.data, 'base64');
  writeFileSync('scratch/radar-success.png', buffer);
  console.log('SCREENSHOT SAVED to scratch/radar-success.png, size:', buffer.length);

  ws.close();
} finally {
  proc.kill();
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
}
