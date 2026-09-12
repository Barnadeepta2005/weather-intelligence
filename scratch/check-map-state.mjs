import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDir = mkdtempSync(join(tmpdir(), 'brave-check-style-'));
const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

const proc = spawn(bravePath, [
  '--headless=new',
  '--remote-debugging-port=9227',
  `--user-data-dir=${tempDir}`,
  '--no-first-run',
  'http://localhost:3000'
], { stdio: 'ignore' });

await new Promise(r => setTimeout(r, 2000));

try {
  const res = await fetch('http://127.0.0.1:9227/json');
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
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://localhost:3000' });

  await new Promise(r => setTimeout(r, 6000));

  const evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const map = window.__radarMap;
      if (!map) return { map: false };
      return {
        isStyleLoaded: map.isStyleLoaded(),
        loaded: map.loaded(),
        sources: Object.keys(map.getStyle()?.sources || {}),
        layersCount: map.getStyle()?.layers?.length || 0,
        radarSource: !!map.getSource('rainviewer-radar-source'),
        radarLayer: !!map.getLayer('rainviewer-radar-layer'),
      };
    })()`,
    returnByValue: true
  });

  console.log('MAP STATE:', evalRes.result.value);
  ws.close();
} finally {
  proc.kill();
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
}
