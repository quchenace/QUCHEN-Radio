const { contextBridge, ipcRenderer, clipboard } = require('electron');

let quchenAiRequestSequence = 0;
function onQuchenAiEvent(channel, callback) {
  if (typeof callback !== 'function') return () => {};
  const listener = (_event, payload) => callback(payload || {});
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('quchenAi', {
  listModels: (options) => ipcRenderer.invoke('quchenradio-ai-models', {
    baseUrl: String(options && options.baseUrl || ''),
    apiKey: String(options && options.apiKey || ''),
  }),
  startChat: (options) => {
    quchenAiRequestSequence += 1;
    const requestId = `qai-${Date.now().toString(36)}-${quchenAiRequestSequence.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    ipcRenderer.send('quchenradio-ai-chat', {
      requestId,
      baseUrl: String(options && options.baseUrl || ''),
      apiKey: String(options && options.apiKey || ''),
      model: String(options && options.model || ''),
      messages: (Array.isArray(options && options.messages) ? options.messages : []).map((message) => ({
        role: String(message && message.role || 'user'),
        content: String(message && message.content != null ? message.content : ''),
      })),
    });
    return requestId;
  },
  cancelChat: (requestId) => ipcRenderer.send('quchenradio-ai-cancel', {
    requestId: String(requestId || ''),
  }),
  onChunk: (callback) => onQuchenAiEvent('quchenradio-ai-chunk', callback),
  onDone: (callback) => onQuchenAiEvent('quchenradio-ai-done', callback),
  onError: (callback) => onQuchenAiEvent('quchenradio-ai-error', callback),
});

contextBridge.exposeInMainWorld('desktopWindow', {
  isDesktop: true,
  minimize: () => ipcRenderer.invoke('desktop-window-minimize'),
  restore: () => ipcRenderer.invoke('desktop-window-restore'),
  toggleMaximize: () => ipcRenderer.invoke('desktop-window-toggle-maximize'),
  toggleFullscreen: () => ipcRenderer.invoke('desktop-window-toggle-fullscreen'),
  exitFullscreenWindowed: () => ipcRenderer.invoke('desktop-window-exit-fullscreen-windowed'),
  getState: () => ipcRenderer.invoke('desktop-window-get-state'),
  getGpuDiagnostics: () => ipcRenderer.invoke('quchenradio-get-gpu-diagnostics'),
  getMemorySnapshot: () => ipcRenderer.invoke('quchenradio-memory-get-snapshot'),
  configureMemoryReduct: (payload) => ipcRenderer.invoke('quchenradio-memory-configure-auto', payload || {}),
  trimAppMemory: (payload) => ipcRenderer.invoke('quchenradio-memory-trim-app', payload || {}),
  purgeSystemMemory: (payload) => ipcRenderer.invoke('quchenradio-memory-purge-system', payload || {}),
  getCacheSettings: () => ipcRenderer.invoke('quchenradio-cache-get-settings'),
  chooseCacheDirectory: () => ipcRenderer.invoke('quchenradio-cache-choose-directory'),
  setCacheSettings: (payload) => ipcRenderer.invoke('quchenradio-cache-set-settings', payload || {}),
  listWallpaperEngineProjects: (payload) => ipcRenderer.invoke('quchenradio-wallpaper-engine-list', payload || {}),
  getWallpaperEngineProjectDetails: (id) => ipcRenderer.invoke('quchenradio-wallpaper-engine-project-details', String(id || '')),
  openWallpaperEngineProjectDetails: (id, target) => ipcRenderer.invoke('quchenradio-wallpaper-engine-open-project-details', {
    id: String(id || ''),
    target: target === 'workshop' ? 'workshop' : 'we',
  }),
  chooseWallpaperEngineDirectory: () => ipcRenderer.invoke('quchenradio-wallpaper-engine-choose-directory'),
  chooseWallpaperEngineProjectFile: () => ipcRenderer.invoke('quchenradio-wallpaper-engine-choose-project-file'),
  removeWallpaperEngineDirectory: (rootId) => ipcRenderer.invoke('quchenradio-wallpaper-engine-remove-directory', String(rootId || '')),
  getWallpaperEngineRuntimeStatus: (payload) => ipcRenderer.invoke('quchenradio-wallpaper-engine-runtime-status', payload || {}),
  startWallpaperEngineScene: (payload) => ipcRenderer.invoke('quchenradio-wallpaper-engine-start-scene', payload || {}),
  reportWallpaperEngineCaptureResult: (payload) => ipcRenderer.invoke('quchenradio-wallpaper-engine-capture-result', payload || {}),
  prepareWallpaperEngineGlassCapture: (payload) => ipcRenderer.invoke('quchenradio-wallpaper-engine-prepare-glass-capture', payload || {}),
  activateWallpaperEngineDwmSurface: (payload) => ipcRenderer.invoke('quchenradio-wallpaper-engine-activate-dwm-surface', payload || {}),
  updateWallpaperEngineGlassSurface: (payload) => ipcRenderer.send('quchenradio-wallpaper-engine-glass-surface', payload || {}),
  reportWallpaperEnginePointerActivity: (payload) => ipcRenderer.send('quchenradio-wallpaper-engine-pointer-activity', payload || {}),
  stopWallpaperEngineScene: (payload) => ipcRenderer.invoke('quchenradio-wallpaper-engine-stop-scene', payload || {}),
  onWallpaperEngineHostBoundsChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('quchenradio-wallpaper-engine-host-bounds-changed', listener);
    return () => ipcRenderer.removeListener('quchenradio-wallpaper-engine-host-bounds-changed', listener);
  },
  readLyricCache: (key) => ipcRenderer.invoke('quchenradio-cache-read-lyric', key || ''),
  writeLyricCache: (key, payload) => ipcRenderer.invoke('quchenradio-cache-write-lyric', key || '', payload || {}),
  close: (behavior) => ipcRenderer.invoke('desktop-window-close', behavior),
  getCloseBehavior: () => ipcRenderer.invoke('desktop-window-get-close-behavior'),
  setCloseBehavior: (behavior) => ipcRenderer.invoke('desktop-window-set-close-behavior', behavior),
  getLoginEasterEggStatus: () => ipcRenderer.invoke('quchenradio-login-easter-egg-status'),
  unlockLoginEasterEgg: (value) => ipcRenderer.invoke('quchenradio-login-easter-egg-unlock', String(value || '')),
  resetLoginEasterEgg: () => ipcRenderer.invoke('quchenradio-login-easter-egg-reset'),
  openNeteaseMusicLogin: () => ipcRenderer.invoke('netease-music-open-login'),
  clearNeteaseMusicLogin: () => ipcRenderer.invoke('netease-music-clear-login'),
  openQQMusicLogin: (options) => ipcRenderer.invoke('qq-music-open-login', options || {}),
  clearQQMusicLogin: () => ipcRenderer.invoke('qq-music-clear-login'),
  openKugouMusicLogin: () => ipcRenderer.invoke('kugou-music-open-login'),
  clearKugouMusicLogin: () => ipcRenderer.invoke('kugou-music-clear-login'),
  openQishuiMusicLogin: () => ipcRenderer.invoke('qishui-music-open-login'),
  clearQishuiMusicLogin: () => ipcRenderer.invoke('qishui-music-clear-login'),
  openSpotifyMusicLogin: () => ipcRenderer.invoke('spotify-music-open-login'),
  clearSpotifyMusicLogin: () => ipcRenderer.invoke('spotify-music-clear-login'),
  openUpdateInstaller: (filePath) => ipcRenderer.invoke('quchenradio-open-update-installer', filePath),
  restartApp: () => ipcRenderer.invoke('quchenradio-restart-app'),
  getUpdateState: () => ipcRenderer.invoke('quchenradio-update-state'),
  checkAppUpdate: () => ipcRenderer.invoke('quchenradio-update-check'),
  downloadAppUpdate: () => ipcRenderer.invoke('quchenradio-update-download'),
  onUpdateState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, state) => callback(state || {});
    ipcRenderer.on('quchenradio-update-state', listener);
    return () => ipcRenderer.removeListener('quchenradio-update-state', listener);
  },
  configureGlobalHotkeys: (bindings) => ipcRenderer.invoke('quchenradio-hotkeys-configure-global', bindings || []),
  copyText: (text) => {
    clipboard.writeText(String(text || ''));
    return { ok: true };
  },
  readText: () => ({ ok: true, text: clipboard.readText() || '' }),
  exportJsonFile: (payload) => ipcRenderer.invoke('quchenradio-export-json-file', payload || {}),
  exportLoginCookie: (provider) => ipcRenderer.invoke('quchenradio-export-login-cookie', provider || ''),
  importJsonFile: () => ipcRenderer.invoke('quchenradio-import-json-file'),
  readCurrentFxAutosaveSync: () => ipcRenderer.sendSync('quchenradio-current-fx-autosave-read-sync'),
  saveCurrentFxAutosaveSync: (payload) => ipcRenderer.sendSync('quchenradio-current-fx-autosave-save-sync', payload || {}),
  saveCurrentFxAutosave: (payload) => ipcRenderer.invoke('quchenradio-current-fx-autosave-save', payload || {}),
  onGlobalHotkey: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('quchenradio-global-hotkey', listener);
    return () => ipcRenderer.removeListener('quchenradio-global-hotkey', listener);
  },
  setDesktopLyricsEnabled: (enabled, payload) => ipcRenderer.invoke('quchenradio-desktop-lyrics-set-enabled', !!enabled, payload || {}),
  updateDesktopLyrics: (payload) => ipcRenderer.invoke('quchenradio-desktop-lyrics-update', payload || {}),
  onDesktopLyricsLockState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('quchenradio-desktop-lyrics-lock-state', listener);
    return () => ipcRenderer.removeListener('quchenradio-desktop-lyrics-lock-state', listener);
  },
  onDesktopLyricsEnabledState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('quchenradio-desktop-lyrics-enabled-state', listener);
    return () => ipcRenderer.removeListener('quchenradio-desktop-lyrics-enabled-state', listener);
  },
  setWallpaperMode: (enabled, payload) => ipcRenderer.invoke('quchenradio-wallpaper-set-enabled', !!enabled, payload || {}),
  updateWallpaperMode: (payload) => ipcRenderer.invoke('quchenradio-wallpaper-update', payload || {}),
  getWallpaperModeStatus: () => ipcRenderer.invoke('quchenradio-wallpaper-get-status'),
  updateDesktopIconShields: (payload) => ipcRenderer.send('quchenradio-full-desktop-icon-shields', payload || {}),
  setDesktopSoftwareLocked: (locked) => ipcRenderer.invoke('quchenradio-full-desktop-set-software-lock', locked === true),
  setDesktopIconsVisible: (visible) => ipcRenderer.invoke('quchenradio-full-desktop-set-icons-visible', visible !== false),
  requestDesktopKeyboardFocus: (reason) => ipcRenderer.send(
    'quchenradio-full-desktop-request-keyboard-focus',
    String(reason || 'renderer-pointerdown').slice(0, 80)
  ),
  updateDesktopPointerRoute: (payload) => ipcRenderer.send('quchenradio-full-desktop-pointer-route', {
    overSoftwareUi: payload && payload.overSoftwareUi === true,
    overDesktopControls: payload && payload.overDesktopControls === true,
  }),
  onWallpaperModeState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('quchenradio-wallpaper-runtime-state', listener);
    return () => ipcRenderer.removeListener('quchenradio-wallpaper-runtime-state', listener);
  },
  onStateChange: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('desktop-window-state', listener);
    return () => ipcRenderer.removeListener('desktop-window-state', listener);
  },
  mineradioLocal: {
    chooseFiles: () => ipcRenderer.invoke('mineradio-local-library-choose-files'),
    listTracks: () => ipcRenderer.invoke('mineradio-local-library-list'),
    authorizeImport: (files) => ipcRenderer.invoke('mineradio-local-library-authorize', {
      files: (Array.isArray(files) ? files : []).map(function (p) {
        if (p && typeof p === 'object' && p.path) return { path: String(p.path) };
        return { path: String(p || '') };
      })
    }),
    importFiles: (token) => ipcRenderer.invoke('mineradio-local-library-import', { token: String(token || '') }),
    lyricForTrack: (localFileId) => ipcRenderer.invoke('mineradio-local-library-lyric', String(localFileId || '')),
  },
  builtInPlaylists: {
    listPlaylists: () => ipcRenderer.invoke('mineradio-built-in-playlists-list'),
    pagePlaylist: (id, options) => ipcRenderer.invoke('mineradio-built-in-playlist-page', String(id || ''), options || {}),
    createPlaylist: (name) => ipcRenderer.invoke('mineradio-built-in-playlist-create', String(name || '')),
    renamePlaylist: (id, name) => ipcRenderer.invoke('mineradio-built-in-playlist-rename', String(id || ''), String(name || '')),
    deletePlaylist: (id) => ipcRenderer.invoke('mineradio-built-in-playlist-delete', String(id || '')),
    addTrack: (id, track) => ipcRenderer.invoke('mineradio-built-in-playlist-add-track', String(id || ''), track || {}),
    removeTrack: (id, index) => ipcRenderer.invoke('mineradio-built-in-playlist-remove-track', String(id || ''), Number(index) || 0),
    reorderTrack: (id, fromIndex, toIndex) => ipcRenderer.invoke('mineradio-built-in-playlist-reorder-track', String(id || ''), Number(fromIndex) || 0, Number(toIndex) || 0),
  },
});

window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.add('desktop-shell-root');
  document.body.classList.add('desktop-shell');
});

// QuChen 账号：主界面只读状态 + 退出登录（退出后重启回到登录墙）
contextBridge.exposeInMainWorld('quchenAccount', {
  state: () => ipcRenderer.invoke('quchen-account:main-state'),
  logout: () => ipcRenderer.invoke('quchen-account:main-logout'),
});
