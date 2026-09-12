import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'brave-5cities-'));
const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

const proc = spawn(bravePath, [
  '--headless=new',
  '--remote-debugging-port=9250',
  `--user-data-dir=${tempDir}`,
  '--no-first-run',
  '--window-size=1280,950',
  'http://localhost:3000'
], { stdio: 'ignore' });

await new Promise(r => setTimeout(r, 2500));

try {
  const res = await fetch('http://127.0.0.1:9250/json');
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

  const cities = [
    { name: 'Kolkata', url: 'http://localhost:3000/?lat=22.5726&lon=88.3639&city=Kolkata&country=India&admin1=West%20Bengal' },
    { name: 'Mumbai', url: 'http://localhost:3000/?lat=19.0760&lon=72.8777&city=Mumbai&country=India&admin1=Maharashtra' },
    { name: 'Delhi', url: 'http://localhost:3000/?lat=28.6139&lon=77.2090&city=Delhi&country=India&admin1=Delhi' },
    { name: 'London', url: 'http://localhost:3000/?lat=51.5074&lon=-0.1278&city=London&country=United%20Kingdom' },
    { name: 'Tokyo', url: 'http://localhost:3000/?lat=35.6762&lon=139.6503&city=Tokyo&country=Japan' },
  ];

  const cityResults = [];

  for (const c of cities) {
    console.log(`\nTesting City: ${c.name}...`);
    await send('Page.navigate', { url: c.url });
    await new Promise(r => setTimeout(r, 4500));

    const check = await send('Runtime.evaluate', {
      expression: `(() => {
        const cityEl = document.querySelector('.location-strip strong');
        const tempEl = document.querySelector('.hero-temp');
        const aqiHeadingEl = document.querySelector('.air-card .panel-heading h2');
        const aqiValEl = document.querySelector('.air-card .aqi-value strong');
        const aqiLvlEl = document.querySelector('.air-card .aqi-value span');
        const badgeEl = Array.from(document.querySelectorAll('.air-card span')).find(s => s.textContent.includes('DATA') || s.textContent.includes('MODELED') || s.textContent.includes('CPCB'));
        const uvValEl = document.querySelector('.uv-value strong');
        const uvLvlEl = document.querySelector('.uv-value span');
        const radarHeaderEl = document.querySelector('.radar-heading h2');
        const radarReady = !!window.__radarMap?.loaded();

        return {
          targetCity: '${c.name}',
          renderedCity: cityEl?.textContent,
          temperature: tempEl?.textContent,
          aqiHeading: aqiHeadingEl?.textContent,
          aqiValue: aqiValEl?.textContent,
          aqiLevel: aqiLvlEl?.textContent,
          aqiSourceBadge: badgeEl?.textContent,
          uvIndex: uvValEl?.textContent,
          uvLevel: uvLvlEl?.textContent,
          radarHeader: radarHeaderEl?.textContent,
          radarReady,
        };
      })()`,
      returnByValue: true
    });

    const val = check.result?.value;
    cityResults.push(val);
    console.log(`Result for ${c.name}:`, val);

    const ss = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(ss.data, 'base64');
    writeFileSync(`scratch/city-${c.name.toLowerCase()}.png`, buffer);
    try {
      writeFileSync(`${artifactsDir}/city-${c.name.toLowerCase()}.png`, buffer);
    } catch {}
  }

  // Also test Search Dropdown interaction via real typing
  console.log('\n--- Testing Search Box Typing & Dropdown Selection ---');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const searchBtn = document.querySelector('.search-btn');
      if (searchBtn) searchBtn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 500));

  // Focus input and send real key events
  await send('Input.insertText', { text: 'Paris' });
  await new Promise(r => setTimeout(r, 1500));

  const dropdownCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const rows = Array.from(document.querySelectorAll('.search-row-btn'));
      return {
        isOpen: !!document.querySelector('.search-dropdown'),
        resultsCount: rows.length,
        firstResult: rows[0]?.innerText.replace(/\\n/g, ' | '),
      };
    })()`,
    returnByValue: true
  });
  console.log('Search Dropdown Test:', dropdownCheck.result?.value);

  writeFileSync('scratch/cities-results.json', JSON.stringify({ cities: cityResults, dropdown: dropdownCheck.result?.value }, null, 2));
  ws.close();
} finally {
  proc.kill();
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
}
