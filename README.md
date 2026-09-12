# Annoti

Annoti 是一个本地优先的文档批注工具：打开 Markdown / 纯文本文档，像在稿纸上一样划线、写批注、贴便签、与朋友交换批注。

当前为 **1.0.0-delta**，即三阶段规划（V1 → V2 → V3）的第一阶段：**V1 核心批注引擎**（基于 Wails v2 重写）。架构与设计决策见 [doc/v1-architecture.md](doc/v1-architecture.md)。

## 功能

- **打开文档**：`.md`（Markdown 渲染）与 `.txt`（纯文本视图）；Markdown 中引用的本地图片可正常显示
- **高亮**：划选文字，五色色点（黄 / 绿 / 蓝 / 粉 / 橙）一键高亮；基于 CSS Custom Highlight API，不修改文档 DOM
- **批注**：批注正文支持 Markdown（编辑 + 预览）；点击高亮即可打开
- **便签**：每条批注可同时摊开一张便签——点空白处不消失、按下置顶、头部拖拽，只有显式关闭才收走
- **审阅**：批注可标记「已解决」（侧栏置底弱化）；侧栏列表点击定位（滚动居中 + 闪烁），锚点失效自动标记
- **数据可靠**：锚点带引文上下文，文档被修改后自动模糊重定位，定位失败标记失效而不是丢数据
- **导入导出**：`.annoti.json` 批注包，自动去重，源文档不一致时警告
- **日常**：启动自动恢复上次文档；亮 / 暗主题（暖纸 × 墨色的"稿纸"设计语言）；窗口大小位置记忆

## 技术栈

- **桌面壳**：[Wails v2](https://wails.io)（Go + 系统 WebView2，不捆绑浏览器引擎）
- **后端**：Go + SQLite（`modernc.org/sqlite`，纯 Go 无 CGO）
- **前端**：Vue 3 + TypeScript + Vite；图标为内联 SVG，界面无 emoji
- **锚点**：W3C Web Annotation 风格（文本位置 + 引文上下文，支持模糊重定位）

## 下载

前往 [Releases](https://github.com/AkutaZehy/Annoti/releases) 下载最新版 `annoti.exe`（Windows 10/11，需系统 WebView2 运行时）。提供 SHA256 校验文件。

## 开发

环境要求：Go 1.24+、Node 20+、pnpm、[Wails CLI](https://wails.io/docs/gettingstarted/installation)（`go install github.com/wailsapp/wails/v2/cmd/wails@latest`）。

```bash
# 安装依赖
cd frontend && pnpm install && cd ..

# 开发模式（前端热更新）
wails dev

# 测试
go test ./...                  # 后端：存储 / 交换包 / 本地资源端点
cd frontend && pnpm test       # 前端：锚点引擎 / 图片路径解析

# 发布构建
wails build                    # 注意：需先生成资源文件（见 doc/v1-architecture.md §5）
go build -tags desktop,production -trimpath -ldflags "-s -w -H windowsgui" -o build/bin/annoti.exe .   # 直接构建（必须带 wails 构建标签，含版本信息）
```

纯浏览器开发（不起 Wails）：`cd frontend && pnpm dev`，自动使用内置示例文档与
localStorage 存储。

## 数据位置

`%APPDATA%\AnnotiV1\`（`annoti.db` 数据库 + `settings.json` 设置）。顶栏数据目录按钮可直接打开。

## 版本规划

| 版本 | 主题 | 状态 |
|------|------|------|
| V1 | 核心批注引擎（md/txt，SQLite，交换格式） | **1.0.0-delta（当前）** |
| V2 | 多格式（html/json/xml/csv）+ 离线讨论串 | 规划中 |
| V3 | PDF / EPUB + 手绘图例 + 长文本性能优化 | 规划中 |

各版本为独立稳定产品，相互不兼容。历史 Tauri 实现存档于
[`archive/1.0.0-dev-tauri`](https://github.com/AkutaZehy/Annoti/tree/archive/1.0.0-dev-tauri)
分支；更早期文档见 `doc/`。

## 贡献

**暂时关闭**：本项目目前暂停接受贡献（PR / Issue / 功能请求）。

## 许可证

MIT License
