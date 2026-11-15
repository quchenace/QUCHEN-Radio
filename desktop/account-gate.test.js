'use strict';
/**
 * QuChen Radio 账号门禁自测（node:test，零依赖）：
 *   node --test desktop/account-gate.test.js
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const { AccountGate } = require('./account-gate');

function fakeAccountService() {
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      let body = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch (_) { body = {}; }
      const send = (code, obj) => {
        const buf = Buffer.from(JSON.stringify(obj));
        res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': buf.length });
        res.end(buf);
      };
      if (req.url === '/api/auth/login' && req.method === 'POST') {
        if (body.password === 'RightPass1!') {
          return send(200, {
            access_token: 'at-1',
            refresh_token: 'rt-1',
            expires_in: 1800,
            user: { email: body.email, role: 'user' },
          });
        }
        return send(401, { code: 'bad_credentials', message: '邮箱或密码不正确' });
      }
      if (req.url === '/api/auth/refresh') {
        if (body.refresh_token === 'rt-1') {
          return send(200, { access_token: 'at-2', refresh_token: 'rt-2', expires_in: 1800 });
        }
        return send(401, { code: 'invalid_refresh', message: 'refresh 无效' });
      }
      if (req.url === '/api/auth/logout') return send(200, { ok: true });
      return send(404, { code: 'not_found' });
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve({ baseUrl, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

function tmpGate(baseUrl, overrides) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quchen-radio-gate-'));
  return new AccountGate('radio', Object.assign({ baseUrl, sessionFile: path.join(dir, 'radio.json') }, overrides || {}));
}

test('未登录：unlocked=false，why=no_session', () => {
  const gate = tmpGate('http://127.0.0.1:1');
  assert.equal(gate.unlocked(), false);
  assert.deepEqual(gate.reason().why, 'no_session');
});

test('登录成功落盘，字段与 Python 版一致', async () => {
  const svc = await fakeAccountService();
  try {
    const gate = tmpGate(svc.baseUrl);
    await gate.login('ace@quchen.local', 'RightPass1!');
    assert.equal(gate.unlocked(), true);
    assert.equal(gate.reason().why, 'session');
    const raw = JSON.parse(fs.readFileSync(gate.sessionFile, 'utf8'));
    for (const key of ['app', 'email', 'role', 'access_token', 'refresh_token', 'expires_at', 'issued_at', 'last_verified', 'revoked']) {
      assert.ok(key in raw, `会话文件缺字段 ${key}`);
    }
    assert.equal(raw.email, 'ace@quchen.local');
    assert.equal(raw.app, 'radio');
    assert.ok(!('password' in raw), '不得存密码');
  } finally { await svc.close(); }
});

test('密码错误抛 bad_credentials 且不落盘', async () => {
  const svc = await fakeAccountService();
  try {
    const gate = tmpGate(svc.baseUrl);
    await assert.rejects(gate.login('ace@quchen.local', 'wrong'), (err) => {
      assert.equal(err.status, 401);
      assert.equal(err.code, 'bad_credentials');
      return true;
    });
    assert.equal(gate.unlocked(), false);
    assert.equal(fs.existsSync(gate.sessionFile), false);
  } finally { await svc.close(); }
});

test('服务不可达：抛 unreachable，原有会话在宽限期内仍放行', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quchen-radio-gate-'));
  const file = path.join(dir, 'radio.json');
  const now = Date.now() / 1000;
  fs.writeFileSync(file, JSON.stringify({
    app: 'radio', email: 'ace@quchen.local', access_token: 'at', refresh_token: 'rt',
    expires_at: now - 10, issued_at: now - 86400, last_verified: now - 86400, revoked: false,
  }), 'utf8');
  const gate = new AccountGate('radio', { baseUrl: 'http://127.0.0.1:1', sessionFile: file });
  const fresh = await gate.ensureFresh();
  assert.equal(fresh, false, '网络不通时 ensureFresh 应返回 false');
  assert.equal(gate.unlocked(), true, '离线宽限期内应继续放行');
  assert.equal(gate.reason().offline_days, 1);
});

test('超过 30 天宽限：不放行，why=grace_expired', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quchen-radio-gate-'));
  const file = path.join(dir, 'radio.json');
  const now = Date.now() / 1000;
  fs.writeFileSync(file, JSON.stringify({
    app: 'radio', email: 'ace@quchen.local', access_token: 'at', refresh_token: 'rt',
    expires_at: now - 10, issued_at: now - 40 * 86400, last_verified: now - 40 * 86400, revoked: false,
  }), 'utf8');
  const gate = new AccountGate('radio', { baseUrl: 'http://127.0.0.1:1', sessionFile: file });
  assert.equal(gate.unlocked(), false);
  assert.equal(gate.reason().why, 'grace_expired');
});

test('刷新轮换 refresh 并刷新 last_verified', async () => {
  const svc = await fakeAccountService();
  try {
    const gate = tmpGate(svc.baseUrl);
    await gate.login('ace@quchen.local', 'RightPass1!');
    const st = await gate.refresh();
    assert.equal(st.access_token, 'at-2');
    assert.equal(st.refresh_token, 'rt-2');
    assert.ok(st.last_verified >= st.issued_at);
  } finally { await svc.close(); }
});

test('退出登录清空会话，重新被拦住', async () => {
  const svc = await fakeAccountService();
  try {
    const gate = tmpGate(svc.baseUrl);
    await gate.login('ace@quchen.local', 'RightPass1!');
    await gate.logout();
    assert.equal(gate.unlocked(), false);
    assert.deepEqual(JSON.parse(fs.readFileSync(gate.sessionFile, 'utf8')), {});
  } finally { await svc.close(); }
});

test('开关关闭：一律放行', () => {
  const gate = tmpGate('http://127.0.0.1:1', { enabled: false });
  assert.equal(gate.unlocked(), true);
  assert.equal(gate.reason().why, 'disabled');
});

test('会话文件损坏不崩，按未登录处理', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quchen-radio-gate-'));
  const file = path.join(dir, 'radio.json');
  fs.writeFileSync(file, '{not json', 'utf8');
  const gate = new AccountGate('radio', { baseUrl: 'http://127.0.0.1:1', sessionFile: file });
  assert.equal(gate.unlocked(), false);
  assert.equal(gate.reason().why, 'no_session');
});
