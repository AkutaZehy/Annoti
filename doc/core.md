# Annoti 核心算法文档

本文档记录 Annoti 项目中值得学习的核心算法，包括思维链分析和具体代码实现。

---

## 目录

1. [跨节点文本高亮算法](#1-跨节点文本高亮算法)
2. [便签唤醒坐标计算](#2-便签唤醒坐标计算)
3. [便签拖动系统](#3-便签拖动系统)
4. [SQLite 数据库架构](#4-sqlite-数据库架构)
5. [防抖保存机制](#5-防抖保存机制)
6. [导入去重策略](#6-导入去重策略)
7. [HTML 导出高亮渲染](#7-html-导出高亮渲染)
8. [CJK 字符宽度计算](#8-cjk-字符宽度计算)
9. [主题切换系统](#9-主题切换系统)

---

## 1. 跨节点文本高亮算法

### 问题背景

当用户在 Markdown 渲染后的 HTML 文档中选择文本时，选区可能跨越多个 DOM 节点（多个段落、标题等）。需要将这段选区高亮显示。

### 思维链

```
1. 用户选择文本 → 触发 mouseup 事件
2. 获取选区对象 (window.getSelection())
3. 判断选区是否有效
4. 遍历选区内的所有文本节点
5. 为每个文本节点创建独立的 Range
6. 使用 surroundContents() 包装高亮
7. 生成锚点信息用于持久化
```

### 代码实现

**文件**: `src/components/DocumentViewer.vue`

```typescript
/**
 * 获取选区内的所有文本节点
 * @param range 选区范围
 * @returns 文本节点数组
 */
const getTextNodesInRange = (range: Range): Text[] => {
    const textNodes: Text[] = [];
    const root = range.commonAncestorContainer;

    // 边界情况：选区在同一文本节点内
    if (root.nodeType === Node.TEXT_NODE) {
        if (range.intersectsNode(root)) return [root as Text];
        return [];
    }

    // 使用 TreeWalker 高效遍历所有文本节点
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) =>
            range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });

    let currentNode: Node | null = walker.nextNode();
    while (currentNode) {
        textNodes.push(currentNode as Text);
        currentNode = walker.nextNode();
    }

    return textNodes;
};

/**
 * 创建高亮批注
 */
const createHighlight = async () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    // 获取所有文本节点
    const textNodes = getTextNodesInRange(range);

    // 构建锚点信息
    const anchor: AnnotationAnchor[] = textNodes.map((node, index) => {
        const containerPath = getContainerPath(node.parentElement!);

        // 计算每个节点内的偏移
        let startOffset = 0;
        let endOffset = node.textContent?.length || 0;

        if (node === range.startContainer) {
            startOffset = range.startOffset;
        }
        if (node === range.endContainer) {
            endOffset = range.endOffset;
        }

        return {
            containerPath,
            textNodeIndex: getTextNodeIndex(node),
            startOffset,
            endOffset
        };
    });

    // 生成唯一批注 ID
    const annotationId = `anno-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 应用高亮到 DOM
    textNodes.forEach((textNode, index) => {
        const span = document.createElement('span');
        span.className = 'doc-highlight';
        span.dataset.annotationId = annotationId;
        span.dataset.groupId = annotationId;

        if (index === 0) span.id = annotationId;

        // 创建子范围
        const subRange = document.createRange();
        subRange.selectNodeContents(textNode);

        // 应用边界偏移
        if (textNode === range.startContainer) {
            subRange.setStart(textNode, range.startOffset);
        }
        if (textNode === range.endContainer) {
            subRange.setEnd(textNode, range.endOffset);
        }

        // 安全包装
        try {
            subRange.surroundContents(span);
        } catch (e) {
            console.warn('高亮包装失败，跳过该节点', e);
        }
    });

    // 添加点击事件
    const highlightSpans = document.querySelectorAll(`[data-group-id="${annotationId}"]`);
    highlightSpans.forEach(span => {
        (span as HTMLElement).onclick = (e) => {
            e.stopPropagation();
            emit('wakeNote', {
                annotationId,
                clickX: e.clientX,
                clickY: e.clientY
            });
        };
    });

    // 保存批注
    await addHighlightAnnotation(selectedText, anchor, annotationId);
};
```

### 关键要点

| 技巧 | 说明 |
|------|------|
| TreeWalker | 高效遍历 DOM 树的文本节点 |
| intersectsNode() | 精确判断节点是否在选区内 |
| surroundContents() | 简化 DOM 包装操作 |
| 子范围拆分 | 将大范围拆分为单节点范围 |
| data-group-id | 实现跨节点群组关联 |

---

## 2. 便签唤醒坐标计算

### 问题背景

点击高亮批注时，需要在其附近显示便签。便签位置需要考虑：
- 实际点击位置
- 视口坐标 vs 内容坐标
- 滚动位置
- 边界约束

### 思维链

```
1. 获取点击事件的 clientX/clientY（视口坐标）
2. 获取 viewer-pane 的边界矩形
3. 计算相对于 viewer-pane 的 X 坐标
4. 计算相对于 viewer-pane 内容的 Y 坐标（需要 + scrollTop）
5. 添加偏移量防止遮挡
6. 约束 X 坐标防止超出屏幕
```

### 代码实现

**文件**: `src/components/MainLayout.vue`

```typescript
/**
 * 唤醒便签（snap-back）
 * @param payload 包含 annotationId 和点击坐标
 */
const onWakeNote = async (payload: { annotationId: string; clickX: number; clickY: number }) => {
    const { annotationId, clickX, clickY } = payload;

    // 获取便签信息
    const anno = annotations.value.find(a => a.id === annotationId);
    if (!anno) return;

    // 获取 viewer-pane 容器
    const viewerPane = document.querySelector('.viewer-pane') as HTMLElement;
    if (!viewerPane) return;

    const viewerRect = viewerPane.getBoundingClientRect();

    // 偏移量：便签显示在点击位置右下方
    const offsetX = 15;
    const offsetY = 20;

    // X: 相对于 viewer-pane 左边缘
    const x = clickX - viewerRect.left + offsetX;

    // Y: 视口坐标 + scrollTop = 内容坐标
    const y = clickY - viewerRect.top + viewerPane.scrollTop + offsetY;

    // X 轴边界约束（防止便签超出屏幕）
    const maxX = window.innerWidth * 0.8 - anno.noteSize.width;
    const constrainedX = Math.max(0, Math.min(x, maxX));

    // 更新便签位置并显示
    await updateNotePosition(annotationId, constrainedX, y);
    await showNote(annotationId);
};
```

### 坐标转换图示

```
视口坐标 (clientX, clientY)
    ↓
viewerRect.left/top (容器边界)
    ↓
相对容器坐标 (x, y)
    ↓
+ scrollTop (滚动补偿)
    ↓
+ 偏移量 (offsetX, offsetY)
    ↓
边界约束
    ↓
最终位置
```

---

## 3. 便签拖动系统

### 问题背景

用户需要能够拖动便签到任意位置，同时需要：
- 记录初始位置
- 计算拖动差值
- 约束在可视区域内
- 实时保存位置

### 思维链

```
mousedown (开始拖动)
    ↓ 记录初始状态
    ├── 初始鼠标位置 (clientX, clientY)
    ├── 初始便签位置 (notePosition.x, y)
    └── 添加全局事件监听

mousemove (拖动中)
    ├── 计算差值 (dx = currentX - initialX)
    ├── 计算新位置 (newX = initialX + dx)
    └── 边界约束

mouseup (结束拖动)
    └── 移除事件监听
```

### 代码实现

**文件**: `src/components/StickyNote.vue`

```typescript
// 拖动状态
const isDragging = ref(false);
let initialMouseX = 0;
let initialMouseY = 0;
let initialContentX = 0;
let initialContentY = 0;

/**
 * 开始拖动
 */
const startDrag = (e: MouseEvent) => {
    emit('bringToTop', props.annotation.id);
    isDragging.value = true;

    // 记录初始状态
    initialMouseX = e.clientX;
    initialMouseY = e.clientY;
    initialContentX = props.annotation.notePosition.x;
    initialContentY = props.annotation.notePosition.y;

    // 添加全局事件
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
};

/**
 * 拖动中
 */
const onDrag = (e: MouseEvent) => {
    if (!isDragging.value) return;

    // 计算差值
    const offsetX = e.clientX - initialMouseX;
    const offsetY = e.clientY - initialMouseY;

    // 新位置 = 初始位置 + 差值
    let newX = initialContentX + offsetX;
    let newY = initialContentY + offsetY;

    // 获取 overlay 边界用于约束
    const overlayRect = noteRef.value?.parentElement?.getBoundingClientRect();
    const noteWidth = props.annotation.noteSize.width;

    if (overlayRect) {
        // X 轴约束
        const maxX = overlayRect.width - noteWidth;
        newX = Math.max(0, Math.min(newX, maxX));
        // Y 轴通常不需要约束（可滚动）
    }

    // 实时保存
    updateNotePosition(props.annotation.id, newX, newY);
};

/**
 * 结束拖动
 */
const stopDrag = () => {
    isDragging.value = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
};

// 清理
onUnmounted(() => {
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
});
```

---

## 4. SQLite 数据库架构

### 设计思路

- **用户表**：存储用户信息，支持多用户
- **文档表**：存储文档路径和内容，使用 checksum 检测变更
- **批注表**：存储批注数据，通过外键关联文档和用户
- **索引**：加速按文档和用户查询

### 代码实现

**文件**: `src-tauri/src/db.rs`

```rust
pub fn init_db() -> Result<Connection, String> {
    let conn = Connection::open(get_db_path())?;

    // 创建用户表
    conn.execute_batch(r#"
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at INTEGER
        );
    "#)?;

    // 创建文档表
    conn.execute_batch(r#"
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            path TEXT UNIQUE NOT NULL,
            content TEXT NOT NULL,
            checksum TEXT NOT NULL,
            last_modified INTEGER,
            created_at INTEGER
        );
    "#)?;

    // 创建批注表
    conn.execute_batch(r#"
        CREATE TABLE IF NOT EXISTS annotations (
            id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            user_name TEXT NOT NULL,
            text TEXT NOT NULL,
            note TEXT,
            note_visible INTEGER DEFAULT 0,
            note_position_x REAL DEFAULT 0,
            note_position_y REAL DEFAULT 0,
            note_width REAL DEFAULT 280,
            note_height REAL DEFAULT 180,
            highlight_color TEXT DEFAULT '#ffd700',
            highlight_type TEXT DEFAULT 'underline',
            anchor_data TEXT NOT NULL,
            created_at INTEGER,
            updated_at INTEGER,
            FOREIGN KEY (document_id) REFERENCES documents(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    "#)?;

    // 创建索引
    conn.execute_batch(r#"
        CREATE INDEX IF NOT EXISTS idx_annotations_doc ON annotations(document_id);
        CREATE INDEX IF NOT EXISTS idx_annotations_user ON annotations(user_id);
    "#)?;

    Ok(conn)
}
```

### ER 图

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│    users    │       │  documents  │       │ annotations │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │◄──────│ document_id │       │ id (PK)     │
│ name        │       │ path        │       │ document_id │────┐
│ created_at  │       │ content     │       │ user_id     │◄───┤
└─────────────┘       │ checksum    │       │ text        │    │
                      │ created_at  │       │ anchor_data │    │
                      └─────────────┘       │ ...         │    │
                                            └─────────────┘    │
                                                           │─┘
                                              FOREIGN KEY ─┘
```

---

## 5. 防抖保存机制

### 问题背景

便签拖动、位置调整等操作会频繁触发保存，直接写入磁盘会影响性能。

### 解决方案

使用防抖（debounce）延迟保存，500ms 内重复触发只保留最后一次。

### 代码实现

**文件**: `src/composables/useAnnotations.ts`

```typescript
// 防抖配置
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
const SAVE_DEBOUNCE_MS = 500;

/**
 * 防抖保存批注
 */
const saveAnnotations = async () => {
    if (!currentDocId) return;

    // 如果已有计时器，清除它
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }

    // 设置新的计时器
    saveTimeout = setTimeout(async () => {
        try {
            const records = annotations.value.map(anno => annotationToRecord(anno, currentDocId!));
            const json = JSON.stringify(records, null, 2);
            await invoke('write_file_content', {
                path: getAnnotationPath(currentDocPath!),
                content: json
            });
            console.log('批注已保存');
        } catch (e) {
            console.error('保存批注失败:', e);
        } finally {
            saveTimeout = null;
        }
    }, SAVE_DEBOUNCE_MS);
};

// 每次状态变更后调用
const updateNotePosition = async (id: string, x: number, y: number) => {
    const index = annotations.value.findIndex(a => a.id === id);
    if (index === -1) return false;

    annotations.value[index].notePosition = { x, y };
    await saveAnnotations(); // 防抖保存
    return true;
};
```

### 时序图

```
拖动事件 → updateNotePosition → saveAnnotations
    │            │
    │            └── [清除旧计时器]
    │            └── [设置新计时器 500ms]
    │
拖动事件 → updateNotePosition → saveAnnotations
    │            │
    │            └── [清除旧计时器]
    │            └── [设置新计时器 500ms]
    │
    ... (等待 500ms 无新事件)
    │
    └──→ 执行实际保存
```

---

## 6. 导入去重策略

### 问题背景

导入批注时，同一批注可能被重复导入多次。

### 解决方案

基于批注文本内容进行去重，只导入不重复的批注。

### 代码实现

**文件**: `src-tauri/src/db.rs`

```rust
pub fn merge_imported_annotations(
    conn: &Connection,
    annotations: &[AnnotationRecord],
    doc_id: &str
) -> Result<usize, String> {
    let mut imported_count = 0;
    let now = Utc::now().timestamp_millis();

    // 获取现有的批注文本集合
    let existing_texts: std::collections::HashSet<String> = {
        let mut stmt = conn.prepare("SELECT text FROM annotations WHERE document_id = ?")?;
        let mut rows = stmt.query([doc_id])?;
        let mut texts = std::collections::HashSet::new();

        while let Ok(Some(row)) = rows.next() {
            if let Ok(text) = row.get::<_, String>(0) {
                texts.insert(text);
            }
        }
        texts
    };

    for mut anno in annotations.iter().cloned() {
        // 去重：检查文本是否已存在
        if existing_texts.contains(&anno.text) {
            continue; // 跳过重复
        }

        // 生成新 ID，避免冲突
        anno.id = Uuid::new_v4().to_string();
        anno.document_id = doc_id.to_string();
        anno.created_at = now;
        anno.updated_at = now;

        add_annotation(conn, &anno)?;
        imported_count += 1;
    }

    Ok(imported_count)
}
```

---

## 7. HTML 导出高亮渲染

### 问题背景

导出包含高亮的 HTML 时，需要将存储的锚点信息重新应用到 DOM。

### 解决方案

根据锚点中的 containerPath 和 textNodeIndex 定位文本节点，然后使用 surroundContents() 应用高亮。

### 代码实现

**文件**: `src/composables/useAnnotations.ts`

```typescript
/**
 * 将高亮应用到 DOM（用于 HTML 导出）
 */
const applyHighlightsToDom = (container: HTMLElement, anno: Annotation) => {
    if (!anno.anchor || anno.anchor.length === 0) return;

    for (const anchor of anno.anchor) {
        // 定位父元素
        const parentEl = container.querySelector<HTMLElement>(anchor.containerPath);
        if (!parentEl) {
            console.warn('找不到锚点容器:', anchor.containerPath);
            continue;
        }

        // 定位文本节点
        let textNode: Node | null = null;
        let currentNode: Node | null = parentEl.firstChild;
        let currentIndex = 0;

        while (currentNode) {
            if (currentNode.nodeType === Node.TEXT_NODE) {
                if (currentIndex === anchor.textNodeIndex) {
                    textNode = currentNode;
                    break;
                }
                currentIndex++;
            }
            currentNode = currentNode.nextSibling;
        }

        if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
            console.warn('找不到锚点文本节点:', anchor);
            continue;
        }

        // 创建高亮范围
        const range = document.createRange();
        const textContent = textNode.textContent || '';

        // 安全边界检查
        const safeStart = Math.min(anchor.startOffset, textContent.length);
        const safeEnd = Math.min(anchor.endOffset, textContent.length);

        range.setStart(textNode, safeStart);
        range.setEnd(textNode, safeEnd);

        // 创建高亮元素
        const span = document.createElement('span');
        span.className = 'doc-highlight';
        span.dataset.annoId = anno.id;
        span.style.backgroundColor = `${anno.highlightColor}4d`;

        if (anno.highlightType === 'underline') {
            span.style.borderBottom = `2px solid ${anno.highlightColor}`;
        }

        // 应用高亮
        try {
            range.surroundContents(span);
        } catch (e) {
            console.warn('高亮 span 失败:', e);
            // 范围跨越多个节点时的降级处理
        }
    }
};
```

---

## 8. CJK 字符宽度计算

### 问题背景

Fixed 模式下需要精确计算字符宽度以实现等宽对齐。CJK 字符通常占用两个 ASCII 字符的宽度。

### 解决方案

定义字符宽度映射表，渲染时累加宽度判断换行。

### 代码实现

**文件**: `src/utils/typographyRenderer.ts`

```typescript
/**
 * CJK 字符宽度配置
 */
const CJK_WIDTH = 1.0;      // CJK 字符宽度
const NON_CJK_WIDTH = 0.5;  // 非 CJK 字符宽度

/**
 * CJK 语言检测配置
 */
interface CjkDetection {
    include_chinese: boolean;
    include_japanese: boolean;
    include_korean: boolean;
    include_cjk_punctuation: boolean;
}

/**
 * 字符宽度检测函数
 */
function isCjkChar(char: string, detection: CjkDetection): boolean {
    const code = char.charCodeAt(0);

    // 中文
    if (detection.include_chinese) {
        if ((code >= 0x4E00 && code <= 0x9FFF) ||   // 常用汉字
            (code >= 0x3400 && code <= 0x4DBF) ||   // 扩展 A
            (code >= 0x20000 && code <= 0x2A6DF) || // 扩展 B
            (code >= 0x2A700 && code <= 0x2B73F) || // 扩展 C
            (code >= 0x2B740 && code <= 0x2B81F) || // 扩展 D
            (code >= 0x2B820 && code <= 0x2CEAF) || // 扩展 E
            (code >= 0x2CEB0 && code <= 0x2EBEF)) { // 扩展 F
            return true;
        }
    }

    // 日文
    if (detection.include_japanese) {
        if ((code >= 0x3040 && code <= 0x309F) ||   // 平假名
            (code >= 0x30A0 && code <= 0x30FF) ||   // 片假名
            (code >= 0x3200 && code <= 0x32FF)) {   // 假名补充
            return true;
        }
    }

    // 韩文
    if (detection.include_korean) {
        if ((code >= 0xAC00 && code <= 0xD7AF) ||   // 音节
            (code >= 0x1100 && code <= 0x11FF) ||   // 谚文jam
            (code >= 0x3130 && code <= 0x318F)) {   // 兼容韩文
            return true;
        }
    }

    // CJK 标点
    if (detection.include_cjk_punctuation) {
        if ((code >= 0x3000 && code <= 0x303F) ||   // CJK 标点
            (code >= 0xFF00 && code <= 0xFFEF)) {   // 全角ASCII
            return true;
        }
    }

    return false;
}

/**
 * 计算字符串的视觉宽度
 */
function calculateVisualWidth(text: string, detection: CjkDetection): number {
    let width = 0;
    for (const char of text) {
        if (isCjkChar(char, detection)) {
            width += CJK_WIDTH;
        } else {
            width += NON_CJK_WIDTH;
        }
    }
    return width;
}

/**
 * Fixed 模式文本渲染器
 */
export class TypographyRenderer {
    private options: FixedPreset;

    constructor(options: FixedPreset) {
        this.options = options;
    }

    /**
     * 渲染单行文本
     */
    renderLine(text: string, lineNumber: number): RenderedLine {
        const detection = this.options.cjk_detection;

        // Tab 展开
        let expanded = this.expandTabs(text);

        // 转义 HTML（可选）
        if (this.options.escape_html) {
            expanded = escapeHtml(expanded);
        }

        // 计算视觉宽度
        const visualWidth = calculateVisualWidth(expanded, detection);

        // 截断或填充到固定宽度
        const visualText = this.constrainToWidth(expanded, detection);

        // 生成行号
        const lineNumberStr = this.options.show_line_numbers
            ? this.formatLineNumber(lineNumber)
            : '';

        return {
            text: visualText,
            visualWidth,
            lineNumber: lineNumberStr
        };
    }

    /**
     * 展开 Tab 为空格
     */
    private expandTabs(text: string): string {
        const tabSize = this.options.tab_size;
        return text.replace(/\t/g, ' '.repeat(tabSize));
    }

    /**
     * 约束到固定宽度
     */
    private constrainToWidth(text: string, detection: CjkDetection): string {
        const maxWidth = this.options.line_width;
        let currentWidth = 0;
        let result = '';

        for (const char of text) {
            const charWidth = isCjkChar(char, detection) ? CJK_WIDTH : NON_CJK_WIDTH;

            if (currentWidth + charWidth > maxWidth) {
                break; // 超出宽度，截断
            }

            result += char;
            currentWidth += charWidth;
        }

        // 填充空格到固定宽度
        while (currentWidth < maxWidth) {
            result += ' ';
            currentWidth += NON_CJK_WIDTH;
        }

        return result;
    }
}
```

---

## 9. 主题切换系统

### 问题背景

支持亮色/暗色主题切换，所有组件的颜色需要一致响应。

### 解决方案

使用 CSS 变量定义颜色，通过切换 body 的类名切换主题。

### 代码实现

**文件**: `src/composables/useTheme.ts`

```typescript
import { ref, computed, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { ThemeMode } from '@/types/theme';

// 状态
const theme = ref<ThemeMode>('light');
const isLoading = ref(false);

// 计算属性
export function useTheme() {
    const isDark = computed(() => theme.value === 'dark');

    /**
     * 加载主题
     */
    const loadTheme = async () => {
        isLoading.value = true;

        try {
            const settingsJson = await invoke<string | null>('load_ui_settings');
            if (settingsJson) {
                const settings = JSON.parse(settingsJson);
                theme.value = settings.theme || 'light';
            } else {
                theme.value = 'light';
            }

            applyTheme();
        } catch (err) {
            console.error('加载主题失败:', err);
            theme.value = 'light';
            applyTheme();
        } finally {
            isLoading.value = false;
        }
    };

    /**
     * 保存主题
     */
    const saveTheme = async () => {
        try {
            let settings = { theme: theme.value };
            const existingJson = await invoke<string | null>('load_ui_settings');
            if (existingJson) {
                const existing = JSON.parse(existingJson);
                settings = { ...existing, theme: theme.value };
            }

            await invoke('save_ui_settings', { settingsJson: JSON.stringify(settings) });
        } catch (err) {
            console.error('保存主题失败:', err);
        }
    };

    /**
     * 切换主题
     */
    const toggleTheme = async () => {
        theme.value = theme.value === 'light' ? 'dark' : 'light';
        applyTheme();
        await saveTheme();
    };

    /**
     * 应用主题到 DOM
     */
    const applyTheme = () => {
        if (typeof document === 'undefined') return;

        // 移除现有主题类
        document.documentElement.classList.remove('light-theme', 'dark-theme');

        // 添加当前主题类
        document.documentElement.classList.add(`${theme.value}-theme`);
    };

    // 初始化
    onMounted(() => {
        loadTheme();
    });

    return {
        theme,
        isDark,
        isLoading,
        loadTheme,
        saveTheme,
        toggleTheme,
        applyTheme
    };
}
```

**CSS 变量定义** (`src/styles/theme-dark.css`):

```css
:root,
.light-theme {
    /* 背景色 */
    --bg-primary: #ffffff;
    --bg-secondary: #f5f5f5;
    --bg-tertiary: #e0e0e0;

    /* 文本色 */
    --text-primary: #333333;
    --text-secondary: #666666;

    /* 边框色 */
    --border-color: #dddddd;

    /* 强调色 */
    --accent: #646cff;
}

.dark-theme {
    /* 背景色 */
    --bg-primary: #1a1a1a;
    --bg-secondary: #2a2a2a;
    --bg-tertiary: #333333;

    /* 文本色 */
    --text-primary: #e0e0e0;
    --text-secondary: #999999;

    /* 边框色 */
    --border-color: #444444;

    /* 强调色 */
    --accent: #646cff;
}
```

### 使用示例

```vue
<script setup lang="ts">
import { useTheme } from '@/composables/useTheme';

const { isDark, toggleTheme } = useTheme();
</script>

<template>
    <div class="app" :class="{ 'dark-mode': isDark }">
        <button @click="toggleTheme">
            {{ isDark ? '切换到亮色' : '切换到暗色' }}
        </button>

        <div class="card">
            <!-- 自动应用当前主题的颜色 -->
            <p style="color: var(--text-primary)">
                这段文字会自动适应主题
            </p>
        </div>
    </div>
</template>
```

---

## 总结

| 算法 | 复杂度 | 应用场景 |
|------|--------|----------|
| 跨节点高亮 | O(n) | 文本批注 |
| 便签坐标计算 | O(1) | UI 定位 |
| 拖动系统 | O(1) | UI 交互 |
| SQLite 架构 | - | 数据持久化 |
| 防抖保存 | O(1) | 性能优化 |
| 导入去重 | O(n) | 数据导入 |
| HTML 导出 | O(n) | 文档导出 |
| CJK 宽度 | O(n) | 文本渲染 |
| 主题切换 | O(1) | UI 定制 |

---

*文档创建日期: 2026-01-13*
