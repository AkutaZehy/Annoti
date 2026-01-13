import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { marked } from 'marked';
import { docContent } from './useDocument';
import type { Annotation, AnnotationAnchor, AnnotationRecord } from '../types';

// 全局状态
const annotations = ref<Annotation[]>([]);
let currentDocId: string | null = null;
let currentDocPath: string | null = null;

/**
 * 转换 AnnotationRecord 到 Annotation
 */
const recordToAnnotation = (record: AnnotationRecord): Annotation => {
  return {
    id: record.id,
    userId: record.user_id,
    userName: record.user_name,
    text: record.text,
    note: record.note,
    anchor: JSON.parse(record.anchor_data) as AnnotationAnchor[],
    createdAt: record.created_at,
    noteVisible: record.note_visible,
    notePosition: { x: record.note_position_x, y: record.note_position_y },
    noteSize: { width: record.note_width, height: record.note_height },
    highlightColor: record.highlight_color,
    highlightType: record.highlight_type as 'underline' | 'square'
  };
};

/**
 * 转换 Annotation 到 AnnotationRecord
 */
const annotationToRecord = (anno: Annotation, docId: string): AnnotationRecord => {
  return {
    id: anno.id,
    document_id: docId,
    user_id: anno.userId,
    user_name: anno.userName,
    text: anno.text,
    note: anno.note,
    note_visible: anno.noteVisible,
    note_position_x: anno.notePosition.x,
    note_position_y: anno.notePosition.y,
    note_width: anno.noteSize.width,
    note_height: anno.noteSize.height,
    highlight_color: anno.highlightColor,
    highlight_type: anno.highlightType,
    anchor_data: JSON.stringify(anno.anchor),
    created_at: anno.createdAt,
    updated_at: Date.now()
  };
};

/**
 * 保存单个注解到数据库
 */
const saveAnnotation = async (anno: Annotation): Promise<void> => {
  if (!currentDocId) return;

  const record = annotationToRecord(anno, currentDocId);
  await invoke('update_annotation', { annotation: JSON.stringify(record) });
};

