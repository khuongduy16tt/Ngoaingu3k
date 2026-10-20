// CDP perf harness: cold-load a URL, collect web vitals + network + long tasks.
// Usage: node measure.mjs <url> <label> [--cpu N] [--net slow4g] [--port 9222]
const args = process.argv.slice(2);
const url = args[0];
const label = args[1] || url;
const cpuIdx = args.indexOf('--cpu');
const cpu = cpuIdx > -1 ? Number(args[cpuIdx + 1]) : 1;
const netIdx = args.indexOf('--net');
const net = netIdx > -1 ? args[netIdx + 1] : 'none';
const portIdx = args.indexOf('--port');
const PORT = portIdx > -1 ? Number(args[portIdx + 1]) : 9222;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newTab() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
  return res.json();
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.handlers = [];
  }

  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });
    const c = new CDP(ws);
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && c.pending.has(msg.id)) {
        const { resolve, reject } = c.pending.get(msg.id);
        c.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        c.handlers.forEach((h) => h(msg));
      }
    };
    return c;
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(fn) {
    this.handlers.push(fn);
  }

  close() {
    this.ws.close();
  }
}

const tab = await newTab();
const cdp = await CDP.connect(tab.webSocketDebuggerUrl);

const requests = new Map();
const consoleErrors = [];
const failed = [];

cdp.on((msg) => {
  const p = msg.params || {};
  if (msg.method === 'Network.requestWillBeSent') {
    requests.set(p.requestId, { url: p.request.url, type: p.type, start: p.timestamp, encoded: 0, status: null });
  } else if (msg.method === 'Network.responseReceived') {
    const r = requests.get(p.requestId);
    if (r) {
      r.status = p.response.status;
      r.mime = p.response.mimeType;
      r.headers = p.response.headers;
    }
  } else if (msg.method === 'Network.loadingFinished') {
    const r = requests.get(p.requestId);
    if (r) {
      r.encoded = p.encodedDataLength;
      r.end = p.timestamp;
    }
  } else if (msg.method === 'Network.loadingFailed') {
    const r = requests.get(p.requestId);
    if (r) {
      r.failedText = p.errorText;
      failed.push(r);
    }
  } else if (msg.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text);
  } else if (msg.method === 'Log.entryAdded' && p.entry.level === 'error') {
    consoleErrors.push(`${p.entry.source}: ${p.entry.text}`);
  }
});

await cdp.send('Network.enable');
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('Log.enable');
await cdp.send('Performance.enable');
await cdp.send('Network.clearBrowserCache');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
if (net === 'slow4g') {
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
}

const observerSource = [
  'window.__vitals = { lcp: 0, fcp: 0, cls: 0, longTasks: [] };',
  'try {',
  '  new PerformanceObserver(function (l) { for (const e of l.getEntries()) window.__vitals.lcp = e.startTime; })',
  "    .observe({ type: 'largest-contentful-paint', buffered: true });",
  '  new PerformanceObserver(function (l) { for (const e of l.getEntries()) { if (e.name === "first-contentful-paint") window.__vitals.fcp = e.startTime; } })',
  "    .observe({ type: 'paint', buffered: true });",
  '  new PerformanceObserver(function (l) { for (const e of l.getEntries()) { if (!e.hadRecentInput) window.__vitals.cls += e.value; } })',
  "    .observe({ type: 'layout-shift', buffered: true });",
  '  new PerformanceObserver(function (l) { for (const e of l.getEntries()) window.__vitals.longTasks.push({ start: e.startTime, dur: e.duration }); })',
  "    .observe({ type: 'longtask', buffered: true });",
  '} catch (e) { window.__vitals.err = String(e); }',
].join('\n');

await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: observerSource });

const t0 = Date.now();
await cdp.send('Page.navigate', { url });

