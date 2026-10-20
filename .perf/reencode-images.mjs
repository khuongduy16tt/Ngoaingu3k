// Re-encode oversized static images through the headless Chrome on :9222.
// Each job: { src, out, maxW, maxH, type, quality }
import { readFileSync, writeFileSync, statSync } from 'node:fs';

const PORT = 9222;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PUBLIC = 'C:/Users/admin/Desktop/25tr/Ngoaingu3k/client/public';

const jobs = [
  // Hiển thị ở 88×88 (avatar tròn). 256px phủ tới màn 2.9x DPR.
  ...['thao', 'linh', 'trang', 'hanh', 'david', 'khoa'].map((n) => ({
    src: `${PUBLIC}/images/team/teacher-${n}.jpg`,
    out: `${PUBLIC}/images/team/teacher-${n}.webp`,
    maxW: 256,
    maxH: 256,
    type: 'image/webp',
    quality: 0.86,
  })),
  // Logo header: cao 72px, giữ nguyên pixel gốc 336×242 (đã là ~2.3x DPR),
  // chỉ đổi mã hoá PNG → WebP có alpha.
  {
    src: `${PUBLIC}/images/imported/logo-ngoaingu3k-clean.png`,
    out: `${PUBLIC}/images/imported/logo-ngoaingu3k-clean.webp`,
    maxW: 336,
    maxH: 242,
    type: 'image/webp',
    quality: 0.92,
  },
];

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

const encoder = `
async function encode(dataUrl, maxW, maxH, type, quality) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
  const scale = Math.min(1, maxW / img.width, maxH / img.height);
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const c = new OffscreenCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await c.convertToBlob({ type, quality });
  const buf = await blob.arrayBuffer();
  let s = '';
  const bytes = new Uint8Array(buf);
  const CH = 8192;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return JSON.stringify({ b64: btoa(s), w: w, h: h, srcW: img.width, srcH: img.height, outType: blob.type });
}
`;
await send('Runtime.evaluate', { expression: encoder });

let savedTotal = 0;
for (const job of jobs) {
  const srcBuf = readFileSync(job.src);
  const ext = job.src.split('.').pop().toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const dataUrl = `data:${mime};base64,${srcBuf.toString('base64')}`;
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression: `encode(${JSON.stringify(dataUrl)}, ${job.maxW}, ${job.maxH}, ${JSON.stringify(job.type)}, ${job.quality})`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (exceptionDetails) {
    console.log(`FAIL ${job.src}: ${JSON.stringify(exceptionDetails).slice(0, 200)}`);
    continue;
  }
  const r = JSON.parse(result.value);
  const outBuf = Buffer.from(r.b64, 'base64');
  writeFileSync(job.out, outBuf);
  const before = statSync(job.src).size;
  const after = outBuf.length;
  savedTotal += before - after;
  console.log(
    `${job.out.split('/').pop().padEnd(32)} ${r.srcW}x${r.srcH} ${(before / 1024).toFixed(0)}KB  ->  ${r.w}x${r.h} ${(after / 1024).toFixed(0)}KB  (${(100 * (1 - after / before)).toFixed(1)}% nhỏ hơn, ${r.outType})`
  );
}
console.log(`\nTổng tiết kiệm: ${(savedTotal / 1024 / 1024).toFixed(2)} MB`);

await fetch(`http://127.0.0.1:${PORT}/json/close/${tab.id}`);
ws.close();
process.exit(0);
