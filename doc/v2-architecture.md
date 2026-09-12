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
