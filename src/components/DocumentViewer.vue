<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { marked } from "marked";
import { useAnnotations } from "../composables/useAnnotations";
import { useDocument } from "../composables/useDocument";
import { useTypography } from "../composables/useTypography";
import { createRendererFromPreset } from "../utils/typographyRenderer";
import TextViewer from "./TextViewer.vue";
import CreateAnnotationDialog from "./CreateAnnotationDialog.vue";
import type { Annotation, AnnotationAnchor } from "../types";
import type { RenderedLine } from "../utils/typographyRenderer";

const emit = defineEmits<{
    (e: "wakeNote", payload: { annotationId: string; clickX: number; clickY: number }): void;
}>();

const props = defineProps<{
    content: string;
}>();

const { annotations, updateAnnotation } = useAnnotations();
const { addHighlightAnnotation } = useDocument();
const { config, isFixedMode, fixedPreset } = useTypography();

const containerRef = ref<HTMLElement | null>(null);

// 标记是否正在恢复高亮（避免触发新的保存）
const isRestoring = ref(false);

// Typography renderer for fixed mode
const typographyRenderer = computed(() => {
    if (isFixedMode.value && !config.value.use_css_override) {
        return createRendererFromPreset(fixedPreset.value);
    }
    return null;
});

// Fixed mode rendered lines
const fixedLines = ref<RenderedLine[]>([]);

// Annotation dialog state
const showAnnotationDialog = ref(false);
const annotationDialogData = ref({
    selectedText: '',
    anchors: [] as AnnotationAnchor[],
    annotationId: '',
});

// Fixed highlight color
const HIGHLIGHT_COLOR = '#ffd700';

// Open annotation dialog
const openAnnotationDialog = (
    text: string,
    anchors: AnnotationAnchor[],
    id: string,
    _color: string
) => {
    annotationDialogData.value = {
        selectedText: text,
        anchors,
        annotationId: id,
    };
    showAnnotationDialog.value = true;
};

// Handle annotation confirmation
const handleAnnotationConfirm = async (data: { note: string; color: string }) => {
    const { selectedText, anchors, annotationId } = annotationDialogData.value;

    // Save to database with fixed color
    await addHighlightAnnotation(
        selectedText,
        anchors,
        annotationId,
        HIGHLIGHT_COLOR,
        'underline'
    );

    // If note provided, update
    if (data.note.trim()) {
        await updateAnnotation(annotationId, { note: data.note.trim() });
    }

    showAnnotationDialog.value = false;
};

// Handle annotation cancel
const handleAnnotationCancel = () => {
    // Remove the highlight spans if cancelled
    const container = containerRef.value;
    if (container) {
        const highlights = container.querySelectorAll(`[data-group-id="${annotationDialogData.value.annotationId}"]`);
        highlights.forEach((node) => {
            const span = node as HTMLElement;
            const parent = span.parentNode;
            if (parent) {
                const text = document.createTextNode(span.textContent || "");
                parent.replaceChild(text, span);
            }
        });
    }
    showAnnotationDialog.value = false;
};

// Watch content and preset changes to update rendering
watch(
    () => [props.content, config.value.preset, config.value.use_css_override, fixedPreset.value],
    () => {
        if (isFixedMode.value && !config.value.use_css_override && typographyRenderer.value) {
            fixedLines.value = typographyRenderer.value.render(props.content);
        } else {
            fixedLines.value = [];
        }
    },
    { immediate: true, deep: true }
);

// 渲染 Markdown (original preset)
const renderedContent = computed(() => {
    if (isFixedMode.value) {
        return '';
    }
    // Configure marked with original preset settings
    const markedOptions = {
        breaks: true,
        gfm: true,
    };
    return marked.parse(props.content, markedOptions);
});

// Container class based on typography mode
const containerClass = computed(() => {
    if (config.value.use_css_override) {
        return 'typography-css-override';
    }
    return `typography-${config.value.preset}`;
});

// Whether to show original markdown content
const showMarkdown = computed(() => !isFixedMode.value || config.value.use_css_override);

// Whether to show fixed text content
const showFixedText = computed(() => isFixedMode.value && !config.value.use_css_override);

// --- 生成父元素的 CSS 选择器路径 ---
const generateContainerPath = (node: Node): string => {
    const path: string[] = [];
    let current: Node | null = node;

    while (current && current !== containerRef.value) {
        if (current.nodeType === Node.ELEMENT_NODE) {
            const el = current as Element;

            // 如果元素有 ID，使用 ID 选择器（最快）
            if (el.id) {
                path.unshift(`#${el.id}`);
                break;
            }

            // 如果元素有 class，使用 class 选择器
            if (el.className && typeof el.className === 'string' && el.className.trim()) {
                path.unshift(el.className.trim().split(/\s+/).join('.'));
            } else {
                // 使用标签名 + 索引
                let index = 1;
                let sibling = current.previousSibling;
                while (sibling) {
                    if (sibling.nodeType === Node.ELEMENT_NODE) {
                        const sibEl = sibling as Element;
                        if (sibEl.tagName === (current as Element).tagName) {
                            index++;
                        }
                    }
                    sibling = sibling.previousSibling;
                }
                const tag = el.tagName.toLowerCase();
                path.unshift(`${tag}:nth-of-type(${index})`);
            }
        }
        current = current.parentNode;
    }

    // 加上容器选择器
    if (containerRef.value) {
        path.unshift('.markdown-body');
    }

    return path.join(' > ');
};

