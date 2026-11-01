/* ============================================================
 * QUCHEN Radio - QuChen AI 一体化模块
 * ------------------------------------------------------------
 * 将本地 QuChen AI（D:\ai-stack，8099 控制台）全套功能融入音乐 App：
 *   AI 聊天（流式+联网+图片+会话管理）
 *   知识库（导入/增删/搜索/问答）
 *   模型商店与模型管理（下载/删除/已装列表）
 *   办公实时面板 / 控制台仪表盘 / 实时日志
 *   服务启停与状态（Ollama/网站/官网/音乐/桌面）
 *   一键自检与修复 / 主题切换 / 联网检索
 * 密码门：Quchennb1（base64 混淆，与既有版本一致）
 * ============================================================ */
(function () {
  if (window.__quchenAiLoaded) return;
  window.__quchenAiLoaded = true;

  var VERSION = '2.0.0';
  var PASSWORD_B64 = 'UXVjaGVubmIx'; // Quchennb1
  var SESSION_KEY = 'quchen-ai-unlocked';
  var API_BASE = (function () {
    try {
      var saved = localStorage.getItem('quchen-ai-api-base');
      if (saved) return saved.replace(/\/+$/, '');
    } catch (e) {}
    return 'http://127.0.0.1:8099';
  })();

  var state = {
    unlocked: false,
    view: 'chat',
    session: 'default',
    sessions: [],
    kbTimer: null,
    svcTimer: null,
    dashTimer: null,
    logTimer: null,
    officeTimer: null,
    logCursor: 0,
    chatBusy: false,
    chatStreaming: false,
    kbImporting: 0,
    theme: { mode: 'dark', accent: '#22d3ee' },
    svcData: null,
  };

  /* ================= 工具 ================= */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtBytes(n) {
    n = Number(n) || 0;
    if (n <= 0) return '0 B';
    var u = ['B', 'KB', 'MB', 'GB', 'TB'];
    var i = Math.floor(Math.log(n) / Math.log(1024));
    return (n / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0) + ' ' + u[i];
  }
  function fmtTime(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    function p(x) { return x < 10 ? '0' + x : '' + x; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function toast(msg, kind) {
    var t = document.createElement('div');
    t.className = 'qai-toast' + (kind ? ' ' + kind : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('qai-toast-hide'); setTimeout(function () { t.remove(); }, 400); }, 2600);
  }
  function api(method, path, body) {
    return fetch(API_BASE + path, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(t || ('HTTP ' + r.status)); });
      return r.json();
    });
  }
  function fmtRel(t) {
    var d = (Date.now() - t) / 1000;
    if (d < 60) return Math.floor(d) + '秒前';
    if (d < 3600) return Math.floor(d / 60) + '分钟前';
    if (d < 86400) return Math.floor(d / 3600) + '小时前';
    return Math.floor(d / 86400) + '天前';
  }

  /* ================= 主界面构建 ================= */
  function injectStyle() {
    if ($('#quchen-ai-style')) return;
    var style = document.createElement('style');
    style.id = 'quchen-ai-style';
    style.textContent = [
      '#quchen-ai-overlay{position:fixed;inset:0;z-index:2147483000;background:linear-gradient(145deg,#0b1220 0%,#101a2e 55%,#0d1526 100%);color:#dbe6f5;display:none;flex-direction:column;font-family:"Segoe UI","Microsoft YaHei",sans-serif;--acc:#22d3ee;--acc2:#3b82f6;--line:#1c2a44;--card:#121c31;--muted:#8fa3c0}',
      '#quchen-ai-overlay.qai-open{display:flex}',
      '#quchen-ai-overlay *{box-sizing:border-box;scrollbar-width:thin;scrollbar-color:#2a3b5e transparent}',
      '.qai-head{height:58px;flex:0 0 auto;display:flex;align-items:center;gap:14px;padding:0 20px;background:rgba(10,17,34,.92);border-bottom:1px solid var(--acc);}',
      '.qai-logo{width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,#22d3ee,#3b82f6);display:flex;align-items:center;justify-content:center;font-weight:700;color:#04111f;font-size:15px;}',
      '.qai-title{font-size:16px;font-weight:600;color:#eef4ff;}',
      '.qai-sub{font-size:12px;color:var(--muted);margin-top:2px;}',
      '.qai-head-right{margin-left:auto;display:flex;align-items:center;gap:10px;}',
      '.qai-pill{font-size:11px;padding:3px 9px;border-radius:20px;border:1px solid var(--acc);color:var(--acc);}',
      '.qai-icon-btn{width:32px;height:32px;border-radius:8px;border:1px solid #24344f;background:#101a2e;color:#b9c8e0;cursor:pointer;font-size:15px;line-height:1;}',
      '.qai-icon-btn:hover{border-color:var(--acc);color:var(--acc);}',
      '.qai-body{flex:1;display:flex;min-height:0;}',
      '.qai-side{width:150px;flex:0 0 auto;background:rgba(10,15,28,.6);border-right:1px solid #15223c;padding:12px 8px;overflow-y:auto;display:flex;flex-direction:column;gap:3px;}',
      '.qai-nav{background:transparent;border:none;color:var(--muted);text-align:left;padding:9px 12px;border-radius:8px;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:8px;}',
      '.qai-nav:hover{background:#14213a;color:#eaf1ff;}',
      '.qai-nav.qai-active{background:linear-gradient(90deg,rgba(34,211,238,.16),rgba(59,130,246,.10));color:#67e8f9;border-left:2px solid var(--acc);}',
      '.qai-nav .qai-nav-dot{width:7px;height:7px;border-radius:50%;background:#33415e;flex:0 0 auto;}',
      '.qai-nav.qai-active .qai-nav-dot{background:var(--acc);box-shadow:0 0 6px var(--acc);}',
      '.qai-view{flex:1;min-width:0;display:none;flex-direction:column;overflow:hidden;}',
      '.qai-view.qai-active{display:flex;}',
      '.qai-view-head{padding:14px 18px 10px;border-bottom:1px solid #15223c;display:flex;align-items:baseline;gap:10px;}',
      '.qai-view-title{font-size:15px;font-weight:600;color:#eaf1ff;}',
      '.qai-view-desc{font-size:12px;color:var(--muted);}',
      '.qai-content{padding:14px 18px;overflow-y:auto;flex:1;min-height:0;display:flex;flex-direction:column;gap:10px;}',
      /* 通用控件 */
      '.qai-btn{background:linear-gradient(135deg,#0e8aa8,#2563eb);border:none;color:#fff;padding:7px 14px;border-radius:7px;cursor:pointer;font-size:13px;}',
      '.qai-btn:hover{filter:brightness(1.12);}',
      '.qai-btn:disabled{opacity:.5;cursor:not-allowed;}',
      '.qai-btn.qai-ghost{background:transparent;border:1px solid #2a3a5e;color:#b9c6e0;}',
      '.qai-btn.qai-danger{background:#3f1d2b;color:#fda4af;border:1px solid #7f1d1d;}',
      '.qai-input,.qai-select{background:#0e1830;border:1px solid #24365a;color:#e6eefc;border-radius:7px;padding:7px 10px;font-size:13px;outline:none;}',
      '.qai-input:focus,.qai-select:focus{border-color:var(--acc);}',
      '.qai-card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;}',
      '.qai-stat{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;}',
      '.qai-stat-item{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;}',
      '.qai-stat-label{font-size:11px;color:var(--muted);margin-bottom:5px;}',
      '.qai-stat-value{font-size:19px;font-weight:600;color:#e9f1ff;}',
      '.qai-badge{display:inline-block;font-size:11px;padding:2px 8px;border-radius:10px;}',
      '.qai-badge-on{background:rgba(34,197,94,.15);color:#4ade80;border:1px solid rgba(74,222,128,.4);}',
      '.qai-badge-off{background:rgba(248,113,113,.12);color:#f87171;border:1px solid rgba(248,113,113,.4);}',
      '.qai-badge-warn{background:rgba(251,191,36,.12);color:#fbbf24;border:1px solid rgba(251,191,36,.4);}',
      '.qai-progress{height:7px;background:#0e1830;border-radius:4px;overflow:hidden;}',
      '.qai-progress>div{height:100%;background:linear-gradient(90deg,#22d3ee,#3b82f6);transition:width .25s;}',
      '.qai-empty{color:var(--muted);text-align:center;padding:24px;font-size:13px;border:1px dashed #22304e;border-radius:10px;}',
      '.qai-row-row{display:flex;align-items:center;gap:10px;}',
      '.qai-muted{color:var(--muted);font-size:12px;}',
      /* 聊天 */
      '.qai-chat-wrap{display:flex;flex:1;min-height:0;}',
      '.qai-chat-side{width:196px;border-right:1px solid #15223c;display:flex;flex-direction:column;flex:0 0 auto;}',
      '.qai-chat-main{flex:1;min-width:0;display:flex;flex-direction:column;}',
      '.qai-chat-toolbar{padding:9px 12px;display:flex;gap:8px;align-items:center;border-bottom:1px solid #15223c;flex-wrap:wrap;}',
      '.qai-chat-list{flex:1;overflow-y:auto;padding:7px;}',
      '.qai-chat-item{padding:8px 10px;border-radius:7px;cursor:pointer;font-size:12px;color:#b9c6e0;border:1px solid transparent;}',
      '.qai-chat-item:hover{background:#14213a;}',
      '.qai-chat-item.qai-cur{background:#16233d;border-color:#2a3a5e;color:#e6eefc;}',
      '.qai-chat-item .t{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.qai-chat-item .s{font-size:10px;color:var(--muted);}',
      '.qai-msg-list{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px;background:rgba(7,12,24,.4);}',
      '.qai-msg{max-width:78%;padding:10px 13px;border-radius:12px;font-size:13px;line-height:1.55;white-space:pre-wrap;word-break:break-word;}',
      '.qai-msg-user{align-self:flex-end;background:linear-gradient(135deg,#1d4ed8,#155e75);color:#eef4ff;border-bottom-right-radius:3px;}',
      '.qai-msg-ai{align-self:flex-start;background:#101c33;border:1px solid #1e2f4f;border-bottom-left-radius:3px;color:#dbe7f7;}',
      '.qai-msg-tag{font-size:10px;color:var(--muted);margin-top:5px;}',
      '.qai-kb-hit{background:#0e1830;border:1px solid #1d3050;border-radius:7px;padding:6px 9px;font-size:11px;color:#93b4d8;margin:3px 0;}',
      '.qai-chat-input{padding:10px 12px;border-top:1px solid #15223c;display:flex;gap:8px;align-items:flex-end;}',
      '.qai-chat-input textarea{flex:1;background:#0e1830;border:1px solid #24365a;color:#e8f0fd;border-radius:8px;padding:9px 11px;font-size:13px;resize:none;height:46px;outline:none;font-family:inherit;line-height:1.4;}',
      '.qai-chat-input textarea:focus{border-color:var(--acc);}',
      '.qai-send{height:46px;background:linear-gradient(135deg,#0e8aa8,#2563eb);border:none;color:#fff;border-radius:8px;padding:0 18px;cursor:pointer;}',
      '.qai-send:disabled{opacity:.5;cursor:not-allowed;}',
      '.qai-model-chip{background:#0e1830;border:1px solid #223156;border-radius:6px;padding:3px 8px;font-size:12px;color:#9fc0e6;}',
      /* 状态样式 */
      '.qai-dot{width:9px;height:9px;border-radius:50%;display:inline-block;margin-right:5px;}',
      '.qai-dot-on{background:#22c55e;box-shadow:0 0 6px rgba(34,197,94,.8);}',
      '.qai-dot-off{background:#ef4444;box-shadow:0 0 6px rgba(239,68,68,.7);}',
      '.qai-dot-warn{background:#f59e0b;box-shadow:0 0 6px rgba(245,158,11,.7);}',
      '.qai-svc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;}',
      '.qai-kb-item p{margin:2px 0;}',
      '.qai-kb-item .prev{color:#93b4d8;font-size:12px;}',
      '.qai-tbl{width:100%;border-collapse:collapse;font-size:12px;}',
      '.qai-tbl th,.qai-tbl td{border:1px solid #1c2a44;padding:6px 8px;text-align:left;vertical-align:top;}',
      '.qai-tbl th{background:#0f1a30;color:#a9c2e6;}',
      '.qai-log-line{font-family:Consolas,"Courier New",monospace;font-size:12px;color:#8fd3e8;line-height:1.5;white-space:pre-wrap;border-bottom:1px solid rgba(21,34,60,.6);padding:2px 0;}',
      '.qai-web-item{border:1px solid #1c2a44;border-radius:9px;padding:11px;background:#101a2e;}',
      '.qai-web-item a{color:#67e8f9;text-decoration:none;font-size:13px;}',
      '.qai-web-item a:hover{text-decoration:underline;}',
      '.qai-web-item .sn{color:var(--muted);font-size:12px;margin-top:4px;line-height:1.45;}',
      '.qai-gate{flex:1;display:flex;align-items:center;justify-content:center;}',
      '.qai-gate-card{width:330px;background:#101a2e;border:1px solid #223052;border-radius:14px;padding:28px 26px;box-shadow:0 10px 40px rgba(0,0,0,.5);}',
      '.qai-gate-card h2{margin:0 0 4px;color:#eef4ff;font-size:18px;}',
      '.qai-gate-card .qai-gate-sub{color:var(--muted);font-size:12px;margin-bottom:18px;}',
      '.qai-gate-card input{width:100%;background:#0b1428;border:1px solid #24365a;color:#e8f0fd;border-radius:8px;padding:10px 12px;font-size:14px;outline:none;margin-bottom:12px;}',
      '.qai-gate-card input:focus{border-color:var(--acc);}',
      '.qai-gate-card button{width:100%;background:linear-gradient(135deg,#089eae,#2b5fd9);border:none;color:#fff;padding:10px;border-radius:8px;cursor:pointer;font-size:14px;}',
      '.qai-gate-card button:hover{filter:brightness(1.12);}',
      '.qai-gate-err{color:#f87171;font-size:12px;min-height:18px;margin-top:8px;}',
      '.qai-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:#0e1830;border:1px solid #2a3a5e;color:#dbe7f7;padding:9px 18px;border-radius:20px;font-size:13px;z-index:2147483999;box-shadow:0 6px 24px rgba(0,0,0,.5);transition:opacity .35s;}',
      '.qai-toast-hide{opacity:0;}',
      '.qai-toggle{position:relative;width:38px;height:20px;border-radius:12px;background:#1c2a44;cursor:pointer;display:inline-block;transition:background .2s;}',
      '.qai-toggle.on{background:linear-gradient(90deg,#089e8b,#2563eb);}',
      '.qai-toggle::after{content:"";position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:#cdd8ea;transition:left .2s;}',
      '.qai-toggle.on::after{left:21px;background:#fff;}',
      '.qai-thm-swatch{width:26px;height:26px;border-radius:7px;border:2px solid transparent;cursor:pointer;display:inline-block;}',
      '.qai-thm-swatch.sel{border-color:#fff;}',
    ].join('\n');
    document.head.appendChild(style);
  }

  function buildOverlay() {
    if ($('#quchen-ai-overlay')) return $('#quchen-ai-overlay');
    var ov = document.createElement('div');
    ov.id = 'quchen-ai-overlay';
    ov.innerHTML = [
      '<div class="qai-head">',
      '  <div class="qai-logo">AI</div>',
      '  <div><div class="qai-title">QuChen AI</div><div class="qai-sub">本地智能 · 与音乐同源</div></div>',
      '  <div class="qai-head-right">',
      '    <span class="qai-pill" id="qai-svc-pill">检测服务…</span>',
      '    <button class="qai-icon-btn" id="qai-close" title="关闭">✕</button>',
      '  </div>',
      '</div>',
      '<div class="qai-body" id="qai-body-root">',
      '  <div class="qai-gate" id="qai-gate"></div>',
      '</div>',
    ].join('');
    document.body.appendChild(ov);
    $('#qai-close', ov).addEventListener('click', close);
    buildGate();
    $('#qai-gate').addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); tryUnlock(); }
    });
    return ov;
  }

  function buildGate() {
    var g = $('#qai-gate');
    if (!g) return;
    g.innerHTML = [
      '<div class="qai-gate-card">',
      '  <h3>QuChen AI</h3>',
      '  <div class="qai-gate-sub">输入访问密码进入 AI 区</div>',
      '  <input id="qai-pass" type="password" placeholder="访问密码" autocomplete="off" />',
      '  <button id="qai-unlock">进入 AI</button>',
      '  <div class="qai-gate-err" id="qai-gate-err"></div>',
      '</div>',
    ].join('');
    $('#qai-unlock', g).addEventListener('click', tryUnlock);
  }

  function tryUnlock() {
    var input = $('#qai-pass');
    var err = $('#qai-gate-err');
    var val = input ? input.value : '';
    var pass = '';
    try { pass = atob(PASSWORD_B64); } catch (e) { pass = ''; }
    if (val === pass) {
      state.unlocked = true;
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) {}
      enterUnlocked();
    } else {
      if (err) err.textContent = '密码错误，请重试';
    }
  }

  function enterUnlocked() {
    var root = $('#qai-body-root');
    if (!root) return;
    root.innerHTML = [
      '<div class="qai-side" id="qai-side"></div>',
      '<div class="qai-view" id="qai-view-chat"></div>',
      '<div class="qai-view" id="qai-view-kb"></div>',
      '<div class="qai-view" id="qai-view-models"></div>',
      '<div class="qai-view" id="qai-view-services"></div>',
      '<div class="qai-view" id="qai-view-office"></div>',
      '<div class="qai-view" id="qai-view-dash"></div>',
      '<div class="qai-view" id="qai-view-logs"></div>',
      '<div class="qai-view" id="qai-view-web"></div>',
      '<div class="qai-view" id="qai-view-selfcheck"></div>',
      '<div class="qai-view" id="qai-view-theme"></div>',
    ].join('');
    var navs = [
      ['chat', 'AI 聊天'], ['kb', '知识库'], ['models', '模型商店'],
      ['services', '服务控制'], ['office', '办公面板'], ['dash', '仪表盘'],
      ['logs', '实时日志'], ['web', '联网检索'], ['selfcheck', '自检修复'], ['theme', '主题'],
    ];
    var side = $('#qai-side');
    navs.forEach(function (n) {
      var b = document.createElement('button');
      b.className = 'qai-nav';
      b.dataset.view = n[0];
      b.innerHTML = '<span class="qai-nav-dot"></span>' + esc(n[1]);
      b.addEventListener('click', function () { switchView(n[0]); });
      side.appendChild(b);
    });
    switchView('chat');
    refreshSvcPill();
    loadThemeRemote();
  }

  function switchView(name) {
    state.view = name;
    stopTimers();
    $$('#qai-side .qai-nav').forEach(function (b) {
      b.classList.toggle('qai-active', b.dataset.view === name);
    });
    $$('.qai-view').forEach(function (v) { v.classList.remove('qai-active'); });
    var view = $('#qai-view-' + name);
    if (view) view.classList.add('qai-active');
    renderPage(name);
  }

  function stopTimers() {
    clearInterval(state.kbTimer); state.kbTimer = null;
    clearInterval(state.svcTimer); state.svcTimer = null;
    clearInterval(state.dashTimer); state.dashTimer = null;
    clearInterval(state.logTimer); state.logTimer = null;
    clearInterval(state.officeTimer); state.officeTimer = null;
  }

  /* ================= 服务状态 pill ================= */
  function loadSvcPill() {
    api('GET', '/api/status').then(function (s) {
      var el = $('#qai-svc-pill');
      if (!el) return;
      var on = s && s.ollamaRunning;
      el.textContent = (on ? 'Ollama 在线 · ' : 'Ollama 离线 · ') + (s && s.models ? s.models.length : 0) + ' 模型';
      el.style.borderColor = on ? 'rgba(74,222,128,.5)' : 'rgba(248,113,113,.5)';
      el.style.color = on ? '#4ade80' : '#f87171';
    }).catch(function () {
      var el = $('#qai-svc-pill');
      if (el) { el.textContent = 'AI 服务离线'; el.style.color = '#f87171'; el.style.borderColor = 'rgba(248,113,113,.5)'; }
    });
  }

  /* ================= 页面渲染 ================= */
  function renderPage(name) {
    if (name === 'chat') renderChat();
    else if (name === 'kb') renderKb();
    else if (name === 'models') renderModels();
    else if (name === 'services') renderServices();
    else if (name === 'office') renderOffice();
    else if (name === 'dash') renderDash();
    else if (name === 'logs') renderLogs();
    else if (name === 'web') renderWeb();
    else if (name === 'selfcheck') renderSelfcheck();
    else if (name === 'theme') renderTheme();
  }

  /* ---------------- 工具条 ---------------- */
  function toolBar(title, desc, extra) {
    return '<div class="qai-view-head"><span class="qai-view-title">' + esc(title) + '</span><span class="qai-view-desc">' + esc(desc || '') + '</span>' + (extra || '') + '</div>';
  }

  /* ================= 聊天 ================= */
  function renderChat() {
    var v = $('#qai-view-chat');
    v.innerHTML = toolBar('AI 聊天', '与本地大模型对话，支持联网检索与知识库增强');
    var main = document.createElement('div');
    main.className = 'qai-chat-wrap';
    main.innerHTML = [
      '<div class="qai-chat-side">',
      '  <div style="padding:8px;display:flex;gap:6px;">',
      '    <button class="qai-btn" id="qai-new-session" style="flex:1;font-size:12px;">+ 新会话</button>',
      '    <button class="qai-btn qai-ghost" id="qai-del-session" style="font-size:12px;" title="删除当前会话">删</button>',
      '  </div>',
      '  <div class="qai-chat-list" id="qai-session-list"></div>',
      '</div>',
      '<div class="qai-chat-main">',
      '  <div class="qai-chat-toolbar">',
      '    <select class="qai-select" id="qai-model" style="min-width:190px;"></select>',
      '    <span style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);">联网 <span class="qai-toggle" id="qai-search-toggle"></span></span>',
      '    <span style="flex:1;"></span>',
      '    <span class="qai-model-chip" id="qai-chat-session-label">会话: default</span>',
      '  </div>',
      '  <div class="qai-msg-list" id="qai-msg-list"></div>',
      '  <div class="qai-chat-input">',
      '    <button class="qai-icon-btn" id="qai-img-btn" title="发送图片">🖼</button>',
      '    <input type="file" id="qai-img-file" accept="image/*" multiple style="display:none;" />',
      '    <textarea id="qai-chat-text" placeholder="输入消息，Enter 发送，Shift+Enter 换行"></textarea>',
      '    <button class="qai-send" id="qai-send">发送</button>',
      '  </div>',
      '</div>',
    ].join('');
    v.appendChild(main);
    loadModelsForChat();
    loadSessions();
    loadHistory('default');
    bindChatEvents();
  }

  function chatSetSearch(on) {
    var t = $('#qai-search-toggle');
    if (!t) return;
    t.classList.toggle('on', !!on);
    t.dataset.on = on ? '1' : '0';
  }

  function bindChatEvents() {
    var t = $('#qai-search-toggle');
    if (t && !t.dataset.bound) {
      t.dataset.bound = '1';
      t.addEventListener('click', function () { chatSetSearch(t.dataset.on !== '1'); });
    }
    $('#qai-new-session').addEventListener('click', function () {
      var sid = 's_' + Date.now().toString(36);
      state.session = sid;
      $('#qai-chat-session-label').textContent = '会话: ' + sid;
      loadSessions();
      loadHistory(sid);
    });
    $('#qai-del-session').addEventListener('click', function () {
      if (!state.session) return;
      if (!confirm('确定删除当前会话？')) return;
      api('POST', '/api/session/delete', { session: state.session })
        .then(function () {
          toast('会话已删除');
          state.session = 'default';
          $('#qai-chat-session-label').textContent = '会话: default';
          loadSessions();
          loadHistory('default');
        }).catch(function (e) { toast(e.message || '删除失败', 'err'); });
    });
    $('#qai-img-btn').addEventListener('click', function () {
      var f = $('#qai-img-file');
      f.value = '';
      f.click();
    });
    $('#qai-img-file').addEventListener('change', function () {
      if (!this.files || !this.files.length) return;
      var files = Array.prototype.slice.call(this.files).slice(0, 3);
      files.forEach(function (file) {
        var fr = new FileReader();
        fr.onload = function () {
          var d = String(fr.result || '').split(',');
          var payload = state.pendingImages || (state.pendingImages = []);
          if (payload.length >= 3) return toast('最多 3 张图片');
          payload.push({ name: file.name, ext: (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/gi, ''), base64: d[1] || '' });
          toast('已添加图片: ' + file.name);
        };
        fr.readAsDataURL(file);
      });
    });
    var ta = $('#qai-chat-text');
    ta.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); doSendChat(); }
    });
    $('#qai-send').addEventListener('click', doSendChat);
  }

  function loadModelsForChat() {
    api('GET', '/api/status').catch(function () { return { models: [], store: [] }; }).then(function (s) {
      var sel = $('#qai-model');
      if (!sel) return;
      var installed = (s.models || []).map(function (m) { return m.name; });
      var opts = [];
      installed.forEach(function (n) { opts.push({ name: n, installed: true }); });
      (s.store || []).forEach(function (m) {
        if (opts.indexOf(m.name) === -1) opts.push({ name: m.name, installed: false });
      });
      if (!opts.length) opts.push({ name: '', installed: false });
      sel.innerHTML = opts.map(function (o, i) {
        return '<option value="' + esc(o.name) + '"' + (i === 0 ? ' selected' : '') + '>' + esc(o.name) + (o.installed ? '' : '（未安装）') + '</option>';
      }).join('');
    });
  }

  function doSendChat() {
    if (state.chatBusy) return;
    var ta = $('#qai-chat-text');
    var msg = ta.value.trim();
    var model = $('#qai-model') ? $('#qai-model').value : '';
    if (!msg && !(state.pendingImages || []).length) return;
    if (!model) { toast('请先选择模型（模型商店可下载）', 'err'); return; }
    var search = $('#qai-search-toggle') && $('#qai-search-toggle').dataset.on === '1';
    var images = state.pendingImages || [];
    ta.value = '';
    state.pendingImages = [];

    appendMsg('user', msg || '（图片）');
    var aiBubble = appendMsg('ai', '思考中…');
    var acc = '';
    state.chatBusy = true;
    var btn = $('#qai-send');
    if (btn) btn.disabled = true;
    var body = {
      model: model,
      text: msg,
      search: !!search,
      session: state.session || 'default',
    };
    if (images.length) body.images = images;

    fetch(API_BASE + '/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(function (res) {
      if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
      var reader = res.body.getReader();
      var decoder = new TextDecoder('utf-8');
      var buf = '';
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) { if (buf.trim()) handleLine(buf); finishChat(aiBubble, sid, sid); return; }
          buf += decoder.decode(r.value, { stream: true });
          var idx;
          while ((idx = buf.indexOf('\n')) >= 0) {
            var line = buf.slice(0, idx).trim(); buf = buf.slice(idx + 1);
            if (line) handleLine(line);
          }
          return pump();
        });
      }
      function handleLine(line) {
        var obj;
        try { obj = JSON.parse(line); } catch (e) { return; }
        if (obj.error) { aiBubble.innerHTML = '<span style="color:#f87171">' + esc(obj.error) + '</span>'; aiBubble.classList.add('qai-err'); }
        if (obj.content) { sid += obj.content; aiBubble.textContent = sid; aiBubble.scrollIntoView({ block: 'nearest' }); }
        if (obj.tool) { addTag(aiBubble, '工具: ' + obj.tool.name + (obj.tool.query ? (' · ' + obj.tool.query) : '')); }
        if (obj.search) { addTag(aiBubble, '检索到 ' + obj.search.length + ' 条'); }
        if (obj.kb) { addTag(aiBubble, '知识库命中 ' + obj.kb.length + ' 条'); renderKbHits(aiBubble, obj.kb); }
        if (obj.vision) { addTag(aiBubble, '图片识别完成'); }
        if (obj.fetch != null) { addTag(aiBubble, obj.fetch ? ('网页已抓取 ' + obj.fetch + ' 字符') : '网页抓取失败，按已有知识回答'); }
        if (obj.done) finishChat(aiBubble, sid, obj.done);
      }
      return pump();
    }).catch(function (err) {
      aiBubble.innerHTML = '<span style="color:#f87171">连接服务失败：' + esc(err.message || err) + '</span>';
      finishChat(aiBubble, sid, '');
    });

    function finishChat(bubble, content, _done) {
      if (state.chatBusy) {
        state.chatBusy = false;
        if (btn) btn.disabled = false;
        if (content) bubble.textContent = content;
        loadSessions();
      }
    }
  }

  function appendMsg(role, text) {
    var list = $('#qai-msg-list');
    var d = document.createElement('div');
    d.className = 'qai-msg ' + (role === 'user' ? 'qai-msg-user' : 'qai-msg-ai');
    d.innerHTML = esc(text);
    list.appendChild(d);
    list.scrollTop = list.scrollHeight;
    return d;
  }
  function addTag(bubble, text) {
    var t = document.createElement('div');
    t.className = 'qai-msg-tag';
    t.textContent = text;
    bubble.appendChild(t);
  }
  function renderKbHits(bubble, hits) {
    if (!Array.isArray(hits) || !hits.length) return;
    hits.forEach(function (h) {
      var d = document.createElement('div');
      d.className = 'qai-kb-hit';
      d.textContent = '📚 ' + (h.name || '') + '：' + (h.snippet || h.text || '').slice(0, 90);
      bubble.appendChild(d);
    });
  }

  function loadSessions() {
    api('GET', '/api/sessions').catch(function () { return { sessions: [] }; }).then(function (r) {
      state.sessions = r.sessions || [];
      var list = $('#qai-session-list');
      if (!list) return;
      if (!state.sessions.length) {
        list.innerHTML = '<div class="qai-empty" style="font-size:11px;padding:12px;">暂无会话</div>';
        return;
      }
      list.innerHTML = state.sessions.map(function (s) {
        return '<div class="qai-chat-item' + (s.sid === state.session ? ' qai-cur' : '') + '" data-sid="' + esc(s.sid) + '" title="' + esc(s.title || '') + '">' +
          '<span class="t">' + esc(s.title || s.sid) + '</span>' +
          '<span class="s">' + (s.turns || 0) + ' 轮 · ' + (s.updatedAt ? fmtRel(s.updatedAt) : '') + '</span></div>';
      }).join('');
      $$('#qai-session-list .qai-chat-item').forEach(function (el) {
        el.addEventListener('click', function () {
          state.session = el.dataset.sid;
          $('#qai-chat-session-label').textContent = '会话: ' + state.session;
          loadSessions();
          loadHistory(state.session);
        });
      });
    });
  }
  function fmtRel(t) {
    var s = Math.max(1, Math.floor((Date.now() - (t || 0)) / 1000));
    if (s < 60) return s + '秒前';
    if (s < 3600) return Math.floor(s / 60) + '分前';
    if (s < 86400) return Math.floor(s / 3600) + '小时前';
    return Math.floor(s / 86400) + '天前';
  }
  function loadHistory(sid) {
    var list = $('#qai-msg-list');
    if (!list) return;
    list.innerHTML = '<div class="qai-empty">加载历史…</div>';
    api('GET', '/api/history' + (sid ? '?session=' + encodeURIComponent(sid) : '')).catch(function () {
      return { messages: [] };
    }).then(function (h) {
      var msgs = h.messages || [];
      list.innerHTML = '';
      if (!msgs.length) {
        list.innerHTML = '<div class="qai-empty">开始与本地模型对话吧（可用 / 联网搜索增强）</div>';
        return;
      }
      msgs.forEach(function (m) {
        if (!m || !m.content) return;
        if (m.role === 'system') return;
        var d = document.createElement('div');
        d.className = 'qai-msg ' + (m.role === 'user' ? 'qai-msg-user' : 'qai-msg-ai');
        d.textContent = String(m.content).replace(/【网页抓取结果】[\s\S]*?(?=\n\n请依据或是$)/, '');
        list.appendChild(d);
      });
      list.scrollTop = list.scrollHeight;
    });
  }

  /* ================= 知识库 ================= */
  function renderKb() {
    var v = $('#qai-view-kb');
    var b = $('#qai-kb-progress');
    v.innerHTML = toolBar('知识库', '导入/删除本地知识，聊天时自动增强回答');
    var c = document.createElement('div');
    c.className = 'qai-content';
    c.innerHTML = [
      '<div class="qai-row-row">',
      '  <button class="qai-btn" id="qai-kb-import">导入文件</button>',
      '  <input type="file" id="qai-kb-file" multiple style="display:none;" />',
      '  <span class="qai-muted" id="qai-kb-count"></span>',
      '  <span style="flex:1;"></span>',
      '  <input class="qai-input" id="qai-kb-search" placeholder="搜索知识库关键词…" style="width:220px;" />',
      '</div>',
      '<div id="qai-kb-import-box"></div>',
      '<div id="qai-kb-list"></div>',
    ].join('');
    v.appendChild(c);
    $('#qai-kb-import').addEventListener('click', function () { $('#qai-kb-file').click(); });
    $('#qai-kb-file').addEventListener('change', function () { importKbFiles(this.files); });
    $('#qai-kb-search').addEventListener('input', debounce(function () {
      var q = $('#qai-kb-search').value.trim();
      if (q) kbSearchLocal(q); else loadKbList();
    }, 400));
    refreshKb();
    state.kbTimer = setInterval(function () { loadKbProgress(); }, 2500);
  }
  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }
  function refreshKb() { loadKbList(); loadKbProgress(); }
  function loadKbList() {
    api('GET', '/api/kb/list').catch(function () { return { items: [] }; }).then(function (r) {
      var items = r.items || [];
      var cnt = $('#qai-kb-count');
      if (cnt) cnt.textContent = '共 ' + items.length + ' 条';
      var box = $('#qai-kb-list');
      if (!box) return;
      if (!items.length) { box.innerHTML = '<div class="qai-empty">知识库为空，点击「导入文件」添加文档</div>'; return; }
      box.innerHTML = items.map(function (it) {
        return '<div class="qai-card qai-kb-item">' +
          '<div class="qai-row-row" style="justify-content:space-between;">' +
          '  <b style="color:#dbe7f7;font-size:13px;">' + esc(it.name) + '</b>' +
          '  <span class="qai-row-row" style="gap:6px;">' +
          (it.img ? '<span class="qai-badge qai-badge-on">图</span>' : '') +
          '  <span class="qai-badge" style="background:#14213a;color:#9fc3e6;">' + esc(it.type || '') + '</span>' +
          '  <span class="qai-badge" style="background:#14213a;color:#9fc3e6;">' + fmtBytes(it.size) + '</span>' +
          '  <button class="qai-btn qai-danger qai-del-kb" data-id="' + esc(it.id) + '" style="font-size:11px;padding:3px 9px;">删</button>' +
          '</span></div>' +
          '<p class="qai-muted" style="margin:6px 0 2px;">' + esc(it.file || '') + ' · 字符 ' + (it.chars || it.textLen || 0) + ' · ' + fmtTime(it.addedAt) + '</p>' +
          '<p class="prev">' + esc((it.summary || it.preview || '').slice(0, 120)) + '</p>' +
          '</div>';
      }).join('');
      $$('#qai-kb-list .qai-del-kb').forEach(function (b) {
        b.addEventListener('click', function () {
          if (!confirm('确定删除该知识条目？')) return;
          api('POST', '/api/kb/delete', { id: b.dataset.id }).then(function () {
            toast('已删除');
            loadKbList();
          }).catch(function (e) { toast(e.message || '删除失败', 'err'); });
        });
      });
    });
  }
  function importKbFiles(files) {
    if (!files || !files.length) return;
    var list = Array.prototype.slice.call(files);
    if (state.kbImporting > 0) return toast('已有导入任务进行中', 'err');
    state.kbImporting = list.length;
    var box = $('#qai-kb-import');
    box.innerHTML = '';
    var chain = Promise.resolve();
    list.forEach(function (file, idx) {
      chain = chain.then(function () {
        return new Promise(function (resolve) {
          var fr = new FileReader();
          fr.onload = function () {
            var d = String(fr.result || '').split(',');
            var line = document.createElement('div');
            line.className = 'qai-stat-item';
            line.textContent = '[' + (idx + 1) + '/' + list.length + '] ' + file.name + ' 处理中…';
            box.appendChild(line);
            api('POST', '/api/kb/import', {
              name: file.name,
              filename: file.name,
              base64: d[1] || '',
            }).then(function (r) {
              state.kbImporting--;
              line.textContent = '[' + (idx + 1) + '/' + list.length + '] ' + file.name + ' → ' + (r && r.ok ? '成功' : ('失败: ' + (r && r.message || (r && r.error) || '未知')) + '');
              loadKbList();
              resolve();
            }).catch(function (e) {
              state.kbImporting--;
              line.textContent = '[' + (idx + 1) + '/' + list.length + '] ' + file.name + ' → 失败: ' + e.message;
              resolve();
            });
          };
          fr.onerror = function () { state.kbImporting--; resolve(); };
          fr.readAsDataURL(file);
        });
      });
    });
    chain.then(function () { state.kbImporting = 0; toast('知识库导入完成'); });
  }
  function loadKbProgress() {
    api('GET', '/api/kb/progress').then(function (r) {
      var p = r.progress || {};
      var box = $('#qai-kb-import');
      if (!box) return;
      if (p.done && p.total > 0 && state.kbImporting === 0) {
        box.innerHTML = '';
        return;
      }
      if (p.total && p.done != null) {
        var pct = Math.round((p.done / p.total) * 100);
        box.innerHTML = '<div class="qai-stat-item"><div class="qai-row-row" style="justify-content:space-between;"><span class="qai-muted">导入 ' + esc(p.name || '') + '</span><span style="color:#67e8f9;font-size:12px;">' + pct + '%</span></div><div class="qai-progress" style="margin-top:6px;"><div style="width:' + pct + '%"></div></div></div>';
      }
    }).catch(function () {});
  }
  function kbSearchLocal(q) {
    api('POST', '/api/kb/search', { query: q, limit: 10 }).then(function (r) {
      var hits = r.hits || r || [];
      var box = $('#qai-kb-list');
      if (!box) return;
      if (!hits.length) { box.innerHTML = '<div class="qai-empty">未命中「' + esc(q) + '」</div>'; return; }
      box.innerHTML = hits.map(function (h) {
        return '<div class="qai-card qai-kb-item"><b style="color:#dbe7f7;font-size:13px;">' + esc(h.name || '') + '</b>' +
          '<p class="prev">' + esc((h.snippet || h.text || '').slice(0, 160)) + '</p></div>';
      }).join('');
    }).catch(function () {});
  }

  /* ================= 模型商店 ================= */
  function renderModels() {
    var v = $('#qai-view-models');
    v.innerHTML = toolBar('模型商店', '查看/下载/删除本地大模型（Ollama）');
    var c = document.createElement('div');
    c.className = 'qai-content';
    c.innerHTML = [
      '<div class="qai-card" id="qai-ollama-status"></div>',
      '<div class="qai-card"><div class="qai-view-title" style="margin-bottom:8px;">已安装模型</div><div id="qai-installed"></div></div>',
      '<div class="qai-card"><div class="qai-view-title" style="margin-bottom:8px;">模型商店</div><div id="qai-store"></div></div>',
    ].join('');
    v.appendChild(c);
    refreshModels();
  }
  function refreshModels() {
    api('GET', '/api/status').catch(function () { return {}; }).then(function (s) {
      var st = $('#qai-ollama-status');
      if (st) {
        var up = !!s.ollamaRunning;
        st.innerHTML = '<div class="qai-row-row" style="justify-content:space-between;flex-wrap:wrap;gap:8px;">' +
          '<span><span class="qai-dot ' + (up ? 'qai-dot-on' : 'qai-dot-off') + '"></span><b>' + (up ? 'Ollama 在线' : 'Ollama 离线') + '</b>' +
          (s.version ? ' <span class="qai-muted" style="margin-left:6px;">' + esc(s.version) + '</span>' : '') +
          (up ? ' <span class="qai-muted" style="margin-left:6px;">' + (s.models || []).length + ' 个模型</span>' : '') + '</span>' +
          '<span class="qai-row-row" style="gap:6px;"><button class="qai-btn qai-ghost" id="qai-ollama-start" ' + (up ? 'disabled' : '') + '>启动</button>' +
          '<button class="qai-btn qai-ghost" id="qai-ollama-stop" ' + (!up ? 'disabled' : '') + '>停止</button>' +
          '<button class="qai-btn qai-ghost" id="qai-ollama-refresh">刷新</button></span>' +
          '</div>';
        var sb = $('#qai-ollama-start'), sp = $('#qai-ollama-stop');
        if (sb) sb.addEventListener('click', function () { api('POST', '/api/start').then(refreshModels); });
        if (sp) sp.addEventListener('click', function () { api('POST', '/api/stop').then(refreshModels); });
        if ($('#qai-ollama-refresh')) $('#qai-ollama-refresh').addEventListener('click', refreshModels);
      }
      var ins = $('#qai-installed');
      var models = s.models || [];
      if (!ins) return;
      if (!models.length) { ins.innerHTML = '<div class="qai-empty">尚未安装模型</div>'; }
      else {
        ins.innerHTML = '<table class="qai-tbl"><tr><th>模型</th><th>大小</th><th>修改时间</th><th></th></tr>' +
          models.map(function (m) {
            return '<tr><td>' + esc(m.name) + '</td><td>' + fmtBytes(m.size) + '</td><td>' + fmtTime(m.modified ? m.modified * 1000 : 0) + '</td>' +
              '<td><button class="qai-btn qai-danger qai-rm-model" data-name="' + esc(m.name) + '" style="font-size:11px;padding:2px 9px;">删除</button></td></tr>';
          }).join('') + '</table>';
        $$('#qai-installed .qai-rm-model').forEach(function (b) {
          b.addEventListener('click', function () {
            if (!confirm('确定删除模型 ' + b.dataset.name + ' ？')) return;
            api('POST', '/api/delete', { name: b.dataset.name }).then(function (r) {
              toast((r && r.ok ? '已删除' : ('失败: ' + (r && r.message || ''))));
              refreshModels();
            }).catch(function (e) { toast('删除失败: ' + e.message, 'err'); });
          });
        });
      }
      var stBox = $('#qai-store');
      if (stBox) {
        var store = s.store || [];
        if (!store.length) { stBox.innerHTML = '<div class="qai-empty">商店暂无可用模型</div>'; }
        else {
          stBox.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(232px,1fr));gap:10px;">' +
            store.map(function (m) {
              var inst = models.some(function (x) { return x.name === m.name; });
              return '<div class="qai-stat-item">' +
                '<div style="font-weight:600;color:#e6eefc;font-size:13px;">' + esc(m.name) + '</div>' +
                '<div class="qai-muted" style="min-height:34px;margin:5px 0 8px;line-height:1.4;">' + esc(m.desc || '') + '</div>' +
                '<div class="qai-row-row" style="justify-content:space-between;"><span class="qai-muted">' + esc(m.size || '') + '</span>' +
                (inst ? '<span class="qai-badge qai-badge-on">已安装</span>' : '<button class="qai-btn qai-dl-model" data-name="' + esc(m.name) + '" style="font-size:11px;padding:3px 10px;">下载</button>') +
                '</div><div class="qai-dl-progress" data-name="' + esc(m.name) + '" style="margin-top:6px;"></div></div>';
            }).join('') + '</div>';
          $$('#qai-store .qai-dl-model').forEach(function (b) {
            b.addEventListener('click', function () { pullStoreModel(b.dataset.name, b); });
          });
        }
      }
    });
  }
  function pullStoreModel(name, btn) {
    if (btn) btn.disabled = true;
    var progBox = document.querySelector('.qai-dl-progress[data-name="' + CSS.escape(name) + '"]');
    function upd(pct, txt) {
      if (progBox) progBox.innerHTML = '<div class="qai-progress"><div style="width:' + Math.max(2, pct || 0) + '%"></div></div><div class="qai-muted" style="margin-top:4px;">' + txt + '</div>';
    }
    upd(0, '连接 Ollama…');
    fetch(API_BASE + '/api/pull', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name }),
    }).then(function (res) {
      if (!res.body) return res.text();
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buf = '';
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) { toast('模型下载完成: ' + name); refreshModels(); return; }
          buf += decoder.decode(r.value, { stream: true });
          var idx;
          while ((idx = buf.indexOf('\n')) >= 0) {
            var line = buf.slice(0, idx).trim(); buf = buf.slice(idx + 1);
            if (!line) continue;
            try {
              var o = JSON.parse(line);
              if (o.error) { toast('下载失败: ' + o.error, 'err'); upd(0, o.error); return pump(); }
              if (o.done) { if (o.error) { toast('下载失败: ' + o.error, 'err'); upd(0, o.error); } else { toast('下载完成: ' + name); refreshModels(); } return pump(); }
              if (o.percent) upd(o.percent, '下载中 ' + o.percent + '%');
              if (o.status) upd(1, o.status);
            } catch (e) {}
          }
          return pump();
        });
      }
      return pump();
    }).catch(function (err) {
      upd(0, '失败: ' + (err.message || err));
      toast('下载失败: ' + (err.message || err), 'err');
      if (btn) btn.disabled = false;
    });
  }

  /* ================= 服务控制 ================= */
  function renderServices() {
    var v = $('#qai-view-services');
    v.innerHTML = toolBar('服务控制', '本地 AI 服务启停与状态（音乐 App 已自动托管）');
    var c = document.createElement('div');
    c.className = 'qai-content';
    c.innerHTML = '<div class="qai-svc-grid" id="qai-svc-grid"></div><p class="qai-muted">说明：Ollama 与 AI 控制台由 QUCHEN Radio 主进程自动托管拉起；此处可额外启停网站 / 官网 / 音乐实例。</p>';
    v.appendChild(c);
    refreshSvc();
    state.svcTimer = setInterval(refreshSvc, 3500);
  }
  function refreshSvc() {
    api('GET', '/api/svc').catch(function () { return {}; }).then(function (s) {
      state.svcData = s;
      var g = $('#qai-svc-grid');
      if (!g) return;
      var cards = [
        { k: 'ollama', name: 'Ollama', desc: '本地大模型引擎', port: '11434' },
        { k: 'website', name: 'Open WebUI', desc: 'AI 网站门户', port: '8081/8080' },
        { k: 'home', name: '官网', desc: '官方站点', port: '8090' },
        { k: 'radio', name: '音乐服务', desc: 'QUCHEN Radio', port: '3000' },
        { k: 'desktop', name: '控制台', desc: 'AI 管控中心', port: '8099' },
      ];
      g.innerHTML = cards.map(function (card) {
        var d = s[card.k] || {};
        var on = d.online;
        var stateTxt = on ? '运行中' : '已停止';
        if (card.k === 'radio' && d.state) stateTxt = d.state;
        var btns = '';
        if (card.k === 'ollama') {
          btns = on
            ? '<button class="qai-btn qai-ghost qai-svc-act" data-act="stop" data-t="ollama">停止</button>'
            : '<button class="qai-btn qai-ghost qai-svc-act" data-act="start" data-t="ollama">启动</button>';
        } else if (card.k !== 'desktop') {
          btns = [
            '<button class="qai-btn qai-ghost qai-svc-act" data-act="start" data-t="' + card.k + '" ' + (on ? 'disabled' : '') + '>启动</button>',
            '<button class="qai-btn qai-ghost qai-svc-act" data-act="stop" data-t="' + card.k + '" ' + (!on ? 'disabled' : '') + '>停止</button>',
            '<button class="qai-btn qai-ghost qai-svc-act" data-act="restart" data-t="' + card.k + '" ' + (!on ? 'disabled' : '') + '>重启</button>',
          ].join('');
        }
        return '<div class="qai-card" style="display:flex;flex-direction:column;gap:7px;">' +
          '<div class="qai-row-row" style="justify-content:space-between;"><b style="color:#e6eefc;">' + card.name + '</b>' +
          '<span><span class="qai-dot ' + (on ? 'qai-dot-on' : 'qai-dot-off') + '"></span><span class="qai-muted">' + stateTxt + '</span></span></div>' +
          '<div class="qai-muted">' + esc(card.desc) + (d.port ? ' · 端口 ' + esc(d.port) : '') + '</div>' +
          (d.url ? '<span class="qai-muted">' + esc(d.url) + '</span>' : '') +
          '<div class="qai-row-row" style="gap:6px;">' + btns + '</div>' +
          '</div>';
      }).join('');
      $$('#qai-svc-grid .qai-svc-act').forEach(function (b) {
        b.addEventListener('click', function () {
          var act = b.dataset.act;
          var t = b.dataset.t;
          if (t === 'ollama') {
            api('POST', act === 'start' ? '/api/start' : '/api/stop').then(function (r) {
              toast(r && r.message || (r.ok ? '成功' : '失败'));
              refreshSvc();
            }).catch(function (e) { toast(e.message || '操作失败', 'err'); });
            return;
          }
          api('POST', '/api/svc/' + act, { target: t }).then(function (r) {
            toast(r && r.message || (r.ok ? '成功' : '失败'));
            setTimeout(refreshSvc, 1200);
          }).catch(function (e) { toast(e.message || '操作失败', 'err'); });
        });
      });
    });
  }

  /* ================= 办公面板 ================= */
  function renderOffice() {
    var v = $('#qai-view-office');
    v.innerHTML = toolBar('办公实时面板', '实时查看模型加载与 GPU 状态（每 3 秒刷新）');
    var c = document.createElement('div');
    c.className = 'qai-content';
    c.innerHTML = '<div id="qai-office-body"><div class="qai-empty">加载中…</div></div>';
    v.appendChild(c);
    refreshOffice();
    state.officeTimer = setInterval(refreshOffice, 3000);
  }
  function refreshOffice() {
    var box = $('#qai-office-body');
    if (!box) return;
    api('GET', '/api/office/status').catch(function () { return {}; }).then(function (d) {
      var oll = d.ollama || {};
      var gpu = d.gpu || {};
      var models = oll.loadedModels || [];
      box.innerHTML =
        '<div class="qai-stat">' +
        '<div class="qai-stat-item"><div class="qai-stat-label">Ollama</div><div class="qai-stat-value" style="color:' + (oll.online ? '#4ade80' : '#f87171') + ';">' + (oll.online ? '在线' : '离线') + '</div></div>' +
        '<div class="qai-stat-item"><div class="qai-stat-label">已加载模型</div><div class="qai-stat-value">' + (oll.count || 0) + '</div></div>' +
        (gpu.ok
          ? '<div class="qai-stat-item"><div class="qai-stat-label">GPU · ' + esc(gpu.name || '') + '</div><div class="qai-stat-value">' + (gpu.usedGB || 0) + '/' + (gpu.totalGB || 0) + ' GB</div></div>'
          : '<div class="qai-stat-item"><div class="qai-stat-label">GPU</div><div class="qai-stat-value" style="color:#f87171;">不可用</div></div>') +
        (gpu.ok ? '<div class="qai-stat-item"><div class="qai-stat-label">GPU 利用率</div><div class="qai-stat-value">' + (gpu.util || 0) + '%</div></div>' : '') +
        '<div class="qai-stat-item"><div class="qai-stat-label">刷新时间</div><div class="qai-stat-value" style="font-size:14px;">' + fmtTime(d.ts) + '</div></div>' +
        '</div>' +
        '<div class="qai-card"><div class="qai-view-title" style="margin-bottom:8px;">已加载模型明细</div>' +
        (models.length ? '<table class="qai-tbl"><tr><th>模型</th><th>显存占用</th><th>总占用</th><th>保留到期</th></tr>' +
          models.map(function (m) {
            return '<tr><td>' + esc(m.name) + '</td><td>' + fmtBytes(m.vram) + '</td><td>' + fmtBytes(m.size) + '</td><td>' + esc(m.expires || '—') + '</td></tr>';
          }).join('') + '</table>' : '<div class="qai-empty">当前无加载中的模型</div>') +
        '</div>';
    }).catch(function () {});
  }

  /* ================= 仪表盘 ================= */
  function renderDash() {
    var v = $('#qai-view-dash');
    v.innerHTML = toolBar('控制台仪表盘', '系统健康 / 磁盘 / 端口 / 最近会话（每 5 秒刷新）');
    var c = document.createElement('div');
    c.className = 'qai-content';
    c.innerHTML = '<div id="qai-dash-body"></div>';
    v.appendChild(c);
    refreshDash();
    state.dashTimer = setInterval(refreshDash, 5000);
  }
  function refreshDash() {
    var box = $('#qai-dash-body');
    if (!box) return;
    api('GET', '/api/dash').catch(function () { return {}; }).then(function (d) {
      var oll = d.ollama || {}, disk = d.disk || {}, gpu = d.gpu || {}, web = d.web || {};
      box.innerHTML =
        '<div class="qai-stat">' +
        '<div class="qai-stat-item"><div class="qai-stat-label">Ollama 引擎</div><div class="qai-stat-value" style="color:' + (oll.online ? '#4ade80' : '#f87171') + ';">' + (oll.online ? '在线' : '离线') + '</div></div>' +
        '<div class="qai-stat-item"><div class="qai-stat-label">磁盘用量 (' + esc(disk.drive || 'D:') + ')</div><div class="qai-stat-value">' + (disk.usedPercent != null ? disk.usedPercent + '%' : '—') + '</div></div>' +
        '<div class="qai-stat-item"><div class="qai-stat-label">磁盘剩余</div><div class="qai-stat-value">' + ((disk.freeGB != null) ? disk.freeGB + ' GB' : '—') + '</div></div>' +
        '<div class="qai-stat-item"><div class="qai-stat-label">8099 控制台</div><div class="qai-stat-value" style="color:' + (web.port8099 ? '#4ade80' : '#f87171') + ';">' + (web.port8099 ? '在线' : '离线') + '</div></div>' +
        '<div class="qai-stat-item"><div class="qai-stat-label">8080 官网网关</div><div class="qai-stat-value" style="color:' + (web.port8080 ? '#4ade80' : '#f87171') + ';">' + (web.port8080 ? '在线' : '离线') + '</div></div>' +
        '</div>' +
        (gpu.ok ? '<div class="qai-card"><div class="qai-view-title" style="margin-bottom:6px;">GPU</div><span class="qai-muted">' + esc(gpu.name || '') + ' · ' + (gpu.usedGB || 0) + '/' + (gpu.totalGB || 0) + ' GB · 利用率 ' + (gpu.util || 0) + '%</span></div>' : '') +
        '<div class="qai-card"><div class="qai-view-title" style="margin-bottom:8px;">最近会话</div>' +
        ((d.sessions && d.sessions.length) ? '<table class="qai-tbl"><tr><th>标题</th><th>轮次</th><th>最后活跃</th></tr>' +
          d.sessions.map(function (s) { return '<tr><td>' + esc(s.title || s.id || '') + '</td><td>' + (s.turns != null ? s.turns : '') + '</td><td>' + fmtTime(typeof s.ts === 'number' ? s.ts : (s.updatedAt || 0)) + '</td></tr>'; }).join('') + '</table>' : '<div class="qai-empty">暂无会话数据</div>') +
        '</div>' +
        '<div class="qai-card"><div class="qai-view-title" style="margin-bottom:8px;">最近日志</div>' +
        '<div style="font-family:Consolas,monospace;font-size:11px;color:#8fd3e8;line-height:1.55;max-height:170px;overflow-y:auto;">' +
        (d.recentLogs && d.recentLogs.length ? d.recentLogs.slice(-12).map(esc).join('<br>') : '暂无') + '</div></div>';
    }).catch(function () {});
  }

  /* ================= 实时日志 ================= */
  function renderLogs() {
    var v = $('#qai-view-logs');
    v.innerHTML = toolBar('实时日志', 'AI 控制台增量日志（自动滚动）');
    var c = document.createElement('div');
    c.className = 'qai-content';
    c.style.padding = '0 12px 12px';
    c.innerHTML = '<div id="qai-logs-box" style="flex:1;overflow-y:auto;background:#0a1020;border:1px solid #1c2a44;border-radius:9px;padding:10px;"></div>';
    v.appendChild(c);
    state.logCursor = 0;
    pollLogs(true);
    state.logTimer = setInterval(function () { pollLogs(false); }, 2500);
  }
  function pollLogs(first) {
    api('GET', '/api/logs?after=' + state.logCursor).then(function (r) {
      var box = $('#qai-logs-box');
      if (!box) return;
      var lines = r.lines || [];
      if (!lines.length) {
        if (first) box.innerHTML = '<div class="qai-log-line">（无日志，等待服务输出…）</div>';
        return;
      }
      lines.forEach(function (l) {
        var d = document.createElement('div');
        d.className = 'qai-log-line';
        d.textContent = l;
        box.appendChild(d);
      });
      state.logCursor = r.after || state.logCursor + lines.length;
      box.scrollTop = box.scrollHeight;
    }).catch(function () {
      var box = $('#qai-logs-box');
      if (box && first) box.innerHTML = '<div class="qai-log-line">（日志服务暂不可达）</div>';
    });
  }

  /* ================= 联网检索 ================= */
  function renderWeb() {
    var v = $('#qai-view-web');
    v.innerHTML = toolBar('联网检索', '免费本地搜索网关（国内可达）');
    var c = document.createElement('div');
    c.className = 'qai-content';
    c.innerHTML = [
      '<div class="qai-row-row" style="gap:8px;">',
      '  <input class="qai-input" id="qai-web-q" placeholder="输入搜索关键词…" style="flex:1;" />',
      '  <button class="qai-btn" id="qai-web-go">搜索</button>',
      '</div>',
      '<div id="qai-web-res"></div>',
    ].join('');
    v.appendChild(c);
    $('#qai-web-go').addEventListener('click', webSearch);
    $('#qai-web-q').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') webSearch(); });
    function webSearch() {
      var q = $('#qai-web-q').value.trim();
      if (!q) return;
      var box = $('#qai-web-res');
      box.innerHTML = '<div class="qai-empty">搜索中…</div>';
      api('POST', '/api/web/search', { query: q, count: 8 }).then(function (r) {
        var items = r.items || [];
        if (!items.length) { box.innerHTML = '<div class="qai-empty">没有结果</div>'; return; }
        box.innerHTML = items.map(function (it, i) {
          return '<div class="qai-webhook">' +
            '<div class="qai-row-row" style="justify-content:space-between;align-items:flex-start;">' +
            '<a href="' + esc(it.link) + '" target="_blank" rel="noopener">' + (i + 1) + '. ' + esc(it.title || it.link) + '</a>' +
            '<button class="qai-btn qai-ghost qai-copy" data-u="' + esc(it.link) + '" style="font-size:11px;padding:2px 8px;">复制</button></div>' +
            '<div class="sn">' + esc(it.snippet || '') + '</div>' +
            '<div class="qai-muted" style="margin-top:3px;word-break:break-all;">' + esc(it.link) + '</div></div>';
        }).join('');
        $$('#qai-web-res .qai-copy').forEach(function (b) {
          b.addEventListener('click', function () {
            try {
              navigator.clipboard.writeText(b.dataset.u).then(function () { toast('已复制链接'); });
            } catch (e) { toast('复制失败', 'err'); }
          });
        });
      }).catch(function (e) {
        box.innerHTML = '<div class="qai-empty" style="color:#f87171;">检索失败：' + esc(e.message || e) + '</div>';
      });
    }
  }

  /* ================= 自检修复 ================= */
  function renderSelfcheck() {
    var v = $('#qai-view-selfcheck');
    v.innerHTML = toolBar('一键自检', '检查本地 AI 环境并修复');
    var c = document.createElement('div');
    c.className = 'qai-content';
    c.innerHTML = '<div class="qai-row-row" style="gap:8px;"><button class="qai-btn" id="qai-sc-run">重新自检</button><span class="qai-muted" id="qai-sc-summary"></span></div><div id="qai-sc-list"></div>';
    v.appendChild(c);
    $('#qai-sc-run').addEventListener('click', loadSelfcheck);
    loadSelfcheck();
  }
  function loadSelfcheck() {
    var box = $('#qai-sc-list');
    var sum = $('#qai-sc-summary');
    if (box) box.innerHTML = '<div class="qai-empty">自检中…</div>';
    if (sum) sum.textContent = '';
    api('GET', '/api/selfcheck').then(function (r) {
      var items = r.items || [];
      if (!box) return;
      var okN = items.filter(function (i) { return i.status === 'ok' || i.status === 'pass' || i.status === 'skip'; }).length;
      if (sum) sum.textContent = '共 ' + items.length + ' 项，通过 ' + okN + ' 项';
      if (!items.length) { box.innerHTML = '<div class="qai-empty">无自检项</div>'; return; }
      box.innerHTML = items.map(function (it) {
        var cls = it.status === 'ok' || it.status === 'pass' ? 'qai-badge-on' : (it.status === 'skip' ? '' : 'qai-badge-off');
        var label = it.status || it.ok ? 'ok' : (it.status || '');
        return '<div class="qai-card qai-row-row" style="justify-content:space-between;">' +
          '<div style="flex:1;"><b style="color:#e3eefc;">' + esc(it.label || it.name || '') + '</b>' +
          '<div class="qai-muted" style="margin-top:3px;">' + esc(it.message || '') + '</div></div>' +
          '<div class="qai-row-row" style="gap:6px;flex:0 0 auto;">' +
          '<span class="qai-badge ' + cls + '">' + esc(label) + '</span>' +
          (it.canFix || it.fix ? '<button class="qai-btn qai-ghost qai-sc-fix" data-key="' + esc(it.key || '') + '" style="font-size:11px;padding:3px 10px;">修复</button>' : '') +
          '</div></div>';
      }).join('');
      $$('#qai-sc-list .qai-sc-fix').forEach(function (b) {
        b.addEventListener('click', function () {
          api('POST', '/api/selfcheck/fix', { key: b.dataset.key }).then(function (r) {
            toast((r && r.message) || (r && r.ok ? '修复完成' : '修复失败'));
            setTimeout(loadSelfcheck, 800);
          }).catch(function (e) { toast('修复失败: ' + e.message, 'err'); });
        });
      });
    }).catch(function (e) {
      if (box) box.innerHTML = '<div class="qai-empty" style="color:#f87171;">自检服务不可达：' + esc(e.message || e) + '</div>';
    });
  }

  /* ================= 主题 ================= */
  function renderTheme() {
    var v = $('#qai-view-theme');
    v.innerHTML = toolBar('主题', '切换 AI 区明暗主题与强调色');
    var c = document.createElement('div');
    c.className = 'qai-content';
    c.innerHTML = [
      '<div class="qai-card"><div class="qai-view-title" style="margin-bottom:8px;">模式</div><div class="qai-row-row" id="qai-thm-mode" style="gap:10px;">' +
      '  <button class="qai-btn qai-ghost qai-mode" data-mode="dark">深色</button>' +
      '  <button class="qai-btn qai-ghost qai-mode" data-mode="light">浅色</button>' +
      '  <button class="qai-btn qai-ghost qai-mode" data-mode="radio">跟随系统</button></div></div>',
      '<div class="qai-card"><div class="qai-view-title" style="margin-bottom:8px;">强调色</div><div class="qai-row-row" id="qai-thm-acc" style="gap:8px;flex-wrap:wrap;"></div></div>',
    ].join('');
    v.appendChild(c);
    api('GET', '/api/theme').catch(function () { return { mode: 'dark', accent: '#22d3ee' }; }).then(function (t) {
      state.theme = t || { mode: 'dark', accent: '#22d3ee' };
      var mb = $('#qai-thm-mode');
      if (mb) {
        mb.innerHTML = ['dark', 'light', 'radio'].map(function (m) {
          return '<button class="qai-btn qai-ghost qai-mode' + (state.theme.mode === m ? ' qai-active' : '') + '" data-mode="' + m + '">' + (m === 'dark' ? '深色' : m === 'light' ? '浅色' : '跟随系统') + '</button>';
        }).join('');
        $$('#qai-thm-mode .qai-mode').forEach(function (b) {
          b.addEventListener('click', function () { saveTheme({ mode: b.dataset.mode }); });
        });
      }
      var ab = $('#qai-thm-acc');
      var accents = ['#22d3ee', '#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e', '#f472b6'];
      if (ab) {
        ab.innerHTML = accents.map(function (a) {
          return '<span class="qai-thm-swatch' + (state.theme.accent === a ? ' sel' : '') + '" data-a="' + a + '" style="background:' + a + ';"></span>';
        }).join('');
        $$('#qai-thm-acc .qai-thm-swatch').forEach(function (s) {
          s.addEventListener('click', function () { saveTheme({ accent: s.dataset.a }); });
        });
      }
    });
    function saveTheme(payload) {
      api('POST', '/api/theme', payload).then(function (t) {
        state.theme = t;
        if (t.accent) document.documentElement.style.setProperty('--acc', t.accent);
        toast('主题已更新');
        renderTheme();
      }).catch(function (e) { toast('保存失败: ' + e.message, 'err'); });
    }
  }

  /* ================= 打开 / 关闭 ================= */
  function open() {
    injectStyle();
    var ov = buildOverlay();
    var unlocked = false;
    try { unlocked = sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) {}
    if (unlocked) {
      state.unlocked = true;
      enterUnlocked();
    } else {
      buildGate();
    }
    ov.classList.add('qai-open');
    document.body.style.overflow = 'hidden';
    loadSvcPill();
  }
  function close() {
    var ov = $('#quchen-ai-overlay');
    if (ov) ov.classList.remove('qai-open');
    document.body.style.overflow = '';
    stopTimers();
  }

  // 暴露入口（index.html 顶栏按钮调用）
  window.openQuchenAi = open;

  // 服务状态轻量轮询（面板打开时保持 pill 新鲜）
  setInterval(function () {
    if ($('#quchen-ai-overlay') && $('#quchen-ai-overlay').classList.contains('qai-open')) loadSvcPill();
  }, 8000);
})();