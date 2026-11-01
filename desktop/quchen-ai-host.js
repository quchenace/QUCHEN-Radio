'use strict';

/* QUCHEN Radio - QuChen AI 本地服务托管模块
 *
 * 职责：QUCHEN Radio 主进程随应用托管/拉起 QuChen AI 本地服务，使 AI 与音乐
 *       同一应用不可分割（不引入新外部依赖，全部复用 D:\ai-stack 既有资产）：
 *   - Ollama      127.0.0.1:11434（绿色版 ollama.exe，模型目录 D:\ai-stack\models，不占 C 盘）
 *   - AI 控制台   127.0.0.1:8099（AI App 以 --headless 纯服务形态运行，界面统一在音乐 App 内）
 *
 * 策略：
 *   - 端口已被占用（外部已启动）时直接复用，绝不重复拉起；
 *   - 仅回收由本进程拉起的子进程；退出时同步清理，不影响用户单独使用 QuChen AI 桌面端；
 *   - headless 模式下向 AI 注入 QUCHEN_AI_RADIO_DISABLED=1，禁止 AI 侧反向托管音乐 exe。
 */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const AI_STACK_BASE = process.env.QUCHEN_AI_BASE || process.env.AI_STACK_BASE || 'D:\\ai-stack';
const AI_APP_DIR = path.join(AI_STACK_BASE, 'app');
const AI_ELECTRON = path.join(AI_APP_DIR, 'node_modules', 'electron', 'dist', 'electron.exe');
const OLLAMA_EXE = path.join(AI_STACK_BASE, 'ollama', 'ollama.exe');
const OLLAMA_MODELS = path.join(AI_STACK_BASE, 'models');
const OLLAMA_PORT = 11434;
const CONSOLE_PORT = 8099;
const CONSOLE_URL = 'http://127.0.0.1:8099';

const managed = { ollama: null, console: null };
let ensureStarted = false;

/* ---- 端口 / HTTP 探测（只读） ---- */
function probeHttp(url, timeoutMs) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs || 1200 }, (res) => {
      res.resume();
      res.on('end', () => resolve(true));
      resolve(true);
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
  });
}

async function probeOllama() { return probeHttp(`http://127.0.0.1:${OLLAMA_PORT}/api/version`, 1200); }
async function probeConsole() { return probeHttp(`${CONSOLE_URL}/api/status`, 1500); }

function waitPort(probe, timeoutMs) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const iv = setInterval(async () => {
      if (await probe()) { clearInterval(iv); resolve(true); return; }
      if (Date.now() - t0 > timeoutMs) { clearInterval(iv); resolve(false); }
    }, 400);
  });
}

