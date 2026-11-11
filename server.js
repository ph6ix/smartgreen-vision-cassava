/**
 * Local development server: serves public/ and the same handlers Vercel runs in api/.
 *   npm install && npm start   →  http://localhost:8080
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from './lib/config.js';
import analyze from './api/analyze.js';
import saveSheet from './api/save-sheet.js';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
};
const API = { '/api/analyze': analyze, '/api/save-sheet': saveSheet };

// Minimal Express-like res helpers so the Vercel handlers run unchanged
function wrapRes(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)); return res; };
  return res;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const handler = API[url.pathname];
  if (handler) {
    try {
      await handler(req, wrapRes(res));
    } catch (err) {
      console.error(err);
      if (!res.headersSent) wrapRes(res).status(500).json({ error: err.message });
    }
    return;
  }

  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || !rel) rel = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}).listen(CONFIG.PORT, () => {
  console.log(`🍠 Cassava Leaf Doctor running at http://localhost:${CONFIG.PORT}`);
});
