---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 4c62cfa8c294f3a01fefc9df934c91f7_d57fa140d56211f180d5525400248c00
    ReservedCode1: CQDxtUo7JF2UBzJsziiuB4qjnSyDnm0IQFSKFTjnOUYX+SudLAgrhzKkTqRffgDpK0/LB/rpE5PKrmTytA6QCRqIZo5pd6zWKLPw3fms3+vObYBafS1z7xsfwHqvnlJVebFGeE6A9arZoV3MqHFtB1dAfiFTL9mdPkETQVQPgWcnHZurRzfs8P5AOBc=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 4c62cfa8c294f3a01fefc9df934c91f7_d57fa140d56211f180d5525400248c00
    ReservedCode2: CQDxtUo7JF2UBzJsziiuB4qjnSyDnm0IQFSKFTjnOUYX+SudLAgrhzKkTqRffgDpK0/LB/rpE5PKrmTytA6QCRqIZo5pd6zWKLPw3fms3+vObYBafS1z7xsfwHqvnlJVebFGeE6A9arZoV3MqHFtB1dAfiFTL9mdPkETQVQPgWcnHZurRzfs8P5AOBc=
---

# QUCHEN Radio v2.1.0 发布说明

## 版本信息
- 版本号：v2.1.0
- 发布日期：2026-11-01
- 仓库：quchenace/QUCHEN-Radio
- Release 链接：https://github.com/quchenace/QUCHEN-Radio/releases/tag/v2.1.0

## 本次内容
- 基于 Mineradio 上游 P1 模块与 P2-10 一键更新能力移植取长补短
- 本地升级：D:\111\QUCHENRadio\resources\app，Electron 42.4.1，electron-updater 6.8.11

## 本轮变更（QuChen AI 全套融入）
- **AI 功能全套融入**：安装 QUCHEN Radio 即同时具备音乐 + 本地 AI 能力，进入 AI 功能页需先通过「密码门」解锁（访问码 base64 混淆存储，非明文）
- **AI 十大功能页接真实 8099 API**：AI 聊天、知识库问答、模型商店 / 模型管理、办公面板、控制台日志、服务管控、主题切换、联网检索、一键自检（19 项）、模型明细
- **Ollama 本地模型推理**：主进程随应用拉起 Ollama（11434），模型库强制落 `D:\ai-stack\models`，预装 qwen3:8b / deepseek-r1:8b / qwen3:1.7b 等，可在线拉取更多模型
- **AI 控制台 8099 headless 托管**：Open WebUI 改造后端（8081 经网关反代）由 QUCHEN Radio 统一拉起 / 回收，端口被占用时复用不重复拉起；不随应用退出的外部服务不受影响
- **本地音乐库与内置歌单按钮修复**：本地音乐库（LocalMusicLibrary）与内置歌单（BuiltInPlaylistLibrary）入口恢复正常可用
- **汽水音乐登录对齐上游**：登录态与 Cookie 机制对齐 Mineradio v2.3.17 上游，多平台音源（QQ / 网易 / 酷狗 / 酷我 / 汽水等）继续可用
- **配置统一**：AI 侧配置收敛到 `D:\ai-stack\config\env.json`，`AI_STACK_BASE`（默认 `D:\ai-stack`）可用环境变量覆盖

## 发布产物
- 安装包：QUCHEN-Radio-Setup-2.1.0.exe（126,551,547 字节）
- 增量映射：QUCHEN-Radio-Setup-2.1.0.exe.blockmap
- 自动更新配置：latest.yml（sha512 = uKIioqpamFDpBEHPkedVtlYd5CpHIVCPV2sCJ+nnb5AH9E5x+5kS8KaMh4IsCscVUmM1hxoAJYQy8MAoXcDyoQ==）

## GitHub 发布凭据（本机记录，勿外传）
- 类型：Fine-grained Personal Access Token（github_pat_...）
- 权限：全部权限（用户确认授权）
- 记录位置：D:\ai-stack\config\github_cred.json，字段 `token`
- 用途：QUCHEN-Radio Release 创建与资产上传；使用前可先用 GitHub API 验证有效性
*（内容由AI生成，仅供参考）*
