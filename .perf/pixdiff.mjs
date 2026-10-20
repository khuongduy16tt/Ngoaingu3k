// Pixel-diff two local PNGs using the headless Chrome already on :9222.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
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

await send('Runtime.enable');
await sleep(200);

const diffFn = `
async function diff(a, b) {
  const load = (d) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = d; });
  const [ia, ib] = await Promise.all([load(a), load(b)]);
  if (ia.width !== ib.width || ia.height !== ib.height) return { sizeMismatch: true, a: ia.width + 'x' + ia.height, b: ib.width + 'x' + ib.height };
  const c1 = new OffscreenCanvas(ia.width, ia.height), c2 = new OffscreenCanvas(ib.width, ib.height);
  const x1 = c1.getContext('2d'), x2 = c2.getContext('2d');
  x1.drawImage(ia, 0, 0); x2.drawImage(ib, 0, 0);
  const d1 = x1.getImageData(0, 0, ia.width, ia.height).data;
  const d2 = x2.getImageData(0, 0, ib.width, ib.height).data;
  let changed = 0, maxDelta = 0, firstRow = -1, lastRow = -1;
  for (let p = 0; p < d1.length; p += 4) {
    const dr = Math.abs(d1[p] - d2[p]), dg = Math.abs(d1[p+1] - d2[p+1]), db = Math.abs(d1[p+2] - d2[p+2]);
    const dm = Math.max(dr, dg, db);
    if (dm > 8) {
      changed++;
      if (dm > maxDelta) maxDelta = dm;
      const row = Math.floor((p / 4) / ia.width);
      if (firstRow < 0) firstRow = row;
      lastRow = row;
    }
  }
  const totalPx = ia.width * ia.height;
  return { w: ia.width, h: ia.height, changedPx: changed, pct: +(100 * changed / totalPx).toFixed(3), maxDelta, firstChangedRow: firstRow, lastChangedRow: lastRow };
}
`;

await send('Runtime.evaluate', { expression: diffFn });

const files = readdirSync(dir).filter((f) => f.startsWith('before_'));
for (const f of files) {
  const aPath = path.join(dir, f);
  const bPath = path.join(dir, f.replace('before_', 'after_'));
  const a = 'data:image/png;base64,' + readFileSync(aPath).toString('base64');
  const b = 'data:image/png;base64,' + readFileSync(bPath).toString('base64');
  const { result } = await send('Runtime.evaluate', {
    expression: `diff(${JSON.stringify(a)}, ${JSON.stringify(b)}).then(r => JSON.stringify(r))`,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log(f.replace('before_', '').padEnd(20), result.value);
}

await fetch(`http://127.0.0.1:${PORT}/json/close/${tab.id}`);
ws.close();
process.exit(0);
