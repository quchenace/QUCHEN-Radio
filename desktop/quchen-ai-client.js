'use strict';

const http = require('http');
const https = require('https');
const { TextDecoder } = require('util');

const DEFAULT_BASE_URL = 'http://127.0.0.1:8791';
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const CHANNELS = Object.freeze({
  models: 'quchenradio-ai-models',
  chat: 'quchenradio-ai-chat',
  cancel: 'quchenradio-ai-cancel',
  chunk: 'quchenradio-ai-chunk',
  done: 'quchenradio-ai-done',
  error: 'quchenradio-ai-error',
});

class QuchenAiError extends Error {
  constructor(message, options) {
    super(message);
    this.name = 'QuchenAiError';
    this.status = options && options.status ? Number(options.status) : 0;
    this.code = options && options.code ? String(options.code) : 'QUCHEN_AI_ERROR';
  }
}

function normalizeBaseUrl(value) {
  const input = String(value || '').trim() || DEFAULT_BASE_URL;
  let parsed;
  try {
    parsed = new URL(input);
  } catch (_) {
    throw new QuchenAiError('QuChen-AI 地址格式无效', { code: 'INVALID_BASE_URL' });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new QuchenAiError('QuChen-AI 地址仅支持 HTTP 或 HTTPS', { code: 'INVALID_BASE_URL' });
  }
  if (parsed.username || parsed.password) {
    throw new QuchenAiError('请在 API key 配置中填写凭据，不要写入地址', { code: 'INVALID_BASE_URL' });
  }
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/+$/, '');
}

function buildApiUrl(baseUrl, resource) {
  let root = normalizeBaseUrl(baseUrl);
  if (root.endsWith('/v1')) root = root.slice(0, -3);
  return new URL(`${root}/v1/${resource}`);
}

function requestHeaders(apiKey, forChat) {
  const headers = { Accept: forChat ? 'text/event-stream, application/json' : 'application/json' };
  const key = String(apiKey || '').trim();
  if (key) headers.Authorization = `Bearer ${key}`;
  if (forChat) headers['Content-Type'] = 'application/json';
  return headers;
}

function transportFor(url) {
  return url.protocol === 'https:' ? https : http;
}

function extractServerMessage(body) {
  if (!body) return '';
  let value = body;
  if (typeof body === 'string') {
    try { value = JSON.parse(body); } catch (_) { value = body; }
  }
  if (!value || typeof value !== 'object') return String(value || '').trim().slice(0, 600);
  if (typeof value.error === 'string') return value.error.trim().slice(0, 600);
  if (value.error && typeof value.error.message === 'string') return value.error.message.trim().slice(0, 600);
  if (typeof value.message === 'string') return value.message.trim().slice(0, 600);
  return '';
}

function httpError(status, body) {
  const labels = {
    400: '请求参数无效',
    401: 'API key 无效或缺失',
    403: 'QuChen-AI 拒绝了请求',
    404: '接口或模型不存在',
    409: '请求冲突，请稍后重试',
    429: '请求过于频繁或额度不足',
    500: 'QuChen-AI 服务内部错误',
  };
  const label = labels[status] || (status >= 500 ? 'QuChen-AI 服务错误' : 'QuChen-AI 请求失败');
  const detail = extractServerMessage(body);
  return new QuchenAiError(`${label}（HTTP ${status}）${detail ? `：${detail}` : ''}`, {
    status,
    code: 'HTTP_ERROR',
  });
}

function networkError(error, baseUrl) {
  if (error instanceof QuchenAiError) return error;
  if (error && error.name === 'AbortError') {
    return new QuchenAiError('请求已取消', { code: 'ABORTED' });
  }
  const detail = error && error.message ? String(error.message) : String(error || '未知网络错误');
  return new QuchenAiError(`连接 QuChen-AI 失败（${normalizeBaseUrl(baseUrl)}）：${detail}`, {
    code: error && error.code ? error.code : 'NETWORK_ERROR',
  });
}

