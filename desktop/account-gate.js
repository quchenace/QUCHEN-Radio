'use strict';
/**
 * QuChen 账号门禁（Electron / Node 版）。
 *
 * 与 QuChen-AI 的 serve/authgate.py 保持同一套语义与同一个会话文件格式：
 *   %APPDATA%\QuChen\auth\<app>.json  （POSIX: ~/.config/QuChen/auth/<app>.json）
 * 只存令牌与邮箱，不存密码。
 *
 *   login()       -> POST {base}/api/auth/login     落盘 access/refresh
 *   refresh()     -> POST {base}/api/auth/refresh   轮换 refresh
 *   unlocked()    -> 令牌有效，或在 7 天离线宽限期内
 *   logout()      -> POST {base}/api/auth/logout    清空本地会话
 *
 * 零第三方依赖，只用 node:http(s) / fs / os / path。
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const { URL } = require('node:url');

const DEFAULT_BASE = process.env.QUCHEN_AUTH_BASE || 'https://frp-any.com:19549';
const OFFLINE_GRACE_DAYS = 7;   // 离线宽限收紧：默认 7 天；服务端下发更严格时以服务端为准
const REFRESH_SKEW = 24 * 3600;   // access 快到期时提前续

function sessionDir() {
  if (process.platform === 'win32') {
    const root = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(root, 'QuChen', 'auth');
  }
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'QuChen', 'auth');
}

class AccountError extends Error {
  constructor(status, code, message) {
    super(message || code || 'account error');
    this.name = 'AccountError';
    this.status = status;
    this.code = code;
  }
}

/* 自家服务（frp-any.com / natfrp.cloud / traesite.cn）使用自签证书，客户端放宽校验 */
const SELF_HOSTS = ['frp-any.com', 'natfrp.cloud', 'traesite.cn'];
const insecureAgent = new https.Agent({ rejectUnauthorized: false });
function tlsOpts(url) {
  const host = String(url.hostname || '').toLowerCase();
  const self = SELF_HOSTS.some((s) => host === s || host.endsWith('.' + s));
  return self && url.protocol === 'https:' ? { agent: insecureAgent } : {};
}

function postJSON(baseUrl, apiPath, payload, token) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(baseUrl.replace(/\/+$/, '') + apiPath);
    } catch (err) {
      reject(new AccountError(0, 'bad_base', `账号服务地址无效：${baseUrl}`));
      return;
    }
    const body = Buffer.from(JSON.stringify(payload || {}), 'utf8');
    const lib = url.protocol === 'https:' ? https : http;
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': body.length,
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const req = lib.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers,
      ...tlsOpts(url),
      timeout: 12000,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let data = {};
        try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = {}; }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new AccountError(res.statusCode, data.code || 'http_error',
            data.message || `账号服务返回 ${res.statusCode}`));
        }
      });
    });
    req.on('timeout', () => {
      req.destroy(new AccountError(0, 'unreachable', '账号服务响应超时'));
    });
    req.on('error', (err) => {
      if (err instanceof AccountError) reject(err);
      else reject(new AccountError(0, 'unreachable', `账号服务不可达：${err.message || err}`));
    });
    req.write(body);
    req.end();
  });
}

class AccountGate {
  /**
   * @param {string} app        会话文件名（ai / radio / vpn / debug）
   * @param {object} [opts]     { baseUrl, sessionFile, enabled, graceDays, deviceName }
   */
  constructor(app, opts = {}) {
    this.app = app;
    this.baseUrl = String(opts.baseUrl || DEFAULT_BASE).replace(/\/+$/, '');
    this.graceDays = Number.isFinite(opts.graceDays) ? opts.graceDays : OFFLINE_GRACE_DAYS;
    this.enabled = opts.enabled !== false;
    this.deviceName = opts.deviceName || app;
    this.sessionFile = opts.sessionFile || path.join(sessionDir(), `${app}.json`);
    this._state = this._load();
  }

  // ---------- 会话文件 ----------
  _load() {
    try {
      const data = JSON.parse(fs.readFileSync(this.sessionFile, 'utf8'));
      return data && typeof data === 'object' ? data : {};
    } catch (_) {
      return {};
    }
  }

