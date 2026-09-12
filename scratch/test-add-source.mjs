import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function testAddSource() {
  const tempDir = mkdtempSync(join(tmpdir(), 'brave-addsource-'));
  const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

  const proc = spawn(bravePath, [
    '--headless=new',
    '--remote-debugging-port=9237',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    'http://localhost:3000'
  ], { stdio: 'ignore' });

  await new Promise(r => setTimeout(r, 2000));
  const res = await fetch('http://127.0.0.1:9237/json');
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
        return new Promise((resolve) => {
          let events = [];
          map.on('data', (e) => {
            if (e.sourceId === 'test-geojson') events.push({ type: 'data', dataType: e.dataType, isSourceLoaded: e.isSourceLoaded });
          });
          map.on('error', (e) => {
            if (e.sourceId === 'test-geojson') events.push({ type: 'error', error: e.error?.message });
          });

          console.log('Adding test-geojson source with absolute URL...');
          const fullUrl = window.location.origin + '/maps/countries.geojson';
          map.addSource('test-geojson', {
            type: 'geojson',
            data: fullUrl
          });

          setTimeout(() => {
            const s = map.getSource('test-geojson');
            resolve({
              events,
              loaded: s?.loaded(),
              hasData: !!s?._data,
              dataType: typeof s?._data
            });
          }, 3000);
        });
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('TEST ADD SOURCE RESULT:', JSON.stringify(result.result.value, null, 2));

  ws.close();
  proc.kill();
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
}
testAddSource();
