# QUCHEN Radio（含 QuChen AI 融合版）

> 本仓库为 QUCHEN Radio 桌面版源码（resources/app）。应用包含音乐播放器和 AI 聊天；AI 聊天直接调用本机 QuChen-AI 的 OpenAI 兼容 API，不再安装或托管第二套模型服务。

---

## 一、项目简介

QUCHEN Radio 是一款 Windows 桌面音乐播放器（Electron），前身移植自 Mineradio / QUCHEN Radio 定制版，保留 QUCHEN 定制能力（AI 3D 视觉、cuefield 混音、五平台音源、QQ 源等）。

**AI 聊天能力**：
- 从 QuChen-AI 获取本地模型和已配置的外部 provider 模型
- 多会话、多轮上下文、流式输出、停止生成和错误提示
- 默认连接 `http://127.0.0.1:8791`，可在聊天页修改地址和可选 API key
- Radio 不启动 Ollama、Open WebUI 或其他 AI 后台

---

## 二、功能清单

### 音乐侧（继承 + 修复）
- 本地音乐库：扫描并管理本地音乐文件（`desktop/main.js` LocalMusicLibrary）
- 内置歌单：内置曲库 / 播放列表（BuiltInPlaylistLibrary）及入口按钮
- 五平台音源：QQ / 网易 / 酷狗 / 酷我 / 汽水等音源（qq-vip-api / kugou-api / qishui-api / spotify-api 等）
- 汽水音乐登录：登录态与 Cookie 已对齐上游 Mineradio v2.3.17
- cuefield 混音、AI 3D 视觉等 QUCHEN 定制能力保留

### AI 侧
1. **模型列表**：读取 QuChen-AI `/v1/models`。
2. **流式聊天**：调用 `/v1/chat/completions`，兼容 SSE 和非流式 JSON 响应。
3. **多轮上下文**：发送当前会话历史，支持多个本地会话。
4. **生成控制**：按请求 ID 关联输出，可停止生成并在窗口关闭时中止请求。
5. **连接配置**：支持本机或远程 HTTP/HTTPS QuChen-AI 地址及可选 API key。

---

## 三、AI 功能架构

```
QUCHEN Radio 渲染进程
  → preload.js 暴露的最小 window.quchenAi 接口
  → Electron 主进程 quchen-ai-client.js
  → QuChen-AI /v1/models 与 /v1/chat/completions
```

- 渲染进程不直接获得 Node.js 或通用网络请求能力，`contextIsolation` 保持开启。
- 主进程使用请求 ID 转发 chunk、done 和 error；停止生成或销毁窗口会取消对应请求。
- 音乐服务仍使用本机动态端口；AI 不再使用 `11434`、`8099` 或 `D:\ai-stack`。

---

## 四、数据落盘策略

| 数据 | 路径 | 说明 |
|---|---|---|
| AI 会话与连接设置 | Radio 的 Chromium localStorage | 模型文件仍由 QuChen-AI 管理 |
| 音乐缓存 | 优先 `D:\QUCHENRadioCache` | 不可用时兜底 userData\cache |
| 应用设置 | `%APPDATA%\QUCHEN Radio` | Electron userData |

> Radio 不下载或保存 AI 模型，也不创建 `D:\ai-stack`。

---

## 五、安装与使用

1. **前置**：Windows 10+；安装包为 NSIS 安装程序（可选择安装目录）。
2. **安装**：运行 `QUCHEN-Radio-Setup-<version>.exe` 完成安装。
3. **AI 依赖**：使用 AI 聊天前启动 QuChen-AI，并在其中加载本地模型或配置外部 provider。
4. **使用**：
   - 音乐：本地音乐库 / 内置歌单 / 多平台音源正常使用；
   - AI：点击「AI」入口，刷新模型后即可聊天；需要时在「连接设置」中修改 QuChen-AI 地址。

---

## 六、技术栈与目录结构

| 组件 | 技术 |
|---|---|
| 桌面框架 | Electron 42.4.1（asar=false，源码落盘） |
| 更新 | electron-updater 6.8.11 |
| 音乐后端 | Node.js（`desktop/main.js` 主进程 + `server.js`，端口 3000 探测漂移） |
| AI 客户端 | Electron 主进程 Node.js HTTP/SSE 客户端 |
| AI API | QuChen-AI OpenAI 兼容接口（默认 127.0.0.1:8791） |
| 前端 | 原生 JS + HTML/CSS（`public/`），Linear / Raycast 风格 UI |

```
D:\111\QUCHENRadio\resources\app\
├── desktop\                 # Electron 主进程模块
│   ├── main.js              # 主入口：音乐服务 + AI IPC
│   ├── quchen-ai-client.js  # QuChen-AI HTTP/SSE 客户端与请求桥
│   ├── preload.js           # 预加载
│   └── *.js                 # 本地音乐库 / 内置歌单 / 壁纸引擎等
├── public/                  # 前端资源
│   └── js\modules\13-quchen-ai\00-quchen-ai.js   # AI 多会话聊天页
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
npm run dist       # electron-builder --win nsis --publish never
```
- 产物输出：`dist\QUCHEN-Radio-Setup-<version>.exe`（`artifactName` 已在 package.json 配置）
- 构建配置：`package.json > build`（appId=com.quchenradio.desktop、nsis 可选安装目录、afterPack 图标注入等）
- 注意：打包需 `build\tools\`（ffmpeg / node 注入工具）与系统 electron-builder 缓存（`%LOCALAPPDATA%\electron-builder\Cache`），缺失时打包前会自动/需手动补齐。

### 发布（GitHub Releases）
- 仓库：`quchenace/QUCHEN-Radio`（electron-builder `publish` 已配置 github provider）
- 发布流程：`npx electron-builder --win nsis --publish always`（需有效 GitHub Token）
- 发布说明：见 `docs/RELEASE-<version>.md`，版本号需与 `package.json` 同步

---

## 七、第三方许可

- 基于 Mineradio 上游（原作者 xhuberrr 停更 v2.2.0，sunzhaocn 接手）二次开发，保留 QUCHEN 定制
- 第三方移植与版权声明见 `docs/THIRD_PARTY_PORTS.md` 与 `NOTICE.md`