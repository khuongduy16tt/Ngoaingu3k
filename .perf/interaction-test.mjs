// Drive real UI interactions and watch for duplicate API calls, JS errors,
// failed requests and jank. Flow is described as a list of steps.
const base = process.argv[2] || 'http://localhost:4100';
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
const apiCalls = [];
const errors = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result);
    pending.delete(msg.id);
    return;
  }
  const p = msg.params || {};
  if (msg.method === 'Network.requestWillBeSent') {
    if (/rest\/v1|\/api\//.test(p.request.url)) apiCalls.push(`${p.request.method} ${p.request.url.split('?')[0]}${p.request.url.includes('select=') ? '?select=…' : ''}`);
  } else if (msg.method === 'Network.loadingFailed') {
    errors.push(`FAILED-REQ ${p.errorText}`);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    errors.push('JS-ERROR ' + (p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || '').split('\n')[0].slice(0, 150));
  } else if (msg.method === 'Log.entryAdded' && p.entry.level === 'error') {
    errors.push(`CONSOLE ${p.entry.text.slice(0, 150)}`);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const n = ++id;
    pending.set(n, resolve);
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const evalJs = async (expression) => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (exceptionDetails) return { error: JSON.stringify(exceptionDetails).slice(0, 200) };
  return result.value;
};

await send('Network.enable');
await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');

const report = [];
function step(name, detail) {
  report.push(`  ${name.padEnd(42)} ${detail}`);
}

// ── Flow 1: cold load /courses, open both nav dropdowns ──────────────────────
apiCalls.length = 0;
await send('Page.navigate', { url: `${base}/courses` });
await sleep(5000);
const afterLoad = apiCalls.length;
step('load /courses', `${afterLoad} API call(s)`);

// Open the two course dropdowns in the header by clicking their buttons.
const openResult = await evalJs(`(function(){
  const items = [...document.querySelectorAll('.site-menu__item, .site-menu li')];
  const labels = [];
  for (const el of items) {
    const btn = el.querySelector('button, a');
    if (!btn) continue;
    const t = (btn.textContent||'').trim();
    if (/TIẾNG/i.test(t)) { labels.push(t); btn.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true})); btn.click(); }
  }
  return labels.join(' | ');
})()`);
await sleep(3500);
step('open nav dropdowns', `${openResult || '(none found)'} → total ${apiCalls.length} API call(s)`);

const courseQueries = apiCalls.filter((c) => /courses\?select/.test(c));
step('identical course-catalog queries', `${courseQueries.length}`);

// ── Flow 2: SPA navigation between routes ───────────────────────────────────
for (const route of ['/home', '/courses', '/courses/hsk-2', '/home']) {
  const before = apiCalls.length;
  await evalJs(`(function(){
    const link = [...document.querySelectorAll('a[href]')].find(a => a.getAttribute('href') === '${route}');
    if (link) { link.click(); return 'clicked'; }
    history.pushState({}, '', '${route}');
    window.dispatchEvent(new PopStateEvent('popstate'));
    return 'pushState';
  })()`);
  await sleep(2600);
  const path = await evalJs('location.pathname');
  const title = await evalJs('document.title');
  step(`SPA nav → ${route}`, `at ${path} · "${String(title).slice(0, 34)}" · +${apiCalls.length - before} API`);
}

// ── Flow 3: rapid repeated navigation (stress) ──────────────────────────────
const beforeStress = apiCalls.length;
for (let i = 0; i < 6; i++) {
  await evalJs(`(function(){ const l=[...document.querySelectorAll('a[href]')].find(a=>a.getAttribute('href')==='${i % 2 ? '/home' : '/courses'}'); if(l) l.click(); })()`);
  await sleep(380);
}
await sleep(2500);
step('6x rapid home↔courses', `+${apiCalls.length - beforeStress} API call(s)`);

// ── Flow 4: direct URL access + reload ──────────────────────────────────────
await send('Page.navigate', { url: `${base}/courses/hsk-2` });
await sleep(4000);
const detailOk = await evalJs(`!!document.querySelector('h1') && document.querySelector('h1').textContent.trim()`);
step('direct URL /courses/hsk-2', `h1 = "${String(detailOk).slice(0, 36)}"`);
await send('Page.reload');
await sleep(4000);
const reloadOk = await evalJs(`!!document.querySelector('h1') && document.querySelector('h1').textContent.trim()`);
step('reload same URL', `h1 = "${String(reloadOk).slice(0, 36)}"`);

// ── Flow 5: images actually resolved ────────────────────────────────────────
await send('Page.navigate', { url: `${base}/courses` });
await sleep(5500);
const imgStat = await evalJs(`(function(){
  const imgs=[...document.images];
  const broken=imgs.filter(i=>i.complete && i.naturalWidth===0).map(i=>i.currentSrc||i.src);
  return JSON.stringify({ total: imgs.length, broken: broken.length, sample: broken.slice(0,3) });
})()`);
step('images on /courses', imgStat);

// ── Flow 6: mobile viewport ─────────────────────────────────────────────────
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await send('Page.navigate', { url: `${base}/home` });
await sleep(5000);
const mobile = await evalJs(`JSON.stringify({ overflowX: document.documentElement.scrollWidth > window.innerWidth + 2, sw: document.documentElement.scrollWidth, iw: window.innerWidth })`);
step('mobile 390px /home', mobile);
await send('Emulation.clearDeviceMetricsOverride');

console.log('INTERACTION TEST\n' + report.join('\n'));
console.log('\nAPI calls observed (deduped count):');
const counts = {};
for (const c of apiCalls) counts[c] = (counts[c] || 0) + 1;
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  ${String(v).padStart(3)}x ${k.slice(0, 110)}`);
console.log('\nErrors: ' + (errors.length ? '\n  ' + [...new Set(errors)].slice(0, 10).join('\n  ') : 'none'));

await fetch(`http://127.0.0.1:${PORT}/json/close/${tab.id}`);
ws.close();
process.exit(0);
