import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viteCandidates = [
  path.join(clientRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
  path.join(clientRoot, '..', 'node_modules', 'vite', 'bin', 'vite.js'),
];

const viteBin = viteCandidates.find((candidate) => existsSync(candidate));

if (!viteBin) {
  console.error('[vite-build] Không tìm thấy vite. Đã thử:');
  viteCandidates.forEach((candidate) => console.error(`  - ${candidate}`));
  process.exit(1);
}

const result = spawnSync(process.execPath, [viteBin, 'build'], {
  cwd: clientRoot,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
