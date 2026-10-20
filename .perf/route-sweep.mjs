// Visit every route, record console errors, failed requests, broken images,
// final path (redirects are expected for protected routes) and CLS.
const base = process.argv[2] || 'http://localhost:4200';
const PORT = 9222;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const routes = [
  '/',
  '/home',
  '/courses',
  '/courses/hsk-2',
  '/courses/hsk-1-tieng-trung-nen-tang',
  '/auth',
  '/test',
  '/learn',
  '/exams',
  '/flashcards',
  '/profile',
  '/dashboard',
  '/dashboard/student',
  '/dashboard/teacher',
  '/dashboard/admin',
  '/student-progress',
  '/khong-ton-tai-abc',
];

const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});
let id = 0;
const pending = new Map();
let bucket = { errors: [], failed: [] };
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result);
    pending.delete(msg.id);
    return;
  }
  const p = msg.params || {};
  if (msg.method === 'Runtime.exceptionThrown') {
    bucket.errors.push((p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || '').split('\n')[0].slice(0, 120));
  } else if (msg.method === 'Log.entryAdded' && p.entry.level === 'error') {
    bucket.errors.push(p.entry.text.slice(0, 120));
  } else if (msg.method === 'Network.loadingFailed' && p.errorText !== 'net::ERR_ABORTED') {
    bucket.failed.push(p.errorText);
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
await send('Page.addScriptToEvaluateOnNewDocument', {
  source:
    "window.__cls=0;new PerformanceObserver(function(l){for(const e of l.getEntries())if(!e.hadRecentInput)window.__cls+=e.value;}).observe({type:'layout-shift',buffered:true});",
});

console.log('ROUTE SWEEP');
console.log('route'.padEnd(36) + 'landed'.padEnd(26) + 'CLS'.padEnd(9) + 'imgs'.padEnd(7) + 'errs  failed');
let totalErrors = 0;
let totalFailed = 0;

for (const route of routes) {
  bucket = { errors: [], failed: [] };
  await send('Page.navigate', { url: base + route });
  await sleep(4200);
  const { result } = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      path: location.pathname,
      cls: +(window.__cls||0).toFixed(4),
      imgs: document.images.length,
      broken: [...document.images].filter(i=>i.complete && i.naturalWidth===0).length,
      hasContent: document.getElementById('root').innerHTML.length > 500
    })`,
    returnByValue: true,
  });
  const d = JSON.parse(result.value);
  const errs = [...new Set(bucket.errors)];
  const fails = [...new Set(bucket.failed)];
  totalErrors += errs.length;
  totalFailed += fails.length;
  const flag = d.hasContent ? '' : '  ⚠ EMPTY';
  console.log(
    route.padEnd(36) +
      d.path.padEnd(26) +
      String(d.cls).padEnd(9) +
      `${d.imgs - d.broken}/${d.imgs}`.padEnd(7) +
      `${errs.length}     ${fails.length}${flag}`
  );
  for (const e of errs.slice(0, 2)) console.log(`      ERROR: ${e}`);
  for (const f of fails.slice(0, 2)) console.log(`      FAILED: ${f}`);
}

console.log(`\nTổng: ${totalErrors} console error, ${totalFailed} request hỏng trên ${routes.length} route.`);
await fetch(`http://127.0.0.1:${PORT}/json/close/${tab.id}`);
ws.close();
process.exit(0);
