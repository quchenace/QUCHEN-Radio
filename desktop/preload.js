const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopWindow', {
  isDesktop: true,
  minimize: () => ipcRenderer.invoke('desktop-window-minimize'),
  toggleMaximize: () => ipcRenderer.invoke('desktop-window-toggle-maximize'),
  toggleFullscreen: () => ipcRenderer.invoke('desktop-window-toggle-fullscreen'),
  exitFullscreenWindowed: () => ipcRenderer.invoke('desktop-window-exit-fullscreen-windowed'),
  getState: () => ipcRenderer.invoke('desktop-window-get-state'),
  close: () => ipcRenderer.invoke('desktop-window-close'),
  openNeteaseMusicLogin: () => ipcRenderer.invoke('netease-music-open-login'),
  clearNeteaseMusicLogin: () => ipcRenderer.invoke('netease-music-clear-login'),
  openQQMusicLogin: () => ipcRenderer.invoke('qq-music-open-login'),
  clearQQMusicLogin: () => ipcRenderer.invoke('qq-music-clear-login'),
  openUpdateInstaller: (filePath) => ipcRenderer.invoke('quchenradio-open-update-installer', filePath),
  restartApp: () => ipcRenderer.invoke('quchenradio-restart-app'),
  configureGlobalHotkeys: (bindings) => ipcRenderer.invoke('quchenradio-hotkeys-configure-global', bindings || []),
  exportJsonFile: (payload) => ipcRenderer.invoke('quchenradio-export-json-file', payload || {}),
  importJsonFile: () => ipcRenderer.invoke('quchenradio-import-json-file'),
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

  // === 任务栏播控 ===
  updatePlaybackState: (state) => ipcRenderer.invoke('quchenradio-playback-state', state || {}),
  onThumbarAction: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('quchenradio-thumbar-action', listener);
    return () => ipcRenderer.removeListener('quchenradio-thumbar-action', listener);
  },

  // === 迷你播放器 ===
  updateMiniPlayer: (state) => ipcRenderer.invoke('quchenradio-miniplayer-update', state || {}),
  onMiniPlayerState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('quchenradio-miniplayer-state', listener);
    return () => ipcRenderer.removeListener('quchenradio-miniplayer-state', listener);
  },
  sendMiniPlayerAction: (action) => ipcRenderer.invoke('quchenradio-miniplayer-action', action || {}),
  getPasswords: () => ipcRenderer.invoke('quchenradio-get-passwords'),
  refreshPasswords: () => ipcRenderer.invoke('quchenradio-refresh-passwords'),
  onPasswordsUpdated: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('quchenradio-passwords-updated', listener);
    return () => ipcRenderer.removeListener('quchenradio-passwords-updated', listener);
  },
  getMiniPlayerSettings: () => ipcRenderer.invoke('quchenradio-miniplayer-settings-get'),
  setMiniPlayerSettings: (settings) => ipcRenderer.invoke('quchenradio-miniplayer-settings-set', settings),
  onMiniPlayerLyrics: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('quchenradio-miniplayer-lyrics', listener);
    return () => ipcRenderer.removeListener('quchenradio-miniplayer-lyrics', listener);
  },
  openSjzPage: () => ipcRenderer.invoke('quchenradio-open-sjz'),

  // 更新
  onUpdateAvailable: (callback) => ipcRenderer.on('quchenradio-update-available', (_event, info) => callback(info)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('quchenradio-update-downloaded', (_event, info) => callback(info)),
  onUpdateError: (callback) => ipcRenderer.on('quchenradio-update-error', (_event, msg) => callback(msg)),
  checkForUpdates: () => ipcRenderer.invoke('quchenradio-check-update'),
  downloadUpdate: () => ipcRenderer.invoke('quchenradio-download-update'),
  quitAndInstall: () => ipcRenderer.invoke('quchenradio-quit-and-install'),

  onStateChange: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('desktop-window-state', listener);
    return () => ipcRenderer.removeListener('desktop-window-state', listener);
  },
});

window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.add('desktop-shell-root');
  document.body.classList.add('desktop-shell');
});
