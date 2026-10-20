// Run measure.mjs / scroll-test.mjs N times and report median + range,
// so noisy main-thread numbers are not read off a single sample.
// Các script con thoát bằng process.exit() nên libuv trên Windows bắn
// assertion và trả exit code khác 0, dù JSON đã in ra đầy đủ. Vì vậy đọc
// stdout thay vì tin vào exit code.
import { spawnSync } from 'node:child_process';

const script = process.argv[2];
const url = process.argv[3];
const n = Number(process.argv[4] || 5);
const label = process.argv[5] || url;
const extraArgs = process.argv.slice(6);

const rows = [];
for (let i = 0; i < n; i++) {
  const res = spawnSync(process.execPath, [script, url, `s${i}`, ...extraArgs], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 10 * 1024 * 1024,
  });
  const out = res.stdout || '';
  const start = out.indexOf('{');
  if (start < 0) {
    console.error(`sample ${i}: no JSON on stdout`);
    continue;
  }
  rows.push(JSON.parse(out.slice(start)));
}

const med = (arr) => {
  const s = arr.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pick = (key) => rows.map((r) => r[key]).filter((v) => typeof v === 'number');
const fmt = (key) => {
  const v = pick(key);
  if (!v.length) return 'n/a';
  return `${med(v)} [${Math.min(...v)}–${Math.max(...v)}]`;
};

const keys = script.includes('scroll')
  ? ['totalMB', 'imageMB', 'totalRequests', 'clsAfterFullScroll', 'totalBlockingMs', 'longestTaskMs']
  : ['FCP', 'LCP', 'CLS', 'TBT', 'longestTask', 'requests', 'totalKB', 'scriptDurationMs', 'layoutDurationMs', 'recalcStyleMs'];

console.log(`\n${label}  (n=${n}, median [min–max])`);
for (const k of keys) console.log(`  ${k.padEnd(20)} ${fmt(k)}`);
