# QUCHEN Radio（含 QuChen AI 融合版）

> 本仓库为 QUCHEN Radio 桌面版源码（resources/app）。v2.1.0 起已将本地 AI 套件 **QuChen AI** 整体融入：安装 QUCHEN Radio 即同时获得「音乐播放器 + 本地智能助手」双能力，AI 与音乐同一应用不可分割。

---

## 一、项目简介

QUCHEN Radio 是一款 Windows 桌面音乐播放器（Electron），前身移植自 Mineradio / QUCHEN Radio 定制版，保留 QUCHEN 定制能力（AI 3D 视觉、cuefield 混音、五平台音源、QQ 源等）。

**v2.1.0 融合 QuChen AI 后新增能力**：
- 本地大模型推理（Ollama 绿色版，全部模型落在 D 盘）
- AI 聊天、知识库问答、模型商店 / 模型管理、办公面板、控制台日志、服务管控、主题切换、联网检索、一键自检等十大功能页
- 数据不出本机，无需联网账号，隐私安全

---

## 二、功能清单

### 音乐侧（继承 + 修复）
- 本地音乐库：扫描并管理本地音乐文件（`desktop/main.js` LocalMusicLibrary）
- 内置歌单：内置曲库 / 播放列表（BuiltInPlaylistLibrary）及入口按钮
- 五平台音源：QQ / 网易 / 酷狗 / 酷我 / 汽水等音源（qq-vip-api / kugou-api / qishui-api / spotify-api 等）
- 汽水音乐登录：登录态与 Cookie 已对齐上游 Mineradio v2.3.17
- cuefield 混音、AI 3D 视觉等 QUCHEN 定制能力保留

### AI 侧（融合新增）
1. **AI 聊天**：多轮对话，支持图片输入、思维链展示、会话历史管理
2. **知识库**：本地向量检索问答（嵌入模型 bge-small-zh），问答基于知识库原文
3. **模型商店 / 模型管理**：浏览可安装模型、查看已安装模型、删除模型
4. **办公面板**：Office 实时面板
5. **控制台 & 日志**：AI 服务最近日志、运行状态
6. **服务管控**：Ollama / Open WebUI / 官网 / 音乐服务 / 控制台启停与状态
7. **主题**：深色 / 浅色 / 动态跟随，双端一致
8. **联网检索**：Bing RSS 网关搜索
9. **一键自检**：19 项检查覆盖服务 / 知识库 / 会话 / 联网 / 模型 / 主题等
10. **模型明细**：Ollama 已加载模型与 GPU 利用率

> 功能入口需通过密码门解锁（见「安装与使用」）。

---

## 三、AI 功能架构

```
┌──────────────────────────────────────────────────────────────┐
│ QUCHEN Radio（Electron 42.4.1）                              │
│  desktop/main.js                                             │
│   ├─ 音乐服务（Node，127.0.0.1:3000，端口占用自动漂移）        │
│   └─ quchen-ai-host.js（AI 托管）                            │
│       ├─ Ollama       127.0.0.1:11434（模型 D:\ai-stack\models）│
│       └─ AI 控制台    127.0.0.1:8099（--headless 服务形态）    │
└──────────────┬───────────────────────────────────────────────┘
               │ 同机本地调用（复用，端口占用不重复拉起）
┌──────────────▼───────────────────────────────────────────────┐
│ QuChen AI（D:\ai-stack）                                     │
│  ├─ app/           8099 控制台（startWebServer，headless 模式）│
│  ├─ ollama/        Ollama 绿色版（ollama.exe serve）           │
│  ├─ models/        本地模型库（blobs + manifests + 嵌入模型）  │
│  ├─ openwebui-src/ Open WebUI 改造后端（uvicorn，8081 网关反代）│
│  ├─ openwebui-venv/ 后端 Python 环境                         │
│  ├─ data/          Open WebUI 数据（webui.db）、知识库、日志  │
│  ├─ website/       官网静态服务 8090（不随启动）              │
│  └─ config/env.json 统一配置                                  │
└──────────────────────────────────────────────────────────────┘
```

- **端口约定**：Ollama `11434`、AI 控制台 `8099`、Open WebUI 后端 `8081`（经控制台网关反代，音乐 App 直连 8099 即可）、官网 `8090`、音乐服务 `3000`（占用时漂移）。
- **服务托管**：音乐主进程随应用拉起 Ollama 与 AI 控制台（`quchen-ai-host.js`）；端口已被外部占用时直接复用、不重复拉起；退出只回收本进程拉起的子进程，不影响单独使用 QuChen AI 桌面端。
- **密码门机制**：进入 AI 功能页需输入访问密码（访问码以 base64 混淆存储于前端，非明文），验证通过后以 `sessionStorage` 保持本会话解锁状态。
- **模型**：预装 `qwen3:8b`、`deepseek-r1:8b`、`qwen3:1.7b`，另可拉取 `gemma2:9b`、`gemma3:4b`、`llama3.1:8b` 等；知识库向量化使用本地嵌入模型 bge-small-zh。

---

## 四、数据落盘策略（强制不占 C 盘）

