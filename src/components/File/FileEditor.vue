<template>
  <div>
    <!-- 保证 textarea 始终显示，只要 fileType 是 'text' 或 'md' -->
    <textarea v-if="isTextOrMd" v-model="localFileContent" @input="emitEdit"></textarea>
    
    <div v-else-if="fileType === 'pdf'">
      <embed :src="pdfDataUrl" type="application/pdf" width="100%" height="600px" />
    </div>
    
    <div v-else>
      <p>无法渲染此文件类型。</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { defineProps, defineEmits } from 'vue';
import { FileType } from '@/utils/fileHandler';

const props = defineProps<{ fileContent: string | ArrayBuffer | null, fileType: FileType }>();
const emit = defineEmits(['edit']);

const localFileContent = ref(props.fileContent || '');
const pdfDataUrl = ref('');

// 计算属性来判断是否是 'text' 或 'md' 类型
const isTextOrMd = computed(() => props.fileType === 'text' || props.fileType === 'md');

watch(() => props.fileContent, (newContent) => {
  if (newContent === null || newContent === '') {
    localFileContent.value = ''; // 确保文本框不会消失
  } else {
    localFileContent.value = newContent;
  }

  if (props.fileType === 'pdf' && newContent instanceof ArrayBuffer) {
    const blob = new Blob([newContent], { type: 'application/pdf' });
    pdfDataUrl.value = URL.createObjectURL(blob);
  }
});

const emitEdit = () => {
  emit('edit', localFileContent.value);
};
</script>
