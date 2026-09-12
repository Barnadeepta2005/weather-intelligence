import { spawn } from 'node:child_process';

const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
const proc = spawn(bravePath, [
  '--headless=new',
  '--remote-debugging-port=9248',
  '--no-first-run',
  '--window-size=768,1024',
  'http://localhost:3000'
], { stdio: 'ignore' });

await new Promise(r => setTimeout(r, 2500));

try {
  const res = await fetch('http://127.0.0.1:9248/json');
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
          const card = document.querySelector('.radar-card');
          const children = Array.from(card.children).map(c => ({
            tag: c.tagName,
            cls: c.className,
            scrollWidth: c.scrollWidth,
            clientWidth: c.clientWidth,
            text: c.innerText?.slice(0, 40)
          }));
          const sourceNote = document.querySelector('.radar-card .source-note');
          const sourceNoteChildren = sourceNote ? Array.from(sourceNote.children).map(c => ({
            tag: c.tagName,
            text: c.innerText?.slice(0, 40),
            scrollWidth: c.scrollWidth,
            clientWidth: c.clientWidth
          })) : [];
          return { children, sourceNoteChildren };
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
