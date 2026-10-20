// Screenshot a page scrolled to a given selector, to eyeball below-fold work.
import { writeFileSync } from 'node:fs';
const [url, selector, outPath] = process.argv.slice(2);
const PORT = 9222;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result);
    pending.delete(msg.id);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const n = ++id;
    pending.set(n, resolve);
    ws.send(JSON.stringify({ id: n, method, params }));
  });

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await sleep(5000);

const { result } = await send('Runtime.evaluate', {
  expression: `(function(){
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return 'NOT_FOUND';
    el.scrollIntoView({ block: 'center' });
    return 'ok';
  })()`,
  returnByValue: true,
});
console.log(`scroll to ${selector}: ${result.value}`);
await sleep(3000);

// Report whether the images in that section actually decoded.
const { result: imgInfo } = await send('Runtime.evaluate', {
  expression: `(function(){
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return '{}';
    const imgs = [...el.querySelectorAll('img')];
    return JSON.stringify(imgs.map(i => ({ src: (i.currentSrc||i.src).split('/').pop(), natural: i.naturalWidth + 'x' + i.naturalHeight, shown: Math.round(i.getBoundingClientRect().width) + 'px' })));
  })()`,
  returnByValue: true,
});
console.log(imgInfo.value);

const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
console.log(`saved ${outPath}`);

await fetch(`http://127.0.0.1:${PORT}/json/close/${tab.id}`);
ws.close();
process.exit(0);
