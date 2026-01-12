<script setup lang="ts">
import { ref } from "vue";
import { useAnnotations } from "../composables/useAnnotations";
import type { Annotation } from "../types";

// 获取全局状态
const { annotations, updateAnnotation, deleteAnnotation } = useAnnotations();

// 当前正在编辑的批注 ID
const editingId = ref<string | null>(null);
// 编辑时的临时笔记内容
const editingNote = ref("");

// 定义事件：当点击某一项时通知父组件定位
const emit = defineEmits<{
    (e: "locate", domId: string): void;
    (e: "delete", annotation: Annotation): void;
}>();

// 开始编辑笔记
const startEditing = (item: Annotation, event: Event) => {
    event.stopPropagation(); // 防止触发定位
    editingId.value = item.id;
    editingNote.value = item.note || "";
};

// 保存笔记
const saveNote = async (id: string) => {
    if (editingId.value === id) {
        await updateAnnotation(id, { note: editingNote.value });
        editingId.value = null;
    }
};

// 取消编辑
const cancelEditing = () => {
    editingId.value = null;
    editingNote.value = "";
};

// 删除批注
const handleDelete = async (id: string, event: Event) => {
    event.stopPropagation(); // 防止触发定位
    const deleted = await deleteAnnotation(id);
    if (deleted) {
        emit("delete", deleted);
    }
};

// 判断是否正在编辑某个批注
const isEditing = (id: string) => editingId.value === id;
</script>

<template>
    <div class="list-container">
        <h3 class="title">批注 ({{ annotations.length }})</h3>

        <ul v-if="annotations.length > 0">
            <li
                v-for="item in annotations"
                :key="item.id"
                class="card"
                :class="{ 'is-editing': isEditing(item.id) }"
                @click="!isEditing(item.id) && emit('locate', item.id)">
                <div class="card-header">
                    <div class="card-meta">
                        <span class="card-user">{{ item.userName }}</span>
                        <span class="card-time">{{ new Date(item.createdAt).toLocaleString() }}</span>
                    </div>
                    <div class="card-actions">
                        <button
                            v-if="!isEditing(item.id)"
                            class="btn-icon edit-btn"
                            @click="startEditing(item, $event)"
                            title="编辑笔记">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                                <path d="m15 5 4 4"/>
                            </svg>
                        </button>
                        <button
                            class="btn-icon delete-btn"
                            @click="handleDelete(item.id, $event)"
                            title="删除批注">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 6h18"/>
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                                <line x1="10" x2="10" y1="11" y2="17"/>
                                <line x1="14" x2="14" y1="11" y2="17"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <div class="card-quote">"{{ item.text }}"</div>

                <!-- 编辑模式 -->
                <div v-if="isEditing(item.id)" class="note-edit">
                    <textarea
                        v-model="editingNote"
                        class="note-input"
                        placeholder="添加笔记..."
                        rows="3"
                        @keydown.enter.exact.prevent="saveNote(item.id)"
                        @keydown.esc="cancelEditing"></textarea>
                    <div class="edit-actions">
                        <button class="btn-small cancel-btn" @click="cancelEditing">取消</button>
                        <button class="btn-small save-btn" @click="saveNote(item.id)">保存</button>
                    </div>
                </div>

                <!-- 显示模式 -->
                <div v-else-if="item.note" class="card-note">
                    {{ item.note }}
                </div>
                <div v-else class="card-note empty-note">
                    点击编辑按钮添加笔记...
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
    color: var(--text-primary, #fff);
}
.card {
    background: var(--bg-tertiary, #333);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 12px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.2s;
}
.card:hover {
    background: var(--bg-secondary, #3c3c3c);
    border-color: var(--border, #666);
}
.card.is-editing {
    border-color: var(--accent, #4a9eff);
    cursor: default;
}
.card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
}
.card-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.card-user {
    font-size: 0.85rem;
    color: var(--accent, #ffd700);
    font-weight: 500;
}
.card-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s;
}
.card:hover .card-actions,
.card.is-editing .card-actions {
    opacity: 1;
}
.btn-icon {
    background: transparent;
    border: none;
    padding: 4px;
    cursor: pointer;
    border-radius: 4px;
    color: var(--text-tertiary, #888);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}
.btn-icon:hover {
    background: var(--bg-tertiary, #555);
    color: var(--text-primary, #fff);
}
.delete-btn:hover {
    color: #ff6b6b;
}
.card-quote {
    font-size: 0.85rem;
    color: var(--text-secondary, #888);
    font-style: italic;
    margin-bottom: 8px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.card-note {
    font-size: 0.9rem;
    color: var(--text-primary, #ddd);
    line-height: 1.5;
    padding: 8px;
    background: var(--bg-secondary, #2a2a2a);
    border-radius: 4px;
    white-space: pre-wrap;
    word-break: break-word;
}
.card-note.empty-note {
    color: var(--text-tertiary, #666);
    font-style: italic;
}
.card-time {
    font-size: 0.75rem;
    color: var(--text-tertiary, #666);
}
.note-edit {
    margin-top: 8px;
}
.note-input {
    width: 100%;
    padding: 8px;
    border: 1px solid var(--border, #555);
    border-radius: 4px;
    background: var(--bg-secondary, #2a2a2a);
    color: var(--text-primary, #ddd);
    font-size: 0.9rem;
    resize: vertical;
    font-family: inherit;
    box-sizing: border-box;
}
.note-input:focus {
    outline: none;
    border-color: var(--accent, #4a9eff);
}
.edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
}
.btn-small {
    padding: 4px 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s;
}
.save-btn {
    background: var(--accent, #4a9eff);
    color: var(--btn-primary-text, #fff);
}
.save-btn:hover {
    background: var(--accent-hover, #3a8eef);
}
.cancel-btn {
    background: transparent;
    color: var(--text-secondary, #888);
}
.cancel-btn:hover {
    color: var(--text-primary, #ddd);
}
.empty-state {
    color: var(--text-tertiary, #666);
    text-align: center;
    margin-top: 50px;
}
</style>
