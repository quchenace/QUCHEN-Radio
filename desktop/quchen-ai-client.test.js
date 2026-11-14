'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { EventEmitter } = require('events');
const {
  CHANNELS,
  OpenAISseParser,
  QuchenAiBridge,
  buildApiUrl,
  normalizeBaseUrl,
  requestChat,
  requestModels,
} = require('./quchen-ai-client');

async function withServer(handler, run) {
  const server = http.createServer(handler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    return await run(baseUrl, server);
  } finally {
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function json(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  response.end(body);
}

class FakeWebContents extends EventEmitter {
  constructor() {
    super();
    this.destroyed = false;
    this.sent = [];
  }

  isDestroyed() { return this.destroyed; }

  send(channel, payload) {
    this.sent.push({ channel, payload });
    this.emit(`sent:${channel}`, payload);
  }

  next(channel) {
    const existing = this.sent.find((item) => item.channel === channel);
    if (existing) return Promise.resolve(existing.payload);
    return new Promise((resolve) => this.once(`sent:${channel}`, resolve));
  }
}

test('base URL defaults and accepts a root or /v1 address', () => {
  assert.equal(normalizeBaseUrl(''), 'http://127.0.0.1:8791');
  assert.equal(buildApiUrl('http://127.0.0.1:8791/', 'models').href, 'http://127.0.0.1:8791/v1/models');
  assert.equal(buildApiUrl('http://127.0.0.1:8791/v1/', 'chat/completions').href, 'http://127.0.0.1:8791/v1/chat/completions');
  assert.throws(() => normalizeBaseUrl('file:///tmp/model'), /HTTP 或 HTTPS/);
});

test('SSE parser handles split chunks, CRLF, comments and multi-line data', () => {
  const chunks = [];
  const parser = new OpenAISseParser({ onContent: (content) => chunks.push(content) });
  const source = ': keepalive\r\n' +
    'data: {"choices":[{"delta":{"content":"你"}}]}\r\n\r\n' +
    'data: {"choices":\r\n' +
    'data: [{"delta":{"content":"好"}}]}\r\n\r\n' +
    'data: [DONE]\r\n\r\n';
  for (const character of source) parser.push(character);
  parser.end();
  assert.equal(parser.content, '你好');
  assert.deepEqual(chunks, ['你', '好']);
  assert.equal(parser.done, true);
});

test('SSE parser flushes [DONE] without a trailing blank line', () => {
  let done = false;
  const parser = new OpenAISseParser({ onDone: () => { done = true; } });
  parser.push('data: [DONE]');
  parser.end();
  assert.equal(done, true);
  assert.equal(parser.done, true);
});

test('model enumeration parses OpenAI data and sends an optional bearer key', async () => {
  await withServer((request, response) => {
    assert.equal(request.method, 'GET');
    assert.equal(request.url, '/v1/models');
    assert.equal(request.headers.authorization, 'Bearer test-key');
    json(response, 200, { object: 'list', data: [{ id: 'alpha' }, { id: 'beta' }, { name: 'ignored' }] });
  }, async (baseUrl) => {
    assert.deepEqual(await requestModels({ baseUrl, apiKey: 'test-key' }), ['alpha', 'beta']);
  });
});

test('model enumeration surfaces HTTP error bodies', async () => {
  for (const status of [401, 404, 409, 429, 500]) {
    await withServer((_request, response) => {
      json(response, status, { error: { message: `detail-${status}` } });
    }, async (baseUrl) => {
      await assert.rejects(
        requestModels({ baseUrl }),
        (error) => error.status === status && error.message.includes(`HTTP ${status}`) && error.message.includes(`detail-${status}`)
      );
    });
  }
});

test('streaming chat preserves UTF-8 across arbitrary network chunks', async () => {
  await withServer(async (request, response) => {
    const body = JSON.parse(await readRequestBody(request));
    assert.equal(request.url, '/v1/chat/completions');
    assert.equal(body.model, 'alpha');
    assert.equal(body.stream, true);
    assert.deepEqual(body.messages, [{ role: 'user', content: 'hello' }]);
    assert.equal(request.headers.authorization, 'Bearer secret');
    response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
    const payload = Buffer.from(
      'data: {"choices":[{"delta":{"content":"你"}}]}\n\n' +
      'data: {"choices":\n' +
      'data: [{"delta":{"content":"好"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"！"}}]}\n\n' +
      'data: [DONE]\n\n'
    );
    const cuts = [0, 3, 19, 41, 58, 83, 109, 137, payload.length];
    let index = 0;
    function writeNext() {
      if (index >= cuts.length - 1) {
        response.end();
        return;
      }
      response.write(payload.subarray(cuts[index], cuts[index + 1]));
      index += 1;
      setImmediate(writeNext);
    }
    writeNext();
  }, async (baseUrl) => {
    const chunks = [];
    const operation = requestChat({
      baseUrl,
      apiKey: 'secret',
      model: 'alpha',
      messages: [{ role: 'user', content: 'hello' }],
    }, (content) => chunks.push(content));
    assert.deepEqual(await operation.completion, { content: '你好！' });
    assert.equal(chunks.join(''), '你好！');
  });
});

test('non-streaming JSON chat emits one content chunk', async () => {
  await withServer((_request, response) => {
    json(response, 200, { choices: [{ message: { role: 'assistant', content: 'complete answer' } }] });
  }, async (baseUrl) => {
    const chunks = [];
    const operation = requestChat({
      baseUrl,
      model: 'alpha',
      messages: [{ role: 'user', content: 'hello' }],
    }, (content) => chunks.push(content));
    assert.deepEqual(await operation.completion, { content: 'complete answer' });
    assert.deepEqual(chunks, ['complete answer']);
  });
});

test('SSE error frames reject with the server detail', async () => {
  await withServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/event-stream' });
    response.end('data: {"error":{"message":"stream failed"}}\n\n');
  }, async (baseUrl) => {
    const operation = requestChat({ baseUrl, model: 'alpha', messages: [{ role: 'user', content: 'hello' }] });
    await assert.rejects(operation.completion, (error) => error.code === 'API_ERROR' && error.message.includes('stream failed'));
  });
});

