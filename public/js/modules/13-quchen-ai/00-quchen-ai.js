/* QUCHEN Radio - QuChen AI OpenAI 兼容聊天 */
(function () {
  if (window.__quchenAiLoaded) return;
  window.__quchenAiLoaded = true;

  var DEFAULT_BASE_URL = 'http://127.0.0.1:8791';
  var STORAGE = {
    baseUrl: 'quchen-ai-openai-base-url',
    apiKey: 'quchen-ai-openai-api-key',
    model: 'quchen-ai-openai-model',
    sessions: 'quchen-ai-openai-sessions-v1',
    current: 'quchen-ai-openai-current-session',
  };
  var idSequence = 0;
  var state = {
    opened: false,
    baseUrl: readLocal(STORAGE.baseUrl) || DEFAULT_BASE_URL,
    apiKey: readLocal(STORAGE.apiKey),
    model: readLocal(STORAGE.model),
    models: [],
    modelsLoading: false,
    modelLoadId: 0,
    sessions: loadSessions(),
    currentId: '',
    busy: false,
    active: null,
  };

  function $(selector, root) { return (root || document).querySelector(selector); }
  function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }
  function readLocal(key) {
    try { return localStorage.getItem(key) || ''; } catch (_) { return ''; }
  }
  function writeLocal(key, value) {
    try { localStorage.setItem(key, String(value == null ? '' : value)); } catch (_) {}
  }
  function createId(prefix) {
    idSequence += 1;
    return prefix + '-' + Date.now().toString(36) + '-' + idSequence.toString(36);
  }
  function api() { return window.quchenAi || null; }

  function loadSessions() {
    var raw = [];
    try { raw = JSON.parse(readLocal(STORAGE.sessions) || '[]'); } catch (_) { raw = []; }
    if (!Array.isArray(raw)) raw = [];
    var sessions = raw.map(function (item) {
      if (!item || typeof item !== 'object') return null;
      var messages = Array.isArray(item.messages) ? item.messages : [];
      return {
        id: String(item.id || createId('session')),
        title: String(item.title || '新会话').slice(0, 60),
        createdAt: Number(item.createdAt) || Date.now(),
        updatedAt: Number(item.updatedAt) || Date.now(),
        messages: messages.map(function (message) {
          if (!message || (message.role !== 'user' && message.role !== 'assistant')) return null;
          return {
            id: String(message.id || createId('message')),
            role: message.role,
            content: String(message.content == null ? '' : message.content),
          };
        }).filter(Boolean),
      };
    }).filter(Boolean);
    if (!sessions.length) sessions.push(newSession());
    return sessions;
  }

  function newSession() {
    return {
      id: createId('session'),
      title: '新会话',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
  }

  function saveSessions() {
    var serializable = state.sessions.map(function (session) {
      return {
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messages: session.messages.map(function (message) {
          return { id: message.id, role: message.role, content: message.content };
        }),
      };
    });
    writeLocal(STORAGE.sessions, JSON.stringify(serializable));
    writeLocal(STORAGE.current, state.currentId);
  }

  function currentSession() {
    return state.sessions.find(function (session) { return session.id === state.currentId; }) || state.sessions[0];
  }

  function sessionById(id) {
    return state.sessions.find(function (session) { return session.id === id; }) || null;
  }

  function injectStyle() {
    if ($('#quchen-ai-style')) return;
    var style = document.createElement('style');
    style.id = 'quchen-ai-style';
    style.textContent = [
      '#quchen-ai-overlay{position:fixed;inset:0;z-index:2147483000;display:none;flex-direction:column;background:linear-gradient(145deg,#0b1220,#111b2e 60%,#0d1526);color:#dce7f7;font-family:"Segoe UI","Microsoft YaHei",sans-serif;--qai-accent:#22d3ee;--qai-line:#22334f;--qai-muted:#8fa3bd}',
      '#quchen-ai-overlay.qai-open{display:flex}',
      '#quchen-ai-overlay *{box-sizing:border-box;scrollbar-width:thin;scrollbar-color:#314665 transparent}',
      '#quchen-ai-overlay button,#quchen-ai-overlay input,#quchen-ai-overlay select,#quchen-ai-overlay textarea{font:inherit}',
      '.qai-head{height:60px;flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:0 18px;border-bottom:1px solid rgba(34,211,238,.55);background:rgba(8,15,29,.94)}',
      '.qai-logo{width:34px;height:34px;display:grid;place-items:center;border-radius:9px;background:linear-gradient(135deg,#22d3ee,#3b82f6);color:#06111f;font-weight:750}',
      '.qai-title{font-size:16px;font-weight:650;color:#f1f6ff}',
      '.qai-subtitle{font-size:11px;color:var(--qai-muted);margin-top:2px}',
      '.qai-head-actions{margin-left:auto;display:flex;align-items:center;gap:8px}',
      '.qai-status{font-size:11px;color:var(--qai-muted);padding:4px 9px;border:1px solid #2b3c58;border-radius:20px;white-space:nowrap}',
      '.qai-status.qai-ok{color:#6ee7b7;border-color:#287559}',
      '.qai-status.qai-warn{color:#fcd34d;border-color:#756123}',
      '.qai-status.qai-error{color:#fca5a5;border-color:#85444c}',
      '.qai-btn{border:1px solid #2b405f;border-radius:7px;background:#122139;color:#c6d5e9;padding:7px 12px;cursor:pointer;font-size:12px}',
      '.qai-btn:hover{border-color:#38bdf8;color:#eff6ff}',
      '.qai-btn:disabled{opacity:.45;cursor:not-allowed}',
      '.qai-btn.qai-primary{background:linear-gradient(135deg,#078aa5,#2563eb);border-color:transparent;color:#fff}',
      '.qai-btn.qai-stop{background:#3b1d2a;border-color:#7f394b;color:#fecdd3}',
      '.qai-body{display:flex;flex:1;min-height:0}',
      '.qai-sidebar{width:220px;flex:0 0 auto;display:flex;flex-direction:column;border-right:1px solid #1a2b45;background:rgba(8,15,28,.66)}',
      '.qai-session-actions{display:flex;gap:7px;padding:12px}',
      '.qai-session-actions .qai-primary{flex:1}',
      '.qai-session-list{flex:1;overflow-y:auto;padding:0 8px 12px}',
      '.qai-session{display:block;width:100%;text-align:left;border:1px solid transparent;border-radius:8px;background:transparent;color:#b9c8dd;padding:10px;margin:3px 0;cursor:pointer}',
      '.qai-session:hover{background:#13233b}',
      '.qai-session.qai-current{background:#162740;border-color:#2b4667;color:#edf5ff}',
      '.qai-session-title{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}',
      '.qai-session-meta{display:block;color:var(--qai-muted);font-size:10px;margin-top:5px}',
      '.qai-main{display:flex;flex:1;min-width:0;flex-direction:column}',
      '.qai-toolbar{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #1a2b45;flex-wrap:wrap}',
      '.qai-toolbar label{font-size:12px;color:var(--qai-muted)}',
      '.qai-select,.qai-input{color:#e3edfa;background:#0d192d;border:1px solid #29405f;border-radius:7px;padding:7px 9px;outline:none;font-size:12px}',
      '.qai-select{min-width:220px;max-width:min(48vw,460px)}',
      '.qai-select:focus,.qai-input:focus,.qai-composer textarea:focus{border-color:var(--qai-accent)}',
      '.qai-model-hint{display:none;margin-left:auto;color:#fcd34d;font-size:11px}',
      '.qai-model-hint.qai-visible{display:block}',
      '.qai-config{display:none;grid-template-columns:minmax(220px,1.4fr) minmax(180px,1fr) auto;gap:10px;padding:12px 14px;background:#0d1729;border-bottom:1px solid #1a2b45}',
      '.qai-config.qai-visible{display:grid}',
      '.qai-config-field{display:flex;flex-direction:column;gap:5px;color:var(--qai-muted);font-size:11px}',
      '.qai-config-note{grid-column:1/-1;color:var(--qai-muted);font-size:10px}',
      '.qai-config-save{align-self:end;height:32px}',
      '.qai-error{display:none;margin:10px 14px 0;padding:9px 12px;border:1px solid #85444c;border-radius:8px;background:rgba(99,28,43,.3);color:#fecaca;font-size:12px;white-space:pre-wrap;word-break:break-word}',
      '.qai-error.qai-visible{display:block}',
      '.qai-messages{flex:1;min-height:0;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:13px;background:rgba(5,11,22,.35)}',
      '.qai-empty{margin:auto;color:var(--qai-muted);font-size:13px;text-align:center;line-height:1.8;border:1px dashed #263b58;border-radius:10px;padding:24px;max-width:520px}',
      '.qai-message{align-self:flex-start;max-width:82%;border:1px solid #213652;border-radius:12px;border-bottom-left-radius:3px;background:#101d32;padding:9px 12px}',
      '.qai-message.qai-user{align-self:flex-end;background:linear-gradient(135deg,#164e63,#1d4ed8);border-color:transparent;border-bottom-left-radius:12px;border-bottom-right-radius:3px;color:#f0f6ff}',
      '.qai-message-role{font-size:10px;color:#8da4c1;margin-bottom:5px}',
      '.qai-user .qai-message-role{color:#bae6fd}',
      '.qai-message-content{font-size:13px;line-height:1.65;white-space:pre-wrap;word-break:break-word}',
      '.qai-message.qai-pending .qai-message-content::after{content:"";display:inline-block;width:7px;height:15px;margin-left:4px;vertical-align:-2px;background:#67e8f9;animation:qai-cursor .8s steps(1) infinite}',
      '@keyframes qai-cursor{50%{opacity:0}}',
      '.qai-composer{display:flex;align-items:flex-end;gap:9px;padding:12px 14px;border-top:1px solid #1a2b45;background:#0b1425}',
      '.qai-composer textarea{flex:1;height:52px;min-height:52px;max-height:150px;resize:vertical;background:#0d192d;color:#e6eefb;border:1px solid #29405f;border-radius:8px;padding:10px 12px;outline:none;line-height:1.5}',
      '.qai-send-actions{display:flex;gap:7px}',
      '.qai-send-actions .qai-btn{height:52px;min-width:68px}',
      '@media(max-width:760px){.qai-sidebar{width:160px}.qai-status{display:none}.qai-config{grid-template-columns:1fr}.qai-config-note{grid-column:1}.qai-message{max-width:92%}.qai-select{min-width:160px}.qai-model-hint{margin-left:0;width:100%}}',
    ].join('\n');
    document.head.appendChild(style);
  }

  function buildOverlay() {
    var existing = $('#quchen-ai-overlay');
    if (existing) return existing;
    var overlay = document.createElement('div');
    overlay.id = 'quchen-ai-overlay';
    overlay.innerHTML = [
      '<div class="qai-head">',
      '  <div class="qai-logo">AI</div>',
      '  <div><div class="qai-title">QuChen AI</div><div class="qai-subtitle">通过 QuChen-AI OpenAI 兼容 API 对话</div></div>',
      '  <div class="qai-head-actions">',
      '    <span class="qai-status" id="qai-status">尚未连接</span>',
      '    <button class="qai-btn" id="qai-settings" type="button">连接设置</button>',
      '    <button class="qai-btn" id="qai-close" type="button">关闭</button>',
      '  </div>',
      '</div>',
      '<div class="qai-body">',
      '  <aside class="qai-sidebar">',
      '    <div class="qai-session-actions"><button class="qai-btn qai-primary" id="qai-new-session" type="button">新建会话</button><button class="qai-btn" id="qai-delete-session" type="button">删除</button></div>',
      '    <div class="qai-session-list" id="qai-session-list"></div>',
      '  </aside>',
      '  <main class="qai-main">',
      '    <div class="qai-toolbar"><label for="qai-model">模型</label><select class="qai-select" id="qai-model"></select><button class="qai-btn" id="qai-refresh-models" type="button">刷新模型</button><span class="qai-model-hint" id="qai-model-hint">未找到模型，请先在 QuChen-AI 中加载模型，再点击刷新。</span></div>',
      '    <div class="qai-config" id="qai-config">',
      '      <label class="qai-config-field">QuChen-AI Base URL<input class="qai-input" id="qai-base-url" type="url" spellcheck="false" placeholder="http://127.0.0.1:8791" /></label>',
      '      <label class="qai-config-field">API key（可选）<input class="qai-input" id="qai-api-key" type="password" autocomplete="off" spellcheck="false" placeholder="未配置时留空" /></label>',
      '      <button class="qai-btn qai-primary qai-config-save" id="qai-save-config" type="button">保存并刷新</button>',
      '      <div class="qai-config-note">支持根地址或以 /v1 结尾的地址；配置仅保存在本机。修改连接前请先停止正在生成的回答。</div>',
      '    </div>',
      '    <div class="qai-error" id="qai-error" role="alert"></div>',
      '    <div class="qai-messages" id="qai-messages"></div>',
      '    <div class="qai-composer"><textarea id="qai-input" placeholder="输入消息，Enter 发送，Shift+Enter 换行"></textarea><div class="qai-send-actions"><button class="qai-btn qai-stop" id="qai-stop" type="button">停止</button><button class="qai-btn qai-primary" id="qai-send" type="button">发送</button></div></div>',
      '    </div>',
      '  </main>',
      '</div>',
    ].join('');
    document.body.appendChild(overlay);
    $('#qai-close', overlay).addEventListener('click', close);
    $('#qai-settings', overlay).addEventListener('click', function () {
      $('#qai-config', overlay).classList.toggle('qai-visible');
    });
    $('#qai-save-config', overlay).addEventListener('click', saveConfig);
    $('#qai-new-session', overlay).addEventListener('click', addSession);
    $('#qai-delete-session', overlay).addEventListener('click', deleteCurrentSession);
    $('#qai-refresh-models', overlay).addEventListener('click', loadModels);
    $('#qai-model', overlay).addEventListener('change', function () {
      state.model = this.value;
      writeLocal(STORAGE.model, state.model);
    });
    $('#qai-send', overlay).addEventListener('click', sendMessage);
    $('#qai-stop', overlay).addEventListener('click', stopGeneration);
    $('#qai-input', overlay).addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        sendMessage();
      }
    });
    $('#qai-base-url', overlay).value = state.baseUrl;
    $('#qai-api-key', overlay).value = state.apiKey;
    renderModelOptions();
    updateControls();
    return overlay;
  }

  function setStatus(text, kind) {
    var element = $('#qai-status');
    if (!element) return;
    element.textContent = text;
    element.className = 'qai-status' + (kind ? ' qai-' + kind : '');
  }

  function setError(message) {
    var element = $('#qai-error');
    if (!element) return;
    element.textContent = String(message || '');
    element.classList.toggle('qai-visible', !!message);
  }

  function renderModelOptions() {
    var select = $('#qai-model');
    if (!select) return;
    select.innerHTML = '';
    if (!state.models.length) {
      var empty = document.createElement('option');
      empty.value = '';
      empty.textContent = state.modelsLoading ? '正在加载模型…' : '暂无可用模型';
      select.appendChild(empty);
    } else {
      state.models.forEach(function (model) {
        var option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        select.appendChild(option);
      });
    }
    select.value = state.model;
    var hint = $('#qai-model-hint');
    if (hint) hint.classList.toggle('qai-visible', !state.modelsLoading && state.models.length === 0);
  }

  function renderSessions() {
    var list = $('#qai-session-list');
    if (!list) return;
    list.innerHTML = '';
    state.sessions.forEach(function (session) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'qai-session' + (session.id === state.currentId ? ' qai-current' : '');
      button.dataset.sessionId = session.id;
      var title = document.createElement('span');
      title.className = 'qai-session-title';
      title.textContent = session.title;
      var meta = document.createElement('span');
      meta.className = 'qai-session-meta';
      meta.textContent = session.messages.length + ' 条消息';
      button.appendChild(title);
      button.appendChild(meta);
      button.addEventListener('click', function () { switchSession(session.id); });
      list.appendChild(button);
    });
  }

  function messageElement(messageId) {
    return $$('.qai-message', $('#qai-messages')).find(function (element) {
      return element.dataset.messageId === messageId;
    }) || null;
  }

  function updateMessage(message, pending) {
    var element = messageElement(message.id);
    if (!element) return;
    element.classList.toggle('qai-pending', !!pending);
    $('.qai-message-content', element).textContent = message.content;
    var list = $('#qai-messages');
    if (list) list.scrollTop = list.scrollHeight;
  }

  function renderMessages() {
    var list = $('#qai-messages');
    if (!list) return;
    var session = currentSession();
    list.innerHTML = '';
    if (!session || !session.messages.length) {
      var empty = document.createElement('div');
      empty.className = 'qai-empty';
      empty.textContent = '开始一个新对话。当前会话的上下文会随下一条消息一起发送。';
      list.appendChild(empty);
      return;
    }
    session.messages.forEach(function (message) {
      var article = document.createElement('article');
      var pending = state.active && state.active.sessionId === session.id && state.active.messageId === message.id;
      article.className = 'qai-message' + (message.role === 'user' ? ' qai-user' : '') + (pending ? ' qai-pending' : '');
      article.dataset.messageId = message.id;
      var role = document.createElement('div');
      role.className = 'qai-message-role';
      role.textContent = message.role === 'user' ? '我' : 'QuChen AI';
      var content = document.createElement('div');
      content.className = 'qai-message-content';
      content.textContent = message.content;
      article.appendChild(role);
      article.appendChild(content);
      list.appendChild(article);
    });
    list.scrollTop = list.scrollHeight;
  }

  function updateControls() {
    var send = $('#qai-send');
    var stop = $('#qai-stop');
    var refresh = $('#qai-refresh-models');
    var save = $('#qai-save-config');
    if (send) {
      send.disabled = state.busy;
      send.style.display = state.busy ? 'none' : '';
    }
    if (stop) {
      stop.style.display = state.busy ? '' : 'none';
      stop.disabled = false;
      stop.textContent = '停止';
    }
    if (refresh) {
      refresh.disabled = state.modelsLoading;
      refresh.textContent = state.modelsLoading ? '加载中…' : '刷新模型';
    }
    if (save) save.disabled = state.busy;
  }

  function loadModels() {
    var bridge = api();
    if (!bridge) {
      state.models = [];
      renderModelOptions();
      setStatus('桌面桥接不可用', 'error');
      setError('请在 QUCHEN Radio 桌面端中使用 AI 聊天。');
      return;
    }
    var loadId = ++state.modelLoadId;
    state.modelsLoading = true;
    setError('');
    setStatus('正在加载模型…');
    renderModelOptions();
    updateControls();
    bridge.listModels({ baseUrl: state.baseUrl, apiKey: state.apiKey }).then(function (result) {
      if (loadId !== state.modelLoadId) return;
      state.models = result && Array.isArray(result.models) ? result.models.filter(function (model) {
        return typeof model === 'string' && model.trim();
      }) : [];
      if (state.models.indexOf(state.model) < 0) state.model = state.models[0] || '';
      writeLocal(STORAGE.model, state.model);
      renderModelOptions();
      if (state.models.length) {
        setStatus('已连接 · ' + state.models.length + ' 个模型', 'ok');
      } else {
        setStatus('已连接 · 无可用模型', 'warn');
        setError('模型列表为空。请先在 QuChen-AI 中加载模型，再点击“刷新模型”。');
      }
    }).catch(function (error) {
      if (loadId !== state.modelLoadId) return;
      state.models = [];
      state.model = '';
      renderModelOptions();
      setStatus('连接失败', 'error');
      setError('模型加载失败：' + String(error && error.message || error || '未知错误'));
    }).then(function () {
      if (loadId !== state.modelLoadId) return;
      state.modelsLoading = false;
      renderModelOptions();
      updateControls();
    });
  }

  function saveConfig() {
    if (state.busy) {
      setError('请先停止当前生成，再修改连接配置。');
      return;
    }
    var baseUrl = $('#qai-base-url').value.trim() || DEFAULT_BASE_URL;
    try {
      var parsed = new URL(baseUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('protocol');
    } catch (_) {
      setError('Base URL 格式无效，请输入 HTTP 或 HTTPS 地址。');
      return;
    }
    state.baseUrl = baseUrl.replace(/\/+$/, '');
    state.apiKey = $('#qai-api-key').value.trim();
    writeLocal(STORAGE.baseUrl, state.baseUrl);
    writeLocal(STORAGE.apiKey, state.apiKey);
    $('#qai-base-url').value = state.baseUrl;
    loadModels();
  }

  function addSession() {
    var session = newSession();
    state.sessions.unshift(session);
    state.currentId = session.id;
    setError('');
    saveSessions();
    renderSessions();
    renderMessages();
    var input = $('#qai-input');
    if (input) input.focus();
  }

  function deleteCurrentSession() {
    if (state.busy && state.active && state.active.sessionId === state.currentId) {
      setError('请先停止当前生成，再删除此会话。');
      return;
    }
    var session = currentSession();
    if (!session || !window.confirm('确定删除当前会话及其本地聊天记录吗？')) return;
    state.sessions = state.sessions.filter(function (item) { return item.id !== session.id; });
    if (!state.sessions.length) state.sessions.push(newSession());
    state.currentId = state.sessions[0].id;
    setError('');
    saveSessions();
    renderSessions();
    renderMessages();
  }

  function switchSession(sessionId) {
    if (!sessionById(sessionId) || sessionId === state.currentId) return;
    state.currentId = sessionId;
    setError('');
    saveSessions();
    renderSessions();
    renderMessages();
  }

  function sendMessage() {
    if (state.busy) return;
    var bridge = api();
    var input = $('#qai-input');
    var text = input ? input.value.trim() : '';
    var session = currentSession();
    if (!text) return;
    if (!bridge) {
      setError('请在 QUCHEN Radio 桌面端中使用 AI 聊天。');
      return;
    }
    if (!state.model) {
      setError(state.models.length ? '请选择模型。' : '暂无可用模型，请先在 QuChen-AI 中加载模型并刷新。');
      return;
    }
    var userMessage = { id: createId('message'), role: 'user', content: text };
    var assistantMessage = { id: createId('message'), role: 'assistant', content: '' };
    var firstUserMessage = !session.messages.some(function (message) { return message.role === 'user'; });
    session.messages.push(userMessage);
    var context = session.messages.map(function (message) {
      return { role: message.role, content: message.content };
    });
    session.messages.push(assistantMessage);
    if (firstUserMessage) session.title = text.slice(0, 32) || '新会话';
    session.updatedAt = Date.now();
    input.value = '';
    setError('');
    state.busy = true;
    state.active = { requestId: '', sessionId: session.id, messageId: assistantMessage.id };
    saveSessions();
    renderSessions();
    renderMessages();
    updateControls();
    try {
      state.active.requestId = bridge.startChat({
        baseUrl: state.baseUrl,
        apiKey: state.apiKey,
        model: state.model,
        messages: context,
      });
    } catch (error) {
      finishActive(false, error);
    }
  }

  function stopGeneration() {
    if (!state.busy || !state.active || !state.active.requestId) return;
    var bridge = api();
    if (bridge) bridge.cancelChat(state.active.requestId);
    var stop = $('#qai-stop');
    if (stop) {
      stop.disabled = true;
      stop.textContent = '停止中…';
    }
  }

  function finishActive(cancelled, error, finalContent) {
    var active = state.active;
    if (!active) return;
    var session = sessionById(active.sessionId);
    var message = null;
    if (session) {
      message = session.messages.find(function (item) { return item.id === active.messageId; }) || null;
      if (message) {
        if (!message.content && finalContent) message.content = String(finalContent);
        if (!message.content.trim() && (cancelled || error)) {
          session.messages = session.messages.filter(function (item) { return item.id !== message.id; });
          message = null;
        }
      }
      session.updatedAt = Date.now();
    }
    state.busy = false;
    state.active = null;
    saveSessions();
    renderSessions();
    renderMessages();
    updateControls();
    if (error) setError('生成失败：' + String(error.message || error.error && error.error.message || error || '未知错误'));
  }

  function bindBridgeEvents() {
    var bridge = api();
    if (!bridge) return;
    bridge.onChunk(function (payload) {
      var active = state.active;
      if (!active || payload.requestId !== active.requestId) return;
      var session = sessionById(active.sessionId);
      var message = session && session.messages.find(function (item) { return item.id === active.messageId; });
      if (!message || typeof payload.content !== 'string' || !payload.content) return;
      message.content += payload.content;
      if (state.currentId === active.sessionId) updateMessage(message, true);
    });
    bridge.onDone(function (payload) {
      if (!state.active || payload.requestId !== state.active.requestId) return;
      finishActive(!!payload.cancelled, null, payload.content);
    });
    bridge.onError(function (payload) {
      if (!state.active || payload.requestId !== state.active.requestId) return;
      finishActive(false, payload.error || { message: '未知错误' }, '');
    });
  }

  function open() {
    injectStyle();
    var overlay = buildOverlay();
    state.opened = true;
    overlay.classList.add('qai-open');
    document.body.style.overflow = 'hidden';
    renderSessions();
    renderMessages();
    loadModels();
  }

  function close() {
    if (state.busy && state.active && state.active.requestId && api()) {
      api().cancelChat(state.active.requestId);
    }
    state.opened = false;
    var overlay = $('#quchen-ai-overlay');
    if (overlay) overlay.classList.remove('qai-open');
    document.body.style.overflow = '';
  }

  state.currentId = readLocal(STORAGE.current);
  if (!sessionById(state.currentId)) state.currentId = state.sessions[0].id;
  bindBridgeEvents();
  window.openQuchenAi = open;
})();
