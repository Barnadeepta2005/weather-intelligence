import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function testSetData() {
  const tempDir = mkdtempSync(join(tmpdir(), 'brave-testsetdata-'));
  const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

  const proc = spawn(bravePath, [
    '--headless=new',
    '--remote-debugging-port=9234',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--window-size=1280,950',
    'http://localhost:3000'
  ], { stdio: 'ignore' });

  await new Promise(r => setTimeout(r, 2000));
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
  await send('Runtime.enable');

  await send('Page.navigate', { url: 'http://localhost:3000' });
  await new Promise(r => setTimeout(r, 5000));

  const result = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        const map = window.__radarMap;
        const [cData, sData] = await Promise.all([
          fetch('/maps/countries.geojson').then(r => r.json()),
          fetch('/maps/states.geojson').then(r => r.json())
        ]);
        map.getSource('country-boundaries').setData(cData);
        map.getSource('state-boundaries').setData(sData);
        await new Promise(r => setTimeout(r, 1200));
        return {
          countryLoaded: map.isSourceLoaded('country-boundaries'),
          stateLoaded: map.isSourceLoaded('state-boundaries'),
          countryFeatures: map.queryRenderedFeatures(undefined, { layers: ['country-boundary-layer'] }).length,
          stateFeatures: map.queryRenderedFeatures(undefined, { layers: ['state-boundary-layer'] }).length,
        };
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('SETDATA RESULT:', result.result.value);

  // Take screenshot to see if borders appear!
  await send('Runtime.evaluate', {
    expression: `document.querySelector('.radar-card')?.scrollIntoView({ behavior: 'instant', block: 'center' })`
  });
  await new Promise(r => setTimeout(r, 1000));
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('scratch/test-with-borders.png', Buffer.from(ss.data, 'base64'));
  console.log('Saved scratch/test-with-borders.png');

  ws.close();
  proc.kill();
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
}
testSetData();
