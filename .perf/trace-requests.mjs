// Trace every request with method + initiator stack, to spot genuine duplicates.
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
const rows = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result);
    pending.delete(msg.id);
  } else if (msg.method === 'Network.requestWillBeSent') {
    const p = msg.params;
    const frames = p.initiator?.stack?.callFrames || [];
    const top = frames
      .slice(0, 3)
      .map((f) => `${f.functionName || '(anon)'}@${(f.url || '').split('/').pop()}:${f.lineNumber}`)
      .join(' < ');
    rows.push({ method: p.request.method, url: p.request.url, init: p.initiator?.type, stack: top });
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
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.navigate', { url });
await sleep(9000);

const counts = {};
for (const r of rows) {
  const key = `${r.method} ${r.url}`;
  counts[key] = (counts[key] || 0) + 1;
}
console.log('--- requests matching /courses or /rest/v1/ ---');
for (const r of rows) {
  if (/rest\/v1|\/api\//.test(r.url)) {
    console.log(`${r.method.padEnd(7)} ${r.url.slice(0, 95)}\n         init=${r.init} ${r.stack}`);
  }
}
console.log('\n--- duplicates (same method+url more than once) ---');
let any = false;
for (const [k, n] of Object.entries(counts)) {
  if (n > 1) {
    any = true;
    console.log(`${n}x ${k.slice(0, 120)}`);
  }
}
if (!any) console.log('(none)');
console.log(`\ntotal requests: ${rows.length}`);
await fetch(`http://127.0.0.1:${PORT}/json/close/${tab.id}`);
ws.close();
process.exit(0);
