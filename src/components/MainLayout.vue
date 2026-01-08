<script setup lang="ts">
import { ref } from "vue";
import DocumentViewer from "./DocumentViewer.vue";
import AnnotationList from "./AnnotationList.vue";
import TopBar from "./TopBar.vue";
import { useDocument } from "../composables/useDocument"; // 引入新的 Composable

const viewerRef = ref<InstanceType<typeof DocumentViewer> | null>(null);

// 从 Composable 获取文档内容
const { docContent } = useDocument();

const onAddClick = () => {
    viewerRef.value?.handleHighlight();
};

const onLocateRequest = (domId: string) => {
    viewerRef.value?.scrollToHighlight(domId);
};
</script>

<template>
    <div class="layout">
        <!-- 使用新的 TopBar 组件 -->
        <TopBar @add-note="onAddClick" />

        <main class="content-wrapper">
            <section class="pane reader-pane">
                <!-- 绑定 docContent -->
                <DocumentViewer ref="viewerRef" :content="docContent" />
            </section>

            <aside class="pane sidebar-pane">
                <AnnotationList @locate="onLocateRequest" />
            </aside>
        </main>
    </div>
</template>

<style scoped>
/* 样式与之前相同，TopBar 样式已移入组件内，此处可删除 .header 相关样式 */
.layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
}
.content-wrapper {
    display: flex;
    flex: 1;
    overflow: hidden;
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
