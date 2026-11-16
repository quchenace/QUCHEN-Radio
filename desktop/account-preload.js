'use strict';
/**
 * 账号登录窗的 preload：只暴露账号门禁相关的最小接口。
 * 主窗口不加载本 preload，登录页也拿不到 Node 能力。
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('quchenAccount', {
  state: () => ipcRenderer.invoke('quchen-account:state'),
  login: (email, password) => ipcRenderer.invoke('quchen-account:login', { email, password }),
  sendCode: (email, purpose) => ipcRenderer.invoke('quchen-account:send-code', { email, purpose }),
  register: (email, code, password) => ipcRenderer.invoke('quchen-account:register', { email, code, password }),
  logout: () => ipcRenderer.invoke('quchen-account:logout'),
  retry: () => ipcRenderer.invoke('quchen-account:retry'),
  quit: () => ipcRenderer.invoke('quchen-account:quit'),
});
