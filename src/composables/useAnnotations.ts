import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { Annotation, AnnotationAnchor } from '../types';

// 全局状态（单例模式，简单模拟Store）
const annotations = ref<Annotation[]>([]);

// 当前文档关联的批注文件路径
let currentAnnotationPath: string | null = null;

/**
 * 生成批注文件路径（document.md -> document.md.ann）
 */
const getAnnotationPath = (docPath: string): string => {
  return `${docPath}.ann`;
};

/**
 * 保存批注到文件
 */
const saveAnnotations = async () => {
  if (!currentAnnotationPath) return;

  try {
    const json = JSON.stringify(annotations.value, null, 2);
    await invoke('write_file_content', {
      path: currentAnnotationPath,
      content: json
    });
    console.log('批注已保存:', currentAnnotationPath);
  } catch (e) {
    console.error('保存批注失败:', e);
  }
};

/**
 * 检查文件是否存在
 */
const annotationFileExists = async (docPath: string): Promise<boolean> => {
  const annPath = getAnnotationPath(docPath);
  return await invoke<boolean>('file_exists', { path: annPath });
};

/**
 * 从文件加载批注
 * @returns 成功返回数组，文件不存在返回 null，损坏返回 null
 */
const loadAnnotations = async (docPath: string): Promise<Annotation[] | null> => {
  const annPath = getAnnotationPath(docPath);

  try {
    const content = await invoke<string>('read_file_content', { path: annPath });
    const parsed = JSON.parse(content);

    // 验证数据结构
    if (Array.isArray(parsed) && parsed.every(a =>
      typeof a.id === 'string' &&
      typeof a.text === 'string' &&
      (a.note === undefined || typeof a.note === 'string') &&
      Array.isArray(a.anchor) &&
      a.anchor.length > 0 &&
      a.anchor.every((anch: unknown) =>
        typeof anch === 'object' && anch !== null &&
        typeof (anch as any).containerPath === 'string' &&
        typeof (anch as any).textNodeIndex === 'number' &&
        typeof (anch as any).startOffset === 'number' &&
        typeof (anch as any).endOffset === 'number'
      ) &&
      typeof a.createdAt === 'number'
    )) {
      return parsed as Annotation[];
    } else {
      return null; // 数据损坏
    }
  } catch (e) {
    // 读取失败视为损坏
    console.warn('批注文件读取失败:', e);
    return null;
  }
};

/**
 * 备份损坏的批注文件
 */
const backupCorruptedFile = async (docPath: string) => {
  const annPath = getAnnotationPath(docPath);
  const backupPath = `${annPath}.backup.${Date.now()}`;

  try {
    const content = await invoke<string>('read_file_content', { path: annPath });
    await invoke('write_file_content', { path: backupPath, content });
    console.log('已备份损坏的批注文件:', backupPath);
    alert(`批注文件已损坏，已备份到: ${backupPath.split(/[\\/]/).pop()}`);
  } catch (e) {
    console.error('备份失败:', e);
    alert('批注文件已损坏，备份失败');
  }
};

export function useAnnotations() {

  /**
   * 设置当前文档并加载批注
   */
  const setDocument = async (docPath: string): Promise<void> => {
    // 数据隔离：清空旧批注
    annotations.value = [];
    currentAnnotationPath = getAnnotationPath(docPath);

    // 检查批注文件是否存在
    const exists = await annotationFileExists(docPath);

    if (!exists) {
      // 批注文件不存在：创建空文件
      await saveAnnotations();
      return;
    }

    // 批注文件存在，尝试加载
    const loaded = await loadAnnotations(docPath);

    if (loaded === null) {
      // 数据损坏：备份 + 警告
      await backupCorruptedFile(docPath);
      annotations.value = [];
    } else {
      annotations.value = loaded;
    }
  };

  /**
   * 添加一条新批注并保存
   * @param text 批注文本
   * @param anchor 位置锚点数组
   * @param groupId 分组ID（用于关联多个片段）
   */
  const addAnnotation = async (text: string, anchor: AnnotationAnchor[], groupId: string) => {
    const newAnno: Annotation = {
      id: groupId,
      text,
      anchor,
      createdAt: Date.now(),
    };
    annotations.value.push(newAnno);

    // 自动保存
    await saveAnnotations();
  };

  /**
   * 根据ID查找批注
   */
  const getAnnotationById = (id: string) => {
    return annotations.value.find(a => a.id === id);
  };

  /**
   * 手动触发保存（可选，用于批量操作后保存）
   */
  const forceSave = async () => {
    await saveAnnotations();
  };

  /**
   * 更新批注的笔记内容
   */
  const updateAnnotation = async (id: string, note: string): Promise<boolean> => {
    const index = annotations.value.findIndex(a => a.id === id);
    if (index === -1) {
      console.warn('找不到要更新的批注:', id);
      return false;
    }

    annotations.value[index].note = note;
    await saveAnnotations();
    return true;
  };

  /**
   * 删除批注
   * @returns 返回被删除的批注数据，用于前端移除高亮
   */
  const deleteAnnotation = async (id: string): Promise<Annotation | null> => {
    const index = annotations.value.findIndex(a => a.id === id);
    if (index === -1) {
      console.warn('找不到要删除的批注:', id);
      return null;
    }

    const deleted = annotations.value[index];
    annotations.value.splice(index, 1);
    await saveAnnotations();
    return deleted;
  };

  return {
    annotations,
    setDocument,
    addAnnotation,
    getAnnotationById,
    updateAnnotation,
    deleteAnnotation,
    forceSave
  };
}
