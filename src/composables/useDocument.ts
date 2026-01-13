import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useAnnotations } from './useAnnotations';
import { useSettings } from './useSettings';

// 全局状态：当前文档的内容
export const docContent = ref<string>('# 欢迎\n请点击右上角打开文件。');
const currentFilePath = ref<string>('');
const currentDocId = ref<string>('');

export function useDocument() {
  const { currentUser } = useSettings();
  const { setDocument, addAnnotation } = useAnnotations();

  /**
   * 打开文件选择器并加载内容
   */
  const openFile = async () => {
    try {
      // 1. 调用 Tauri 的 Dialog 插件选择文件
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Text / Markdown',
          extensions: ['txt', 'md']
        }]
      });

      if (selected === null) {
        return; // 用户取消
      }

      // 2. 获取路径
      const path = typeof selected === 'string' ? selected : (selected as { path?: string }).path ?? '';

      // 3. 调用 Rust 后端读取内容
      const content = await invoke<string>('read_file_content', { path });

      // 4. 更新文档状态
      docContent.value = content;
      currentFilePath.value = path;

      // 5. 加载关联的批注
      await setDocument(path, content);

      console.log('文件加载成功:', path);

    } catch (e) {
      console.error('打开文件失败:', e);
      alert('无法打开文件: ' + e);
    }
  };

  /**
   * 添加高亮注解（由 DocumentViewer 调用）
   */
  const addHighlightAnnotation = async (
    text: string,
    anchor: import('../types').AnnotationAnchor[],
    groupId: string,
    highlightColor?: string,
    highlightType?: 'underline' | 'square'
  ) => {
    if (!currentUser.value) {
      console.warn('用户未加载');
      return;
    }

    await addAnnotation(
      text,
      anchor,
      groupId,
      currentUser.value.id,
      currentUser.value.name,
      highlightColor,
      highlightType
    );
  };

  return {
    docContent,
    currentFilePath,
    currentDocId,
    openFile,
    addHighlightAnnotation
  };
}
