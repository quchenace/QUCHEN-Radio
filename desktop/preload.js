const { contextBridge, ipcRenderer } = require('electron');

const PERSISTENT_UI_STATE_KEYS = [
  'apex-player-volume',
  'quchen-lyric-layout-v1',
  'quchen-playback-quality-v1',
  'quchen-diy-player-mode-v1',
  'quchen-playlist-panel-pinned-v1',
  'quchen-user-capsule-auto-hide-v1',
  'quchen-fx-fab-auto-hide-v1',
  'quchen-controls-auto-hide-v1',
  'quchen-free-camera-v1',
  'quchen-local-library-folder-v1',
  'quchen-local-library-folders-v2',
  'quchen-hidden-wallpapers-v1',
  'quchen-playback-session-v1',
  'quchen-user-fx-archives-v1',
  'quchen-hotkey-settings-v1',
  'quchen-visual-guide-seen-v2',
  'quchen-upload-tip-seen',
];

function restorePersistentUiState() {
  try {
    const values = ipcRenderer.sendSync('quchen-ui-state-read-sync') || {};
    PERSISTENT_UI_STATE_KEYS.forEach((key) => {
      if (typeof values[key] !== 'string') return;
      if (window.localStorage.getItem(key) != null) return;
      window.localStorage.setItem(key, values[key]);
    });
  } catch (_e) {}
}

restorePersistentUiState();

contextBridge.exposeInMainWorld('desktopWindow', {
  isDesktop: true,
  minimize: () => ipcRenderer.invoke('desktop-window-minimize'),
  toggleMaximize: () => ipcRenderer.invoke('desktop-window-toggle-maximize'),
  toggleFullscreen: () => ipcRenderer.invoke('desktop-window-toggle-fullscreen'),
  exitFullscreenWindowed: () => ipcRenderer.invoke('desktop-window-exit-fullscreen-windowed'),
  getState: () => ipcRenderer.invoke('desktop-window-get-state'),
  close: () => ipcRenderer.invoke('desktop-window-close'),
  beginWindowDrag: () => ipcRenderer.invoke('desktop-window-drag-state', true),
  endWindowDrag: () => ipcRenderer.invoke('desktop-window-drag-state', false),
  beginWindowResize: (direction, screenX, screenY) => ipcRenderer.send('desktop-window-resize-start', { direction, screenX, screenY }),
  updateWindowResize: (screenX, screenY) => ipcRenderer.send('desktop-window-resize-update', { screenX, screenY }),
  endWindowResize: () => ipcRenderer.send('desktop-window-resize-end'),
  getTraySettings: () => ipcRenderer.invoke('quchen-tray-get-settings'),
  setCloseToTray: (enabled) => ipcRenderer.invoke('quchen-tray-set-close-to-tray', !!enabled),
  setStartupEnabled: (enabled) => ipcRenderer.invoke('quchen-startup-set-enabled', !!enabled),
  updateTrayPlayback: (state) => ipcRenderer.invoke('quchen-tray-update-playback', state || {}),
  onTrayCommand: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('quchen-tray-command', listener);
    return () => ipcRenderer.removeListener('quchen-tray-command', listener);
  },
  openUpdateInstaller: (filePath) => ipcRenderer.invoke('quchen-open-update-installer', filePath),
  restartApp: () => ipcRenderer.invoke('quchen-restart-app'),
  openLxScheme: (schemeUrl) => ipcRenderer.invoke('quchen-lx-open-scheme', schemeUrl),
  setLxPlaybackLinked: (linked) => ipcRenderer.invoke('quchen-lx-set-linked', !!linked),
  configureGlobalHotkeys: (bindings) => ipcRenderer.invoke('quchen-hotkeys-configure-global', bindings || []),
  exportJsonFile: (payload) => ipcRenderer.invoke('quchen-export-json-file', payload || {}),
  importJsonFile: () => ipcRenderer.invoke('quchen-import-json-file'),
  backupUiState: (patch) => ipcRenderer.invoke('quchen-ui-state-write', patch || {}),
  chooseLocalMusicFiles: () => ipcRenderer.invoke('quchen-local-music-choose-files'),
  chooseLocalMusicFolder: () => ipcRenderer.invoke('quchen-local-music-choose-folder'),
  scanLocalMusicFolder: (folderPath) => ipcRenderer.invoke('quchen-local-music-scan-folder', folderPath),
  refreshLocalMusicFiles: (folderPath, files) => ipcRenderer.invoke('quchen-local-music-refresh-entries', folderPath, files || []),
  prepareLocalAudio: (filePath) => ipcRenderer.invoke('quchen-local-audio-prepare', filePath),
  transcodeLocalAudio: (filePath) => ipcRenderer.invoke('quchen-local-audio-transcode', filePath),
  readLocalFileRange: (filePath, start, end) => ipcRenderer.invoke('quchen-local-file-read-range', filePath, start, end),
  readLocalFileDataUrl: (filePath) => ipcRenderer.invoke('quchen-local-file-read-data-url', filePath),
  onGlobalHotkey: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('quchen-global-hotkey', listener);
    return () => ipcRenderer.removeListener('quchen-global-hotkey', listener);
  },
  setDesktopLyricsEnabled: (enabled, payload) => ipcRenderer.invoke('quchen-desktop-lyrics-set-enabled', !!enabled, payload || {}),
  updateDesktopLyrics: (payload) => ipcRenderer.invoke('quchen-desktop-lyrics-update', payload || {}),
  onDesktopLyricsLockState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('quchen-desktop-lyrics-lock-state', listener);
    return () => ipcRenderer.removeListener('quchen-desktop-lyrics-lock-state', listener);
  },
  onDesktopLyricsEnabledState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('quchen-desktop-lyrics-enabled-state', listener);
    return () => ipcRenderer.removeListener('quchen-desktop-lyrics-enabled-state', listener);
  },
  setWallpaperMode: (enabled, payload) => ipcRenderer.invoke('quchen-wallpaper-set-enabled', !!enabled, payload || {}),
  updateWallpaperMode: (payload) => ipcRenderer.invoke('quchen-wallpaper-update', payload || {}),
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
