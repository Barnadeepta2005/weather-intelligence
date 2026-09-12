import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';

const html = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl/dist/maplibre-gl.css" />
  <script src="https://unpkg.com/maplibre-gl/dist/maplibre-gl.js"></script>
  <style>
    body, html, #map { margin: 0; width: 800px; height: 400px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    console.log('STARTING MAP');
    const map = new maplibregl.Map({
      container: 'map',
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: [88.3639, 22.5726],
      zoom: 6,
      maxZoom: 7
    });
    map.on('style.load', () => console.log('EVENT: style.load, isStyleLoaded:', map.isStyleLoaded()));
    map.on('load', () => console.log('EVENT: load, loaded:', map.loaded()));
    map.on('error', (e) => console.log('EVENT: error:', e.error ? e.error.message : e));
    map.on('render', () => console.log('EVENT: render'));
    map.on('idle', () => console.log('EVENT: idle'));
  </script>
</body>
</html>`;

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
});

server.listen(8765, async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'brave-test-style-'));
  const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

  const proc = spawn(bravePath, [
    '--headless=new',
    '--remote-debugging-port=9226',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    'http://localhost:8765'
  ], { stdio: 'ignore' });

  await new Promise(r => setTimeout(r, 2000));

  try {
    const res = await fetch('http://127.0.0.1:9226/json');
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
    await send('Console.enable');

    ws.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      if (data.method === 'Runtime.consoleAPICalled') {
        console.log('[BROWSER]', ...data.params.args.map(a => a.value ?? a.description ?? a));
      }
    });

    await new Promise(r => setTimeout(r, 6000));
    ws.close();
  } finally {
    proc.kill();
    server.close();
    try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
});