// --- 获取文本节点在父元素中的索引 ---
const getTextNodeIndex = (textNode: Text): number => {
    const parent = textNode.parentElement;
    if (!parent) return 0;

    let index = 0;
    let sibling: Node | null = parent.firstChild;

    while (sibling) {
        if (sibling.nodeType === Node.TEXT_NODE) {
            if (sibling === textNode) {
                return index;
            }
            index++;
        }
        sibling = sibling.nextSibling;
    }

    return 0;
};

// --- 暴露给父组件的方法 ---

// 1. 执行跨段落高亮并保存数据
const handleHighlight = async () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed)
        return;

    const range = selection.getRangeAt(0);
    const text = selection.toString();
    const annotationId = `anno-${Date.now()}`;

    // 获取所有受影响的文本节点
    const textNodes = getTextNodesInRange(range);

    if (textNodes.length === 0) return;

    // 为每个文本节点创建 anchor 并高亮
    const anchors: AnnotationAnchor[] = [];

    textNodes.forEach((textNode, index) => {
        // 计算这个节点的子范围
        const subRange = document.createRange();
        subRange.selectNodeContents(textNode);

        // 处理边界情况
        if (textNode === range.startContainer) {
            subRange.setStart(textNode, range.startOffset);
        }
        if (textNode === range.endContainer) {
            subRange.setEnd(textNode, range.endOffset);
        }

        // 生成父元素路径和文本节点索引
        const containerPath = generateContainerPath(textNode);
        const textNodeIndex = getTextNodeIndex(textNode);

        // 保存 anchor 信息
        const anchor: AnnotationAnchor = {
            containerPath,
            textNodeIndex,
            startOffset: subRange.startOffset,
            endOffset: subRange.endOffset
        };
        anchors.push(anchor);

        // 创建高亮包裹元素
        const span = document.createElement("span");
        span.className = "doc-highlight";
        span.style.backgroundColor = "rgba(255, 215, 0, 0.3)";
        span.style.cursor = "pointer";
        span.style.borderBottom = "2px solid var(--accent, gold)";
        span.dataset.groupId = annotationId;
        span.onclick = (e) => {
            e.stopPropagation();
            emit("wakeNote", { annotationId, clickX: e.clientX, clickY: e.clientY });
        };

        if (index === 0) {
            span.id = annotationId;
        }

        try {
            subRange.surroundContents(span);
        } catch (e) {
            console.error("Highlight error on node", textNode, e);
        }
    });

    // 打开注释对话框（不再使用 prompt）
    openAnnotationDialog(text, anchors, annotationId, HIGHLIGHT_COLOR);

    // 清空选择
    selection.removeAllRanges();
};

// 获取 Range 内的所有文本节点
const getTextNodesInRange = (range: Range): Text[] => {
    const textNodes: Text[] = [];
    const root = range.commonAncestorContainer;

    if (root.nodeType === Node.TEXT_NODE) {
        if (range.intersectsNode(root)) {
            return [root as Text];
        }
        return [];
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
            // 过滤空白文本节点（仅包含空格、换行符、制表符）
            const textContent = (node as Text).textContent || '';
            if (/^\s*$/.test(textContent)) {
                return NodeFilter.FILTER_REJECT;
            }
            return range.intersectsNode(node)
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_REJECT;
        },
    });

    let currentNode: Node | null;
    while ((currentNode = walker.nextNode())) {
        textNodes.push(currentNode as Text);
    }
    return textNodes;
};

// 2. 定位到指定的高亮元素
const scrollToHighlight = (domId: string) => {
    const el = document.getElementById(domId);
    if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });

        const group = document.querySelectorAll(`[data-group-id="${domId}"]`);

        group.forEach((node) => {
            const htmlNode = node as HTMLElement;
            const originalBg = htmlNode.style.backgroundColor;

            htmlNode.style.transition = "background 0.3s";
            htmlNode.style.backgroundColor = "rgba(255, 100, 100, 0.5)";

            setTimeout(() => {
                htmlNode.style.backgroundColor = originalBg;
            }, 500);
        });
    }
};

