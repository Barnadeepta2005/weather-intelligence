import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function captureSpecific(cityObj) {
  const tempDir = mkdtempSync(join(tmpdir(), 'brave-city-'));
  const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

  const proc = spawn(bravePath, [
    '--headless=new',
    '--remote-debugging-port=9238',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--window-size=1280,950',
    `http://localhost:3000/?lat=${cityObj.lat}&lon=${cityObj.lon}&city=${encodeURIComponent(cityObj.name)}&country=${encodeURIComponent(cityObj.country)}&tz=${encodeURIComponent(cityObj.tz)}`
  ], { stdio: 'ignore' });

  await new Promise(r => setTimeout(r, 2500));
  const res = await fetch('http://127.0.0.1:9238/json');
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

  // Wait for map to settle
  await new Promise(r => setTimeout(r, 6000));

  // Scroll to radar card precisely
  await send('Runtime.evaluate', {
    expression: `
      const el = document.querySelector('.radar-card');
      if (el) {
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
    `
  });
  await new Promise(r => setTimeout(r, 1500));

  const ss = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(cityObj.file, Buffer.from(ss.data, 'base64'));
  console.log(`Saved ${cityObj.file}`);

  ws.close();
  proc.kill();
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
}

async function run() {
  await captureSpecific({
    name: 'London',
    country: 'UK',
    lat: 51.5074,
    lon: -0.1278,
    tz: 'Europe/London',
    file: 'scratch/map-london.png'
  });

  await captureSpecific({
    name: 'Delhi',
    country: 'India',
    lat: 28.6139,
    lon: 77.2090,
    tz: 'Asia/Kolkata',
    file: 'scratch/map-delhi.png'
  });
}

run();
