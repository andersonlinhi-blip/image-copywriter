import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateCopyFromImage } from './src/providers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY_BYTES = 20 * 1024 * 1024; // 20 MB

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

/**
 * Load simple key=value pairs from .env file if present without overriding process.env.
 */
export function loadEnvFile(envPath = path.join(__dirname, '.env')) {
  const loaded = {};
  if (!fs.existsSync(envPath)) return loaded;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    loaded[key] = value;
  }
  return loaded;
}

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readJsonBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(Object.assign(new Error('上傳資料過大，請壓縮圖片或選擇 15MB 以下圖片'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(Object.assign(new Error('請求內容不是有效的 JSON 格式'), { statusCode: 400 }));
      }
    });

    req.on('error', (err) => reject(err));
  });
}

function serveStaticFile(reqPath, res) {
  const cleanUrlPath = reqPath.split('?')[0];
  const relativePath = cleanUrlPath === '/' ? 'index.html' : cleanUrlPath.replace(/^\/+/, '');
  const resolved = path.resolve(PUBLIC_DIR, relativePath);

  if (!resolved.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  fs.stat(resolved, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(resolved).pipe(res);
  });
}

/**
 * Create the HTTP server instance.
 */
export function createAppServer(customEnv = {}) {
  const fileEnv = loadEnvFile();
  const envKeys = {
    GEMINI_API_KEY: customEnv.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY ?? fileEnv.GEMINI_API_KEY ?? '',
    OPENAI_API_KEY: customEnv.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? fileEnv.OPENAI_API_KEY ?? '',
    OPENAI_BASE_URL: customEnv.OPENAI_BASE_URL ?? process.env.OPENAI_BASE_URL ?? fileEnv.OPENAI_BASE_URL ?? '',
  };

  return http.createServer(async (req, res) => {
    const urlPath = (req.url || '/').split('?')[0];

    if (req.method === 'GET' && urlPath === '/api/health') {
      sendJson(res, 200, {
        ok: true,
        hasServerGeminiKey: Boolean(envKeys.GEMINI_API_KEY),
        hasServerOpenAIKey: Boolean(envKeys.OPENAI_API_KEY),
      });
      return;
    }

    if (req.method === 'POST' && urlPath === '/api/generate') {
      try {
        const body = await readJsonBody(req);
        const result = await generateCopyFromImage(body, envKeys);
        sendJson(res, 200, result);
      } catch (err) {
        const status = err.statusCode || 400;
        sendJson(res, status, { error: err.message || '生成失敗，請稍後再試' });
      }
      return;
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      serveStaticFile(urlPath, res);
      return;
    }

    sendJson(res, 405, { error: 'Method Not Allowed' });
  });
}

// Start server directly when executed as main entry
const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  const fileEnv = loadEnvFile();
  const port = Number(process.env.PORT || fileEnv.PORT || 3456);
  const server = createAppServer();
  server.listen(port, '127.0.0.1', () => {
    console.log(`圖片文案生成工具已啟動：http://127.0.0.1:${port}`);
  });
}
