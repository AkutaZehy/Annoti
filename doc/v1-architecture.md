# Annoti V1 架构文档

本文档记录 V1 重做（Tauri → Wails v2）的架构决策与实现方式。

*文档日期: 2026-09-12*

---

## 1. 项目背景

Annoti 原为 Tauri 2 + Vue 3 实现（见 `doc/project.md`，历史文档）。
因 Rust 工具链心智负担、调试负担与构建产物问题，V1 起改用 **Wails v2 + Go**。

V1 定位（对应 V1-V3 三阶段规划的第一阶段）：

- 打开本地 `.md` / `.txt` 文档
- 划选高亮、Markdown 批注
- SQLite 持久化（唯一事实源），`.annoti.json` 作为导入导出交换格式
- 亮/暗主题、侧栏批注列表、窗口状态记忆

明确不在 V1 范围：悬浮便签层、稿纸排版（Fixed 模式，留待 V3 决定去留）、
讨论串（V2，schema 已预留 `parent_id`）、多格式（V2/V3）。

## 2. 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 桌面壳 | Wails v2.12 | WebView2（系统组件，Windows 10/11 预装） |
| 后端 | Go 1.26 | 文件 IO、SQLite、原生对话框、窗口状态 |
| 数据库 | modernc.org/sqlite | 纯 Go 实现，无 CGO，Windows 免 gcc |
| 前端 | Vue 3.5 + TypeScript 5.6 + Vite 6 | |
| 渲染 | marked 17 + DOMPurify | Markdown → 消毒后的 HTML |
| 高亮 | CSS Custom Highlight API | 不修改文档 DOM，按批注颜色分桶（默认黄/绿/蓝/粉/橙） |
| 图标 | 内联 SVG（Lucide 风格线性图标） | components/ui/Icon.vue，无 emoji |
| 视觉 | "稿纸"设计语言 | 暖纸底、墨色文字、琥珀强调、衬线标题（theme-*.css tokens） |
| 测试 | go test + vitest (jsdom) | 后端存储/交换包 + 前端锚点引擎 |

## 3. 目录结构

```
Annoti/
├── main.go                  # Wails 入口，内嵌 frontend/dist
├── app.go                   # App：绑定给前端的唯一服务对象
├── wails.json               # Wails 配置
├── internal/
│   ├── models/models.go     # 前后端共享类型（JSON tag 对齐）
│   ├── storage/             # SQLite（db.go）+ settings.json（settings.go）+ 测试
│   └── pack/                # .annoti.json 交换格式：Build/Parse/MergeImport + 测试
├── build/                   # Wails 图标与 Windows 清单
├── frontend/
│   ├── src/
│   │   ├── core/            # ★ 批注引擎（框架无关）
│   │   │   ├── textIndex.ts # DOM 文本节点 → 线性文本流（偏移索引）
│   │   │   ├── anchor.ts    # 锚点：文本位置 + 引文上下文，模糊重定位
│   │   │   ├── highlight.ts # CSS Custom Highlight API 画笔
│   │   │   └── anchor.test.ts
│   │   ├── platform/        # ★ 平台服务层
│   │   │   ├── index.ts     # Platform 接口 + 运行时探测
│   │   │   ├── wails.ts     # Wails 实现（调 wailsjs bindings）
│   │   │   └── mock.ts      # 浏览器 Mock（pnpm dev 纯浏览器可跑）
│   │   ├── composables/     # Vue 状态：设置/文档/批注
│   │   ├── components/      # MainLayout / TopBar / DocumentViewer /
│   │   │                    # AnnotationList / NotePopover / SelectionToolbar
│   │   ├── styles/          # 主题变量 + markdown 排版 + 高亮伪元素
│   │   └── types/           # 应用层类型（与 Go models 对齐）
│   └── wailsjs/             # wails 自动生成的 TS bindings
└── doc/                     # 历史文档 + 本文档
```

## 4. 核心设计

### 4.1 三层隔离：Core / UI / Shell

- **Core**（`src/core` + Go `internal/`）：批注引擎与持久化，无框架依赖
- **UI**（Vue 组件）：只通过 `Platform` 接口取数，不知道自己跑在哪个壳里
- **Shell**（Wails/Go）：fs、SQLite、对话框、窗口

将来接纯 Web 构建（File System Access API + SQLite-WASM）只需新增一个
Platform 实现，UI/Core 零改动。Web 与桌面版可共用同一 schema 的 `.annoti.json`
乃至数据库文件。

### 4.2 锚点系统（与旧版的本质区别）

旧版锚点 = CSS 选择器路径 + 文本节点索引 → 文档重渲染即失效，且只在
Markdown 模式可用。

V1 锚点（W3C Web Annotation 风格）：

```json
{
  "type": "text",
  "start": 25, "end": 29,
  "exact": "重复词语",
  "prefix": "标题文字…第二段：",
  "suffix": "在这里。…"
}
```

- `start/end`：渲染文本流的 UTF-16 code unit 偏移（`textIndex.ts` 把 DOM
  文本节点拉平成一条带偏移的流）
- `exact/prefix/suffix`：引文上下文（各 ≤32 字符），文档改动导致偏移漂移时
  按三级策略重定位：偏移直命中 → 全上下文匹配 → 纯 exact 匹配；
  全部失败则标记"失效"（侧栏显示 ⚠，不删数据）
