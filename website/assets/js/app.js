/**
 * Quchen Radio 官网主应用逻辑
 * 负责：渲染特性卡片、音源卡片、更新日志，绑定按钮事件，
 *       处理导航滚动效果、滚动揭示动画，以及版本号同步。
 */
(function (global) {
  'use strict';

  const CONFIG = global.QUCHEN_CONFIG || {};
  const API = global.QuchenAPI;

  /* ============================================================
     静态数据：特性卡片 & 更新日志
     ============================================================ */
  const FEATURES = [
    {
      icon: '♪',
      title: '沉浸式音乐播放',
      desc: '基于 Electron 的本地播放引擎，支持无损格式与流畅切换，让每一个音符都到位。',
    },
    {
      icon: '☀',
      title: '天气电台',
      desc: '根据当前天气与时间自动切换的氛围电台，雨天有雨天的听法，夜晚有夜晚的味道。',
    },
    {
      icon: '✦',
      title: '粒子视觉',
      desc: 'WebGL 驱动的实时粒子动画，跟随音乐节奏起伏，让屏幕变成一张会呼吸的画布。',
    },
    {
      icon: '☰',
      title: '3D 歌单架',
      desc: '把歌单做成可以旋转、缩放的三维架子，封面在空间里排列，浏览体验像在挑唱片。',
    },
    {
      icon: '♫',
      title: '歌词舞台',
      desc: '桌面歌词悬浮窗，逐行高亮、过渡平滑，支持拖拽定位与多语言显示，不抢戏也不沉默。',
    },
    {
      icon: '⌨',
      title: '全局热键',
      desc: '播放、暂停、上一首、下一首、音量调节全部支持全局快捷键，不用切回主窗口也能掌控。',
    },
    {
      icon: '⌬',
      title: '壁纸模式',
      desc: '把粒子视觉直接铺到桌面壁纸层，工作的时候也能有一片会动的背景，不打扰也不喧宾夺主。',
    },
    {
      icon: '⇅',
      title: '网易云 / QQ 音乐',
      desc: '通过受支持的第三方接口接入网易云与 QQ 音乐曲库，登录账号后即可同步歌单与收藏。',
    },
    {
      icon: '◷',
      title: '自动更新检查',
      desc: '内置更新检查器，新版本发布后会在应用内提示，下载源直连 QUCHEN-Radio 仓库。',
    },
  ];

  const CHANGELOG = [
    {
      version: 'v1.0.0',
      date: '2026-07-05',
      title: 'Quchen Radio 首个公开版本',
      items: [
        '全新品牌与代码重构，Quchen Radio 正式发布。',
        '融合六音、Huibq、野花、野草、ikun、洛雪独家、聚合 API 共 7 款 LX Music 音源插件。',
        '软件内更新检查与下载源重定向到 quchenace/QUCHEN-Radio 仓库。',
        '新增官方网站，支持一键下载安装包与音源插件，无需跳转 GitHub 页面。',
        'NSIS 安装器路径与界面文本全面 Quchen 化。',
      ],
    },
    {
      version: 'v0.9.0',
      date: '2026-06-20',
      title: '内部测试版本',
      items: [
        '完成 LX Music 音源插件的初步集成与清单化。',
        '搭建 lx-sources 目录结构，提供 sources.json 机器可读清单。',
        '调整 GitHub 加速镜像顺序，优先使用 gh-proxy.com。',
      ],
    },
  ];

  /* ============================================================
     工具函数
     ============================================================ */
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $all(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let v = bytes;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i++;
    }
    return v.toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function showMsg(msg, type) {
    const toast = $('#toast');
    const msgEl = $('#toast-msg');
    const iconEl = toast ? toast.querySelector('.toast__icon') : null;
    if (!toast || !msgEl) return;
    msgEl.textContent = msg;
    toast.classList.remove('is-success', 'is-error', 'is-info');
    const t = type || 'info';
    toast.classList.add('is-' + t);
    if (iconEl) {
      iconEl.textContent = t === 'error' ? '!' : t === 'success' ? '✓' : 'i';
    }
    toast.classList.add('is-visible');
    clearTimeout(showMsg._t);
    showMsg._t = setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 3200);
  }

  /* ============================================================
     渲染：特性卡片
     ============================================================ */
  function renderFeatures() {
    const grid = $('#features-grid');
    if (!grid) return;
    grid.innerHTML = FEATURES.map((f) => `
      <article class="feature-card reveal">
        <div class="feature-card__icon" aria-hidden="true">${escapeHtml(f.icon)}</div>
        <h3 class="feature-card__title">${escapeHtml(f.title)}</h3>
        <p class="feature-card__desc">${escapeHtml(f.desc)}</p>
      </article>
    `).join('');
  }

  /* ============================================================
     渲染：音源卡片
     ============================================================ */
  function renderSources() {
    const grid = $('#sources-grid');
    if (!grid) return;
    const sources = CONFIG.lxSources || [];
    const platformNames = CONFIG.platformNames || {};
    grid.innerHTML = sources.map((s) => {
      const platforms = (s.platforms || []).map((p) =>
        `<span class="source-card__platform">${escapeHtml(platformNames[p] || p)}</span>`
      ).join('');
      const homepage = s.homepage
        ? `<a class="source-card__btn source-card__btn--ghost" href="${escapeHtml(s.homepage)}" target="_blank" rel="noopener">主页</a>`
        : '';
      return `
        <article class="source-card reveal" data-source-id="${escapeHtml(s.id)}">
          <div class="source-card__header">
            <span class="source-card__name">${escapeHtml(s.name)}</span>
            <span class="source-card__version">${escapeHtml(s.version)}</span>
          </div>
          <p class="source-card__desc">${escapeHtml(s.description || '')}</p>
          <div class="source-card__meta">
            <span class="source-card__author">${escapeHtml(s.author || '社区')}</span>
          </div>
          <div class="source-card__platforms">${platforms}</div>
          <div class="source-card__actions">
            <button class="source-card__btn source-card__btn--primary" data-action="download-source" data-source-id="${escapeHtml(s.id)}" type="button">
              <span aria-hidden="true">⬇</span> 下载插件
            </button>
            <button class="source-card__btn source-card__btn--ghost" data-action="copy-source-url" data-source-id="${escapeHtml(s.id)}" type="button">
              复制导入链接
            </button>
            ${homepage}
          </div>
        </article>
      `;
    }).join('');
  }

  /* ============================================================
     渲染：更新日志
     ============================================================ */
  function renderChangelog() {
    const wrap = $('#changelog-list');
    if (!wrap) return;
    wrap.innerHTML = CHANGELOG.map((c) => `
      <article class="changelog-item reveal">
        <div class="changelog-item__version">
          <span class="changelog-item__ver-num">${escapeHtml(c.version)}</span>
          <span class="changelog-item__date">${escapeHtml(c.date)}</span>
        </div>
        <div class="changelog-item__content">
          <h3 class="changelog-item__title">${escapeHtml(c.title)}</h3>
          <ul class="changelog-item__list">
            ${(c.items || []).map((i) => `<li>${escapeHtml(i)}</li>`).join('')}
          </ul>
        </div>
      </article>
    `).join('');
  }

  /* ============================================================
     渲染：页脚年份
     ============================================================ */
  function renderFooterYear() {
    const el = $('#footer-year');
    if (el) el.textContent = new Date().getFullYear();
  }

  /* ============================================================
     版本信息同步
     从本地 website-server.js 拉取最新 Release 信息，
     成功后更新页面上的所有版本号显示。
     ============================================================ */
  async function syncVersion() {
    const versionTexts = $all('[id$="version"], #download-version-large, #hero-version, #hero-meta-version, #download-version');
    const sizeEl = $('#hero-meta-size');
    if (!API || typeof API.checkUpdate !== 'function') return;
    try {
      const data = await API.checkUpdate();
      if (!data) return;
      const version = data.version || (data.tag_name || '').replace(/^v/, '');
      if (version) {
        CONFIG.app = CONFIG.app || {};
        CONFIG.app.version = version;
        CONFIG.app.installerName = `Quchen-Radio-${version}-Setup.exe`;
        CONFIG.app.installerAsset = `Quchen-Radio-${version}-Setup.exe`;
        versionTexts.forEach((el) => {
          if (el && el.id !== 'footer-year') {
            el.textContent = version;
          }
        });
        const big = $('#download-version-large');
        if (big) big.textContent = version;
      }
      if (sizeEl && data.assets && data.assets.length) {
        const installer = data.assets.find((a) => /Quchen-Radio-.+Setup\.exe$/i.test(a.name || ''));
        if (installer && installer.size) {
          const sizeStr = formatBytes(installer.size);
          if (sizeStr) sizeEl.textContent = '约 ' + sizeStr;
        }
      }
      const publishedEl = $('[data-published-at]');
      if (publishedEl && data.publishedAt) {
        publishedEl.textContent = '发布于 ' + formatDate(data.publishedAt);
      }
    } catch (e) {
      // 静默失败：服务器不可达时保留默认版本号
    }
  }

  /* ============================================================
     事件：下载安装包
     ============================================================ */
  async function handleDownloadInstaller(btn) {
    if (!API) return;
    btn.disabled = true;
    const label = btn.querySelector('.btn__label');
    const original = label ? label.textContent : '';
    const status = $('#download-status');
    if (status) {
      status.textContent = '正在准备下载…';
      status.classList.add('is-active');
    }
    try {
      API.downloadInstaller();
      showMsg('已开始下载安装包，请留意浏览器下载提示', 'success');
      if (status) {
        setTimeout(() => {
          status.textContent = '下载已开始，如未弹出请检查浏览器拦截';
        }, 600);
      }
    } catch (e) {
      showMsg('下载失败：' + (e.message || e), 'error');
      if (status) status.textContent = '下载失败';
    } finally {
      setTimeout(() => {
        btn.disabled = false;
        if (label) label.textContent = original;
        if (status) {
          setTimeout(() => {
            status.textContent = '准备就绪';
            status.classList.remove('is-active');
          }, 3000);
        }
      }, 1500);
    }
  }

  /* ============================================================
     事件：检查更新
     ============================================================ */
  async function handleCheckUpdate(btn) {
    if (!API) return;
    btn.disabled = true;
    const label = btn.querySelector('.btn__label');
    const original = label ? label.textContent : '';
    if (label) label.textContent = '检查中…';
    try {
      const data = await API.checkUpdate();
      if (!data) {
        showMsg('暂未获取到版本信息', 'info');
        return;
      }
      const version = data.version || (data.tag_name || '').replace(/^v/, '') || '未知';
      const current = (CONFIG.app && CONFIG.app.version) || '1.0.0';
      if (version === current) {
        showMsg(`已是最新版本 v${version}`, 'success');
      } else {
        showMsg(`发现新版本 v${version}，可点击下方按钮下载`, 'success');
      }
      // 顺便同步一次版本号显示
      syncVersion();
    } catch (e) {
      showMsg('检查更新失败：' + (e.message || e), 'error');
    } finally {
      setTimeout(() => {
        btn.disabled = false;
        if (label) label.textContent = original;
      }, 1200);
    }
  }

  /* ============================================================
     事件：下载音源插件
     ============================================================ */
  function handleDownloadSource(sourceId) {
    if (!API || !sourceId) return;
    API.downloadLxSource(sourceId);
    showMsg('已开始下载音源插件，请在浏览器下载中查看', 'success');
  }

  /* ============================================================
     事件：复制音源导入链接
     ============================================================ */
  async function handleCopySourceUrl(sourceId) {
    if (!API || !sourceId) return;
    const url = API.getLxSourceImportUrl(sourceId, true);
    if (!url) {
      showMsg('未找到该音源的链接', 'error');
      return;
    }
    const ok = await API.copyToClipboard(url);
    if (ok) {
      showMsg('导入链接已复制到剪贴板', 'success');
    } else {
      showMsg('复制失败，请手动复制：' + url, 'error');
    }
  }

  /* ============================================================
     事件绑定
     ============================================================ */
  function bindEvents() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      switch (action) {
        case 'download-installer':
          e.preventDefault();
          handleDownloadInstaller(btn);
          break;
        case 'check-update':
          e.preventDefault();
          handleCheckUpdate(btn);
          break;
        case 'download-source': {
          e.preventDefault();
          const sid = btn.getAttribute('data-source-id');
          handleDownloadSource(sid);
          break;
        }
        case 'copy-source-url': {
          e.preventDefault();
          const sid = btn.getAttribute('data-source-id');
          handleCopySourceUrl(sid);
          break;
        }
        default:
          break;
      }
    });

    // 平滑滚动锚点
    $all('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const href = a.getAttribute('href');
        if (!href || href === '#') return;
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  /* ============================================================
     导航滚动效果
     ============================================================ */
  function initNavScroll() {
    const nav = $('#nav');
    if (!nav) return;
    let ticking = false;
    function update() {
      if (window.scrollY > 24) {
        nav.classList.add('is-scrolled');
      } else {
        nav.classList.remove('is-scrolled');
      }
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
    update();
  }

  /* ============================================================
     滚动揭示动画
     ============================================================ */
  function initRevealOnScroll() {
    const reveals = $all('.reveal');
    if (!reveals.length) return;
    if (!('IntersectionObserver' in global)) {
      reveals.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach((el) => io.observe(el));
  }

  /* ============================================================
     初始化
     ============================================================ */
  function init() {
    renderFeatures();
    renderSources();
    renderChangelog();
    renderFooterYear();
    bindEvents();
    initNavScroll();
    initRevealOnScroll();
    syncVersion();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