  _save(state) {
    this._state = state;
    try {
      fs.mkdirSync(path.dirname(this.sessionFile), { recursive: true });
      const tmp = `${this.sessionFile}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
      fs.renameSync(tmp, this.sessionFile);
    } catch (_) {
      // 只读盘时不致命：本次进程内仍按内存状态放行
    }
  }

  state() {
    return { ...this._state };
  }

  // ---------- 判定 ----------
  unlocked() {
    if (!this.enabled) return true;
    const st = this._state;
    if (!st.refresh_token) return false;
    if (st.revoked) return false;
    const now = Date.now() / 1000;
    const verified = Number(st.last_verified) || 0;
    if (verified && now - verified <= this.graceDays * 86400) return true;
    const issued = Number(st.issued_at) || 0;
    return Boolean(issued && now - issued <= this.graceDays * 86400);
  }

  reason() {
    const st = this._state;
    if (!this.enabled) return { unlocked: true, why: 'disabled' };
    if (!st.refresh_token) return { unlocked: false, why: 'no_session' };
    if (st.revoked) return { unlocked: false, why: 'revoked', email: st.email };
    if (this.unlocked()) {
      const ref = Number(st.last_verified) || Number(st.issued_at) || 0;
      const age = ref ? Math.floor((Date.now() / 1000 - ref) / 86400) : 0;
      return { unlocked: true, why: 'session', email: st.email, role: st.role, offline_days: age };
    }
    return { unlocked: false, why: 'grace_expired', email: st.email };
  }

  // ---------- 联网动作 ----------
  /** 发送邮箱验证码（purpose: register / reset / login）。 */
  async sendCode(email, purpose = 'register') {
    const target = String(email || '').trim().toLowerCase();
    if (!target) throw new AccountError(400, 'bad_request', '请填写邮箱');
    return postJSON(this.baseUrl, '/api/auth/send-code', { email: target, purpose });
  }

  /**
   * 邮箱验证码注册。服务端开了 require_approval 时返回 status='pending'，
   * 账号要先经管理员审批才能登录；未开审批时 status='active'，可立即 login()。
   */
  async register(email, code, password) {
    const target = String(email || '').trim().toLowerCase();
    return postJSON(this.baseUrl, '/api/auth/register', {
      email: target,
      code: String(code || '').trim(),
      password: String(password || ''),
      device_id: this.app,
      device_name: this.deviceName,
    });
  }

  async login(email, password) {
    const data = await postJSON(this.baseUrl, '/api/auth/login', {
      email,
      password,
      device_id: this.app,
      device_name: this.deviceName,
    });
    const now = Date.now() / 1000;
    const user = data.user || {};
    const state = {
      app: this.app,
      email: user.email || email,
      role: user.role || null,
      access_token: data.access_token || null,
      refresh_token: data.refresh_token || null,
      expires_at: now + (Number(data.expires_in) || 1800),
      issued_at: now,
      last_verified: now,
      revoked: false,
    };
    const gd = Number(data.offline_grace_days);
    if (Number.isFinite(gd) && gd >= 0 && gd < this.graceDays) this.graceDays = gd;
    this._save(state);
    return { ...state };
  }

  async refresh() {
    const rt = this._state.refresh_token;
    if (!rt) throw new AccountError(401, 'no_session', '尚未登录');
    const data = await postJSON(this.baseUrl, '/api/auth/refresh', { refresh_token: rt });
    const now = Date.now() / 1000;
    const state = {
      ...this._state,
      access_token: data.access_token || null,
      refresh_token: data.refresh_token || rt,
      expires_at: now + (Number(data.expires_in) || 1800),
      last_verified: now,
      revoked: false,
    };
    this._save(state);
    return { ...state };
  }

  /** access 快过期就续一次；网络不通返回 false 但不清会话（离线宽限内继续可用）。 */
  async ensureFresh() {
    const st = this._state;
    if (!st.refresh_token) return false;
    if ((Number(st.expires_at) || 0) - Date.now() / 1000 > REFRESH_SKEW) return true;
    try {
      await this.refresh();
      return true;
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        this._save({ ...this._state, revoked: true });
      }
      return false;
    }
  }

  async logout() {
    const st = this._state;
    if (st.refresh_token) {
      try {
        await postJSON(this.baseUrl, '/api/auth/logout', { refresh_token: st.refresh_token }, st.access_token);
      } catch (_) { /* 离线也允许本地退出 */ }
    }
    this._save({});
  }

  async entitlement() {
    const st = this._state;
    if (!st.access_token) return {};
    try {
      // GET 语义：用一次空 body POST 之外的实现不必要，这里直接复用登录态查询
      const url = new URL(`${this.baseUrl}/api/auth/entitlement`);
      const lib = url.protocol === 'https:' ? https : http;
      return await new Promise((resolve) => {
        const req = lib.request({
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname,
          method: 'GET',
          headers: { Authorization: `Bearer ${st.access_token}` },
          ...tlsOpts(url),
          timeout: 8000,
        }, (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (_) { resolve({}); }
          });
        });
        req.on('timeout', () => { req.destroy(); resolve({}); });
        req.on('error', () => resolve({}));
        req.end();
      });
    } catch (_) {
      return {};
    }
  }
}

module.exports = { AccountGate, AccountError, sessionDir, DEFAULT_BASE, OFFLINE_GRACE_DAYS };
