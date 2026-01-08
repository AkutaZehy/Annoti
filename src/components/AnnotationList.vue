<script setup lang="ts">
import { useAnnotations } from "../composables/useAnnotations";

// 获取全局状态
const { annotations } = useAnnotations();

// 定义事件：当点击某一项时通知父组件
const emit = defineEmits<{
    (e: "locate", domId: string): void;
}>();
</script>

<template>
    <div class="list-container">
        <h3 class="title">批注 ({{ annotations.length }})</h3>

        <ul v-if="annotations.length > 0">
            <li
                v-for="item in annotations"
                :key="item.id"
                class="card"
                @click="emit('locate', item.domId)">
                <div class="card-text">"{{ item.text }}"</div>
                <div class="card-time">
                    {{ new Date(item.createdAt).toLocaleTimeString() }}
                </div>
            </li>
        </ul>

        <div v-else class="empty-state">
            暂无批注，请在左侧选中文本并点击添加。
        </div>
    </div>
</template>

<style scoped>
.list-container {
    padding: 16px;
    height: 100%;
    box-sizing: border-box;
}
.title {
    margin-top: 0;
    font-size: 1.2rem;
    color: #fff;
}
.card {
    background: #333;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 12px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.2s;
}
.card:hover {
    background: #3c3c3c;
    border-color: #666;
    transform: translateY(-2px);
}
.card-text {
    font-size: 0.95rem;
    color: #ddd;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.card-time {
    font-size: 0.8rem;
    color: #888;
    margin-top: 8px;
    text-align: right;
}
.empty-state {
    color: #666;
    text-align: center;
    margin-top: 50px;
}
</style>
