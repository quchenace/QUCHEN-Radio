/**
 * Quchen Radio 官网服务器
 * ---------------------------------------------------------------------------
 * 仅依赖 Node.js 内置模块，无需 npm install。
 *
 * 功能：
 *   1. 静态文件服务 —— 提供 ./website/ 下的 HTML/CSS/JS/图片
 *   2. API 代理：
 *      GET /api/update/check           查询 quchenace/QUCHEN-Radio 最新 Release
 *      GET /api/download/installer      流式下载安装包(不跳转 GitHub)
 *      GET /api/download/lx-source?id=  下载指定音源插件
 *      GET /api/sources                 返回 lx-sources/sources.json 清单
 *      GET /api/changelog               返回 CHANGELOG.md 解析后的版本列表
 *      GET /api/health                  健康检查
 *
 * 运行：
 *   node website-server.js
 *   PORT=3000 node website-server.js   (PORT 默认 3000)
 *
 * 部署：
 *   本地端口 3000，通过 natapp 内网穿透映射到 quchen.nat100.top
 */

'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

/* ============================================================
   配置
   ============================================================ */
const ROOT = __dirname;
const WEBSITE_DIR = path.join(ROOT, 'website');
const LX_SOURCES_DIR = path.join(ROOT, 'lx-sources');
const SOURCES_JSON = path.join(LX_SOURCES_DIR, 'sources.json');
const CHANGELOG_MD = path.join(ROOT, 'CHANGELOG.md');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const REPO = {
  owner: 'quchenace',
  name: 'QUCHEN-Radio',
  apiHost: 'api.github.com',
  rawHost: 'raw.githubusercontent.com',
  releasePath: '/repos/quchenace/QUCHEN-Radio/releases/latest',
};

// GitHub 加速镜像(按优先级)。镜像前缀 + 完整 GitHub URL
const MIRRORS = [
  'https://gh-proxy.com/',
  'https://ghfast.top/',
  'https://gh.llkk.cc/',
];

// GitHub API 缓存(避免触发 60 次/小时的未认证限制)
const API_CACHE_TTL = 5 * 60 * 1000; // 5 分钟
let releaseCache = { data: null, expireAt: 0 };

// MIME 类型
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

/* ============================================================
   工具函数
   ============================================================ */
function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function sendJson(res, code, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendError(res, code, message) {
  sendJson(res, code, { error: message, code });
}

function safeJoin(base, target) {
  const resolved = path.resolve(base, '.' + path.sep + target);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    return null;
  }
  return resolved;
}

function getMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

/* ============================================================
   HTTPS GET(返回 Buffer 或流)
   ============================================================ */
function httpsGetBuffer(targetUrl, options) {
  const opts = options || {};
  return new Promise((resolve, reject) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeout || 15000);
    const parsed = new URL(targetUrl);
    const reqOpts = {
      method: 'GET',
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      headers: opts.headers || {
        'User-Agent': 'Quchen-Radio-Website/1.0',
        'Accept': 'application/json',
      },
      signal: ctrl.signal,
    };
    const req = https.request(reqOpts, (resp) => {
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
        // 跟随重定向(最多 5 次)
        const redirects = (opts._redirects || 0) + 1;
        if (redirects > 5) {
          clearTimeout(timer);
          resp.resume();
          reject(new Error('too many redirects'));
          return;
        }
        const nextUrl = new URL(resp.headers.location, targetUrl).href;
        clearTimeout(timer);
        resp.resume();
        resolve(httpsGetBuffer(nextUrl, { ...opts, _redirects: redirects }));
        return;
      }
      if (resp.statusCode !== 200) {
        clearTimeout(timer);
        const chunks = [];
        resp.on('data', (c) => chunks.push(c));
        resp.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8').slice(0, 500);
          reject(new Error(`HTTP ${resp.statusCode}: ${text}`));
        });
        return;
      }
      const chunks = [];
      resp.on('data', (c) => chunks.push(c));
      resp.on('end', () => {
        clearTimeout(timer);
        resolve(Buffer.concat(chunks));
      });
    });
    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    req.on('abort', () => {
      clearTimeout(timer);
      reject(new Error('aborted'));
    });
    req.end();
  });
}

/* ============================================================
   获取最新 Release 信息(带缓存)
   ============================================================ */