| 数据 | 路径 | 说明 |
|---|---|---|
| AI 模型库 | `D:\ai-stack\models` | Ollama 通过 `OLLAMA_MODELS` 强制指向 |
| Ollama 服务 | `D:\ai-stack\ollama` | 绿色版，无系统服务 |
| Open WebUI 数据 | `D:\ai-stack\data\openwebui`（webui.db 等） | 知识库 / 会话权威源 |
| 知识库文件 | `D:\ai-stack\data\knowledge` | — |
| 配置 | `D:\ai-stack\config\env.json` | 统一配置，日志写 D 盘 |
| 音乐缓存 | 优先 `D:\QUCHENRadioCache` | 不可用时兜底 userData\cache |
| AI_STACK_BASE | 默认 `D:\ai-stack` | 可用环境变量 `QUCHEN_AI_BASE` / `AI_STACK_BASE` 覆盖 |

> 说明：AI 全部数据强制落在 D 盘；音乐缓存优先 D 盘。运行期仍有少量 C 盘写点（userData 默认 `%APPDATA%\QUCHENRadio`、壁纸原生临时目录 `%LOCALAPPDATA%\QUCHENRadio\native-helper-temp`），如需绝对零 C 盘可在后续版本将二者重定向至 D 盘。

---

## 五、安装与使用

1. **前置**：Windows 10+；安装包为 NSIS 安装程序（可选择安装目录）。
2. **安装**：运行 `QUCHEN-Radio-Setup-<version>.exe` 完成安装。
3. **AI 依赖**：首次使用 AI 功能需本机存在 `D:\ai-stack`（模型、Ollama、Open WebUI 数据均在其中）。程序启动时会自动检测并拉起服务；若目录不存在，请在装有 QuChen AI 数据的机器上迁移该目录，或配置 `QUCHEN_AI_BASE` 指向实际路径。
4. **使用**：
   - 音乐：本地音乐库 / 内置歌单 / 多平台音源正常使用；
   - AI：点击「QuChen AI」入口 → 输入访问密码解锁 → 进入十大功能页；
   - 关闭应用时自动停止由本应用拉起的 AI 服务，不残留进程。

---

## 六、技术栈与目录结构

| 组件 | 技术 |
|---|---|
| 桌面框架 | Electron 42.4.1（asar=false，源码落盘） |
| 更新 | electron-updater 6.8.11 |
| 音乐后端 | Node.js（`desktop/main.js` 主进程 + `server.js`，端口 3000 探测漂移） |
| AI 推理 | Ollama（绿色版，11434） |
| AI 管控 | QuChen AI 控制台（8099，headless） |
| AI 网页后端 | Open WebUI 改造版（uvicorn，8081，经网关反代） |
| 前端 | 原生 JS + HTML/CSS（`public/`），Linear / Raycast 风格 UI |

```
D:\111\QUCHENRadio\resources\app\
├── desktop\                 # Electron 主进程模块
│   ├── main.js              # 主入口：音乐服务 + AI 托管 + IPC
│   ├── quchen-ai-host.js    # AI 服务托管（Ollama + 8099 控制台）
│   ├── preload.js           # 预加载
│   └── *.js                 # 本地音乐库 / 内置歌单 / 壁纸引擎等
├── public/                  # 前端资源
│   └── js\modules\13-quchen-ai\00-quchen-ai.js   # AI 功能页（密码门+十大功能）
├── build/                   # electron-builder 资源（icon、installer.nsh、tools）
├── docs/                    # 项目文档（README / RELEASE / THIRD_PARTY_PORTS）
├── dist/                    # 构建输出（生成物，不入库）
├── *.api.js                 # 多平台音源适配（qq / kugou / qishui / spotify）
├── server.js                # 本地 Node 音乐服务
└── package.json             # 依赖与 electron-builder 配置
```

---

## 七、开发构建说明

### 环境
- Node.js + npm（构建机需能访问 npm registry）
- 源码位置：`resources\app`（本目录）

### 本地运行
```bash
cd resources/app
npm install
npm start          # 或 npx electron .
```

### 打包
```bash
cd resources/app
npm run dist       # electron-builder --win nsis
```
- 产物输出：`dist\QUCHEN-Radio-Setup-<version>.exe`（`artifactName` 已在 package.json 配置）
- 构建配置：`package.json > build`（appId=com.quchenradio.desktop、nsis 可选安装目录、afterPack 图标注入等）
- 注意：打包需 `build\tools\`（ffmpeg / node 注入工具）与系统 electron-builder 缓存（`%LOCALAPPDATA%\electron-builder\Cache`），缺失时打包前会自动/需手动补齐。

### 发布（GitHub Releases）
- 仓库：`quchenace/QUCHEN-Radio`（electron-builder `publish` 已配置 github provider）
- 发布流程：`npm run dist -p always`（或 `electron-builder --publish always`，需有效 GitHub Token）
- 发布说明：见 `docs/RELEASE-<version>.md`，版本号需与 `package.json` 同步

---

## 七、第三方许可

- 基于 Mineradio 上游（原作者 xhuberrr 停更 v2.2.0，sunzhaocn 接手）二次开发，保留 QUCHEN 定制
- 第三方移植与版权声明见 `docs/THIRD_PARTY_PORTS.md` 与 `NOTICE.md`