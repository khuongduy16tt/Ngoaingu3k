import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const port = Number(process.env.PORT || 5173);
const rootDir = path.resolve(process.cwd(), 'client', 'dist');
const textMimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml']
]);

function sendFile(filePath, response) {
  const ext = path.extname(filePath);
  response.setHeader('Content-Type', textMimeTypes.get(ext) || 'application/octet-stream');
  createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const decodedPath = decodeURIComponent(requestUrl.pathname);
  let filePath = path.resolve(rootDir, decodedPath === '/' ? 'index.html' : `.${decodedPath}`);

  if (!filePath.startsWith(rootDir)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    await fs.access(filePath);
    sendFile(filePath, response);
    return;
  } catch {
    sendFile(path.join(rootDir, 'index.html'), response);
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Static preview running on http://127.0.0.1:${port}`);
});
