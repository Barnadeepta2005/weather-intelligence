import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'brave-debug-'));
const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

const proc = spawn(bravePath, [
  '--headless=new',
  '--remote-debugging-port=9240',
  `--user-data-dir=${tempDir}`,
  '--no-first-run',
  'http://localhost:3000'
], { stdio: 'ignore' });

await new Promise(r => setTimeout(r, 2500));

try {
  const res = await fetch('http://127.0.0.1:9240/json');
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
  await send('Emulation.setDeviceMetricsOverride', {
    width: 768,
    height: 1024,
    deviceScaleFactor: 2,
    mobile: false
  });
  await send('Page.navigate', { url: 'http://localhost:3000' });
  await new Promise(r => setTimeout(r, 3500));

  // Test injecting CSS
  await send('Runtime.evaluate', {
    expression: `(() => {
      const s = document.createElement('style');
      s.id = 'fix-test';
      s.textContent = \`
        @media(max-width:900px) {
          .dashboard-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .dashboard-grid > * {
            min-width: 0 !important;
            max-width: 100% !important;
          }
        }
      \`;
      document.head.appendChild(s);
    })()`
  });

  await new Promise(r => setTimeout(r, 500));

  const check = await send('Runtime.evaluate', {
    expression: `(() => {
      const getInfo = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          width: Math.round(r.width),
          left: Math.round(r.left),
          right: Math.round(r.right),
          cssWidth: cs.width,
          minWidth: cs.minWidth,
          maxWidth: cs.maxWidth,
          display: cs.display,
          gridTemplateColumns: cs.gridTemplateColumns,
        };
      };
      return {
        windowWidth: window.innerWidth,
        docClientWidth: document.documentElement.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
        hasOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > window.innerWidth + 1,
        app: getInfo('.weather-app'),
        shell: getInfo('.content-shell'),
        grid: getInfo('.dashboard-grid'),
        hero: getInfo('.hero-card'),
        radar: getInfo('.radar-card'),
      };
    })()`,
    returnByValue: true
  });

  console.log('Result after fix at 768px:', JSON.stringify(check.result?.value, null, 2));
  ws.close();
} finally {
  proc.kill();
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
}