async function fetchLatestRelease() {
  const now = Date.now();
  if (releaseCache.data && now < releaseCache.expireAt) {
    return releaseCache.data;
  }
  const apiUrl = `https://${REPO.apiHost}${REPO.releasePath}`;
  const candidates = [];
  for (const m of MIRRORS) {
    candidates.push(m + apiUrl);
  }
  candidates.push(apiUrl);
  let lastErr = null;
  for (const url of candidates) {
    try {
      const buf = await httpsGetBuffer(url, {
        timeout: 12000,
        headers: {
          'User-Agent': 'Quchen-Radio-Website/1.0',
          'Accept': 'application/vnd.github+json',
        },
      });
      const json = JSON.parse(buf.toString('utf8'));
      const data = {
        version: (json.tag_name || '').replace(/^v/, '') || '1.0.0',
        tagName: json.tag_name,
        name: json.name,
        htmlUrl: json.html_url,
        releaseNotes: json.body || '',
        publishedAt: json.published_at || json.created_at,
        assets: (json.assets || []).map((a) => ({
          name: a.name,
          size: a.size,
          downloadUrl: a.browser_download_url,
          contentType: a.content_type,
        })),
      };
      releaseCache = { data, expireAt: now + API_CACHE_TTL };
      log(`通过镜像获取 Release 成功: ${url}`);
      return data;
    } catch (err) {
      lastErr = err;
      log(`镜像失败: ${url} -> ${err.message}`);
    }
  }
  log(`所有镜像都失败，返回默认数据: ${lastErr?.message}`);
  return {
    version: '1.0.0',
    tagName: 'v1.0.0',
    name: 'Quchen Radio v1.0.0',
    htmlUrl: `https://github.com/${REPO.owner}/${REPO.name}/releases/latest`,
    releaseNotes: '无法连接 GitHub API，显示默认版本信息。',
    publishedAt: null,
    assets: [],
    warning: '无法连接 GitHub API,显示默认版本信息。',
  };
}

/* ============================================================
   通过镜像下载文件并流式返回给客户端
   支持多镜像回退
   ============================================================ */
function streamFromUrl(targetUrl, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const reqOpts = {
      method: 'GET',
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers: headers || {},
    };
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(reqOpts, (resp) => {
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
        const nextUrl = new URL(resp.headers.location, targetUrl).href;
        resp.resume();
        resolve(streamFromUrl(nextUrl, headers));
        return;
      }
      if (resp.statusCode !== 200) {
        const chunks = [];
        resp.on('data', (c) => chunks.push(c));
        resp.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8').slice(0, 500);
          reject(new Error(`HTTP ${resp.statusCode}: ${text}`));
        });
        return;
      }
      resolve(resp);
    });
    req.on('error', reject);
    req.setTimeout(60000, () => {
      req.destroy(new Error('timeout'));
    });
    req.end();
  });
}

async function streamAssetToClient(res, assetUrl, fallbackPath, fileName) {
  // 先尝试直连 GitHub,再依次尝试镜像
  const candidates = [assetUrl];
  for (const m of MIRRORS) {
    candidates.push(m + assetUrl);
  }
  let lastErr = null;
  for (let i = 0; i < candidates.length; i++) {
    const target = candidates[i];
    try {
      const upstream = await streamFromUrl(target, {
        'User-Agent': 'Quchen-Radio-Website/1.0',
        'Accept': '*/*',
      });
      const headers = {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      };
      if (upstream.headers['content-length']) {
        headers['Content-Length'] = upstream.headers['content-length'];
      }
      res.writeHead(200, headers);
      upstream.pipe(res);
      upstream.on('error', (err) => {
        if (!res.headersSent) {
          sendError(res, 502, '下载流中断: ' + err.message);
        } else {
          res.end();
        }
      });
      return true;
    } catch (err) {
      lastErr = err;
      log(`镜像 ${i + 1}/${candidates.length} 失败: ${target} -> ${err.message}`);
    }
  }
  // 所有镜像都失败,尝试本地 fallback
  if (fallbackPath && fs.existsSync(fallbackPath)) {
    try {
      const stat = fs.statSync(fallbackPath);
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': stat.size,
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      });
      fs.createReadStream(fallbackPath).pipe(res);
      log(`使用本地文件作为回退: ${fallbackPath}`);
      return true;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr) {
    sendError(res, 502, '所有下载源均不可用: ' + lastErr.message);
  }
  return false;
}