export function useAnnotations() {
  /**
   * 设置当前文档并加载注解
   */
  const setDocument = async (docPath: string, docContent: string): Promise<void> => {
    annotations.value = [];
    currentDocPath = docPath;

    try {
      // 保存文档
      const docRecord = await invoke<{ id: string; content: string }>('save_document', {
        path: docPath,
        content: docContent
      });

      currentDocId = docRecord.id;

      // 加载注解
      const records = await invoke<AnnotationRecord[]>('get_annotations', {
        docId: currentDocId
      });

      annotations.value = records.map(recordToAnnotation);
    } catch (e) {
      console.error('加载注解失败:', e);
      annotations.value = [];
    }
  };

  /**
   * 添加新注解
   */
  const addAnnotation = async (
    text: string,
    anchor: AnnotationAnchor[],
    groupId: string,
    userId: string,
    userName: string,
    highlightColor: string = '#ffd700',
    highlightType: 'underline' | 'square' = 'underline'
  ): Promise<Annotation> => {
    if (!currentDocId) {
      throw new Error('未设置文档');
    }

    const newAnno: Annotation = {
      id: groupId,
      userId,
      userName,
      text,
      anchor,
      createdAt: Date.now(),
      noteVisible: false,
      notePosition: { x: 0, y: 0 },
      noteSize: { width: 280, height: 180 },
      highlightColor,
      highlightType
    };

    // 保存到数据库
    const record = annotationToRecord(newAnno, currentDocId);
    await invoke('add_annotation', { annotation: JSON.stringify(record) });

    annotations.value.push(newAnno);
    return newAnno;
  };

  /**
   * 导出单个注解为 annpkg
   */
  const exportAnnotation = async (annoId: string): Promise<Blob> => {
    if (!currentDocPath) {
      throw new Error('未设置文档');
    }

    const json = await invoke<string>('export_annotation', {
      annoId,
      docPath: currentDocPath
    });

    return new Blob([json], { type: 'application/json' });
  };

  /**
   * 导入注解
   */
  const importAnnotation = async (file: File): Promise<{ imported: number; duplicates: number; warning?: string }> => {
    if (!currentDocPath) {
      throw new Error('未设置文档');
    }

    const text = await file.text();

    // 解析导入
    const result = await invoke<string>('import_annotation', { json: text });
    const importedAnnotations: AnnotationRecord[] = JSON.parse(result);

    if (importedAnnotations.length === 0) {
      return { imported: 0, duplicates: 0, warning: '文件中没有注解' };
    }

    // 获取当前注解数量用于计算去重
    const beforeCount = annotations.value.length;

    // 合并到数据库（自动去重）
    const importedCount = await invoke<number>('merge_imported_annotations', {
      annotationsJson: JSON.stringify(importedAnnotations),
      docPath: currentDocPath
    });

    const afterCount = annotations.value.length;
    const duplicates = afterCount - beforeCount - importedCount;

    // 重新加载
    if (currentDocId) {
      const records = await invoke<AnnotationRecord[]>('get_annotations', {
        docId: currentDocId
      });
      annotations.value = records.map(recordToAnnotation);
    }

    return {
      imported: importedCount,
      duplicates: duplicates > 0 ? duplicates : 0,
      warning: importedCount === 0 ? '所有注解已存在（去重）' : undefined
    };
  };

  /**
   * 根据ID查找注解
   */
  const getAnnotationById = (id: string) => {
    return annotations.value.find(a => a.id === id);
  };

  /**
   * 更新注解
   */
  const updateAnnotation = async (id: string, updates: Partial<Annotation>): Promise<boolean> => {
    const index = annotations.value.findIndex(a => a.id === id);
    if (index === -1) return false;

    annotations.value[index] = { ...annotations.value[index], ...updates };
    await saveAnnotation(annotations.value[index]);
    return true;
  };

  /**
   * 删除注解
   */
  const deleteAnnotation = async (id: string): Promise<Annotation | null> => {
    const index = annotations.value.findIndex(a => a.id === id);
    if (index === -1) return null;

    const deleted = annotations.value[index];
    annotations.value.splice(index, 1);

    await invoke('delete_annotation', { id });
    return deleted;
  };

  /**
   * 显示便签
   */
  const showNote = async (id: string): Promise<boolean> => {
    return await updateAnnotation(id, { noteVisible: true });
  };

  /**
   * 隐藏便签
   */
  const hideNote = async (id: string): Promise<boolean> => {
    return await updateAnnotation(id, { noteVisible: false });
  };

  /**
   * 更新便签位置
   */
  const updateNotePosition = async (id: string, x: number, y: number): Promise<boolean> => {
    return await updateAnnotation(id, { notePosition: { x, y } });
  };

  /**
   * 更新便签尺寸
   */
  const updateNoteSize = async (id: string, width: number, height: number): Promise<boolean> => {
    return await updateAnnotation(id, { noteSize: { width, height } });
  };

  /**
   * 重置便签位置
   */
  const resetNotePosition = async (id: string): Promise<boolean> => {
    return await updateAnnotation(id, { notePosition: { x: 0, y: 0 } });
  };

  /**
   * 导出为只读 HTML
   */
  const exportAsHtml = async (savePath: string): Promise<void> => {
    if (!currentDocId) {
      throw new Error('未设置文档');
    }

    const renderedContent = await marked(docContent.value || '');

    // 将 HTML 字符串转换为 DOM，应用的锚点高亮
    // 注意：锚点路径基于 .markdown-body 包装器
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = `<div class="markdown-body">${renderedContent}</div>`;
    const markdownBody = tempDiv.querySelector<HTMLElement>('.markdown-body')!;

    // 应用高亮到 DOM
    for (const anno of annotations.value) {
      if (anno.anchor && anno.anchor.length > 0) {
        applyHighlightsToDom(markdownBody, anno);
      }
    }

    // 获取带有高亮的 HTML
    const contentWithHighlights = tempDiv.innerHTML;

    const annoIds = annotations.value.map(a => a.id);
    const html = await invoke<string>('export_as_html', {
      docId: currentDocId,
      annoIds,
      content: contentWithHighlights
    });

    await invoke('save_html_file', { path: savePath, html });
  };

  // 将锚点高亮应用到 DOM
  const applyHighlightsToDom = (container: HTMLElement, anno: Annotation) => {
    if (!anno.anchor || anno.anchor.length === 0) return;

    for (const anchor of anno.anchor) {
      try {
        const parentEl = container.querySelector(anchor.containerPath);
        if (!parentEl) continue;

        // 找到指定索引的文本节点
        let textNode: Node | null = null;
        let currentNode: Node | null = parentEl.firstChild;
        let currentIndex = 0;

        while (currentNode) {
          if (currentNode.nodeType === Node.TEXT_NODE) {
            if (currentIndex === anchor.textNodeIndex) {
              textNode = currentNode;
              break;
            }
            currentIndex++;
          }
          currentNode = currentNode.nextSibling;
        }

        if (!textNode || textNode.nodeType !== Node.TEXT_NODE) continue;

        // 创建范围并高亮
        const range = document.createRange();
        const textContent = textNode.textContent || '';
        range.setStart(textNode, Math.min(anchor.startOffset, textContent.length));
        range.setEnd(textNode, Math.min(anchor.endOffset, textContent.length));

        // 创建高亮元素
        const span = document.createElement('span');
        span.className = 'doc-highlight';
        span.dataset.annoId = anno.id;
        span.style.backgroundColor = anno.highlightColor ? `${anno.highlightColor}4d` : 'rgba(255, 215, 0, 0.3)';
        if (anno.highlightType === 'underline') {
          span.style.borderBottom = `2px solid ${anno.highlightColor || 'gold'}`;
        }

        try {
          range.surroundContents(span);
        } catch (e) {
          // 如果范围跨越多个节点，尝试部分高亮
          console.warn('高亮 span 失败，尝试替代方法', e);
        }
      } catch (e) {
        console.warn('应用高亮失败，注解:', anno.id, e);
      }
    }
  };

  /**
   * 迁移侧边文件
   */
  const migrateSidecarFiles = async (baseDir: string): Promise<void> => {
    await invoke('migrate_sidecar_files', { baseDir });
  };

  return {
    annotations,
    setDocument,
    addAnnotation,
    exportAnnotation,
    importAnnotation,
    getAnnotationById,
    updateAnnotation,
    deleteAnnotation,
    showNote,
    hideNote,
    updateNotePosition,
    updateNoteSize,
    resetNotePosition,
    exportAsHtml,
    migrateSidecarFiles
  };
}
