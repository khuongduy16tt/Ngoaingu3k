// Đọc Drive folder video (embeddedfolderview, không cần API key vì folder chia sẻ)
// → map { "Ngữ âm": [fileId...], "Chủ đề N": [fileId...] } lưu ra videomap.json.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_FOLDER = '13Sfom7-W6vBVjmq4BtswR_V5eaLxETUB';

async function folderEntries(id) {
  const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${id}#list`);
  const html = await res.text();
  const entries = [];
  const re = /<div class="flip-entry" id="entry-([A-Za-z0-9_-]{20,})"[\s\S]*?<div class="flip-entry-title">([^<]*)</g;
  let m;
  while ((m = re.exec(html))) {
    const isFolder = html.includes(`folders/${m[1]}`);
    entries.push({ id: m[1], name: m[2].trim(), isFolder });
  }
  return entries;
}

function chapterKey(name) {
  const n = name.toLowerCase();
  if (/ng[uữ]\s*[âa]m/.test(n)) return 'Ngữ âm';
  const m = n.match(/ch[uủ]\s*[dđ][eêề]\s*(\d+)/);
  if (m) return `Chủ đề ${Number(m[1])}`;
  if (/gi[oớ]i\s*thi[eệ]u/.test(n)) return 'intro';
  return null;
}

// Thu thập video đệ quy (Ngữ âm có subfolder ngu am 1..5 lồng bên trong).
async function collectVideos(id, depth = 0) {
  if (depth > 3) return [];
  const entries = await folderEntries(id);
  let vids = entries
    .filter((f) => !f.isFolder && /\.(mp4|mov|m4v|webm)$/i.test(f.name))
    .map((f) => f.id);
  for (const sub of entries.filter((e) => e.isFolder)) {
    vids = vids.concat(await collectVideos(sub.id, depth + 1));
  }
  return vids;
}

const subfolders = await folderEntries(ROOT_FOLDER);
const map = {};
for (const sf of subfolders) {
  if (!sf.isFolder) continue;
  const key = chapterKey(sf.name);
  if (!key || key === 'intro') continue;
  const vids = await collectVideos(sf.id);
  if (vids.length) map[key] = (map[key] || []).concat(vids);
  process.stderr.write(`  ${sf.name} → ${key}: ${vids.length} video\n`);
}

writeFileSync(path.resolve(__dirname, 'videomap.json'), JSON.stringify(map, null, 1));
const total = Object.values(map).reduce((s, a) => s + a.length, 0);
console.log(`\nTổng: ${Object.keys(map).length} chương có video, ${total} video. Keys: ${Object.keys(map).sort().join(', ')}`);