function readBody(response, maxBytes) {
  const limit = maxBytes || MAX_RESPONSE_BYTES;
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    function fail(error) {
      if (settled) return;
      settled = true;
      reject(error);
    }
    response.on('data', (chunk) => {
      if (settled) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > limit) {
        fail(new QuchenAiError('QuChen-AI 响应过大', { code: 'RESPONSE_TOO_LARGE' }));
        response.destroy();
        return;
      }
      chunks.push(buffer);
    });
    response.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    response.on('aborted', () => fail(new QuchenAiError('QuChen-AI 响应中断', { code: 'RESPONSE_ABORTED' })));
    response.on('error', fail);
  });
}

function parseJsonBody(body) {
  try {
    return JSON.parse(body);
  } catch (_) {
    throw new QuchenAiError('QuChen-AI 返回了无效 JSON', { code: 'INVALID_JSON' });
  }
}

function errorFromPayload(payload) {
  if (!payload || !payload.error) return null;
  const detail = extractServerMessage(payload) || '未知错误';
  return new QuchenAiError(`QuChen-AI 返回错误：${detail}`, { code: 'API_ERROR' });
}

function choiceContent(payload, streaming) {
  const choice = payload && Array.isArray(payload.choices) ? payload.choices[0] : null;
  if (!choice) return '';
  const source = streaming ? choice.delta : (choice.message || choice.delta);
  let content = source && source.content;
  if (content == null && typeof choice.text === 'string') content = choice.text;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === 'string') return part;
      return part && typeof part.text === 'string' ? part.text : '';
    }).join('');
  }
  return '';
}

class OpenAISseParser {
  constructor(options) {
    this.options = options || {};
    this.buffer = '';
    this.dataLines = [];
    this.eventType = '';
    this.content = '';
    this.done = false;
  }

  push(text) {
    if (this.done) return;
    this.buffer += String(text || '');
    let newline;
    while (!this.done && (newline = this.buffer.indexOf('\n')) >= 0) {
      let line = this.buffer.slice(0, newline);
      this.buffer = this.buffer.slice(newline + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      this.processLine(line);
    }
  }

  end() {
    if (this.done) return this.content;
    if (this.buffer) {
      let line = this.buffer;
      this.buffer = '';
      if (line.endsWith('\r')) line = line.slice(0, -1);
      this.processLine(line);
    }
    this.dispatch();
    return this.content;
  }

  processLine(line) {
    if (!line) {
      this.dispatch();
      return;
    }
    if (line.startsWith(':')) return;
    const colon = line.indexOf(':');
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'data') this.dataLines.push(value);
    else if (field === 'event') this.eventType = value;
  }

  dispatch() {
    if (this.done || !this.dataLines.length) {
      this.eventType = '';
      return;
    }
    const data = this.dataLines.join('\n');
    const eventType = this.eventType;
    this.dataLines = [];
    this.eventType = '';
    if (data.trim() === '[DONE]') {
      this.done = true;
      if (typeof this.options.onDone === 'function') this.options.onDone();
      return;
    }
    let payload;
    try {
      payload = JSON.parse(data);
    } catch (_) {
      if (eventType === 'error') {
        throw new QuchenAiError(`QuChen-AI 返回错误：${data.slice(0, 600)}`, { code: 'API_ERROR' });
      }
      throw new QuchenAiError('QuChen-AI 返回了无效 SSE 数据', { code: 'INVALID_SSE' });
    }
    if (eventType === 'error') {
      const detail = extractServerMessage(payload) || '未知错误';
      throw new QuchenAiError(`QuChen-AI 返回错误：${detail}`, { code: 'API_ERROR' });
    }
    const apiError = errorFromPayload(payload);
    if (apiError) throw apiError;
    const content = choiceContent(payload, true);
    if (content) {
      this.content += content;
      if (typeof this.options.onContent === 'function') this.options.onContent(content);
    }
  }
}

