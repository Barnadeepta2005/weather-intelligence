import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'brave-smoke-'));
const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

const proc = spawn(bravePath, [
  '--headless=new',
  '--remote-debugging-port=9232',
  `--user-data-dir=${tempDir}`,
  '--no-first-run',
  '--window-size=1280,950',
  'http://localhost:3000'
], { stdio: 'ignore' });

await new Promise(r => setTimeout(r, 2500));

try {
  const res = await fetch('http://127.0.0.1:9232/json');
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
  await send('DOM.enable');

  const artifactsDir = 'C:\\Users\\barna\\.gemini\\antigravity-ide\\brain\\45a5e96c-d014-4a98-9c60-b0cf72516b26';

  async function saveScreenshot(filename) {
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(screenshot.data, 'base64');
    writeFileSync(`scratch/${filename}`, buffer);
    try {
      writeFileSync(`${artifactsDir}/${filename}`, buffer);
    } catch {}
    console.log(`[Screenshot Saved] scratch/${filename} (${buffer.length} bytes)`);
  }

  console.log('=== TEST 1: INITIAL LOAD (KOLKATA) ===');
  await send('Page.navigate', { url: 'http://localhost:3000' });
  await new Promise(r => setTimeout(r, 4500));

  const state1 = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        city: document.querySelector('.location-strip strong')?.textContent,
        temp: document.querySelector('.hero-temp')?.textContent,
        aqiSource: document.querySelector('.air-card .source-note span')?.textContent,
        aqiValue: document.querySelector('.air-card .aqi-value strong')?.textContent,
        aqiLevel: document.querySelector('.air-card .aqi-value span')?.textContent,
        uvIndex: document.querySelector('.uv-value strong')?.textContent,
        radarHeader: document.querySelector('.radar-heading h2')?.textContent,
        isMapReady: !!window.__radarMap?.loaded(),
      };
    })()`,
    returnByValue: true
  });
  console.log('State 1 (Kolkata):', state1.result?.value);
  await saveScreenshot('smoke-1-kolkata.png');

  console.log('=== TEST 2: SEARCH & SELECT MUMBAI ===');
  // Type 'Mumbai' into search
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('.search-btn');
      if (btn) btn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 600));

  await send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('.search-expanded-box input');
      if (input) {
        input.value = 'Mumbai';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`
  });
  await new Promise(r => setTimeout(r, 1200));

  // Click first result row
  await send('Runtime.evaluate', {
    expression: `(() => {
      const firstRow = document.querySelector('.search-row-btn');
      if (firstRow) firstRow.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 4000));

  const state2 = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        city: document.querySelector('.location-strip strong')?.textContent,
        temp: document.querySelector('.hero-temp')?.textContent,
        aqiSource: document.querySelector('.air-card .source-note span')?.textContent,
        aqiValue: document.querySelector('.air-card .aqi-value strong')?.textContent,
        aqiLevel: document.querySelector('.air-card .aqi-value span')?.textContent,
        radarHeader: document.querySelector('.radar-heading h2')?.textContent,
      };
    })()`,
    returnByValue: true
  });
  console.log('State 2 (Mumbai):', state2.result?.value);
  await saveScreenshot('smoke-2-mumbai.png');

  console.log('=== TEST 3: SEARCH & SELECT LONDON (MODELED AQI) ===');
  // Type 'London' into search
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('.search-btn');
      if (btn) btn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 600));

  await send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('.search-expanded-box input');
      if (input) {
        input.value = 'London';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`
  });
  await new Promise(r => setTimeout(r, 1200));

  await send('Runtime.evaluate', {
    expression: `(() => {
      const firstRow = document.querySelector('.search-row-btn');
      if (firstRow) firstRow.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 4000));

  const state3 = await send('Runtime.evaluate', {
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
  console.log('State 3 (London):', state3.result?.value);
  await saveScreenshot('smoke-3-london.png');

  console.log('=== TEST 4: UNIT CONVERSION (°C <-> °F) ===');
  const tempC = await send('Runtime.evaluate', {
    expression: `document.querySelector('.hero-temp')?.textContent`,
    returnByValue: true
  });

  // Click °F
  await send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('.unit-toggle button'));
      const fBtn = buttons.find(b => b.textContent.includes('°F'));
      if (fBtn) fBtn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 500));

  const tempF = await send('Runtime.evaluate', {
    expression: `document.querySelector('.hero-temp')?.textContent`,
    returnByValue: true
  });

  // Click °C back
  await send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('.unit-toggle button'));
      const cBtn = buttons.find(b => b.textContent.includes('°C'));
      if (cBtn) cBtn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 500));

  const tempC2 = await send('Runtime.evaluate', {
    expression: `document.querySelector('.hero-temp')?.textContent`,
    returnByValue: true
  });
  console.log(`Unit conversion test: Initial °C: "${tempC.result?.value}" -> Converted °F: "${tempF.result?.value}" -> Restored °C: "${tempC2.result?.value}"`);

  console.log('=== TEST 5: MOBILE VIEWPORT (375x812) ===');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 812,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await new Promise(r => setTimeout(r, 1000));
  await saveScreenshot('smoke-4-mobile.png');

  // Reset viewport
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 950,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await new Promise(r => setTimeout(r, 1000));

  console.log('=== TEST 6: GEOLOCATION NOTICE / FLOW ===');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const locBtn = document.querySelector('.location-button');
      if (locBtn) locBtn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 2000));

  const geoNotice = await send('Runtime.evaluate', {
    expression: `(() => {
      const notice = document.querySelector('.content-shell > div');
      return notice ? notice.innerText : 'NO NOTICE BANNER';
    })()`,
    returnByValue: true
  });
  console.log('Geolocation Result:', geoNotice.result?.value);
  await saveScreenshot('smoke-5-geolocation.png');

  console.log('=== TEST 7: EXPLICIT DEMO MODE BANNER ===');
  // Trigger error or demo mode to inspect explicit banner
  await send('Page.navigate', { url: 'http://localhost:3000/?lat=999&lon=999&city=FAIL' });
  await new Promise(r => setTimeout(r, 3000));

  // Click VIEW DEMO REFERENCE (OFFLINE)
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const demoBtn = btns.find(b => b.textContent.includes('VIEW DEMO REFERENCE'));
      if (demoBtn) demoBtn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 1500));

  const demoBanner = await send('Runtime.evaluate', {
    expression: `(() => {
      const banner = document.querySelector('.content-shell > div');
      return banner ? banner.innerText : 'NO BANNER';
    })()`,
    returnByValue: true
  });
  console.log('Demo mode banner text:', demoBanner.result?.value);
  await saveScreenshot('smoke-6-demomode.png');

  console.log('=== ALL BROWSER SMOKE TESTS COMPLETE ===');

  ws.close();
} finally {
  proc.kill();
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
}
