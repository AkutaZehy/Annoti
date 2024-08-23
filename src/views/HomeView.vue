<template>
  <div>
    <FileUpload @file-uploaded="handleFileUploaded" />
    
    <FileEditor v-if="fileType === 'text' || fileType === 'md'" 
                :fileContent="fileContent" 
                :fileType="fileType" 
                @edit="handleFileEdit" />

    <FileDisplay v-if="fileType === 'text' || fileType === 'md' || fileType === 'pdf'"
                 :fileContent="fileContent" 
                 :fileType="fileType" />

    <FileSave v-if="fileContent" 
              :fileContent="fileContent" 
              :fileType="fileType" 
              :fileName="fileName" 
              :annotations="annotations" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import FileUpload from '@/components/File/FileUpload.vue';
import FileDisplay from '@/components/File/FileDisplay.vue';
import FileEditor from '@/components/File/FileEditor.vue';
import FileSave from '@/components/File/FileSave.vue';
import { FileType, parseFileContent } from '@/utils/fileHandler';

const fileContent = ref<string | ArrayBuffer | null>(null);
const fileType = ref<FileType>('unknown');
const fileName = ref<string>('');
const annotations = ref<any[]>([]);

interface FileUploadEvent {
  fileContent: string | ArrayBuffer | null;
  fileType: FileType;
  fileName: string;
  annotations: any[];
}

const handleFileUploaded = ({ fileContent: content, fileType: type, fileName: name, annotations: annots }: FileUploadEvent) => {
  fileContent.value = content;
  fileType.value = type;
  fileName.value = name;
  annotations.value = annots;
  
};

const handleFileEdit = (editedContent: string | ArrayBuffer | null) => {
  fileContent.value = editedContent;
};

// 初始化时解析文件内容
onMounted(async () => {
  const file = new File(["example content"], "example.diet"); // 替换为实际的文件
  const { fileContent: content, fileType: type, annotations: annots } = await parseFileContent(file);
  fileContent.value = content;
  fileType.value = type;
  annotations.value = annots;
});
</script>