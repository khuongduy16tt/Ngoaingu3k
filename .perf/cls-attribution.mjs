// Report which DOM nodes caused layout shifts.
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

const src = [
  'window.__shifts = [];',
  'new PerformanceObserver(function (l) {',
  '  for (const e of l.getEntries()) {',
  '    if (e.hadRecentInput) continue;',
  '    const srcs = (e.sources || []).map(function (s) {',
  '      const n = s.node;',
  '      if (!n) return "(detached)";',
  '      const cls = n.className && typeof n.className === "string" ? "." + n.className.trim().split(/\\s+/).join(".") : "";',
  '      return (n.tagName || "?").toLowerCase() + cls + " prev=" + JSON.stringify(s.previousRect) + " cur=" + JSON.stringify(s.currentRect);',
  '    });',
  '    window.__shifts.push({ t: Math.round(e.startTime), value: +e.value.toFixed(4), sources: srcs });',
  '  }',
  "}).observe({ type: 'layout-shift', buffered: true });",
].join('\n');

await send('Page.addScriptToEvaluateOnNewDocument', { source: src });
await send('Page.navigate', { url });
await sleep(10000);

const { result } = await send('Runtime.evaluate', {
  expression: 'JSON.stringify(window.__shifts)',
  returnByValue: true,
});
const shifts = JSON.parse(result.value);
const total = shifts.reduce((a, s) => a + s.value, 0);
console.log(`URL: ${url}`);
console.log(`Total CLS: ${total.toFixed(4)}  (${shifts.length} shifts)\n`);
for (const s of shifts.sort((a, b) => b.value - a.value).slice(0, 8)) {
  console.log(`  ${s.value}  @${s.t}ms`);
  for (const x of s.sources.slice(0, 3)) console.log(`       ${x.slice(0, 190)}`);
}
await fetch(`http://127.0.0.1:${PORT}/json/close/${tab.id}`);
ws.close();
process.exit(0);
