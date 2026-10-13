import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanProject } from './scan.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, '..', 'public');
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml' };

export function startServer({ root, host = '127.0.0.1', port = 4173 }) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/api/map') return json(res, scanProject(root));
    if (url.pathname === '/api/health') return json(res, { ok: true, root });

    const rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\//,'');
    const safe = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');
    const file = path.join(publicDir, safe);
    if (!file.startsWith(publicDir) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, { 'content-type':'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    const ext = path.extname(file);
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control':'no-store' });
    fs.createReadStream(file).pipe(res);
  });

  server.listen(port, host, () => {
    console.log(`BuildMap watching: ${root}`);
    console.log(`Open: http://${host}:${port}`);
  });
  return server;
}

function json(res, value) {
  res.writeHead(200, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' });
  res.end(JSON.stringify(value));
}
