import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(siteDir, 'dist');
const built = spawnSync(process.execPath, [path.join(siteDir, 'scripts', 'build.mjs')], { stdio: 'inherit' });
if (built.status !== 0) process.exit(built.status || 1);

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' };
const port = Number(process.env.PORT || 4173);
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const target = path.resolve(distDir, `.${pathname}`);
    if (!target.startsWith(`${distDir}${path.sep}`)) { res.writeHead(403).end(); return; }
    const info = await stat(target);
    if (!info.isFile()) { res.writeHead(404).end(); return; }
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Страница не найдена');
  }
}).listen(port, '127.0.0.1', () => console.log(`Откройте http://localhost:${port}/`));
