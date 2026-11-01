function quchenradioCacheStorageNode(id) {
  return document.getElementById(id);
}

function formatQUCHENRadioCacheBytes(value) {
  var bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return bytes + ' B';
  var units = ['KB', 'MB', 'GB', 'TB'];
  var index = -1;
  do {
    bytes /= 1024;
    index += 1;
  } while (bytes >= 1024 && index < units.length - 1);
  return (bytes >= 100 || index === 0 ? bytes.toFixed(0) : bytes.toFixed(1)) + ' ' + units[index];
}

function setQUCHENRadioCacheStorageText(id, value) {
  var node = quchenradioCacheStorageNode(id);
  if (node) node.textContent = value == null || value === '' ? '—' : String(value);
}

function applyQUCHENRadioCacheSettings(snapshot) {
  if (!snapshot || !snapshot.ok) {
    setQUCHENRadioCacheStorageText('cache-storage-total', '读取失败');
    setQUCHENRadioCacheStorageText('cache-storage-note', snapshot && snapshot.error ? ('缓存设置不可用：' + snapshot.error) : '缓存设置不可用');
    return;
  }
  var settings = snapshot.settings || {};
  var usage = snapshot.usage || {};
  setQUCHENRadioCacheStorageText('cache-storage-root', settings.rootPath);
  setQUCHENRadioCacheStorageText('cache-storage-total', '已占用 ' + formatQUCHENRadioCacheBytes(usage.totalManagedBytes));
  setQUCHENRadioCacheStorageText('cache-storage-lyrics-path', settings.lyricsPath);
  setQUCHENRadioCacheStorageText('cache-storage-lyrics-size', formatQUCHENRadioCacheBytes(usage.lyricsBytes));
  setQUCHENRadioCacheStorageText('cache-storage-chromium-path', settings.activeChromiumPath || settings.chromiumPath);
  setQUCHENRadioCacheStorageText('cache-storage-chromium-size', formatQUCHENRadioCacheBytes(usage.chromiumBytes));
  setQUCHENRadioCacheStorageText('cache-storage-beatmaps-path', settings.activeBeatmapsPath || settings.beatmapsPath);
  setQUCHENRadioCacheStorageText('cache-storage-beatmaps-size', formatQUCHENRadioCacheBytes(usage.beatmapsBytes));
  setQUCHENRadioCacheStorageText('cache-storage-updates-path', settings.activeUpdatesPath || settings.updatesPath);
  setQUCHENRadioCacheStorageText('cache-storage-updates-size', formatQUCHENRadioCacheBytes(usage.updatesBytes));
  setQUCHENRadioCacheStorageText('cache-storage-wallpaper-path', settings.activeWallpaperEnginePath || settings.wallpaperEnginePath);
  setQUCHENRadioCacheStorageText('cache-storage-wallpaper-size', formatQUCHENRadioCacheBytes(usage.wallpaperEngineBytes));
  setQUCHENRadioCacheStorageText('cache-storage-userdata-path', settings.userDataPath || '系统安全数据目录');
  setQUCHENRadioCacheStorageText('cache-storage-userdata-size', formatQUCHENRadioCacheBytes(usage.userDataBytes));
  var restartButton = quchenradioCacheStorageNode('cache-storage-restart');
  if (restartButton) restartButton.hidden = !settings.restartRequired;
  setQUCHENRadioCacheStorageText(
    'cache-storage-note',
    settings.restartRequired
      ? '歌词缓存已切换；封面、网络、音频分片、节奏分析、WE 静音场景与更新缓存将在重启后改用新目录。'
      : '歌词缓存立即生效；封面、网络、音频分片、节奏分析、WE 静音场景与更新缓存已使用此目录。'
  );
}

function refreshQUCHENRadioCacheSettings() {
  if (!window.desktopWindow || typeof window.desktopWindow.getCacheSettings !== 'function') {
    applyQUCHENRadioCacheSettings({ ok: false, error: '仅桌面版支持本地缓存路径设置' });
    return Promise.resolve();
  }
  setQUCHENRadioCacheStorageText('cache-storage-total', '正在统计...');
  return window.desktopWindow.getCacheSettings().then(applyQUCHENRadioCacheSettings).catch(function (error) {
    applyQUCHENRadioCacheSettings({ ok: false, error: error && error.message || '读取失败' });
  });
}

function chooseQUCHENRadioCacheRoot() {
  if (!window.desktopWindow || typeof window.desktopWindow.chooseCacheDirectory !== 'function') return;
  window.desktopWindow.chooseCacheDirectory().then(function (choice) {
    if (!choice || !choice.ok || choice.canceled || !choice.rootPath) return;
    return window.desktopWindow.setCacheSettings({ rootPath: choice.rootPath });
  }).then(function (snapshot) {
    if (snapshot) applyQUCHENRadioCacheSettings(snapshot);
  }).catch(function (error) {
    applyQUCHENRadioCacheSettings({ ok: false, error: error && error.message || '保存失败' });
  });
}

function restartQUCHENRadioForCachePath() {
  if (!window.desktopWindow || typeof window.desktopWindow.restartApp !== 'function') return;
  window.desktopWindow.restartApp();
}

setTimeout(refreshQUCHENRadioCacheSettings, 450);
