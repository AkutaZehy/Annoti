<template>
  <div>
    <input type="file" @change="handleFileUpload" ref="fileInput" />
  </div>
</template>

<script setup lang="ts">
import { ref, defineEmits } from 'vue';
import { parseFileContent } from '@/utils/fileHandler';

const emit = defineEmits(['file-uploaded']);
const fileInput = ref<HTMLInputElement | null>(null);

const handleFileUpload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    const { fileContent, fileType, annotations } = await parseFileContent(file);
    emit('file-uploaded', { fileContent, fileType, fileName: file.name, annotations });

    // // 重置文件输入框的值
    // if (fileInput.value) {
    //   fileInput.value.value = '';
    // }
  }
};
</script>