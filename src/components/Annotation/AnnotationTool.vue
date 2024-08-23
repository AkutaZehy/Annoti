<template>
  <div @mouseup="addAnnotation">
    <pre>{{ fileContent }}</pre>
  </div>
  <div v-for="annotation in annotations" :key="annotation.id">
    {{ annotation.text }}
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const annotations = ref([]);

const addAnnotation = () => {
  const selectedText = window.getSelection()?.toString();
  if (selectedText) {
    annotations.value.push({ id: Date.now(), text: selectedText });
  }
};
</script>