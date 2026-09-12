import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'brave-switch-test-'));
const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

const proc = spawn(bravePath, [
  '--headless=new',
  '--remote-debugging-port=9229',
  `--user-data-dir=${tempDir}`,
  '--no-first-run',
  '--window-size=1280,950',
  'http://localhost:3000'
], { stdio: 'ignore' });

await new Promise(r => setTimeout(r, 2500));

try {
  const res = await fetch('http://127.0.0.1:9229/json');
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

  // 1. Initial load (Kolkata)
  await send('Page.navigate', { url: 'http://localhost:3000' });
  await new Promise(r => setTimeout(r, 6000));

  await send('Runtime.evaluate', {
    expression: `document.querySelector('.radar-card')?.scrollIntoView({ behavior: 'instant', block: 'center' })`
  });
  await new Promise(r => setTimeout(r, 1500));

  const ssKolkata = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('scratch/kolkata-enhanced.png', Buffer.from(ssKolkata.data, 'base64'));
  console.log('Saved scratch/kolkata-enhanced.png');

  // 2. Switch location to Tokyo via URL navigation
  await send('Page.navigate', {
    url: 'http://localhost:3000/?lat=35.6895&lon=139.6917&city=Tokyo&country=Japan&tz=Asia%2FTokyo'
  });
  await new Promise(r => setTimeout(r, 6000));

  await send('Runtime.evaluate', {
    expression: `document.querySelector('.radar-card')?.scrollIntoView({ behavior: 'instant', block: 'center' })`
  });
  await new Promise(r => setTimeout(r, 1500));

  const ssTokyo = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('scratch/tokyo-switch.png', Buffer.from(ssTokyo.data, 'base64'));
  console.log('Saved scratch/tokyo-switch.png');

  const checkTokyoDom = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        locationText: document.querySelector('.location-strip')?.innerText,
        aqiCardText: document.querySelector('.air-card')?.innerText,
        uvCardText: document.querySelector('.uv-card')?.innerText,
        markerLabel: document.querySelector('.radar-marker-label')?.innerText,
      };
    })()`,
    returnByValue: true
  });

  console.log('TOKYO DOM CHECK:', JSON.stringify(checkTokyoDom.result.value, null, 2));

  ws.close();
} finally {
  proc.kill();
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
}
