import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

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

      // 2. 获取路径 (Tauri v2 open 返回的是 string 或 FileResponse 对象，取决于配置，通常单选返回 string | null)
      // 注意：类型定义可能会变，根据实际返回值处理
      const path = typeof selected === 'string' ? selected : selected.path;
      
      // 3. 调用 Rust 后端读取内容
      const content = await invoke<string>('read_file_content', { path });
      
      // 4. 更新状态
      docContent.value = content;
      currentFilePath.value = path;
      
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
