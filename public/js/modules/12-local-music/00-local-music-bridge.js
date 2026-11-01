/* QUCHEN Radio - 本地音乐库 / 内置歌单前端桥接模块
 * 依赖：desktop/preload.js 暴露 desktopWindow.mineradioLocal 与 desktopWindow.builtInPlaylists
 * 提供：全局样式注入、IPC 桥、播放复用（现有播放器）、本地歌词注入
 */
(function () {
  if (window.__quchenLocalMusicBridgeLoaded) return;
  window.__quchenLocalMusicBridgeLoaded = true;

  var QUCHEN_LM_STYLE_ID = 'quchen-local-music-styles';

  function quchenLmInjectStyles() {
    if (document.getElementById(QUCHEN_LM_STYLE_ID)) return;
    var css = [
      '.quchen-lm-overlay{position:fixed;inset:0;z-index:20000;background:rgba(4,6,14,.62);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;}',
      '.quchen-lm-panel{width:min(880px,92vw);height:min(640px,86vh);background:linear-gradient(160deg,rgba(24,30,52,.96),rgba(13,17,32,.97));border:1px solid rgba(140,160,220,.22);border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,.55);display:flex;flex-direction:column;overflow:hidden;color:#e8ecf8;}',
      '.quchen-lm-head{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid rgba(140,160,220,.14);flex-shrink:0;}',
      '.quchen-lm-title{font-size:16px;font-weight:600;color:#fff;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.quchen-lm-subtitle{font-size:12px;color:#8d97b8;margin-left:-8px;}',
      '.quchen-lm-close{cursor:pointer;border:1px solid rgba(140,160,220,.25);background:rgba(140,160,220,.1);color:#cdd6ee;border-radius:9px;width:32px;height:32px;font-size:14px;line-height:30px;text-align:center;flex-shrink:0;}',
      '.quchen-lm-close:hover{background:rgba(255,90,110,.25);border-color:rgba(255,90,110,.5);color:#ffb0ba;}',
      '.quchen-lm-toolbar{display:flex;align-items:center;gap:10px;padding:10px 18px;border-bottom:1px solid rgba(140,160,220,.1);flex-shrink:0;flex-wrap:wrap;}',
      '.quchen-lm-btn{cursor:pointer;border:1px solid rgba(140,160,220,.3);background:rgba(140,160,220,.1);color:#dfe6fa;border-radius:9px;padding:6px 14px;font-size:13px;line-height:1.4;}',
      '.quchen-lm-btn:hover{background:rgba(140,160,220,.2);}',
      '.quchen-lm-btn-danger:hover{background:rgba(255,90,110,.18);border-color:rgba(255,90,110,.45);}',
      '.quchen-lm-btn-primary{background:linear-gradient(135deg,#4f7cff,#7a5cff);border-color:transparent;color:#fff;}',
      '.quchen-lm-btn-primary:hover{filter:brightness(1.1);}',
      '.quchen-lm-search{background:rgba(10,14,28,.55);border:1px solid rgba(140,160,220,.18);border-radius:9px;color:#e8ecf8;padding:6px 12px;font-size:13px;min-width:180px;outline:none;}',
      '.quchen-lm-search::placeholder{color:#6a7496;}',
      '.quchen-lm-status{font-size:12px;color:#aab4d4;flex:1;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.quchen-lm-body{flex:1;overflow:auto;padding:8px 0;}',
      '.quchen-lm-list{list-style:none;margin:0;padding:0 10px;}',
      '.quchen-lm-row{display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:11px;cursor:pointer;transition:background .15s;}',
      '.quchen-lm-row:hover{background:rgba(140,160,220,.1);}',
      '.quchen-lm-row.playing{background:rgba(79,124,255,.14);box-shadow:inset 2px 0 0 #4f7cff;}',
      '.quchen-lm-row-idx{width:26px;text-align:center;color:#6b7496;font-size:12px;flex-shrink:0;}',
      '.quchen-lm-row-main{flex:1;min-width:0;}',
      '.quchen-lm-row-title{font-size:14px;color:#eef2ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.quchen-lm-row-sub{font-size:12px;color:#8d97b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;}',
      '.quchen-lm-row-meta{font-size:12px;color:#7c86aa;flex-shrink:0;white-space:nowrap;}',
      '.quchen-lm-row-lyric-tag{font-size:10px;color:#7ce8b0;border:1px solid rgba(124,232,176,.35);border-radius:5px;padding:1px 6px;flex-shrink:0;}',
      '.quchen-lm-row-act{cursor:pointer;border:none;background:transparent;color:#8d97b8;font-size:12px;padding:4px 6px;flex-shrink:0;border-radius:6px;}',
      '.quchen-lm-row-act:hover{background:rgba(140,160,220,.18);color:#fff;}',
      '.quchen-lm-empty{color:#7c86aa;text-align:center;padding:48px 20px;font-size:13px;}',
      '.quchen-lm-hint{color:#566080;text-align:center;padding:6px 20px 18px;font-size:12px;}',
      '.quchen-lm-pl-row{padding:10px 12px;}',
      '.quchen-lm-cover{width:38px;height:38px;border-radius:8px;background:linear-gradient(135deg,#2a3357,#1a2036);display:flex;align-items:center;justify-content:center;font-size:15px;color:#7c86aa;flex-shrink:0;overflow:hidden;}',
      '.quchen-lm-cover img{width:100%;height:100%;object-fit:cover;}',
      '.quchen-lm-detail-meta{padding:12px 20px;border-bottom:1px solid rgba(140,160,220,.1);font-size:12px;color:#aab4d4;flex-shrink:0;}',
      '.quchen-lm-note{color:#f6d98a;}',
      '.quchen-lm-overlay *{box-sizing:border-box;}'
    ].join('');
    var el = document.createElement('style');
    el.id = QUCHEN_LM_STYLE_ID;
    el.textContent = css;
    var head = document.head || document.documentElement;
    (head || document.body).appendChild(el);
  }

  function quchenLocalBridge() {
    var dw = window.desktopWindow || {};
    return {
      ml: dw.mineradioLocal || null,
      bp: dw.builtInPlaylists || null,
      available: !!(dw.mineradioLocal && dw.builtInPlaylists)
    };
  }

  function quchenLmEscapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function quchenLmFormatDuration(sec) {
    sec = Number(sec);
    if (!isFinite(sec) || sec <= 0) return '--:--';
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return (m < 10 ? '0' + m : '' + m) + ':' + (s < 10 ? '0' + s : '' + s);
  }

  /* 复用现有播放器：将本地歌曲推入播放队列并开始播放 */
  function quchenLocalPlayTracks(tracks, index) {
    if (!tracks || !tracks.length) return false;
    var song = tracks[Math.max(0, Math.min(Number(index) || 0, tracks.length - 1))];
    if (!song) return false;
    if (typeof homeForcedOpen !== 'undefined') homeForcedOpen = false;
    if (typeof setHomeControlsLocked === 'function') setHomeControlsLocked(false);
    var targetKey = (typeof queueItemKey === 'function') ? queueItemKey(song) : (song.localKey || song.id || '');
    if (!playQueue.length) {
      playQueue.unshift(cloneSong(song));
      currentIdx = 0;
    } else {
      var matchIdx = -1;
      for (var j = 0; j < playQueue.length; j++) {
        var k = (typeof queueItemKey === 'function') ? queueItemKey(playQueue[j]) : (playQueue[j].localKey || playQueue[j].id || '');
        if (k === targetKey) { matchIdx = j; break; }
      }
      if (matchIdx >= 0) {
        currentIdx = (typeof moveQueueIndexToTop === 'function') ? moveQueueIndexToTop(matchIdx) : matchIdx;
      } else {
        playQueue.unshift(cloneSong(song));
        currentIdx = 0;
      }
    }
    quchenLocalLoadLyric(playQueue[currentIdx], null);
    playQueueAt(currentIdx);
    return true;
  }

  /* 通过主进程取本地歌词并注入现有歌词渲染 */
  function quchenLocalLoad(song, localFileId) {
    if (!song || song.__quchenLyricFetching) return;
    var bridge = quchenLocalBridge();
    if (!bridge.ml) return;
    var fid = localFileId || song.localFileId ||
      (typeof song.localKey === 'string' ? song.localKey.replace(/^local:/, '') : '');
    if (!fid) return;
    song.__quchenLyricFetching = true;
    Promise.resolve(bridge.ml.lyricForTrack(fid)).then(function (res) {
      if (res && res.ok && typeof res.lyric === 'string' && res.lyric.trim()) {
        song.lyric = res.lyric;
        song.hasLyric = true;
        try {
          if (typeof applyFetchedLyricResponse === 'function') {
            setTimeout(function () {
              var token = (typeof trackSwitchToken !== 'undefined') ? trackSwitchToken : 0;
              if (token === undefined || token === null) token = 0;
              applyFetchedLyricResponse(song, token, {
                lyric: res.lyric,
                lyricSource: res.lyricSource || 'local'
              }, { persist: false, reason: 'local-music' });
            }, 160);
          }
        } catch (e) { /* 歌词注入失败不影响播放 */ }
      }
      song.__quchenLyricFetching = false;
    }).catch(function () {
      song.__quchenLyricFetching = false;
    });
  }

  quchenLmInjectStyles();

  window.quchenLocalBridge = quchenLocalBridge;
  window.quchenLocalPlayTracks = quchenLocalPlayTracks;
  window.quchenLocalLoadLyric = quchenLocalLoad;
  window.quchenLmEscapeHtml = quchenLmEscapeHtml;
  window.quchenLmFormatDuration = quchenLmFormatDuration;
})();