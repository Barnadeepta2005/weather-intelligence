import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'brave-cities-'));
const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

const proc = spawn(bravePath, [
  '--headless=new',
  '--remote-debugging-port=9234',
  `--user-data-dir=${tempDir}`,
  '--no-first-run',
  '--window-size=1280,950',
  'http://localhost:3000'
], { stdio: 'ignore' });

await new Promise(r => setTimeout(r, 2500));

try {
  const res = await fetch('http://127.0.0.1:9234/json');
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

  const artifactsDir = 'C:\\Users\\barna\\.gemini\\antigravity-ide\\brain\\45a5e96c-d014-4a98-9c60-b0cf72516b26';

  // 1. Mumbai
  console.log('Navigating to Mumbai...');
  await send('Page.navigate', {
    url: 'http://localhost:3000/?lat=19.0760&lon=72.8777&city=Mumbai&country=India&admin1=Maharashtra'
  });
  await new Promise(r => setTimeout(r, 4500));

  const mumbaiState = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        city: document.querySelector('.location-strip strong')?.textContent,
        temp: document.querySelector('.hero-temp')?.textContent,
        aqiHeading: document.querySelector('.air-card .panel-heading span')?.textContent,
        aqiSource: document.querySelector('.air-card .source-note span')?.textContent,
        aqiValue: document.querySelector('.air-card .aqi-value strong')?.textContent,
        aqiLevel: document.querySelector('.air-card .aqi-value span')?.textContent,
        radarHeader: document.querySelector('.radar-heading h2')?.textContent,
      };
    })()`,
    returnByValue: true
  });
  console.log('Mumbai State:', mumbaiState.result?.value);

  let screenshot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('scratch/smoke-2-mumbai.png', Buffer.from(screenshot.data, 'base64'));
  writeFileSync(`${artifactsDir}/smoke-2-mumbai.png`, Buffer.from(screenshot.data, 'base64'));

  // 2. London
  console.log('Navigating to London...');
  await send('Page.navigate', {
    url: 'http://localhost:3000/?lat=51.5074&lon=-0.1278&city=London&country=UK'
  });
  await new Promise(r => setTimeout(r, 4500));

  const londonState = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        city: document.querySelector('.location-strip strong')?.textContent,
        temp: document.querySelector('.hero-temp')?.textContent,
        aqiHeading: document.querySelector('.air-card .panel-heading span')?.textContent,
        aqiSource: document.querySelector('.air-card .source-note span')?.textContent,
        aqiValue: document.querySelector('.air-card .aqi-value strong')?.textContent,
        aqiLevel: document.querySelector('.air-card .aqi-value span')?.textContent,
        radarHeader: document.querySelector('.radar-heading h2')?.textContent,
      };
    })()`,
    returnByValue: true
  });
  console.log('London State:', londonState.result?.value);

  screenshot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('scratch/smoke-3-london.png', Buffer.from(screenshot.data, 'base64'));
  writeFileSync(`${artifactsDir}/smoke-3-london.png`, Buffer.from(screenshot.data, 'base64'));

  ws.close();
} finally {
  proc.kill();
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
}
