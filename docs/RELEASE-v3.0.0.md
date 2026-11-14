# QUCHEN Radio v3.0.0 发布说明

## 版本信息
- 版本号：v3.0.0
- 发布日期：2026-11-14
- 仓库：quchenace/QUCHEN-Radio
- Release 链接：https://github.com/quchenace/QUCHEN-Radio/releases/tag/v3.0.0

## 本次内容

AI 对话改为直接使用 QuChen-AI 的模型服务，Radio 不再自带第二套 AI 后台。

- **接线方式变更**：删除内置的 `quchen-ai-host.js`，新增 `desktop/quchen-ai-client.js`，通过 QuChen-AI 的 OpenAI 兼容接口（默认 `127.0.0.1:8791`）对话。
- **模型与连接**：可从 QuChen-AI 读取模型列表，也可手工填写服务地址与 API Key；连接失败给出明确错误，不再静默失败。
- **流式对话**：支持 SSE 分块增量输出、停止生成、多会话切换，窗口关闭时中止在途请求并释放连接。
- **安全边界**：preload 只暴露模型、对话、取消三类能力及对应事件，不向页面暴露 Node 能力。
- **安装器**：修复 NSIS 自定义安装目录被默认目录覆盖的问题（`/D=` 不再被注册表或默认路径改写）。
- **测试**：新增 14 项客户端测试，覆盖分块 SSE、错误处理、取消与窗口销毁清理。

## 发布产物
- 安装包：QUCHEN-Radio-Setup-3.0.0.exe
- 增量映射：QUCHEN-Radio-Setup-3.0.0.exe.blockmap
- 自动更新配置：latest.yml

## 验证
- `node --test` 客户端测试 14/14 通过。
- Electron 内与 QuChen-AI 实际联调通过：读取模型、流式回复、停止生成、会话切换。
- Windows NSIS 安装包构建通过，安装后可启动。