/* ============================================================
   API: /api/update/check
   ============================================================ */
async function handleUpdateCheck(res) {
  try {
    const data = await fetchLatestRelease();
    sendJson(res, 200, data);
  } catch (err) {
    log('update check 失败:', err.message);
    // 返回降级数据,避免前端报错
    sendJson(res, 200, {
      version: '1.0.0',
      tagName: 'v1.0.0',
      name: 'Quchen Radio v1.0.0',
      htmlUrl: `https://github.com/${REPO.owner}/${REPO.name}/releases/latest`,
      releaseNotes: '当前为初始版本。',
      publishedAt: null,
      assets: [],
      warning: '无法连接 GitHub API,显示默认版本信息。',
    });
  }
}

/* ============================================================
   API: /api/download/installer
   ============================================================ */
async function handleDownloadInstaller(res) {
  let release;
  try {
    release = await fetchLatestRelease();
  } catch (err) {
    sendError(res, 502, '无法获取 Release 信息: ' + err.message);
    return;
  }
  const version = release.version || '1.0.0';
  const installerAsset = (release.assets || []).find((a) =>
    /Quchen-Radio-.+Setup\.exe$/i.test(a.name || '')
  );
  const fileName = `Quchen-Radio-${version}-Setup.exe`;
  if (!installerAsset) {
    sendError(res, 404, `当前版本 ${version} 暂未发布安装包,请稍后再试。`);
    return;
  }
  log(`开始下载安装包: ${fileName} (源: ${installerAsset.downloadUrl})`);
  const localFallback = path.join(ROOT, 'dist', fileName);
  await streamAssetToClient(res, installerAsset.downloadUrl, localFallback, fileName);
}

/* ============================================================
   API: /api/download/lx-source?id=xxx
   ============================================================ */
async function handleDownloadLxSource(res, parsedUrl) {
  const query = parsedUrl.query || {};
  const id = (query.id || '').trim();
  if (!id) {
    sendError(res, 400, '缺少 id 参数');
    return;
  }
  // 读取 sources.json 找到对应音源
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(SOURCES_JSON, 'utf8'));
  } catch (err) {
    sendError(res, 500, '音源清单读取失败: ' + err.message);
    return;
  }
  const src = (manifest.sources || []).find((s) => s.id === id);
  if (!src) {
    sendError(res, 404, `未找到音源: ${id}`);
    return;
  }
  const fileName = src.fileName || `${src.id}-latest.js`;
  const localPath = path.join(ROOT, src.filePath);
  if (fs.existsSync(localPath)) {
    try {
      const stat = fs.statSync(localPath);
      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': stat.size,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      });
      fs.createReadStream(localPath).pipe(res);
      log(`下载本地音源: ${fileName} (${stat.size} bytes)`);
      return;
    } catch (err) {
      log('本地音源读取失败,改为远程下载:', err.message);
    }
  }
  // 本地不存在则走 GitHub raw + 镜像
  const rawUrl = `https://${REPO.rawHost}/${REPO.owner}/${REPO.name}/main/${src.filePath}`;
  log(`本地音源不存在,从远程下载: ${rawUrl}`);
  const ok = await streamAssetToClient(res, rawUrl, null, fileName);
  if (!ok) {
    // 已经在 streamAssetToClient 中发送错误
  }
}

/* ============================================================
   API: /api/sources
   ============================================================ */
function handleSources(res) {
  try {
    const data = JSON.parse(fs.readFileSync(SOURCES_JSON, 'utf8'));
    sendJson(res, 200, data);
  } catch (err) {
    sendError(res, 500, '音源清单读取失败: ' + err.message);
  }
}

/* ============================================================
   API: /api/changelog
   解析 CHANGELOG.md 为版本列表
   ============================================================ */