// 3. 恢复高亮（使用 anchor 信息）
const restoreHighlights = async () => {
    const container = containerRef.value;
    if (!container || container.children.length === 0) return;

    if (annotations.value.length === 0) return;

    isRestoring.value = true;

    try {
        for (const anno of annotations.value) {
            await applyHighlight(anno);
        }
    } finally {
        isRestoring.value = false;
    }
};

// 根据 anchor 恢复单个高亮
const applyHighlight = async (anno: Annotation) => {
    const container = containerRef.value;
    if (!container || !anno.anchor) return;

    const anchors = anno.anchor;

    for (let i = 0; i < anchors.length; i++) {
        const anchor = anchors[i];
        if (!restoreSingleHighlight(container, anchor, anno.id, i === 0, anno)) {
            console.warn(`无法恢复片段 ${i} for annotation:`, anno.id);
        }
    }
};

// 恢复单个高亮片段
const restoreSingleHighlight = (
    container: HTMLElement,
    anchor: AnnotationAnchor,
    groupId: string,
    isFirst: boolean,
    anno?: Annotation
): boolean => {
    try {
        // 通过选择器找到父元素
        const parentEl = container.querySelector(anchor.containerPath);
        if (!parentEl) {
            console.warn('找不到父元素:', anchor.containerPath);
            return false;
        }

        // 找到指定索引的文本节点
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
            console.warn('找不到文本节点, index:', anchor.textNodeIndex);
            return false;
        }

        // 创建范围并高亮
        const range = document.createRange();
        range.setStart(textNode, anchor.startOffset);
        range.setEnd(textNode, Math.min(anchor.endOffset, textNode.textContent?.length || 0));

        // 创建高亮元素
        const span = document.createElement("span");
        span.className = "doc-highlight";
        span.style.backgroundColor = anno?.highlightColor ? `${anno.highlightColor}4d` : "rgba(255, 215, 0, 0.3)";
        span.style.cursor = "pointer";
        if (anno?.highlightType === 'underline' || !anno) {
            span.style.borderBottom = "2px solid gold";
        }
        span.dataset.groupId = groupId;
        span.onclick = (e) => {
            e.stopPropagation();
            emit("wakeNote", { annotationId: groupId, clickX: e.clientX, clickY: e.clientY });
        };

        if (isFirst) {
            span.id = groupId;
        }

        range.surroundContents(span);
        return true;

    } catch (e) {
        console.error('恢复高亮失败:', e);
        return false;
    }
};

// 4. 移除高亮（删除批注时调用）
const removeHighlight = (groupId: string) => {
    const container = containerRef.value;
    if (!container) return;

    const highlights = container.querySelectorAll(`[data-group-id="${groupId}"]`);
    highlights.forEach((node) => {
        const span = node as HTMLElement;
        const parent = span.parentNode;
        if (parent) {
            // 将 span 的内容替换为文本节点
            const text = document.createTextNode(span.textContent || "");
            parent.replaceChild(text, span);
            // 清理相邻的重复文本节点
            mergeWithSiblings(parent);
        }
    });
};

// 合并相邻的文本节点
const mergeWithSiblings = (node: Node) => {
    const parent = node.parentNode;
    if (!parent) return;

    let current = node.nextSibling;
    while (current && current.nodeType === Node.TEXT_NODE) {
        const textNode = node as Text;
        const siblingText = current as Text;
        textNode.textContent = (textNode.textContent || "") + (siblingText.textContent || "");
        parent.removeChild(siblingText);
        current = node.nextSibling;
    }
};

defineExpose({
    handleHighlight,
    scrollToHighlight,
    restoreHighlights,
    removeHighlight,
});
</script>

<template>
    <div class="document-viewer" :class="containerClass">
        <!-- Original Markdown Rendering -->
        <div
            v-if="showMarkdown"
            ref="containerRef"
            class="document-content markdown-body"
            v-html="renderedContent"></div>

        <!-- Fixed Text Rendering -->
        <TextViewer
            v-if="showFixedText"
            :lines="fixedLines"
            :show-line-numbers="fixedPreset.show_line_numbers"
            class="document-content text-body"
        />

        <!-- Create Annotation Dialog -->
        <CreateAnnotationDialog
            :visible="showAnnotationDialog"
            :selected-text="annotationDialogData.selectedText"
            @confirm="handleAnnotationConfirm"
            @cancel="handleAnnotationCancel"
        />
    </div>
</template>

<style scoped>
.document-viewer {
    width: 100%;
    height: 100%;
}

.markdown-body {
    padding: 40px;
    line-height: 1.8;
    font-size: 1.1rem;
    color: var(--text-primary, #e0e0e0);
    max-width: 900px;
    margin: 0 auto;
}

.text-body {
    width: 100%;
}

:deep(h1),
:deep(h2) {
    border-bottom: 1px solid var(--border, #444);
    padding-bottom: 0.3em;
}
</style>
