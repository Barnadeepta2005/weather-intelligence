import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'brave-resp-'));
const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

const proc = spawn(bravePath, [
  '--headless=new',
  '--remote-debugging-port=9238',
  `--user-data-dir=${tempDir}`,
  '--no-first-run',
  '--window-size=1280,950',
  'http://localhost:3000'
], { stdio: 'ignore' });

await new Promise(r => setTimeout(r, 2500));

try {
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

  const viewports = [
    { name: '375px', width: 375, height: 667, mobile: true },
    { name: '390px', width: 390, height: 844, mobile: true },
    { name: '430px', width: 430, height: 932, mobile: true },
    { name: '768px', width: 768, height: 1024, mobile: false },
    { name: '1024px', width: 1024, height: 768, mobile: false },
    { name: '1280px', width: 1280, height: 800, mobile: false },
    { name: '1440px', width: 1440, height: 900, mobile: false },
  ];

  await send('Page.navigate', { url: 'http://localhost:3000' });
  await new Promise(r => setTimeout(r, 4000));

  const results = [];

  for (const vp of viewports) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 2,
      mobile: vp.mobile,
    });
    await new Promise(r => setTimeout(r, 1000));

    const check = await send('Runtime.evaluate', {
      expression: `(() => {
        const docEl = document.documentElement;
        const body = document.body;
        const scrollW = Math.max(docEl.scrollWidth, body.scrollWidth);
        const clientW = window.innerWidth;
        const hasOverflow = scrollW > clientW + 1; // 1px tolerance for subpixel rounding

        const radarEl = document.querySelector('.radar-map');
        const radarW = radarEl ? radarEl.clientWidth : 0;
        const radarH = radarEl ? radarEl.clientHeight : 0;

        const hourlyRow = document.querySelector('.hourly-row');
        const hourlyScrollable = hourlyRow ? hourlyRow.scrollWidth > hourlyRow.clientWidth : false;

        const weeklyRow = document.querySelector('.weekly-row');
        const weeklyScrollable = weeklyRow ? weeklyRow.scrollWidth > weeklyRow.clientWidth : false;

        const buttons = Array.from(document.querySelectorAll('button:not([disabled])'));
        const smallTouchTargets = buttons
          .map(b => {
            const r = b.getBoundingClientRect();
            return { w: Math.round(r.width), h: Math.round(r.height), text: b.textContent?.trim().slice(0, 15) };
          })
          .filter(b => b.w < 24 || b.h < 24);

        return {
          viewport: '${vp.name}',
          windowWidth: clientW,
          scrollWidth: scrollW,
          hasOverflow,
          radarDimensions: \`\${radarW}x\${radarH}\`,
          hourlyScrollable,
          weeklyScrollable,
          smallTouchTargetsCount: smallTouchTargets.length,
        };
      })()`,
      returnByValue: true
    });

    const val = check.result?.value;
    results.push(val);
    console.log(`Viewport ${vp.name}:`, val);

    const ss = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`scratch/responsive-${vp.name.replace('+', '')}.png`, Buffer.from(ss.data, 'base64'));
  }

  writeFileSync('scratch/responsive-results.json', JSON.stringify(results, null, 2));
  console.log('Responsive audit completed successfully.');

  ws.close();
} finally {
  proc.kill();
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
}