function parseChangelog(md) {
  const lines = md.split(/\r?\n/);
  const items = [];
  let current = null;
  let inList = false;
  const reVersion = /^##\s*\[?v?([0-9][^\]\s]*)\]?\s*(?:-|\—)?\s*(.*)$/;
  for (const line of lines) {
    const m = line.match(reVersion);
    if (m) {
      if (current) items.push(current);
      current = {
        version: 'v' + m[1].replace(/^v/, ''),
        date: m[2] ? m[2].trim() : '',
        title: m[2] ? m[2].trim() : '',
        items: [],
      };
      inList = false;
      continue;
    }
    if (!current) continue;
    if (/^\s*[-*]\s+/.test(line)) {
      current.items.push(line.replace(/^\s*[-*]\s+/, '').trim());
      inList = true;
    } else if (/^\s*\d+\.\s+/.test(line)) {
      current.items.push(line.replace(/^\s*\d+\.\s+/, '').trim());
      inList = true;
    } else if (inList && line.trim() === '') {
      inList = false;
    } else if (line.trim() && !line.startsWith('#')) {
      // 续行:追加到最后一条
      if (current.items.length) {
        current.items[current.items.length - 1] += ' ' + line.trim();
      } else if (!current.title) {
        current.title = line.trim();
      }
    }
  }
  if (current) items.push(current);
  return items;
}

function handleChangelog(res) {
  try {
    const md = fs.readFileSync(CHANGELOG_MD, 'utf8');
    const items = parseChangelog(md);
    sendJson(res, 200, { items });
  } catch (err) {
    // 降级:返回最小化日志
    sendJson(res, 200, {
      items: [
        {
          version: 'v1.0.0',
          date: '2026-07-05',
          title: 'Quchen Radio 首个公开版本',
          items: ['Quchen Radio 首个发布版本。'],
        },
      ],
    });
  }
}

/* ============================================================
   静态文件服务
   ============================================================ */
function serveStatic(req, res, parsedUrl) {
  let pathname = decodeURIComponent(parsedUrl.pathname);
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }
  // 安全检查,防止路径穿越
  const filePath = safeJoin(WEBSITE_DIR, pathname);
  if (!filePath) {
    sendError(res, 403, '禁止访问');
    return;
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA 回退到 index.html(但排除 /api/* 路径)
      const indexPath = path.join(WEBSITE_DIR, 'index.html');
      fs.stat(indexPath, (e2, s2) => {
        if (e2 || !s2.isFile()) {
          sendError(res, 404, '文件未找到: ' + pathname);
          return;
        }
        serveFile(res, indexPath, 200);
      });
      return;
    }
    serveFile(res, filePath, 200);
  });
}

function serveFile(res, filePath, code) {
  const mime = getMime(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendError(res, 500, '读取文件失败: ' + err.message);
      return;
    }
    res.writeHead(code || 200, {
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  });
}

/* ============================================================
   路由分发
   ============================================================ */
async function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname || '/';
  const method = req.method || 'GET';

  // CORS 预检
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (method !== 'GET') {
    sendError(res, 405, '仅支持 GET');
    return;
  }

  // API 路由
  if (pathname.startsWith('/api/')) {
    try {
      switch (pathname) {
        case '/api/health':
          sendJson(res, 200, { ok: true, time: Date.now(), port: PORT });
          return;
        case '/api/update/check':
          await handleUpdateCheck(res);
          return;
        case '/api/download/installer':
          await handleDownloadInstaller(res);
          return;
        case '/api/download/lx-source':
          await handleDownloadLxSource(res, parsedUrl);
          return;
        case '/api/sources':
          handleSources(res);
          return;
        case '/api/changelog':
          handleChangelog(res);
          return;
        default:
          sendError(res, 404, '未知 API: ' + pathname);
          return;
      }
    } catch (err) {
      log('API 错误:', pathname, err.message);
      if (!res.headersSent) {
        sendError(res, 500, '服务器内部错误: ' + err.message);
      }
      return;
    }
  }

  // 静态文件
  serveStatic(req, res, parsedUrl);
}

/* ============================================================
   启动服务器
   ============================================================ */
const server = http.createServer(handleRequest);
server.listen(PORT, HOST, () => {
  log(`Quchen Radio 官网服务器已启动`);
  log(`  本地:  http://localhost:${PORT}/`);
  log(`  监听:  ${HOST}:${PORT}`);
  log(`  网站目录: ${WEBSITE_DIR}`);
  log(`  仓库:  https://github.com/${REPO.owner}/${REPO.name}`);
  log(`  外网(通过 natapp): https://quchen.nat100.top/`);
});
server.on('error', (err) => {
  log('服务器错误:', err.message);
  if (err.code === 'EADDRINUSE') {
    log(`端口 ${PORT} 已被占用,请使用 PORT=xxxx 环境变量指定其他端口`);
  }
  process.exit(1);
});
