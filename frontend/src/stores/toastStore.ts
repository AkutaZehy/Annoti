// 轻提示（Pinia 容器）：全局单条 toast，4 秒自动收起。
// 组合式函数（useDocument 等）也经此提示错误，替代系统 alert。

import { defineStore } from "pinia";
import { ref } from "vue";

export const useToastStore = defineStore("toast", () => {
  const message = ref<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;

  function show(msg: string) {
    message.value = msg;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => (message.value = null), 4000);
  }

  return { message, show };
});
