# V2 架构增量

V2 在 V1 的 Core / Platform / UI 三层之上做加法，不推翻任何既有机制。
本文只记 V2 新增的设计决策；V1 核心见 [v1-architecture.md](v1-architecture.md)。

## 1. 多格式渲染层（frontend/src/formats/）

核心洞察：V1 的锚点引擎（文本流偏移 + CSS Custom Highlight API）只吃 DOM，
不关心 DOM 从哪来。因此新增格式 = 新增一个**确定性渲染器**，管线其余部分
（buildTextIndex → makeAnchor/resolveAnchor → HighlightPainter）原样复用。

```
原始文本 ──▶ renderDocument(mode, content, ctx) ──▶ 规范 HTML（已消毒/转义）
                    │ md:   marked → DOMPurify → 图片本地化
                    │ txt:  最小转义（容器 pre-wrap 排版）
                    │ html: DOMParser 取 body → DOMPurify → 图片本地化
                    │ json: JSON.parse → 2 空格 pretty → 记号高亮
                    │ xml:  原文照排 → 记号高亮（DOMParser 仅校验告警）
                    │ csv:  RFC4180 状态机 → 真 <table>（首行作表头）
                    └──▶ buildTextIndex → 锚点引擎（不变）
```

关键不变量：**同一输入必须产出逐字节相同的 HTML**——锚点偏移依赖渲染稳定性。
高亮 span 只包裹不引入文本，渲染后的文本流逐字符可验证（formats.test.ts
用 buildTextIndex 断言这一点）。

各格式的取舍：

- **html**：以 body 为阅读主体（head 样式脚本不进入阅读视图）；DOMPurify
  额外禁 iframe/form/base/object/embed；`<a href>` 由 DocumentViewer 拦截，
  经 Go `OpenExternal`（runtime.BrowserOpenURL）交给系统浏览器，应用内不导航。
- **json**：pretty-print 改变空白但确定性成立；解析失败回退原文 + 顶部告警条。
- **xml**：不做 pretty-print 重排——混合内容的缩进重排风险高；原文照排使
  文本流与文件完全一致，锚点天然稳定。
- **csv**：单元格即文本节点，跨单元格划选由全局文本索引天然支持；
  短行补齐到表头宽度；分隔符按表头行嗅探（`,` / `\t` / `;`）。

## 2. 编码检测（internal/encoding）

判定顺序：UTF-8/UTF-16 BOM → `utf8.Valid` → GB18030 回退（向下兼容 GBK/GB2312，
覆盖中文 Windows 的 ANSI 文本——Excel 导出的 CSV 是常态场景）。所有文本格式
（md/txt/html/json/xml/csv）统一走这一入口。

## 3. 讨论串（回复）

- **结构：树形**。`ParentID` 指向被回复节点（V1 已预留的自引用外键，
  `ON DELETE CASCADE`），存储支持任意深度；展示层缩进封顶 2 级（REPLY_MAX_DEPTH），
  更深平铺。选树形而非扁平：每条回复是独立 UUID 节点、各带自己的 ParentID，
  离线合并 = 并集，不因树形变难，而结构表达更完整。
- **回复无锚点**：位置由父节点给（anchor 零值），不参与高亮绘制与失效检测。
- **解决态挂串根**：根解决 = 整串在侧栏折叠弱化；回复不可单独解决。
- **删除级联**：DB 侧外键级联；前端本地列表用 `descendantIds` 一次清空，
  带回复的删除需确认。
- **孤儿回复**（父链断裂）：照常导入/展示，标"回复丢失"——与锚点失效
  "标记不删"同一哲学。

## 4. 离线合并（pack 格式 v2）

`.annoti.json` 升 version 2，**向下兼容 v1**（字段超集）。合并算法两遍扫描：

1. **根批注**按 DedupeKey（作者|引文|位置）去重；新的以**原 ID** 导入——
   讨论串链接依赖 ID 不变（V1 曾重置 ID，v2 起不再）。与本地重复的根，
   其包内回复的 ParentID 重映射到本地对应根。
2. **回复**按 ID 去重：本地已有且包内 `updatedAt` 更新 → 原位更新（LWW，
   保留本地 CreatedAt）；否则跳过；本地没有 → 原 ID 新增。

不需要 CRDT：每节点独立 UUID + LWW，A→B→A 的多轮交换自然收敛。

## 5. 多作者

- **按人着色**：authorId 的 FNV-1a 哈希 → 8 色调色板（core/authors.ts），
  便签头像点 / 侧栏 / 回复列表一致；作者色与高亮色点并存、语义不同。
- **作者筛选**：侧栏按参与者筛选讨论串（作者数 > 1 时出现筛选条）。

## 6. 数据与版本

- 数据目录 `%APPDATA%\AnnotiV2`（与 V1 的 AnnotiV1 隔离，两代并排安装，
  免迁移代码）；`.annoti.json` 是唯一的跨代迁移通道（v1 导出可导入 v2）。
