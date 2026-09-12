import { spawn } from 'node:child_process';

const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
const proc = spawn(bravePath, [
  '--headless=new',
  '--remote-debugging-port=9242',
  '--no-first-run',
  '--window-size=768,1024',
  'http://localhost:3000'
], { stdio: 'ignore' });

await new Promise(r => setTimeout(r, 2500));

try {
  const res = await fetch('http://127.0.0.1:9242/json');
  const targets = await res.json();
  const pageTarget = targets.find(t => t.type === 'page');
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  await new Promise(r => ws.addEventListener('open', r));

  const msg = await new Promise(resolve => {
    ws.addEventListener('message', ev => resolve(JSON.parse(ev.data)));
    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: {
        expression: `(() => {
          const w = window.innerWidth;
          const overflows = Array.from(document.querySelectorAll('*'))
            .map(el => ({
              tag: el.tagName,
              cls: el.className,
              rect: el.getBoundingClientRect(),
            }))
            .filter(item => item.rect.right > w + 1)
            .map(item => ({
              tag: item.tag,
              cls: typeof item.cls === 'string' ? item.cls.slice(0, 35) : '',
              right: Math.round(item.rect.right),
              width: Math.round(item.rect.width),
            }));
          return { windowWidth: w, overflows };
        })()`,
        returnByValue: true
      }
    }));
  });

  console.log(JSON.stringify(msg.result?.result?.value, null, 2));
  ws.close();
} finally {
  proc.kill();
}
