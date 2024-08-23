<template>
  <div>
    <button v-if="isTextOrMd" @click="refreshDisplay">刷新显示</button>
    <div v-if="fileType === 'text' || fileType === 'md'">
      <pre>{{ displayedContent }}</pre>
    </div>
    <div v-else-if="fileType === 'pdf'">
      <embed :src="pdfDataUrl" type="application/pdf" width="100%" height="600px" />
    </div>
    <div v-else>
      <p>无法渲染此文件类型。</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { defineProps } from 'vue';
import { FileType } from '@/utils/fileHandler';

const props = defineProps<{ fileType: FileType, fileContent: string | ArrayBuffer | null }>();
const pdfDataUrl = ref('');
const displayedContent = ref<string | ArrayBuffer | null>(null);

const isTextOrMd = computed(() => props.fileType === 'text' || props.fileType === 'md');

const refreshDisplay = () => {
  if (props.fileContent === null || props.fileContent === '') {
    displayedContent.value = null;
  } else {
    displayedContent.value = props.fileContent;
  }

  if (props.fileType === 'pdf' && props.fileContent instanceof ArrayBuffer) {
    const blob = new Blob([props.fileContent], { type: 'application/pdf' });
    pdfDataUrl.value = URL.createObjectURL(blob);
  }
};
</script>
