// Drives test/smoke.html in headless Chrome over the DevTools protocol.
// Usage: serve the repo on :8765, then `node test/run-smoke.mjs <level> [seconds] [screenshot.png]`
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const [level = '1', seconds = '40', shot] = process.argv.slice(2);
const chrome = spawn('google-chrome', ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=9333', '--window-size=960,540', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    target = await fetch('http://127.0.0.1:9333/json').then((r) => r.json()).then((l) => l.find((t) => t.type === 'page')).catch(() => null);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (pending.has(msg.id)) pending.get(msg.id)(msg.result);
  });
  const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  await send('Page.enable');
  await send('Page.navigate', { url: `http://localhost:8765/test/smoke.html?level=${level}&debug` });
  const deadline = Date.now() + Number(seconds) * 1000;
  let state = '';
  while (Date.now() < deadline) {
    await sleep(1000);
    const res = await send('Runtime.evaluate', { expression: '[document.title, document.body?.dataset.done]', returnByValue: true });
    const [title, done] = res.result.value ?? [];
    state = title;
    if (done) break;
  }
  if (shot) writeFileSync(shot, Buffer.from((await send('Page.captureScreenshot')).data, 'base64'));
  console.log(state);
  ws.close();
} finally {
  chrome.kill();
}
