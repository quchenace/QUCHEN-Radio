/**
 * Quchen Radio 官网配置
 * 集中管理仓库地址、下载链接、版本信息等
 * 便于后续维护和修改
 */
window.QUCHEN_CONFIG = {
  // 仓库信息
  repo: {
    owner: 'quchenace',
    name: 'QUCHEN-Radio',
    fullName: 'quchenace/QUCHEN-Radio',
    url: 'https://github.com/quchenace/QUCHEN-Radio',
    rawUrl: 'https://raw.githubusercontent.com/quchenace/QUCHEN-Radio/main',
    releasesApi: 'https://api.github.com/repos/quchenace/QUCHEN-Radio/releases/latest',
    releasesUrl: 'https://github.com/quchenace/QUCHEN-Radio/releases/latest',
  },

  // GitHub 加速镜像(国内用户优先)
  mirrors: [
    'https://gh.llkk.cc/',
    'https://ghfast.top/',
    'https://gh-proxy.com/',
  ],

  // 应用信息
  app: {
    name: 'Quchen Radio',
    version: '1.0.0',
    description: '沉浸式音乐播放器，融合天气电台、歌词舞台、粒子视觉和 3D 歌单架。',
    author: 'Quchen',
    license: 'GPL-3.0',
    // 安装包文件名(发布后由 GitHub Release 提供)
    installerName: 'Quchen-Radio-1.0.0-Setup.exe',
    // 安装包在 Release 中的 asset 名称
    installerAsset: 'Quchen-Radio-1.0.0-Setup.exe',
  },

  // LX Music 音源插件列表
  lxSources: [
    {
      id: 'sixyin',
      name: '六音音源',
      version: 'v1.2.1',
      author: '六音',
      description: 'v1.2.1 如失效请前往 www.sixyin.com 下载最新版本',
      homepage: 'www.sixyin.com',
      platforms: ['kw', 'kg', 'tx', 'wy', 'mg'],
      filePath: 'lx-sources/sixyin/latest.js',
    },
    {
      id: 'huibq',
      name: 'Huibq_lxmusic源',
      version: 'v1.2.0',
      author: 'Huibq',
      description: 'Github 搜索"洛雪音乐音源"，禁止批量下载！',
      homepage: 'https://github.com/Huibq/keep-alive',
      platforms: ['kw', 'kg', 'tx', 'wy', 'mg'],
      filePath: 'lx-sources/huibq/latest.js',
    },
    {
      id: 'flower',
      name: '野花',
      version: 'v1',
      author: '社区',
      description: '社区维护的洛雪音源插件',
      platforms: ['kw', 'kg', 'tx', 'wy', 'mg'],
      filePath: 'lx-sources/flower/latest.js',
    },
    {
      id: 'grass',
      name: '野草',
      version: 'v1',
      author: '社区',
      description: '社区维护的洛雪音源插件',
      platforms: ['kw', 'kg', 'tx', 'wy', 'mg'],
      filePath: 'lx-sources/grass/latest.js',
    },
    {
      id: 'ikun',
      name: 'ikun音源',
      version: 'v22',
      author: 'ikunshare',
      description: 'ikunshare 社区音源',
      homepage: 'https://github.com/lxmusics/lx-music-api-server',
      platforms: ['kw', 'kg', 'tx', 'wy', 'mg'],
      filePath: 'lx-sources/ikun/latest.js',
    },
    {
      id: 'lx',
      name: '洛雪独家音源',
      version: 'v4',
      author: '洛雪科技',
      description: '音源更新，关注微信公众号：洛雪科技',
      homepage: 'https://www.lxmusic.cc/',
      platforms: ['kw', 'kg', 'tx', 'wy', 'mg'],
      filePath: 'lx-sources/lx/latest.js',
    },
    {
      id: 'juhe',
      name: '聚合API接口',
      version: 'v3',
      author: 'lerd',
      description: 'Cloudflare 部署的聚合 API 接口',
      platforms: ['kw', 'kg', 'tx', 'wy', 'mg'],
      filePath: 'lx-sources/juhe/latest.js',
    },
  ],

  // 本地服务端口(部署时使用)
  server: {
    port: 3000,
    host: 'quchen.nat100.top',
  },

  // 平台名称映射
  platformNames: {
    kw: '酷我',
    kg: '酷狗',
    tx: 'QQ 音乐',
    wy: '网易云',
    mg: '咪咕',
  },
};
