/* QUCHEN Radio - 内置歌单管理面板
 * 功能：歌单列表、新建/重命名/删除、详情（增删歌曲、排序）、播放（复用现有播放器）
 * 说明：添加的歌曲来自本地音乐库（provider: 'local'，identity=localFileId）
 */
(function () {
  if (window.__quchenBuiltinPlaylistsLoaded) return;
  window.__quchenBuiltinPlaylistsLoaded = true;

  var state = {
    open: false,
    loading: false,
    playlists: [],
    detail: null,
    detailTracks: [],
    pickerOpen: false,
    libraryTracks: [],
    statusText: ''
  };

  var PANEL_ID = 'quchen-builtin-playlists-panel';

  function openBuiltInPlaylists() {
    if (state.open) {
      document.getElementById(PANEL_ID).style.display = 'flex';
      return;
    }
    rebuildPanel();
    state.open = true;
    showListView();
  }

  function closeBuiltInPlaylists() {
    state.open = false;
    var el = document.getElementById(PANEL_ID);
    if (el) el.style.display = 'none';
  }

  function setStatus(text) {
    state.statusText = text || '';
    var st = document.querySelector('#' + PANEL_ID + ' [data-quchen-lm-status]');
    if (st) st.textContent = state.statusText;
  }

  function rebuildPanel() {
    var old = document.getElementById(PANEL_ID);
    if (old) old.parentNode.removeChild(old);
    var wrap = document.createElement('div');
    wrap.className = 'quchen-lm-overlay';
    wrap.id = PANEL_ID;
    wrap.innerHTML = '' +
      '<div class="quchen-lm-panel">' +
      '  <div class="quchen-lm-head">' +
      '    <button class="quchen-lm-btn" data-qpl-back style="display:none;">‹ 返回</button>' +
      '    <div class="quchen-lm-title" data-qpl-title>内置歌单</div>' +
      '    <span class="quchen-lm-subtitle" data-quchen-lm-status></span>' +
      '    <button class="quchen-lm-close" data-quchen-lm-close title="关闭">×</button>' +
      '  </div>' +
      '  <div class="quchen-lm-toolbar">' +
      '    <button class="quchen-lm-btn quchen-lm-btn-primary" data-qpl-create>新建歌单</button>' +
      '    <button class="quchen-lm-btn" data-qpl-add-track style="display:none;">添加本地歌曲</button>' +
      '    <button class="quchen-lm-btn" data-qpl-play-all style="display:none;">播放全部</button>' +
      '  </div>' +
      '  <div class="quchen-lm-body" data-qpl-body></div>' +
      '  <div class="quchen-lm-picker" data-qpl-picker style="display:none;position:absolute;inset:0;background:rgba(4,6,14,.72);display:none;z-index:2;"></div>' +
      '</div>';
    document.body.appendChild(wrap);

    wrap.addEventListener('click', function (e) {
      if (e.target.closest('[data-quchen-lm-close]')) { closeBuiltInPlaylists(); return; }
      var pickerBg = e.target.closest('[data-qpl-picker]');
      if (pickerBg && e.target === pickerBg) { hidePicker(); return; }
      if (e.target.closest('[data-qpl-pick-close]')) { hidePicker(); return; }
      var pickAdd = e.target.closest('[data-qpl-pick-add]');
      if (pickAdd) {
        if (state.detail) {
          var addIdx = Number(pickAdd.getAttribute('data-qpl-pick-add') || '-1');
          if (state.libraryTracks[addIdx]) addTrackToPlaylist(state.detail.id, state.libraryTracks[addIdx]);
        }
        return;
      }
      if (e.target.closest('[data-qpl-back]')) { showListView(); return; }
      if (e.target.closest('[data-qpl-create]')) { createPlaylistPrompt(); return; }
      if (e.target.closest('[data-qpl-add-track]')) { openPicker(); return; }
      if (e.target.closest('[data-qpl-play-all]')) { playAll(); return; }
      var playBtn = e.target.closest('[data-qpl-play]');
      if (playBtn && state.detail) {
        var idx = Number(playBtn.getAttribute('data-qpl-play') || '0');
        if (state.detailTracks[idx]) window.quchenLocalPlayTracks(state.detailTracks, idx);
        return;
      }
      var openBtn = e.target.closest('[data-qpl-open]');
      if (openBtn) { openDetail(openBtn.getAttribute('data-qpl-open')); return; }
      var renameBtn = e.target.closest('[data-qpl-rename]');
      if (renameBtn) { renamePlaylistPrompt(renameBtn.getAttribute('data-qpl-rename')); return; }
      var delBtn = e.target.closest('[data-qpl-delete]');
      if (delBtn) { deletePlaylistPrompt(delBtn.getAttribute('data-qpl-delete')); return; }
      var upBtn = e.target.closest('[data-qpl-up]');
      if (upBtn && state.detail) { reorderTrack(Number(upBtn.getAttribute('data-qpl-up') || '0'), -1); return; }
      var downBtn = e.target.closest('[data-qpl-down]');
      if (downBtn && state.detail) { reorderTrack(Number(downBtn.getAttribute('data-qpl-down') || '0'), 1); return; }
      var removeBtn = e.target.closest('[data-qpl-remove]');
      if (removeBtn && state.detail) { removeTrackPrompt(Number(removeBtn.getAttribute('data-qpl-remove') || '0')); return; }
    });
  }

  function showListView() {
    state.detail = null;
    state.detailTracks = [];
    hidePicker();
    var back = document.querySelector('#' + PANEL_ID + ' [data-qpl-back]');
    var addBtn = document.querySelector('#' + PANEL_ID + ' [data-qpl-add-track]');
    var playAll = document.querySelector('#' + PANEL_ID + ' [data-qpl-play-all]');
    if (back) back.style.display = 'none';
    if (addBtn) addBtn.style.display = 'none';
    if (playAll) playAll.style.display = 'none';
    var title = document.querySelector('#' + PANEL_ID + ' [data-qpl-title]');
    if (title) title.textContent = '内置歌单';
    loadPlaylists();
  }

  function loadPlaylists() {
    var bridge = window.quchenLocalBridge();
    if (!bridge || !bridge.available || !bridge.bp) {
      renderListEmpty('当前环境未提供内置歌单接口');
      return;
    }
    state.loading = true;
    setStatus('加载中…');
    Promise.resolve(bridge.bp.listPlaylists()).then(function (res) {
      state.loading = false;
      if (res && res.ok) {
        state.playlists = (Array.isArray(res.playlists) ? res.playlists : []).filter(Boolean);
        setStatus('共 ' + state.playlists.length + ' 个歌单');
        renderList();
      } else {
        setStatus('读取失败: ' + ((res && res.error) || 'UNKNOWN'));
        renderList();
      }
    }).catch(function (err) {
      state.loading = false;
      setStatus('读取异常: ' + ((err && err.message) || err));
      renderList();
    });
  }

  function renderList() {
    var body = document.querySelector('#' + PANEL_ID + ' [data-qpl-body]');
    if (!body) return;
    var esc = window.quchenLmEscapeHtml;
    if (!state.playlists.length) {
      body.innerHTML = '<div class="quchen-lm-empty">暂无歌单，点击「新建歌单」创建</div>';
      return;
    }
    var html = '<ul class="quchen-lm-list">';
    for (var i = 0; i < state.playlists.length; i++) {
      var p = state.playlists[i] || {};
      html += '<li class="quchen-lm-row quchen-lm-pl-row">' +
        '<div class="quchen-lm-cover">' + (p.cover ? '<img src="' + esc(p.cover) + '" alt="" />' : '♫') + '</div>' +
        '<div class="quchen-lm-row-main">' +
        '  <div class="quchen-lm-row-title">' + esc(p.name || '未命名歌单') + '</div>' +
        '  <div class="quchen-lm-row-sub">' + (Number(p.trackCount) || 0) + ' 首</div>' +
        '</div>' +
        '<button class="quchen-lm-row-act" data-qpl-open="' + esc(p.id) + '" title="打开">打开</button>' +
        '<button class="quchen-lm-row-act" data-qpl-rename="' + esc(p.id) + '" title="重命名">✎</button>' +
        '<button class="quchen-lm-row-act quchen-lm-btn-danger" data-qpl-delete="' + esc(p.id) + '" title="删除">🗑</button>' +
        '</li>';
    }
    html += '</ul>';
    body.innerHTML = html;
  }

  function setListEmpty(msg) {
    var body = document.querySelector('#' + PANEL_ID + ' [data-qpl-body]');
    if (body) body.innerHTML = '<div class="quchen-lm-empty">' + msg + '</div>';
  }

  function createPlaylistPrompt() {
    var name = window.prompt('请输入歌单名称：', '我的歌单');
    if (name === null) return;
    name = String(name || '').trim();
    if (!name) return;
    var bridge = window.quchenLocalBridge();
    if (!bridge || !bridge.bp) return;
    setStatus('创建中…');
    Promise.resolve(bridge.bp.createPlaylist(name)).then(function (res) {
      setStatus(res && res.ok ? '创建成功' : '创建失败: ' + ((res && res.error) || 'CREATE_FAILED'));
      loadPlaylists();
    }).catch(function (err) { setStatus('创建异常: ' + ((err && err.message) || err)); });
  }

  function renamePlaylistPrompt(id) {
    var p = null;
    for (var i = 0; i < state.playlists.length; i++) if (state.playlists[i].id === id) { p = state.playlists[i]; break; }
    var name = window.prompt('请输入新的歌单名称：', p ? p.name : '');
    if (name === null) return;
    name = String(name || '').trim();
    if (!name) return;
    var bridge = window.quchenLocalBridge();
    if (!bridge || !bridge.bp) return;
    setStatus('重命名中…');
    Promise.resolve(bridge.bp.renamePlaylist(id, name)).then(function (res) {
      setStatus(res && res.ok ? '重命名成功' : '重命名失败: ' + ((res && res.error) || 'RENAME_FAILED'));
      loadPlaylists();
      if (state.detail && state.detail.id === id) {
        var title = document.querySelector('#' + PANEL_ID + ' [data-qpl-title]');
        if (title) title.textContent = name;
      }
    }).catch(function (err) { setStatus('重命名异常: ' + ((err && err.message) || err)); });
  }

  function deletePlaylistPrompt(id) {
    var p = null;
    for (var i = 0; i < state.playlists.length; i++) if (state.playlists[i].id === id) { p = state.playlists[i]; break; }
    if (!window.confirm('确定删除歌单「' + ((p && p.name) || '未命名') + '」吗？')) return;
    var bridge = window.quchenLocalBridge();
    if (!bridge || !bridge.bp) return;
    setStatus('删除中…');
    Promise.resolve(bridge.bp.deletePlaylist(id)).then(function (res) {
      setStatus(res && res.ok ? '已删除' : '删除失败: ' + ((res && res.error) || 'DELETE_FAILED'));
      loadPlaylists();
    }).catch(function (err) { setStatus('删除异常: ' + ((err && err.message) || err)); });
  }

  function openDetail(id) {
    var bridge = window.quchenLocalBridge();
    if (!bridge || !bridge.bp) return;
    state.detail = null;
    state.detailTracks = [];
    var back = document.querySelector('#' + PANEL_ID + ' [data-qpl-back]');
    var addBtn = document.querySelector('#' + PANEL_ID + ' [data-qpl-add-track]');
    var playAll = document.querySelector('#' + PANEL_ID + ' [data-qpl-play-all]');
    if (back) back.style.display = '';
    if (addBtn) addBtn.style.display = '';
    if (playAll) playAll.style.display = '';
    var title = document.querySelector('#' + PANEL_ID + ' [data-qpl-title]');
    if (title) title.textContent = '歌单详情';
    setStatus('加载中…');
    Promise.resolve(bridge.bp.pagePlaylist(id, { offset: 0, limit: 500 })).then(function (res) {
      if (res && res.ok) {
        state.detail = res.playlist || null;
        state.detailTracks = Array.isArray(res.tracks) ? res.tracks : [];
        var t = document.querySelector('#' + PANEL_ID + ' [data-qpl-title]');
        if (t && state.detail) t.textContent = state.detail.name || '歌单详情';
        setStatus('共 ' + state.detailTracks.length + ' 首');
        renderDetail();
      } else {
        setStatus('打开失败: ' + ((res && res.error) || 'NOT_FOUND'));
        showListView();
      }
    }).catch(function (err) {
      setStatus('打开异常: ' + ((err && err.message) || err));
      showListView();
    });
  }

  function renderDetail() {
    var body = document.querySelector('#' + PANEL_ID + ' [data-qpl-body]');
    if (!body) return;
    var esc = window.quchenLmEscapeHtml;
    var fmt = window.quchenLmFormatDuration;
    if (!state.detailTracks.length) {
      body.innerHTML = '<div class="quchen-lm-empty">歌单是空的，点击「添加本地歌曲」添加</div>';
      return;
    }
    var html = '<div class="quchen-lm-detail-meta">' + esc((state.detail && state.detail.name) || '') + ' · ' + state.detailTracks.length + ' 首</div><ul class="quchen-lm-list">';
    for (var i = 0; i < state.detailTracks.length; i++) {
      var t = state.detailTracks[i] || {};
      var name = t.name || t.title || '未知歌曲';
      var artist = t.artist || (t.provider === 'local' ? '本地歌曲' : '未知歌手');
      var dur = fmt(t.duration);
      html += '<li class="quchen-lm-row">' +
        '<span class="quchen-lm-row-idx">' + (i + 1) + '</span>' +
        '<div class="quchen-lm-row-main">' +
        '  <div class="quchen-lm-row-title">' + esc(name) + '</div>' +
        '  <div class="quchen-lm-row-sub">' + esc(artist) + (t.localMissing ? ' <span class="quchen-lm-note">(文件缺失)</span>' : '') + '</div>' +
        '</div>' +
        (t.hasLyric ? '<span class="quchen-lm-row-lyric-tag">词</span>' : '') +
        '<span class="quchen-lm-row-meta">' + dur + '</span>' +
        '<button class="quchen-lm-row-act" data-qpl-play="' + i + '" title="播放">▶</button>' +
        '<button class="quchen-lm-row-act" data-qpl-up="' + i + '" title="上移">↑</button>' +
        '<button class="quchen-lm-row-act" data-qpl-down="' + i + '" title="下移">↓</button>' +
        '<button class="quchen-lm-row-act quchen-lm-btn-danger" data-qpl-remove="' + i + '" title="移除">×</button>' +
        '</li>';
    }
    html += '</ul>';
    body.innerHTML = html;
  }

  function reorderTrack(idx, dir) {
    if (!state.detail) return;
    var to = idx + dir;
    if (to < 0 || to >= state.detailTracks.length) return;
    var bridge = window.quchenLocalBridge();
    if (!bridge || !bridge.bp) return;
    setStatus('移动中…');
    Promise.resolve(bridge.bp.reorderTrack(state.detail.id, idx, to)).then(function (res) {
      if (res && res.ok) {
        var item = state.detailTracks.splice(idx, 1)[0];
        state.detailTracks.splice(to, 0, item);
        setStatus('已移动');
        renderDetail();
      } else {
        setStatus('移动失败: ' + ((res && res.error) || 'REORDER_FAILED'));
      }
    }).catch(function (err) { setStatus('移动异常: ' + ((err && err.message) || err)); });
  }

  function removeTrackPrompt(idx) {
    var t = state.detailTracks[idx] || {};
    if (!window.confirm('确定从歌单移除《' + (t.name || t.title || '未知歌曲') + '》吗？')) return;
    var bridge = window.quchenLocalBridge();
    if (!bridge || !bridge.bp || !state.detail) return;
    var pid = state.detail.id;
    setStatus('移除中…');
    Promise.resolve(bridge.bp.removeTrack(pid, idx)).then(function (res) {
      if (res && res.ok) {
        state.detailTracks.splice(idx, 1);
        setStatus('已移除');
        renderDetail();
      } else {
        setStatus('移除失败: ' + ((res && res.error) || 'REMOVE_FAILED'));
      }
    }).catch(function (err) { setStatus('移除异常: ' + ((err && err.message) || err)); });
  }

  function openPicker() {
    var picker = document.querySelector('#' + PANEL_ID + ' [data-qpl-picker]');
    if (!picker) return;
    state.pickerOpen = true;
    picker.style.display = 'flex';
    state.libraryTracks = [];
    picker.innerHTML = '<div style="background:rgba(13,17,32,.97);border:1px solid rgba(140,160,220,.22);border-radius:16px;width:min(640px,88vw);max-height:72vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.6);">' +
      '<div class="quchen-lm-head"><div class="quchen-lm-title">添加本地歌曲</div><button class="quchen-lm-close" data-qpl-pick-close title="关闭">×</button></div>' +
      '<div class="quchen-lm-body" data-qpl-pick-list><div class="quchen-lm-empty">加载本地歌曲…</div></div></div>';
    var bridge = window.quchenLocalBridge();
    if (!bridge || !bridge.ml) {
      picker.querySelector('[data-qpl-pick-list]').innerHTML = '<div class="quchen-lm-empty">本地音乐库不可用</div>';
      return;
    }
    Promise.resolve(bridge.ml.listTracks()).then(function (res) {
      if (res && res.ok) state.libraryTracks = (Array.isArray(res.tracks) ? res.tracks : []).filter(Boolean);
      renderPickerList();
    }).catch(function () { renderPickerList(); });
  }

  function hidePicker() {
    state.pickerOpen = false;
    var picker = document.querySelector('#' + PANEL_ID + ' [data-qpl-picker]');
    if (picker) { picker.style.display = 'none'; picker.innerHTML = ''; }
  }

  function renderPickerList() {
    var listEl = document.querySelector('#' + PANEL_ID + ' [data-qpl-pick-list]');
    if (!listEl) return;
    var esc = window.quchenLmEscapeHtml;
    if (!state.libraryTracks.length) {
      listEl.innerHTML = '<div class="quchen-lm-empty">本地音乐库为空，<span style="color:#7ce8b0;">请先到「本地音乐库」导入歌曲</span></div>';
      return;
    }
    var html = '<ul class="quchen-lm-list">';
    for (var i = 0; i < state.libraryTracks.length; i++) {
      var t = state.libraryTracks[i] || {};
      html += '<li class="quchen-lm-row">' +
        '<div class="quchen-lm-row-main">' +
        '  <div class="quchen-lm-row-title">' + esc(t.name || t.title || t.filePath || '未知歌曲') + '</div>' +
        '  <div class="quchen-lm-row-sub">' + esc(t.artist || '本地歌曲') + '</div>' +
        '</div>' +
        '<button class="quchen-lm-row-act quchen-lm-btn-primary" data-qpl-pick-add="' + i + '">添加</button>' +
        '</li>';
    }
    html += '</ul>';
    listEl.innerHTML = html;
  }

  function addTrackToPlaylist(pid, track) {
    var bridge = window.quchenLocalBridge();
    if (!bridge || !bridge.bp) return;
    setStatus('添加中…');
    Promise.resolve(bridge.bp.addTrack(pid, track)).then(function (res) {
      if (res && res.ok) {
        if (res.duplicate) setStatus('歌曲已在歌单中');
        else setStatus('已添加');
        hidePicker();
        if (state.detail && state.detail.id === pid) openDetail(pid);
        else loadPlaylists();
      } else {
        setStatus('添加失败: ' + ((res && res.error) || 'ADD_FAILED'));
      }
    }).catch(function (err) { setStatus('添加异常: ' + ((err && err.message) || err)); });
  }

  function playAll() {
    if (!state.detailTracks.length) { setStatus('歌单为空'); return; }
    window.quchenLocalPlayTracks(state.detailTracks, 0);
  }

  window.openBuiltInPlaylists = openBuiltInPlaylists;
  window.closeBuiltInPlaylists = closeBuiltInPlaylists;
})();