- 对 `.md` 与 `.txt` 一视同仁——同一套引擎

### 4.3 高亮渲染

CSS Custom Highlight API（Chromium 105+，WebView2 满足）：在 Range 上着色，
**完全不修改文档 DOM**。旧版"Vue 重渲染抹掉高亮 → setTimeout 抢救恢复"
的竞态从根上不存在。三个着色桶：

- `anno-base`：普通高亮（金色底）
- `anno-active`：当前选中的批注（橙色底）
- `anno-flash`：侧栏定位时的闪烁提示（红色底）

点击命中检测：`caretPositionFromPoint`/`caretRangeFromPoint` → 文本流偏移 →
查区间覆盖。不支持 Highlight API 的环境自动退化为 no-op（功能不受影响，
仅无高亮底色）。

### 4.4 数据模型

```
documents(id, path UNIQUE, name, checksum, size, created_at, updated_at)
annotations(id, document_id FK, parent_id FK→annotations,   -- V2 讨论串预留
            author_id, author_name, quote, body,            -- body = Markdown
            anchor JSON, color, resolved, created_at, updated_at)
```

- 文档按 `path` 登记，`checksum`（SHA-256）检测内容变化；变化时前端用引文
  上下文模糊重定位，并在顶栏提示"已修改"
- 导入去重键：`作者|引文|起|止`
- settings.json：`window`（Go 启动/退出时读写）+ `ui`（前端不透明 JSON 块，
  主题/侧栏宽度/作者名）——前后端互不侵入

### 4.5 交换格式 `.annoti.json`

```json
{
  "format": "annoti-annotations",
  "version": 1,
  "exportedAt": 1760000000000,
  "document": { "name": "文章.md", "checksum": "sha256…" },
  "annotations": [ … ]
}
```

只用于交换（数据库才是事实源）。导入时若 checksum 与当前文档不一致，
前端给出"批注位置可能偏移"的警告。

### 4.6 Markdown 中的本地图片

WebView 的页面源是应用资源（`wails://`），Markdown 里的图片引用无法直接命中
磁盘文件。处理链路：

1. 渲染管线：`marked → DOMPurify（放宽 URI 白名单，放行 file:/data:）→
   localizeMarkdownImages`
2. `core/resolveImages.ts` 把每处 `<img src>` 解析为绝对路径（相对路径拼文档
   目录、剥 `file://`、解码 `%20`、归一化 `./`/`../`），编码为
   `/local/<base64url(绝对路径)>`
3. Go 侧 `internal/localres` 挂在 AssetServer 的 fallthrough Handler 上：
   解码路径，校验为绝对路径 + 图片扩展名后用 `http.ServeFile` 放行；
   相对路径、目录穿越、非图片扩展名一律 403/404

安全边界：该端点只暴露给自家 WebView 渲染的已消毒内容，且限制图片扩展名；
V3 接入 epub（zip 内资源）时需扩展为虚拟路径 → 条目流的映射。

## 5. 构建与测试

```bash
# 前端（frontend/）
pnpm install
pnpm test        # vitest：锚点引擎 10 例
pnpm build       # vue-tsc --noEmit && vite build

# 后端（根目录）
go test ./...    # storage 3 例 + pack 3 例 + localres 2 例
go vet ./...

# 集成
wails build      # → build/bin/annoti.exe
wails dev        # 开发模式（前端热更新）

# 直接 go build 发布（绕过 wails 打包步骤，与外部 winres syso 配合）
# 注意：desktop,production 标签缺一不可，否则启动即报"Wails applications
# will not build without the correct build tags"
go build -tags desktop,production -trimpath -ldflags "-s -w -H windowsgui" \
  -o build/bin/annoti.exe .
```

版本资源：`winres/winres.json` 经 `go-winres simply --arch amd64` 生成
`rsrc_windows_amd64.syso`（产品名 / 版本 / 版权 / 图标 / 清单，go build 自动链接）。

纯浏览器开发（不起 Wails）：`cd frontend && pnpm dev`，自动落到 mock 平台，
内置示例文档，批注存 localStorage。

## 6. 已知取舍

- 便签（StickyNote）遵循真便签语义：每条批注可同时摊开一张、点空白处不关闭、
  按下即置顶，只有显式 ×（或删除批注）才收走；视口浮层定位，拖拽位置会话内
  有效不持久化（旧版便签的 notePosition 字段未迁移；如需持久化在 V2 schema 加列）
- 选区工具条由 `selectionchange` 事件驱动（150ms 去抖），统一覆盖拖选/双击选词/
  键盘选区，不依赖 mouseup 时机与渲染帧——窗口被遮挡时 rAF 不触发是实测踩过的坑
- 文档编码仅支持 UTF-8（含 BOM 剥离）；GBK 需 V2 再议
- 高亮颜色 V1 全局统一，按人着色留到 V2 讨论串
- "修订"（tracked changes，改文档内容）不在规划内——Annoti 是阅读批注工具，
  "达到 Word 审阅水平"指批注/回复/解决状态这一半
- 旧版（Tauri）数据在 `%APPDATA%\Annoti`，V1 使用 `%APPDATA%\AnnotiV1`，
  按版本不兼容策略不迁移