function consumeSse(response, onContent) {
  return new Promise((resolve, reject) => {
    const decoder = new TextDecoder('utf-8');
    let settled = false;
    let parser;
    function cleanup() {
      response.removeListener('data', onData);
      response.removeListener('end', onEnd);
      response.removeListener('aborted', onAborted);
      response.removeListener('error', onError);
    }
    function succeed() {
      if (settled) return;
      settled = true;
      cleanup();
      response.resume();
      resolve({ content: parser.content });
    }
    function fail(error) {
      if (settled) return;
      settled = true;
      cleanup();
      response.destroy();
      reject(error);
    }
    function onData(chunk) {
      try {
        parser.push(decoder.decode(chunk, { stream: true }));
      } catch (error) { fail(error); }
    }
    function onEnd() {
      try {
        parser.push(decoder.decode());
        parser.end();
        succeed();
      } catch (error) { fail(error); }
    }
    function onAborted() {
      fail(new QuchenAiError('QuChen-AI 流式响应中断', { code: 'RESPONSE_ABORTED' }));
    }
    function onError(error) { fail(error); }
    parser = new OpenAISseParser({ onContent, onDone: succeed });
    response.on('data', onData);
    response.on('end', onEnd);
    response.on('aborted', onAborted);
    response.on('error', onError);
  });
}

function requestModels(options) {
  const settings = options || {};
  const url = buildApiUrl(settings.baseUrl, 'models');
  return new Promise((resolve, reject) => {
    const request = transportFor(url).request(url, {
      method: 'GET',
      headers: requestHeaders(settings.apiKey, false),
    }, (response) => {
      readBody(response).then((body) => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw httpError(response.statusCode, body);
        }
        const payload = parseJsonBody(body);
        const apiError = errorFromPayload(payload);
        if (apiError) throw apiError;
        if (!payload || !Array.isArray(payload.data)) {
          throw new QuchenAiError('模型列表格式无效：缺少 data 数组', { code: 'INVALID_MODELS' });
        }
        const models = payload.data.map((item) => {
          if (typeof item === 'string') return item.trim();
          return item && typeof item.id === 'string' ? item.id.trim() : '';
        }).filter(Boolean);
        resolve(models);
      }).catch(reject);
    });
    request.setTimeout(15000, () => {
      request.destroy(new QuchenAiError('连接 QuChen-AI 超时', { code: 'TIMEOUT' }));
    });
    request.on('error', (error) => reject(networkError(error, settings.baseUrl)));
    request.end();
  });
}

function requestChat(options, onContent) {
  const settings = options || {};
  const model = String(settings.model || '').trim();
  if (!model) throw new QuchenAiError('请选择模型', { code: 'MODEL_REQUIRED' });
  if (!Array.isArray(settings.messages) || !settings.messages.length) {
    throw new QuchenAiError('聊天消息不能为空', { code: 'MESSAGES_REQUIRED' });
  }
  const messages = settings.messages.map((message) => ({
    role: String(message && message.role || 'user'),
    content: String(message && message.content != null ? message.content : ''),
  }));
  const url = buildApiUrl(settings.baseUrl, 'chat/completions');
  let request;
  const completion = new Promise((resolve, reject) => {
    request = transportFor(url).request(url, {
      method: 'POST',
      headers: requestHeaders(settings.apiKey, true),
    }, (response) => {
      const contentType = String(response.headers['content-type'] || '').toLowerCase();
      if (response.statusCode < 200 || response.statusCode >= 300) {
        readBody(response).then((body) => reject(httpError(response.statusCode, body))).catch(reject);
        return;
      }
      if (contentType.includes('text/event-stream')) {
        consumeSse(response, onContent).then(resolve).catch(reject);
        return;
      }
      readBody(response).then((body) => {
        const payload = parseJsonBody(body);
        const apiError = errorFromPayload(payload);
        if (apiError) throw apiError;
        const content = choiceContent(payload, false);
        if (content && typeof onContent === 'function') onContent(content);
        resolve({ content });
      }).catch(reject);
    });
    request.on('error', (error) => reject(networkError(error, settings.baseUrl)));
    request.end(JSON.stringify({ model, messages, stream: true }));
  });
  return { request, completion };
}

