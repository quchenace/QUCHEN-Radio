# Quchen Radio · LX Music 音源插件

本目录收录了适配 [LX Music 桌面版](https://github.com/lyswhut/lx-music-desktop) 的音源插件,源自社区项目 [pdone/lx-music-source](https://github.com/pdone/lx-music-source)。

## 包含的音源

| 音源 | 版本 | 作者 | 说明 |
| --- | --- | --- | --- |
| 六音音源 | v1.2.1 | 六音 | www.sixyin.com |
| Huibq_lxmusic源 | v1.2.0 | Huibq | Github 搜索「洛雪音乐音源」 |
| 野花 | v1 | 社区 | 社区维护 |
| 野草 | v1 | 社区 | 社区维护 |
| ikun音源 | v22 | ikunshare | ikunshare 社区 |
| 洛雪独家音源 | v4 | 洛雪科技 | 关注微信公众号:洛雪科技 |
| 聚合API接口 | v3 | lerd | Cloudflare 部署 |

每个音源目录下的 `latest.js` 即当前推荐版本。

## 在线导入链接

访问 Quchen Radio 官网 [quchen.nat100.top](http://quchen.nat100.top) 即可一键下载音源插件。

也可直接使用 raw 链接(需能访问 GitHub):

```
https://raw.githubusercontent.com/quchenace/QUCHEN-Radio/main/lx-sources/<source-id>/latest.js
```

例如:
- 六音: `https://raw.githubusercontent.com/quchenace/QUCHEN-Radio/main/lx-sources/sixyin/latest.js`
- Huibq: `https://raw.githubusercontent.com/quchenace/QUCHEN-Radio/main/lx-sources/huibq/latest.js`

## 加速链接

国内访问 GitHub 受限时,可使用镜像:

```
https://gh-proxy.com/https://raw.githubusercontent.com/quchenace/QUCHEN-Radio/main/lx-sources/<source-id>/latest.js
```

可用镜像:
- `https://gh.llkk.cc/`
- `https://ghfast.top/`
- `https://gh-proxy.com/`

## 使用说明

1. 在 Quchen Radio 官网或本仓库下载对应音源的 `latest.js` 文件
2. 打开 LX Music 桌面版
3. 进入「设置 → 音乐来源 → 自定义源管理」
4. 点击「导入」选择下载的 `.js` 文件
5. 启用该音源即可使用

## 平台支持

所有音源均支持以下平台(具体音质因平台而异):

| 代码 | 平台 |
| --- | --- |
| kw | 酷我音乐 |
| kg | 酷狗音乐 |
| tx | QQ 音乐 |
| wy | 网易云音乐 |
| mg | 咪咕音乐 |

## 清单文件

`sources.json` 是机器可读的音源清单,包含所有音源的元数据,Quchen Radio 官网通过该清单展示音源卡片。

## 注意事项

- 所有插件均来自社区,仅供学习研究使用
- 请遵守对应音乐平台的用户协议、版权规则和会员权益规则
- 本项目不提供绕过付费、绕过会员、破解音质或重新分发音乐内容的能力
- 如音源失效,请前往原作者主页获取最新版本

## 致谢

- [pdone/lx-music-source](https://github.com/pdone/lx-music-source) - 音源收集维护
- [lxmusics/lx-music-api-server](https://github.com/lxmusics/lx-music-api-server) - 洛雪官方 API 服务
- [Huibq/keep-alive](https://github.com/Huibq/keep-alive) - Huibq 音源
- [SixYin](https://www.sixyin.com/) - 六音音源
- [lyswhut/lx-music-desktop](https://github.com/lyswhut/lx-music-desktop) - LX Music 桌面版
