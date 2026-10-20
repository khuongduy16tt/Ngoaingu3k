// Report the LCP element + CLS sources together.
const url = process.argv[2];
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
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: process.argv[3] !== 'warm' });

const src = [
  'window.__lcp = [];',
  'window.__shifts = [];',
  'new PerformanceObserver(function (l) {',
  '  for (const e of l.getEntries()) {',
  '    const n = e.element;',
  '    const cls = n && n.className && typeof n.className === "string" ? "." + n.className.trim().split(/\\s+/).slice(0,3).join(".") : "";',
  '    window.__lcp.push({ t: Math.round(e.startTime), size: e.size, tag: n ? n.tagName.toLowerCase() + cls : "(gone)", url: e.url || "", text: n ? (n.textContent||"").trim().slice(0,45) : "" });',
  '  }',
  "}).observe({ type: 'largest-contentful-paint', buffered: true });",
  'new PerformanceObserver(function (l) {',
  '  for (const e of l.getEntries()) {',
  '    if (e.hadRecentInput) continue;',
  '    const srcs = (e.sources||[]).map(function (s) { const n=s.node; if(!n) return "(detached)"; const c=n.className&&typeof n.className==="string"?"."+n.className.trim().split(/\\s+/).slice(0,3).join("."):""; return (n.tagName||"?").toLowerCase()+c; });',
  '    window.__shifts.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), srcs: srcs.slice(0,4) });',
  '  }',
  "}).observe({ type: 'layout-shift', buffered: true });",
].join('\n');

await send('Page.addScriptToEvaluateOnNewDocument', { source: src });
await send('Page.navigate', { url });
await sleep(11000);

const { result } = await send('Runtime.evaluate', {
  expression: 'JSON.stringify({ lcp: window.__lcp, shifts: window.__shifts })',
  returnByValue: true,
});
const d = JSON.parse(result.value);
console.log(`URL: ${url}  (cache ${process.argv[3] === 'warm' ? 'ENABLED' : 'disabled'})`);
console.log('\n-- LCP candidates (last one wins) --');
for (const c of d.lcp) {
  console.log(`  @${String(c.t).padStart(5)}ms size=${String(c.size).padStart(7)} ${c.tag}`);
  if (c.url) console.log(`          url=${c.url.slice(0, 120)}`);
  else if (c.text) console.log(`          text="${c.text}"`);
}
const total = d.shifts.reduce((a, s) => a + s.v, 0);
console.log(`\n-- CLS total ${total.toFixed(4)} --`);
for (const s of d.shifts.sort((a, b) => b.v - a.v).slice(0, 5)) {
  console.log(`  ${s.v}  @${s.t}ms  ${s.srcs.join(' , ')}`);
}
await fetch(`http://127.0.0.1:${PORT}/json/close/${tab.id}`);
ws.close();
process.exit(0);