/* ---------------- 拉起 Ollama ---------------- */
function startOllama() {
  return new Promise((resolve) => {
    if (!fs.existsSync(OLLAMA_EXE)) {
      resolve({ ok: false, error: `未找到 ollama.exe：${OLLAMA_EXE}` });
      return;
    }
    try {
      fs.mkdirSync(OLLAMA_MODELS, { recursive: true });
    } catch (e) { /* 目录已存在或不可写，交给 ollama 报错 */ }
    console.log('[QuChen AI Host] 启动 Ollama serve（models=' + OLLAMA_MODELS + '）');
    const proc = spawn(OLLAMA_EXE, ['serve'], {
      env: Object.assign({}, process.env, { OLLAMA_MODELS }),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    managed.ollama = proc;
    proc.stdout.on('data', (d) => console.log('[QuChen AI Host][ollama] ' + String(d).trim()));
    proc.stderr.on('data', (d) => console.log('[QuChen AI Host][ollama] ' + String(d).trim()));
    proc.on('exit', (code) => {
      console.log('[QuChen AI Host] Ollama 退出 code=' + code);
      if (managed.ollama === proc) managed.ollama = null;
    });
    proc.on('error', (err) => {
      console.error('[QuChen AI Host] Ollama 启动失败：' + (err && err.message ? err.message : err));
      if (managed.ollama === proc) managed.ollama = null;
      resolve({ ok: false, error: String((err && err.message) || err) });
    });
    waitPort(probeOllama, 30000).then((up) => {
      resolve(up ? { ok: true } : { ok: false, error: 'Ollama 启动超时（127.0.0.1:11434）' });
    });
  });
}

/* ---------------- 拉起 AI 控制台（headless） ---------------- */
function startConsole() {
  return new Promise((resolve) => {
    if (!fs.existsSync(AI_ELECTRON) || !fs.existsSync(path.join(AI_APP_DIR, 'main.js'))) {
      resolve({ ok: false, error: `AI App 不完整：${AI_APP_DIR}` });
      return;
    }
    console.log('[QuChenAI Host] 拉起 QuChen AI 控制台（headless）：' + AI_ELECTRON + ' ' + AI_APP_DIR);
    const proc = spawn(AI_ELECTRON, [AI_APP_DIR, '--headless'], {
      env: Object.assign({}, process.env, {
        QUCHEN_AI_HEADLESS: '1',
        QUCHEN_AI_RADIO_DISABLED: '1', // 避免 AI 侧反向托管音乐 exe（本进程已承载）
      }),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });
    managed.console = proc;
    proc.stdout.on('data', (d) => console.log('[QuChen AI Host][ai] ' + String(d).trim()));
    proc.stderr.on('data', (d) => console.log('[QuChen AI Host][ai] ' + String(d).trim()));
    proc.on('exit', (code) => {
      console.log('[QuChen AI Host] AI 控制台退出 code=' + code);
      if (managed.console === proc) managed.console = null;
    });
    proc.on('error', (err) => {
      console.error('[QuChen AI Host] AI 控制台启动失败：' + (err && err.message ? err.message : err));
      if (managed.console === proc) managed.console = null;
      resolve({ ok: false, error: String((err && err.message) || err) });
    });
    waitPort(probeConsole, 40000).then((up) => {
      resolve(up ? { ok: true } : { ok: false, error: 'AI 控制台启动超时（127.0.0.1:8099）' });
    });
  });
}

/* ---------------- 对外 API ---------------- */
async function ensureAiServices() {
  if (ensureStarted) return getAiServiceState();
  ensureStarted = true;
  const [ollamaUp, consoleUp] = [await probeOllama(), await probeConsole()];
  const results = { ollama: { preexisting: ollamaUp }, console: { preexisting: consoleUp } };
  if (!ollamaUp) results.ollama.res = await startOllama();
  if (!consoleUp) results.console.res = await startConsole();
  console.log('[QuChenAI Host] 服务就绪：' + JSON.stringify(results));
  return getAiServiceState();
}

function stopAiServices() {
  const stopped = { ollama: false, console: false };
  if (managed.console) {
    stopProc(managed.console);
    managed.console = null;
    stopped.console = true;
  }
  if (managed.ollama) {
    stopProc(managed.ollama);
    managed.ollama = null;
    stopped.ollama = true;
  }
  if (stopped.console || stopped.ollama) {
    console.log('[QuChenAI Host] 已停止本进程托管的 AI 子服务：' + JSON.stringify(stopped));
  }
  return stopped;
}

function stopProc(proc) {
  try {
    if (!proc || proc.killed) return;
    proc.kill('SIGTERM');
  } catch (e) { /* 已经退出则忽略 */ }
}

async function getAiServiceState() {
  const [ollamaUp, consoleUp] = [await probeOllama(), await probeConsole()];
  return {
    online: consoleUp,
    baseUrl: CONSOLE_URL,
    ollamaOnline: ollamaUp,
    ollamaPort: OLLAMA_PORT,
    consolePort: CONSOLE_PORT,
    managedOllama: !!managed.ollama,
    managedConsole: !!managed.console,
    aiStackBase: AI_STACK_BASE,
  };
}

module.exports = {
  ensureAiServices,
  stopAiServices,
  getAiServiceState,
  CONSOLE_URL,
};