test('named SSE error events reject with message payloads', async () => {
  await withServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/event-stream' });
    response.end('event: error\ndata: {"message":"named stream failure"}\n\n');
  }, async (baseUrl) => {
    const operation = requestChat({ baseUrl, model: 'alpha', messages: [{ role: 'user', content: 'hello' }] });
    await assert.rejects(operation.completion, (error) => error.code === 'API_ERROR' && error.message.includes('named stream failure'));
  });
});

test('chat HTTP errors include status and response detail', async () => {
  await withServer((_request, response) => {
    json(response, 429, { error: 'slow down' });
  }, async (baseUrl) => {
    const operation = requestChat({ baseUrl, model: 'alpha', messages: [{ role: 'user', content: 'hello' }] });
    await assert.rejects(operation.completion, (error) => error.status === 429 && error.message.includes('slow down'));
  });
});

test('bridge forwards correlated chunks and done payloads', async () => {
  await withServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/event-stream' });
    response.end('data: {"choices":[{"delta":{"content":"answer"}}]}\n\ndata: [DONE]\n\n');
  }, async (baseUrl) => {
    const bridge = new QuchenAiBridge(null);
    const sender = new FakeWebContents();
    const done = sender.next(CHANNELS.done);
    bridge.startChat(sender, {
      requestId: 'request-1',
      baseUrl,
      model: 'alpha',
      messages: [{ role: 'user', content: 'hello' }],
    });
    assert.deepEqual(await done, { requestId: 'request-1', content: 'answer', cancelled: false });
    assert.deepEqual(sender.sent.filter((item) => item.channel === CHANNELS.chunk), [{
      channel: CHANNELS.chunk,
      payload: { requestId: 'request-1', content: 'answer' },
    }]);
    assert.equal(bridge.requests.size, 0);
  });
});

test('bridge forwards correlated HTTP errors', async () => {
  await withServer((_request, response) => {
    json(response, 500, { error: { message: 'upstream broken' } });
  }, async (baseUrl) => {
    const bridge = new QuchenAiBridge(null);
    const sender = new FakeWebContents();
    const failed = sender.next(CHANNELS.error);
    bridge.startChat(sender, {
      requestId: 'request-error',
      baseUrl,
      model: 'alpha',
      messages: [{ role: 'user', content: 'hello' }],
    });
    const payload = await failed;
    assert.equal(payload.requestId, 'request-error');
    assert.equal(payload.error.status, 500);
    assert.match(payload.error.message, /upstream broken/);
    assert.equal(bridge.requests.size, 0);
  });
});

test('bridge cancellation aborts the HTTP request and emits done', async () => {
  let interval;
  await withServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/event-stream' });
    response.write('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n');
    interval = setInterval(() => response.write(': keepalive\n\n'), 20);
    response.on('close', () => clearInterval(interval));
  }, async (baseUrl) => {
    const bridge = new QuchenAiBridge(null);
    const sender = new FakeWebContents();
    const chunk = sender.next(CHANNELS.chunk);
    const done = sender.next(CHANNELS.done);
    bridge.startChat(sender, {
      requestId: 'request-cancel',
      baseUrl,
      model: 'alpha',
      messages: [{ role: 'user', content: 'hello' }],
    });
    await chunk;
    bridge.cancelChat(sender, 'request-cancel');
    assert.deepEqual(await done, { requestId: 'request-cancel', content: 'partial', cancelled: true });
    assert.equal(bridge.requests.size, 0);
  });
  clearInterval(interval);
});

test('window destruction aborts streaming without sending more events', async () => {
  let interval;
  await withServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/event-stream' });
    response.write('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n');
    interval = setInterval(() => response.write(': keepalive\n\n'), 20);
    response.on('close', () => clearInterval(interval));
  }, async (baseUrl) => {
    const bridge = new QuchenAiBridge(null);
    const sender = new FakeWebContents();
    const chunk = sender.next(CHANNELS.chunk);
    bridge.startChat(sender, {
      requestId: 'request-destroy',
      baseUrl,
      model: 'alpha',
      messages: [{ role: 'user', content: 'hello' }],
    });
    await chunk;
    sender.destroyed = true;
    sender.emit('destroyed');
    assert.equal(bridge.requests.size, 0);
    assert.equal(sender.sent.some((item) => item.channel === CHANNELS.done || item.channel === CHANNELS.error), false);
  });
  clearInterval(interval);
});
