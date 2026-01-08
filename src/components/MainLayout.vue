<script setup lang="ts">
import { ref } from "vue";
import DocumentViewer from "./DocumentViewer.vue";
import AnnotationList from "./AnnotationList.vue";

// 硬编码的 Markdown 内容 (MVP)
const mdx = `
# 示例：Tauri 批注阅读器

这是一个 **MVP (Minimum Viable Product)** 演示。

## 功能演示
1. **文本渲染**：Markdown 解析为 HTML。
2. **划线高亮**：选中一段文字，点击上方"添加批注"。
3. **双向定位**：点击右侧卡片，左侧自动滚动。

## 测试文本
Rust 是一门赋予每个人构建可靠且高效软件能力的语言。
Tauri 是一个构建所有主要桌面平台的小型、快速二进制文件的框架。
Vue (读音 /vjuː/，类似于 view) 是一套用于构建用户界面的渐进式框架。
`;

// 引用子组件实例，以便调用其方法
const viewerRef = ref<InstanceType<typeof DocumentViewer> | null>(null);

// 处理顶部按钮点击
const onAddClick = () => {
    viewerRef.value?.handleHighlight();
};

// 处理侧边栏点击定位
const onLocateRequest = (domId: string) => {
    viewerRef.value?.scrollToHighlight(domId);
};
</script>

<template>
    <div class="layout">
        <!-- 顶部栏 -->
        <header class="header">
            <div class="brand">Read & Note</div>
            <button class="btn-primary" @click="onAddClick">+ 添加批注</button>
        </header>

        <!-- 主体内容 (Flex 布局) -->
        <main class="content-wrapper">
            <!-- 左侧：阅读器 (Flex 2) -->
            <section class="pane reader-pane">
                <DocumentViewer ref="viewerRef" :content="mdx" />
            </section>

            <!-- 右侧：批注列表 (Flex 1) -->
            <aside class="pane sidebar-pane">
                <AnnotationList @locate="onLocateRequest" />
            </aside>
        </main>
    </div>
</template>

<style scoped>
.layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
}

.header {
    height: 60px;
    background: #1a1a1a;
    border-bottom: 1px solid #333;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    flex-shrink: 0;
}

.brand {
    font-weight: bold;
    font-size: 1.2rem;
}

.btn-primary {
    background: #646cff;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
}
.btn-primary:hover {
    background: #535bf2;
}

.content-wrapper {
    display: flex;
    flex: 1;
    overflow: hidden; /* 内容区域内部滚动，容器不滚动 */
}

.pane {
    overflow-y: auto;
    height: 100%;
}

.reader-pane {
    flex: 2;
    border-right: 1px solid #333;
    background-color: #242424;
}

.sidebar-pane {
    flex: 1;
    background-color: #1e1e1e;
}
</style>
