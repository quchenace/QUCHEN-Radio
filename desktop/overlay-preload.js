const { contextBridge, ipcRenderer } = require('electron');

function bind(channel, callback) {
  if (typeof callback !== 'function') return () => {};
  const listener = (_event, payload) => callback(payload || {});
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('desktopOverlay', {
  onLyricsState: (callback) => bind('quchenradio-desktop-lyrics-state', callback),
  onWallpaperState: (callback) => bind('quchenradio-wallpaper-state', callback),
  setLyricsDrag: (dragging) => ipcRenderer.invoke('quchenradio-desktop-lyrics-set-dragging', !!dragging),
  setLyricsPointerCapture: (active) => ipcRenderer.invoke('quchenradio-desktop-lyrics-set-pointer-capture', !!active),
  setLyricsHotBounds: (bounds) => ipcRenderer.invoke('quchenradio-desktop-lyrics-set-hot-bounds', bounds || {}),
  setLyricsLockState: (locked) => ipcRenderer.invoke('quchenradio-desktop-lyrics-set-lock-state', !!locked),
  moveLyricsBy: (dx, dy) => ipcRenderer.invoke('quchenradio-desktop-lyrics-move-by', Number(dx) || 0, Number(dy) || 0),
  closeLyrics: () => ipcRenderer.invoke('quchenradio-desktop-lyrics-set-enabled', false, {}),

  // === sjz 工具站 ===
  getPasswords: () => ipcRenderer.invoke('quchenradio-get-passwords'),
  refreshPasswords: () => ipcRenderer.invoke('quchenradio-refresh-passwords'),
});