- SQLite `PRAGMA user_version = 2`（V2 无破坏性列变更，仅新增索引）。
- 批注正文升级为 Markdown 渲染并支持本地图片（复用文档同一条
  marked → DOMPurify → /local/ 管线），即愿景中"V2 可能加图片"的落点。

## 7. V2.1 增量：区域批注、EPUB 与阅读工具

### 7.1 区域批注（框选，三级锚定）

`Ctrl+G` 进入框选模式，拖出矩形后按目标分级锚定（core/regions.ts）：

1. **图片**：`region.img` = 渲染时的 img src 作为身份 + 相对图片元素的归一化
   坐标。图片内部几何不随排版变化，零漂移。
2. **文本块**：中心落点所在块（p/li/td/h1-6/pre/blockquote 等），取**块内全部
   文本节点**的文档级范围作 Start/End（复用 TextAnchor 的 exact/prefix/suffix
   模糊重定位），框相对"该文本范围的 Range 包围盒"归一化——绘制与解析两侧
   由同一对偏移重建参考框，口径一致，回流后仍贴住同一段内容。注意 pre>code、
   blockquote>p 这类块没有直接文本子节点，必须用 TreeWalker 聚合而非
   selectNodeContents（首版踩坑：直接子节点找不到文本 → 锚点构造失败）。
3. **页面叠加层**（`region.page=true`）：相对文档内容列（v-html 包裹层包围盒）
   归一化，不锚定任何内容。空白/边距批注靠它；**无文本层的扫描件 PDF（V3）
   只有这一种锚定方式**，届时参考框换成固定几何的页面即完全稳定。文本回流时
   框随几何近似缩放，这是几何叠加的固有取舍。

落点判定：图片（相交面积最大）→ 文本块（与块文本框相交占比 ≥ 40%）→ 叠加层，
永不拒绝框选。

**存储零迁移**：区域数据全部挂在 `TextAnchor.region` 可选 JSON 字段
（anchor 列本就是 JSON blob），数据库表结构不变、user_version 不变、
批注包仍是 v2。旧版本反序列化忽略未知字段：导入含区域批注的包时降级为
"锚定到块首的文本批注"；DedupeKey 追加框坐标参与区分（仅新版本计算）。

### 7.2 EPUB

分工：Go 只做机械解包（internal/epub，zip-slip 用"前导斜杠钳制"防御，
条目数/解压总量设上限，缓存键 = 路径+大小+mtime），前端做全部语义解析
（formats/epub.ts：container → OPF → spine 逐章抓取 /local/ 产物 →
去脚本/样式 → DOMPurify → 图片路径改写 → 拼进单容器）。

- 单容器拼接保持"文档级文本流"不变量，锚点/讨论串/合并零改动；
- 章节包 `<section class="epub-chapter">`，带 content-visibility 懒渲染；
- 目录 EPUB3 nav 优先、EPUB2 NCX 兜底，进侧栏大纲；
- 内部跳转链接剥 href（防应用内导航），外链保留走系统浏览器；
- 不做 DRM。

### 7.3 阅读工具

- **文内查找**（Ctrl+F）：core/find.ts 用转义正则在渲染文本流上找全部偏移
  （不做 toLowerCase——个别字符大小写变换会改变长度、污染偏移）；高亮走
  HighlightPainter 新增的通用附加桶（find / find-current），与批注桶共用
  增量注册表（附加桶必须在清理前并入 desired，否则每次重绘删建丢帧）。
- **字号缩放**（Ctrl+滚轮 / Ctrl+=/-/0）：`--doc-zoom` 乘在 .doc-content
  字号上，文本流锚点天然抗回流；0.8–2.0，持久化进 settings。
- **大纲**：md/html 取 h1-h3（DOM 上打 data-outline 定位键），EPUB 用章节
  目录；定位用 scrollIntoView（content-visibility 屏外内容由浏览器强制布局，
  手工 scrollTop 算术在 CV 下会失准）。
- **长文档**：内容超 25 万字符按顶层块、EPUB 按章节启用 content-visibility，
  DOM 与文本流不变，只跳过屏外布局绘制。
- **菜单栏**：应用内菜单（文件/视图/批注/帮助）+ 全局快捷键 + 最近打开
  （settings.recents）+ 拖拽文件打开（Go OnFileDrop → doc:dropped 事件）。
- **便签位置记忆**：settings.notePositions，键 = `文档ID/批注ID`。

### 7.4 兼容性与 V2.2 接口

- 数据目录仍为 `AnnotiV2`，数据库 schema 零变更，2.0 数据原样可用；
  批注包保持 v2（加法扩展），2.0 ↔ 2.1 文本批注互通。
- 为标签页多开（V2.2）留的路：查找状态、区域框选等视图态都封装在
  DocumentViewer 组件内，全局模块态只有批注数据与文档单例（与 2.0 一致），
  多开时按组件实例隔离即可。
