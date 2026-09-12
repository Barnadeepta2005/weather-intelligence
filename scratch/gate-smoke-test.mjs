import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'brave-final-smoke-'));
const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

const proc = spawn(bravePath, [
  '--headless=new',
  '--remote-debugging-port=9245',
  `--user-data-dir=${tempDir}`,
  '--no-first-run',
  '--window-size=1280,950',
  'http://localhost:3000'
], { stdio: 'ignore' });

await new Promise(r => setTimeout(r, 2500));

try {
  const res = await fetch('http://127.0.0.1:9245/json');
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
    console.log(`[Screenshot Saved] scratch/${filename}`);
  }

  async function selectCity(name) {
    console.log(`\n--- Selecting: ${name} ---`);
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.querySelector('.search-btn');
        if (btn) btn.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 500));

    await send('Runtime.evaluate', {
      expression: `(() => {
        const input = document.querySelector('.search-expanded-box input');
        if (input) {
          input.value = '${name}';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()`
    });
    await new Promise(r => setTimeout(r, 1400));

    await send('Runtime.evaluate', {
      expression: `(() => {
        const firstRow = document.querySelector('.search-row-btn');
        if (firstRow) firstRow.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 4500));

    const state = await send('Runtime.evaluate', {
      expression: `(() => {
        return {
          city: document.querySelector('.location-strip strong')?.textContent,
          temp: document.querySelector('.hero-temp')?.textContent,
          feelsLike: document.querySelector('.feels')?.textContent,
          condition: document.querySelector('.condition')?.textContent,
          aqiHeading: document.querySelector('.air-card .panel-heading h2')?.textContent,
          aqiValue: document.querySelector('.air-card .aqi-value strong')?.textContent,
          aqiLevel: document.querySelector('.air-card .aqi-value span')?.textContent,
          aqiBadge: document.querySelector('.air-card .source-note span')?.textContent || document.querySelectorAll('.air-card span')[1]?.textContent,
          uvIndex: document.querySelector('.uv-value strong')?.textContent,
          uvLevel: document.querySelector('.uv-value span')?.textContent,
          radarHeader: document.querySelector('.radar-heading h2')?.textContent,
          radarReady: !!window.__radarMap?.loaded(),
        };
      })()`,
      returnByValue: true
    });
    return state.result?.value;
  }

  console.log('=== STEP 1: INITIAL LOAD (KOLKATA) ===');
  await send('Page.navigate', { url: 'http://localhost:3000' });
  await new Promise(r => setTimeout(r, 4500));

  const kolkataState = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        city: document.querySelector('.location-strip strong')?.textContent,
        temp: document.querySelector('.hero-temp')?.textContent,
        feelsLike: document.querySelector('.feels')?.textContent,
        condition: document.querySelector('.condition')?.textContent,
        aqiHeading: document.querySelector('.air-card .panel-heading h2')?.textContent,
        aqiValue: document.querySelector('.air-card .aqi-value strong')?.textContent,
        aqiLevel: document.querySelector('.air-card .aqi-value span')?.textContent,
        aqiBadge: document.querySelector('.air-card .source-note span')?.textContent || document.querySelectorAll('.air-card span')[1]?.textContent,
        uvIndex: document.querySelector('.uv-value strong')?.textContent,
        uvLevel: document.querySelector('.uv-value span')?.textContent,
        radarHeader: document.querySelector('.radar-heading h2')?.textContent,
        radarReady: !!window.__radarMap?.loaded(),
      };
    })()`,
    returnByValue: true
  });
  console.log('Kolkata State:', kolkataState.result?.value);
  await saveScreenshot('gate-1-kolkata.png');

  console.log('=== STEP 2: MUMBAI ===');
  const mumbaiState = await selectCity('Mumbai');
  console.log('Mumbai State:', mumbaiState);
  await saveScreenshot('gate-2-mumbai.png');

  console.log('=== STEP 3: DELHI ===');
  const delhiState = await selectCity('Delhi');
  console.log('Delhi State:', delhiState);
  await saveScreenshot('gate-3-delhi.png');

  console.log('=== STEP 4: LONDON ===');
  const londonState = await selectCity('London');
  console.log('London State:', londonState);
  await saveScreenshot('gate-4-london.png');

  console.log('=== STEP 5: TOKYO ===');
  const tokyoState = await selectCity('Tokyo');
  console.log('Tokyo State:', tokyoState);
  await saveScreenshot('gate-5-tokyo.png');

  console.log('=== STEP 6: USE MY LOCATION ===');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const locBtn = document.querySelector('.location-button');
      if (locBtn) locBtn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 2000));
  const geoResult = await send('Runtime.evaluate', {
    expression: `(() => {
      const banner = document.querySelector('.content-shell > div');
      return banner ? banner.innerText : 'NO NOTIFICATION BANNER';
    })()`,
    returnByValue: true
  });
  console.log('Geolocation flow banner/state:', geoResult.result?.value);
  await saveScreenshot('gate-6-geolocation.png');

  console.log('=== STEP 7: °C / °F TOGGLE ===');
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
  await new Promise(r => setTimeout(r, 400));
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
  await new Promise(r => setTimeout(r, 400));
  const tempC2 = await send('Runtime.evaluate', {
    expression: `document.querySelector('.hero-temp')?.textContent`,
    returnByValue: true
  });
  console.log(`Unit Toggle Verification: ${tempC.result?.value} -> ${tempF.result?.value} -> ${tempC2.result?.value}`);

  console.log('=== STEP 8: RADAR CONTROLS & TIMELINE ===');
  const radarVerification = await send('Runtime.evaluate', {
    expression: `(() => {
      const map = window.__radarMap;
      const zoom = map ? map.getZoom() : null;
      const maxZoom = map ? map.getMaxZoom() : null;
      const playBtn = document.querySelector('.radar-timeline button');
      const timeText = document.querySelector('.radar-timeline')?.innerText;
      return {
        hasMapInstance: !!map,
        currentZoom: zoom,
        configuredMaxZoom: maxZoom,
        timelineActive: !!playBtn,
        timelineContent: timeText?.slice(0, 30),
      };
    })()`,
    returnByValue: true
  });
  console.log('Radar State:', radarVerification.result?.value);

  console.log('=== STEP 9: MOBILE VIEWPORT TEST ===');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await new Promise(r => setTimeout(r, 1000));
  const mobileAudit = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        windowWidth: window.innerWidth,
        scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        hasOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > window.innerWidth + 1,
        mobileNavVisible: !!document.querySelector('.mobile-nav'),
        radarWidth: document.querySelector('.radar-map')?.clientWidth,
      };
    })()`,
    returnByValue: true
  });
  console.log('Mobile Viewport Audit:', mobileAudit.result?.value);
  await saveScreenshot('gate-7-mobile.png');

  console.log('\n=== ALL SMOKE TEST STEPS EXECUTED SUCCESSFULLY ===');
  ws.close();
} finally {
  proc.kill();
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
}
