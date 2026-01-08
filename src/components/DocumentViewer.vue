<script setup lang="ts">
import { ref, computed } from "vue";
import { marked } from "marked";
import { useAnnotations } from "../composables/useAnnotations";

const props = defineProps<{
    content: string;
}>();

const { addAnnotation } = useAnnotations();
const containerRef = ref<HTMLElement | null>(null);

// 渲染 Markdown
const renderedContent = computed(() => marked(props.content));

// --- 核心工具函数：获取Range内的所有文本节点 ---
// 这是一个递归查找的过程，专门找出那些真正包含文字的节点
const getTextNodesInRange = (range: Range): Text[] => {
    const textNodes: Text[] = [];

    // 创建一个 TreeWalker，专门只看文本节点 (SHOW_TEXT)
    // root 设置为 range.commonAncestorContainer，即选区的最小公共父节点
    const root = range.commonAncestorContainer;

    // 如果公共父节点本身就是文本节点（即选区在同一个纯文本节点内）
    if (root.nodeType === Node.TEXT_NODE) {
        // 只有当这个文本节点真正和Range有交集时才返回
        if (range.intersectsNode(root)) {
            return [root as Text];
        }
        return [];
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
            // 关键逻辑：判断这个节点是否在 Range 范围内
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

// --- 暴露给父组件的方法 ---

// 1. 执行跨段落高亮并保存数据
const handleHighlight = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed)
        return;

    const range = selection.getRangeAt(0);
    const text = selection.toString(); // 获取纯文本内容
    const annotationId = `anno-${Date.now()}`; // 生成唯一业务ID

    // 获取所有受影响的文本节点
    const textNodes = getTextNodesInRange(range);

    if (textNodes.length === 0) return;

    // 倒序处理：修改 DOM 时最好从后往前，以免索引变化影响前面的节点
    // 但对于 wrap 操作，顺序其实影响不大，为了逻辑清晰，我们按顺序处理
    textNodes.forEach((textNode, index) => {
        // 创建一个新的 Range 用于处理当前这个单独的文本节点
        const subRange = document.createRange();
        subRange.selectNodeContents(textNode);

        // 处理边界情况：
        // 如果是选区的第一个节点，开始位置要遵循原 Range 的 startOffset
        if (textNode === range.startContainer) {
            subRange.setStart(textNode, range.startOffset);
        }
        // 如果是选区的最后一个节点，结束位置要遵循原 Range 的 endOffset
        if (textNode === range.endContainer) {
            subRange.setEnd(textNode, range.endOffset);
        }

        // 创建高亮包裹元素
        const span = document.createElement("span");
        span.className = "doc-highlight";
        span.style.backgroundColor = "rgba(255, 215, 0, 0.3)";
        span.style.cursor = "pointer";
        span.style.borderBottom = "2px solid gold";

        // 给所有片段加上相同的 data-id，方便后续可能的高级操作（如鼠标悬停高亮一组）
        span.dataset.groupId = annotationId;

        // 只有第一个片段会被赋予 ID，用于 scrollIntoView 定位
        if (index === 0) {
            span.id = annotationId;
        }

        try {
            // 现在的 subRange 保证只在一个文本节点内，surroundContents 安全了
            subRange.surroundContents(span);
        } catch (e) {
            console.error("Highlight error on node", textNode, e);
        }
    });

    // 保存数据
    // 注意：domId 我们存的是 annotationId，它对应的是第一个 span 的 id
    addAnnotation(text, annotationId);

    // 清除选中状态
    selection.removeAllRanges();
};

// 2. 定位到指定的高亮元素 (逻辑不变，因为我们给第一个span设置了ID)
const scrollToHighlight = (domId: string) => {
    const el = document.getElementById(domId);
    if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });

        // 视觉反馈：我们可以通过 dataset.groupId 找到同组的所有片段一起闪烁
        const group = document.querySelectorAll(`[data-group-id="${domId}"]`);

        group.forEach((node) => {
            const htmlNode = node as HTMLElement;
            const originalBg = htmlNode.style.backgroundColor;

            htmlNode.style.transition = "background 0.3s";
            htmlNode.style.backgroundColor = "rgba(255, 100, 100, 0.5)"; // 红色闪烁

            setTimeout(() => {
                htmlNode.style.backgroundColor = originalBg;
            }, 500);
        });
    }
};

defineExpose({
    handleHighlight,
    scrollToHighlight,
});
</script>

<template>
    <div
        ref="containerRef"
        class="markdown-body"
        v-html="renderedContent"></div>
</template>

<style scoped>
/* 保持原有样式不变 */
.markdown-body {
    padding: 40px;
    line-height: 1.8;
    font-size: 1.1rem;
    color: #e0e0e0;
    max-width: 900px;
    margin: 0 auto;
}
:deep(h1),
:deep(h2) {
    border-bottom: 1px solid #444;
    padding-bottom: 0.3em;
}
</style>