// Chờ tới khi mạng thật sự yên: không đủ nếu chỉ nhìn SỐ LƯỢNG request đứng
// yên — trên mạng chậm, số request đứng yên trong lúc một ảnh lớn vẫn đang
// tải dở, nên vòng lặp thoát sớm và LCP bị ghi nhận hụt (đo bản gốc trên
// Slow 4G ra đúng 725KB = vừa đủ JS+CSS, chưa ảnh nào về). Phải thêm điều
// kiện: mọi request đã kết thúc (xong hoặc lỗi).
let lastCount = -1;
let stable = 0;
for (let i = 0; i < 240; i++) {
  await sleep(250);
  const c = requests.size;
  const pendingReqs = [...requests.values()].filter((r) => !r.end && !r.failedText).length;
  if (c === lastCount && pendingReqs === 0) stable++;
  else stable = 0;
  lastCount = c;
  if (stable >= 8 && Date.now() - t0 > 3000) break;
}
await sleep(1500);

const evalExpr = [
  'JSON.stringify({',
  '  vitals: window.__vitals,',
  "  nav: (function () { const n = performance.getEntriesByType('navigation')[0]; return n ? { dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd, ttfb: n.responseStart } : null; })(),",
  "  domNodes: document.getElementsByTagName('*').length,",
  '  maxDepth: (function () { let max = 0; const walk = function (el, d) { if (d > max) max = d; for (const c of el.children) walk(c, d + 1); }; walk(document.body, 0); return max; })(),',
  '  title: document.title',
  '})',
].join('\n');

const { result } = await cdp.send('Runtime.evaluate', { expression: evalExpr, returnByValue: true });
const data = JSON.parse(result.value);

const metrics = await cdp.send('Performance.getMetrics');
const m = Object.fromEntries(metrics.metrics.map((x) => [x.name, x.value]));

const reqs = [...requests.values()];
const totalBytes = reqs.reduce((a, r) => a + (r.encoded || 0), 0);
const byType = {};
for (const r of reqs) {
  const k = r.type || 'Other';
  byType[k] = byType[k] || { n: 0, bytes: 0 };
  byType[k].n++;
  byType[k].bytes += r.encoded || 0;
}
const lt = data.vitals.longTasks || [];
const tbt = lt.reduce((a, t) => a + Math.max(0, t.dur - 50), 0);

const urlCounts = {};
for (const r of reqs) urlCounts[r.url] = (urlCounts[r.url] || 0) + 1;
const dupes = Object.entries(urlCounts).filter((e) => e[1] > 1);

const out = {
  label,
  url,
  cpu,
  net,
  FCP: +data.vitals.fcp.toFixed(0),
  LCP: +data.vitals.lcp.toFixed(0),
  CLS: +data.vitals.cls.toFixed(4),
  TBT: +tbt.toFixed(0),
  longTasks: lt.length,
  longestTask: lt.length ? +Math.max(...lt.map((t) => t.dur)).toFixed(0) : 0,
  TTFB: data.nav ? +data.nav.ttfb.toFixed(0) : null,
  DCL: data.nav ? +data.nav.dcl.toFixed(0) : null,
  Load: data.nav ? +data.nav.load.toFixed(0) : null,
  requests: reqs.length,
  totalKB: +(totalBytes / 1024).toFixed(1),
  byType: Object.fromEntries(Object.entries(byType).map((e) => [e[0], `${e[1].n} / ${(e[1].bytes / 1024).toFixed(1)}KB`])),
  domNodes: data.domNodes,
  domDepth: data.maxDepth,
  jsHeapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1),
  scriptDurationMs: +(m.ScriptDuration * 1000).toFixed(0),
  layoutDurationMs: +(m.LayoutDuration * 1000).toFixed(0),
  recalcStyleMs: +(m.RecalcStyleDuration * 1000).toFixed(0),
  layoutCount: m.LayoutCount,
  recalcCount: m.RecalcStyleCount,
  consoleErrors: consoleErrors.slice(0, 15),
  failedRequests: failed.map((f) => `${f.url} :: ${f.failedText}`).slice(0, 10),
  duplicateRequests: dupes.map((e) => `${e[1]}x ${e[0]}`).slice(0, 15),
  top10Requests: reqs
    .slice()
    .sort((a, b) => (b.encoded || 0) - (a.encoded || 0))
    .slice(0, 10)
    .map((r) => `${(r.encoded / 1024).toFixed(1)}KB ${r.type} ${r.url.slice(0, 110)}`),
};
console.log(JSON.stringify(out, null, 2));
await fetch(`http://127.0.0.1:${PORT}/json/close/${tab.id}`);
cdp.close();
process.exit(0);
