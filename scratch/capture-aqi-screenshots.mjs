import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'brave-aqi-'));
const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

const proc = spawn(bravePath, [
  '--headless=new',
  '--remote-debugging-port=9230',
  `--user-data-dir=${tempDir}`,
  '--no-first-run',
  '--window-size=1280,950',
  'http://localhost:3000'
], { stdio: 'ignore' });

await new Promise(r => setTimeout(r, 2500));

try {
  const res = await fetch('http://127.0.0.1:9230/json');
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

  const testCases = [
    {
      name: 'aqi-kolkata.png',
      url: 'http://localhost:3000/?lat=22.5726&lon=88.3639&city=Kolkata&country=India&admin1=West+Bengal',
      label: 'Kolkata (CPCB Ground Data)'
    },
    {
      name: 'aqi-delhi.png',
      url: 'http://localhost:3000/?lat=28.6139&lon=77.2090&city=Delhi&country=India&admin1=Delhi',
      label: 'Delhi (CPCB Ground Data)'
    },
    {
      name: 'aqi-london.png',
      url: 'http://localhost:3000/?lat=51.5074&lon=-0.1278&city=London&country=UK',
      label: 'London (Modeled Air Quality)'
    },
    {
      name: 'aqi-rural-india.png',
      url: 'http://localhost:3000/?lat=28.7900&lon=95.9000&city=Anini&country=India&admin1=Arunachal+Pradesh',
      label: 'Anini (Rural India Modeled Fallback)'
    }
  ];

  for (const tc of testCases) {
    console.log(`Navigating to ${tc.label}...`);
    await send('Page.navigate', { url: tc.url });
    await new Promise(r => setTimeout(r, 4500));

    // Scroll AQICard into view
    await send('Runtime.evaluate', {
      expression: `document.querySelector('.air-card')?.scrollIntoView({ behavior: 'instant', block: 'center' })`
    });
    await new Promise(r => setTimeout(r, 800));

    // Evaluate card content to log
    const evalResult = await send('Runtime.evaluate', {
      expression: `(() => {
        const card = document.querySelector('.air-card');
        if (!card) return 'NO CARD FOUND';
        const heading = card.querySelector('.panel-heading span')?.textContent;
        const badges = Array.from(card.querySelectorAll('span')).map(s => s.textContent.trim());
        const strong = card.querySelector('.aqi-value strong')?.textContent;
        const level = card.querySelector('.aqi-value span')?.textContent;
        return { heading, strong, level, text: card.innerText };
      })()`,
      returnByValue: true
    });
    console.log(`  Card content for ${tc.label}:`, evalResult.result?.value);

    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(screenshot.data, 'base64');
    writeFileSync(`scratch/${tc.name}`, buffer);
    console.log(`  Screenshot saved to scratch/${tc.name} (${buffer.length} bytes)`);
  }

  ws.close();
} finally {
  proc.kill();
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
}
