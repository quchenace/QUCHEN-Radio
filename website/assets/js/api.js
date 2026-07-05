/**
 * Quchen Radio 官网 API 模块
 * 处理下载、更新检查、音源获取等接口调用
 * 支持两种模式：
 *   1. 本地 website-server.js 代理模式（有完整 API）
 *   2. 静态页面模式（GitHub Pages，直接走 GitHub API + 镜像）
 */
(function (global) {
  'use strict';

  const CONFIG = global.QUCHEN_CONFIG || {};
  const REPO = CONFIG.repo || {
    owner: 'quchenace',
    name: 'QUCHEN-Radio',
    releasesUrl: 'https://github.com/quchenace/QUCHEN-Radio/releases/latest',
    releasesApi: 'https://api.github.com/repos/quchenace/QUCHEN-Radio/releases/latest',
  };
  const MIRRORS = CONFIG.mirrors || [
    'https://gh-proxy.com/',
    'https://ghfast.top/',
    'https://gh.llkk.cc/',
  ];

  const QUCHEN_API = {
    downloadInstaller: '/api/download/installer',
    downloadLxSource: '/api/download/lx-source',
    checkUpdate: '/api/update/check',
    listSources: '/api/sources',
    changelog: '/api/changelog',
  };

  function isStaticMode() {
    const host = window.location.hostname;
    return host === 'quchenace.github.io' || 
           host.endsWith('.github.io') || 
           host === 'quchen.nat100.top' ||
           !host.includes('.');
  }

  /**
   * 通用 fetch JSON
   */
  async function fetchJson(url, options) {
    const opts = options || {};
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeout || 12000);
    try {
      const resp = await fetch(url, {
        method: opts.method || 'GET',
        headers: opts.headers || { Accept: 'application/json' },
        body: opts.body || undefined,
        signal: ctrl.signal,
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
      }
      return await resp.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 检查最新版本
   * 返回 { version, htmlUrl, releaseNotes, assets, publishedAt }
   */
  async function checkUpdate() {
    if (isStaticMode()) {
      try {
        const urls = [];
        for (const mirror of MIRRORS) {
          urls.push(mirror + REPO.releasesApi);
        }
        urls.push(REPO.releasesApi);
        
        for (const url of urls) {
          try {
            const data = await fetchJson(url, { timeout: 8000 });
            return data;
          } catch (e) {}
        }
      } catch (e) {}
      
      return {
        version: CONFIG.app && CONFIG.app.version || '1.0.0',
        tagName: 'v1.0.0',
        name: 'Quchen Radio v1.0.0',
        htmlUrl: REPO.releasesUrl,
        releaseNotes: '无法连接 GitHub API，显示默认版本。',
        publishedAt: null,
        assets: [],
        warning: '无法连接 GitHub API,显示默认版本信息。',
      };
    }
    return fetchJson(QUCHEN_API.checkUpdate, { timeout: 15000 });
  }

  /**
   * 触发安装包下载
   * 直接使用镜像链接下载，不依赖本地服务器代理
   * 支持多镜像回退，国内用户无需翻墙
   */
  async function downloadInstaller() {
    const installerName = CONFIG.app && CONFIG.app.installerName || 'Quchen-Radio-1.0.0-Setup.exe';
    
    const downloadUrls = [];
    const githubDownloadUrl = `https://github.com/${REPO.owner}/${REPO.name}/releases/download/v1.0.0/${installerName}`;
    
    for (const mirror of MIRRORS) {
      downloadUrls.push(mirror + githubDownloadUrl);
    }
    downloadUrls.push(githubDownloadUrl);
    
    for (const url of downloadUrls) {
      try {
        window.location.href = url;
        return;
      } catch (e) {}
    }
    
    window.open(REPO.releasesUrl, '_blank');
  }

  /**
   * 下载音源插件
   * @param {string} sourceId 音源 ID(sixyin/huibq/flower/...)
   */
  function downloadLxSource(sourceId) {
    if (isStaticMode()) {
      downloadLxSourceStatic(sourceId);
      return;
    }
    const url = QUCHEN_API.downloadLxSource + '?id=' + encodeURIComponent(sourceId) + '&t=' + Date.now();
    triggerDownload(url);
  }

  function downloadLxSourceStatic(sourceId) {
    const url = getLxSourceImportUrl(sourceId, true);
    if (url) {
      window.location.href = url;
    }
  }

  /**
   * 获取原始音源导入链接(raw URL,可用于 LX Music 在线导入)
   */
  function getLxSourceImportUrl(sourceId, useMirror) {
    const config = global.QUCHEN_CONFIG;
    if (!config) return null;
    const src = config.lxSources.find((s) => s.id === sourceId);
    if (!src) return null;
    const rawUrl = config.repo.rawUrl + '/' + src.filePath;
    if (useMirror && config.mirrors && config.mirrors.length) {
      return config.mirrors[0] + rawUrl;
    }
    return rawUrl;
  }

  /**
   * 复制文本到剪贴板
   */
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // 兼容旧浏览器
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        document.body.removeChild(ta);
        return true;
      } catch (e2) {
        document.body.removeChild(ta);
        return false;
      }
    }
  }

  /**
   * 触发浏览器下载(无跳转感)
   */
  function triggerDownload(url) {
    // 使用隐藏 iframe,确保浏览器直接下载而不跳转
    let iframe = document.getElementById('_download_iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = '_download_iframe';
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
    }
    iframe.src = url;
  }

  /**
   * 获取音源清单
   */
  async function listSources() {
    if (isStaticMode()) {
      return { sources: CONFIG.lxSources || [] };
    }
    return fetchJson(QUCHEN_API.listSources);
  }

  /**
   * 获取更新日志
   */
  async function getChangelog() {
    if (isStaticMode()) {
      return { items: [] };
    }
    return fetchJson(QUCHEN_API.changelog);
  }

  global.QuchenAPI = {
    checkUpdate,
    downloadInstaller,
    downloadLxSource,
    getLxSourceImportUrl,
    copyToClipboard,
    listSources,
    getChangelog,
    endpoints: QUCHEN_API,
  };
})(window);
