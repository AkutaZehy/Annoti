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

// --- 暴露给父组件的方法 ---

// 1. 执行高亮并保存数据
const handleHighlight = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed)
        return;

    const range = selection.getRangeAt(0);
    const text = selection.toString();

    // 生成唯一的 DOM ID 用于后续定位
    const domId = `highlight-${Date.now()}`;

    // 创建高亮元素 span
    const span = document.createElement("span");
    span.id = domId;
    span.className = "doc-highlight";
    span.style.backgroundColor = "rgba(255, 215, 0, 0.3)";
    span.style.cursor = "pointer";
    span.style.borderBottom = "2px solid gold";

    try {
        // 简单实现：使用 surroundContents (注意：跨标签选择会报错，MVP暂不处理复杂情况)
        range.surroundContents(span);

        // 调用逻辑层保存数据
        addAnnotation(text, domId);

        // 清除选中状态
        selection.removeAllRanges();
    } catch (e) {
        console.warn("跨段落选择暂不支持", e);
        alert("MVP限制：请勿跨段落选择文本");
    }
};

// 2. 定位到指定的高亮元素
const scrollToHighlight = (domId: string) => {
    const el = document.getElementById(domId);
    if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // 添加闪烁动画
        el.style.transition = "background 0.5s";
        const originalBg = el.style.backgroundColor;
        el.style.backgroundColor = "rgba(255, 255, 255, 0.8)";
        setTimeout(() => {
            el.style.backgroundColor = originalBg;
        }, 500);
    }
};

// 暴露方法给父组件调用
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
.markdown-body {
    padding: 40px;
    line-height: 1.8;
    font-size: 1.1rem;
    color: #e0e0e0;
    max-width: 900px;
    margin: 0 auto;
}
/* 样式穿透：针对v-html渲染出来的内容 */
:deep(h1),
:deep(h2) {
    border-bottom: 1px solid #444;
    padding-bottom: 0.3em;
}
</style>
