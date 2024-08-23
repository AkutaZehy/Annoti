<template>
  <div>
    <button @click="saveAsFile">另存为</button>
  </div>
</template>

<script setup lang="ts">
import { saveAs } from "file-saver";
import JSZip, { JSZipObject } from "jszip";
import { defineProps } from "vue";
import { FileType } from '@/utils/fileHandler';

const props = defineProps<{ fileContent: string, fileType: FileType, fileName: string, annotations: any[] }>();

interface FilePickerOptions {
  suggestedName: string;
  types: {
    description: string;
    accept: Record<string, string[]>;
  }[];
}

const saveAsFile = async () => {
  const fileExtension = props.fileName.split('.').pop()?.toLowerCase();
  let defaultFileName = props.fileName;
  let options: FilePickerOptions = {
    suggestedName: defaultFileName,
    types: []
  };

  let internalFileExtension = fileExtension as FileType;

  console.log('fileExtension:', fileExtension);

  if (fileExtension === 'diet') {
    // 检查diet文件内部的格式
    const zip = await JSZip.loadAsync(props.fileContent);
    const infoFile = zip.file("info.json");
    if (!infoFile) {
      console.error('info.json 文件不存在');
      return;
    }
    const info = JSON.parse(await infoFile.async("string"));
    internalFileExtension = info.fileName.split('.').pop()?.toLowerCase() || '';
    defaultFileName = 'annotated_file.diet';
  }

  const fileTypes = {
    txt: {
      description: 'Text Files',
      accept: { 'text/plain': ['.txt'] }
    },
    md: {
      description: 'Markdown Files',
      accept: { 'text/markdown': ['.md'] }
    },
    pdf: {
      description: 'PDF Files',
      accept: { 'application/pdf': ['.pdf'] }
    },
    diet: {
      description: 'Diet Files',
      accept: { 'application/zip': ['.diet'] }
    }
  };

  if (internalFileExtension in fileTypes) {
    options.types.push(fileTypes[internalFileExtension]);
  }
  options.types.push(fileTypes.diet);
  options.suggestedName = defaultFileName;

  try {
    const handle = await window.showSaveFilePicker(options);
    const writable = await handle.createWritable();
    const selectedFileName = handle.name;
    const selectedFileExtension = selectedFileName.split('.').pop()?.toLowerCase();

    if (selectedFileExtension === 'diet') {
      const info = {
        fileType: props.fileType,
        fileName: props.fileName,
        annotationCount: props.annotations.length,
        lastAnnotationTime: new Date().toISOString(),
        participants: [],
      };

      if (fileExtension === 'diet') {
        const zip = await JSZip.loadAsync(props.fileContent);
        const infoFile = zip.file("info.json") as JSZipObject;
        const infoFileContent = JSON.parse(await infoFile.async("string"));

        info.annotationCount = infoFileContent.annotationCount + props.annotations.length;
        info.lastAnnotationTime = new Date().toISOString();
        info.participants = infoFileContent.participants;
      }

      const zip = new JSZip();
      zip.file("info.json", JSON.stringify(info));
      zip.file(`file/${props.fileName}`, props.fileContent);
      zip.file("annotation/annoti.json", JSON.stringify(props.annotations));
      const blob = await zip.generateAsync({ type: "blob" });
      await writable.write(blob);
    } else {
      const mimeType = selectedFileExtension === 'pdf' ? 'application/pdf' :
                       selectedFileExtension === 'md' ? 'text/markdown' :
                       'text/plain;charset=utf-8';
      const blob = new Blob([props.fileContent], { type: mimeType });
      await writable.write(blob);
    }

    await writable.close();
  } catch (error) {
    console.error('保存文件时出错:', error);
  }
};
</script>