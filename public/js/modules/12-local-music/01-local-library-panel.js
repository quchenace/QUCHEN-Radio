/* QUCHEN Radio - 本地音乐库面板
 * 功能：选择/导入本地音频、歌曲列表、点击播放（复用现有播放器）、本地歌词显示
 */
(function () {
  if (window.__quchenLocalLibraryPanelLoaded) return;
  window.__quchenLocalLibraryPanelLoaded = true;

  var libraryState = {
    open: false,
    loading: false,
    importing: false,
    tracks: [],
    filter: '',
    statusText: ''
  };

  var PANEL_ID = 'quchen-local-library-panel';

  function openLocalMusicLibrary() {
    if (libraryState.open) { document.getElementById(PANEL_ID).style.display = 'flex'; return; }
    rebuildPanel();
    libraryState.open = true;
    refreshLocalLibrary(true);
  }

  function closeLocalMusicLibrary() {
    libraryState.open = false;
    var el = document.getElementById(PANEL_ID);
    if (el) el.style.display = 'none';
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
      '    <div class="quchen-lm-title">本地音乐库</div>' +
      '    <span class="quchen-lm-subtitle" data-quchen-lm-status></span>' +
      '    <button class="quchen-lm-close" data-quchen-lm-close title="关闭">×</button>' +
      '  </div>' +
      '  <div class="quchen-lm-toolbar">' +
      '    <button class="quchen-lm-btn quchen-lm-btn-primary" data-quchen-lm-import>导入本地音频</button>' +
      '    <input class="quchen-lm-search" type="text" placeholder="搜索本地歌曲…" data-quchen-lm-filter />' +
      '  </div>' +
      '  <div class="quchen-lm-body" data-quchen-lm-list></div>' +
      '</div>';
    document.body.appendChild(wrap);

    wrap.addEventListener('click', function (e) {
      var closeBtn = e.target.closest('[data-quchen-lm-close]');
      if (closeBtn) { closeLocalMusicLibrary(); return; }
      var act = e.target.closest('[data-quchen-lm-action]');
      if (act && act.getAttribute('data-quchen-lm-action') === 'import') {
        importLocalAudioFiles(e);
        return;
      }
      var playBtn = e.target.closest('[data-quchen-lm-play]');
      if (playBtn) {
        var idx = Number(playBtn.getAttribute('data-quchen-lm-play') || '0');
        if (libraryState.tracks[idx]) {
          window.quchenLocalPlayTracks(libraryState.tracks, idx);
          markPlayingRow(idx);
        }
        return;
      }
    });

    wrap.addEventListener('input', function (e) {
      var f = e.target.closest('[data-quchen-lm-filter]');
      if (!f) return;
      libraryState.filter = f.value.trim().toLowerCase();
      renderTrackList();
    });
  }

  function markPlayingRow(idx) {
    var rows = (document.getElementById(PANEL_ID) || document).querySelectorAll('[data-quchen-lm-play]');
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i].closest('.quchen-lm-row');
      if (row) row.classList.toggle('playing', Number(rows[i].getAttribute('data-quchen-lm-play')) === idx);
    }
  }

  function refreshLocalLibrary(silent) {
    var bridge = window.quchenLocalBridge();
    if (!bridge || !bridge.available || !bridge.ml) {
      renderNoBridge();
      return;
    }
    libraryState.loading = true;
    if (!silent) setStatus('加载中…');
    return Promise.resolve(bridge.ml.listTracks()).then(function (res) {
      libraryState.loading = false;
      if (res && res.ok) {
        libraryState.tracks = (Array.isArray(res.tracks) ? res.tracks : []).filter(Boolean);
        setStatus('共 ' + libraryState.tracks.length + ' 首');
      } else {
        setStatus('读取失败: ' + ((res && res.error) || '未知'));
      }
      renderTrackList();
    }).catch(function (err) {
      libraryState.loading = false;
      setStatus('读取异常: ' + ((err && err.message) || err));
      renderTrackList();
    });
  }

  function importLocalAudioFiles(e) {
    var bridge = window.quchenLocalBridge();
    if (!bridge || !bridge.available || !bridge.ml) return;
    if (libraryState.importing) return;
    libraryState.importing = true;
    setStatus('选择文件…');
    Promise.resolve(bridge.ml.chooseFiles()).then(function (choose) {
      if (!choose || !choose.ok || !choose.paths || !choose.paths.length) {
        libraryState.importing = false;
        setStatus(choose && choose.canceled ? '已取消' : '未选择文件');
        return;
      }
      setStatus('授权 ' + choose.paths.length + ' 个文件…');
      return Promise.resolve(bridge.ml.authorizeImport(choose.paths)).then(function (auth) {
        if (!auth || !auth.ok || !auth.token) {
          libraryState.importing = false;
          setStatus('导入授权失败: ' + ((auth && auth.error) || 'NO_TOKEN'));
          return;
        }
        setStatus('导入中…');
        return Promise.resolve(bridge.ml.importFiles(auth.token)).then(function (imp) {
          libraryState.importing = false;
          if (imp && imp.ok) {
            var n = (imp.tracks && imp.tracks.length) || imp.count || 0;
            setStatus('导入成功 ' + n + ' 首');
          } else {
            setStatus('导入失败: ' + ((imp && imp.error) || 'IMPORT_FAILED'));
          }
          return refreshLocalLibrary(true);
        });
      });
    }).catch(function (err) {
      libraryState.importing = false;
      setStatus('导入异常: ' + ((err && err.message) || err));
    });
  }

  function setStatus(text) {
    libraryState.statusText = text || '';
    var st = document.querySelector('#' + PANEL_ID + ' [data-quchen-lm-status]');
    if (st) st.textContent = libraryState.statusText;
  }

  function renderTrackList() {
    var body = document.querySelector('#' + PANEL_ID + ' [data-quchen-lm-list]');
    if (!body) return;
    var list = libraryState.tracks;
    if (libraryState.filter) {
      list = list.filter(function (t) {
        var hay = ((t.name || '') + ' ' + (t.artist || '') + ' ' + (t.album || '')).toLowerCase();
        return hay.indexOf(libraryState.filter) >= 0;
      });
    }
    if (!list.length) {
      body.innerHTML = '' +
        '<div class="quchen-lm-empty">' + (libraryState.tracks.length ? '没有匹配的歌曲' : '暂无本地歌曲，点击“导入本地音频”添加') + '</div>';
      return;
    }
    var esc = window.quchenLmEscapeHtml;
    var fmt = window.quchenLmFormatDuration;
    var html = '<ul class="quchen-lm-list">';
    for (var i = 0; i < list.length; i++) {
      var t = list[i] || {};
      var displayName = t.name || t.title || t.localPath || '未知歌曲';
      var artist = t.artist || '未知歌手';
      var album = t.album || '';
      var dur = fmt(t.duration);
      html += '<li class="quchen-lm-row" data-quchen-lm-row="' + i + '">' +
        '<span class="quchen-lm-row-idx">' + (i + 1) + '</span>' +
        '<div class="quchen-lm-cover">' + (t.cover ? '<img src="' + esc(t.cover) + '" alt="" />' : '♪') + '</div>' +
        '<div class="quchen-lm-row-main">' +
        '  <div class="quchen-lm-row-title">' + esc(displayName) + '</div>' +
        '  <div class="quchen-lm-row-sub">' + esc(artist) + (album ? ' — ' + esc(album) : '') + '</div>' +
        '</div>' +
        (t.hasLyric ? '<span class="quchen-lm-row-lyric-tag">词</span>' : '') +
        '<span class="quchen-lm-row-meta">' + dur + '</span>' +
        '<button class="quchen-lm-row-act" data-quchen-lm-play="' + i + '" title="播放">▶</button>' +
        '</li>';
    }
    html += '</ul>';
    body.innerHTML = html;
  }

  function renderNoBridge() {
    var body = document.querySelector('#' + PANEL_ID + ' [data-quchen-lm-list]');
    if (body) body.innerHTML = '<div class="quchen-lm-empty">当前环境未提供本地音乐库接口</div>';
  }

  window.openLocalMusicLibrary = openLocalMusicLibrary;
  window.closeLocalMusicLibrary = closeLocalMusicLibrary;
  window.quchenLocalLibraryRefresh = refreshLocalLibrary;
})();