import { ref } from 'vue';
import type { Annotation } from '../types';

// 全局状态（单例模式，简单模拟Store）
const annotations = ref<Annotation[]>([]);

export function useAnnotations() {
  
  /**
   * 添加一条新批注
   */
  const addAnnotation = (text: string, domId: string) => {
    const newAnno: Annotation = {
      id: crypto.randomUUID(), // 需要现代浏览器环境
      text,
      domId,
      createdAt: Date.now(),
    };
    annotations.value.push(newAnno);
  };

  /**
   * 根据ID查找批注
   */
  const getAnnotationById = (id: string) => {
    return annotations.value.find(a => a.id === id);
  };

  return {
    annotations,
    addAnnotation,
    getAnnotationById
  };
}
