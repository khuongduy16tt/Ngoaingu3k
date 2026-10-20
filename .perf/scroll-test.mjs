// Scroll a page top-to-bottom like a user, measure what it costs:
// total bytes pulled, long tasks during scroll, dropped frames, final CLS.
const url = process.argv[2];
const label = process.argv[3] || url;
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
const reqs = new Map();
const errors = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result);
    pending.delete(msg.id);
    return;
  }
  const p = msg.params || {};
  if (msg.method === 'Network.requestWillBeSent') reqs.set(p.requestId, { url: p.request.url, type: p.type, bytes: 0 });
  else if (msg.method === 'Network.loadingFinished') {
    const r = reqs.get(p.requestId);
    if (r) r.bytes = p.encodedDataLength;
  } else if (msg.method === 'Network.loadingFailed') {
    const r = reqs.get(p.requestId);
    if (r) errors.push(`FAILED ${r.url.slice(0, 90)} :: ${p.errorText}`);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    errors.push('JS: ' + (p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || '').slice(0, 160));
  } else if (msg.method === 'Log.entryAdded' && p.entry.level === 'error') {
    errors.push(`${p.entry.source}: ${p.entry.text.slice(0, 160)}`);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const n = ++id;
    pending.set(n, resolve);
    ws.send(JSON.stringify({ id: n, method, params }));
  });

await send('Network.enable');
await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setCPUThrottlingRate', { rate: 4 });

await send('Page.addScriptToEvaluateOnNewDocument', {
  source: [
    'window.__lt = []; window.__cls = 0;',
    "new PerformanceObserver(function(l){ for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({type:'longtask',buffered:true});",
    "new PerformanceObserver(function(l){ for (const e of l.getEntries()) if(!e.hadRecentInput) window.__cls += e.value; }).observe({type:'layout-shift',buffered:true});",
  ].join('\n'),
});

await send('Page.navigate', { url });
await sleep(6000);

// Scroll the whole page in steps, like a user flicking through.
const { result: heightRes } = await send('Runtime.evaluate', {
  expression: 'document.documentElement.scrollHeight',
  returnByValue: true,
});
const pageHeight = heightRes.value;
const step = 700;
for (let y = 0; y < pageHeight; y += step) {
  await send('Runtime.evaluate', { expression: `window.scrollTo(0, ${y})` });
  await sleep(220);
}
await sleep(2500);

const { result } = await send('Runtime.evaluate', {
  expression:
    'JSON.stringify({ lt: window.__lt, cls: +window.__cls.toFixed(4), h: document.documentElement.scrollHeight, nodes: document.getElementsByTagName("*").length })',
  returnByValue: true,
});
const d = JSON.parse(result.value);
const all = [...reqs.values()];
const total = all.reduce((a, r) => a + (r.bytes || 0), 0);
const imgs = all.filter((r) => r.type === 'Image');
const imgBytes = imgs.reduce((a, r) => a + (r.bytes || 0), 0);
const over50 = d.lt.filter((x) => x > 50);
console.log(
  JSON.stringify(
    {
      label,
      pageHeightPx: d.h,
      domNodes: d.nodes,
      totalRequests: all.length,
      totalMB: +(total / 1048576).toFixed(2),
      imageRequests: imgs.length,
      imageMB: +(imgBytes / 1048576).toFixed(2),
      clsAfterFullScroll: d.cls,
      longTasksOver50ms: over50.length,
      longestTaskMs: d.lt.length ? Math.max(...d.lt) : 0,
      totalBlockingMs: over50.reduce((a, x) => a + (x - 50), 0),
      errors: errors.slice(0, 8),
      heaviest: all
        .slice()
        .sort((a, b) => b.bytes - a.bytes)
        .slice(0, 6)
        .map((r) => `${(r.bytes / 1024).toFixed(0)}KB ${r.url.slice(0, 85)}`),
    },
    null,
    1
  )
);
await fetch(`http://127.0.0.1:${PORT}/json/close/${tab.id}`);
ws.close();
process.exit(0);