function publicError(error) {
  return {
    message: String(error && error.message || error || '未知错误'),
    status: Number(error && error.status) || 0,
    code: String(error && error.code || 'QUCHEN_AI_ERROR'),
  };
}

function canSend(webContents) {
  return webContents && (typeof webContents.isDestroyed !== 'function' || !webContents.isDestroyed());
}

class QuchenAiBridge {
  constructor(ipcMain) {
    this.ipcMain = ipcMain;
    this.requests = new Map();
  }

  install() {
    this.ipcMain.handle(CHANNELS.models, async (_event, payload) => {
      try {
        return { models: await requestModels(payload || {}) };
      } catch (error) {
        throw new Error(publicError(error).message);
      }
    });
    this.ipcMain.on(CHANNELS.chat, (event, payload) => this.startChat(event.sender, payload || {}));
    this.ipcMain.on(CHANNELS.cancel, (event, payload) => {
      this.cancelChat(event.sender, payload && payload.requestId);
    });
    return this;
  }

  send(webContents, channel, payload) {
    if (!canSend(webContents)) return;
    try { webContents.send(channel, payload); } catch (_) {}
  }

  startChat(webContents, payload) {
    const requestId = String(payload.requestId || '');
    if (!requestId || this.requests.has(requestId)) {
      this.send(webContents, CHANNELS.error, {
        requestId,
        error: { message: '请求 ID 无效或重复', status: 0, code: 'INVALID_REQUEST_ID' },
      });
      return;
    }
    const record = {
      requestId,
      webContents,
      request: null,
      content: '',
      settled: false,
      onDestroyed: null,
    };
    record.onDestroyed = () => this.abort(record, false);
    this.requests.set(requestId, record);
    if (webContents && typeof webContents.once === 'function') webContents.once('destroyed', record.onDestroyed);
    let operation;
    try {
      operation = requestChat(payload, (content) => {
        if (record.settled) return;
        record.content += content;
        this.send(webContents, CHANNELS.chunk, { requestId, content });
      });
      record.request = operation.request;
    } catch (error) {
      this.finish(record, 'error', { error: publicError(error) });
      return;
    }
    operation.completion.then((result) => {
      this.finish(record, 'done', { content: result.content, cancelled: false });
    }).catch((error) => {
      this.finish(record, 'error', { error: publicError(error) });
    });
  }

  finish(record, type, payload) {
    if (!record || record.settled) return;
    record.settled = true;
    if (this.requests.get(record.requestId) === record) this.requests.delete(record.requestId);
    if (record.webContents && typeof record.webContents.removeListener === 'function') {
      record.webContents.removeListener('destroyed', record.onDestroyed);
    }
    this.send(record.webContents, type === 'done' ? CHANNELS.done : CHANNELS.error, Object.assign({
      requestId: record.requestId,
    }, payload));
  }

  abort(record, notify) {
    if (!record || record.settled) return;
    if (notify) this.finish(record, 'done', { content: record.content, cancelled: true });
    else {
      record.settled = true;
      this.requests.delete(record.requestId);
      if (record.webContents && typeof record.webContents.removeListener === 'function') {
        record.webContents.removeListener('destroyed', record.onDestroyed);
      }
    }
    if (record.request && !record.request.destroyed) record.request.destroy();
  }

  cancelChat(webContents, requestId) {
    const record = this.requests.get(String(requestId || ''));
    if (!record || record.webContents !== webContents) return;
    this.abort(record, true);
  }

  dispose() {
    Array.from(this.requests.values()).forEach((record) => this.abort(record, false));
    this.requests.clear();
  }
}

function installQuchenAiIpc(options) {
  return new QuchenAiBridge(options.ipcMain).install();
}

module.exports = {
  CHANNELS,
  DEFAULT_BASE_URL,
  OpenAISseParser,
  QuchenAiBridge,
  QuchenAiError,
  buildApiUrl,
  consumeSse,
  httpError,
  installQuchenAiIpc,
  normalizeBaseUrl,
  publicError,
  requestChat,
  requestModels,
};
