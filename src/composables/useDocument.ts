import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useAnnotations } from './useAnnotations';

// 全局状态：当前文档的内容
const docContent = ref<string>('# 欢迎\n请点击右上角打开文件。');
const currentFilePath = ref<string>('');

export function useDocument() {

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
      const path = typeof selected === 'string' ? selected : (selected as any).path;

      // 3. 调用 Rust 后端读取内容
      const content = await invoke<string>('read_file_content', { path });

      // 4. 更新文档状态
      docContent.value = content;
      currentFilePath.value = path;

      // 5. 加载关联的批注文件（在 openFile 时才获取 setDocument）
      const { setDocument } = useAnnotations();
      await setDocument(path);

      console.log('文件加载成功:', path);

    } catch (e) {
      console.error('打开文件失败:', e);
      alert('无法打开文件: ' + e);
    }
  };

  return {
    docContent,
    currentFilePath,
    openFile
  };
}
