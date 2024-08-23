// utils/fileHandler.ts
import JSZip from 'jszip';

export type FileType = 'text' | 'md' | 'pdf' | 'diet' | 'unknown';

export async function parseFileContent(file: File): Promise<{ fileContent: string | ArrayBuffer | null, fileType: FileType, annotations: any[] }> {
  const fileType: FileType = detectFileType(file.name);

  let fileContent: string | ArrayBuffer | null = null;
  let annotations: any[] = [];
  let realFileType: FileType = fileType;

  if (fileType === 'diet') {
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);
    const infoContent = await zipContent.file("info.json")?.async("string");
    if (infoContent) {
      const info = JSON.parse(infoContent);
      const fileEntry = zipContent.file(`file/${info.fileName}`);
      fileContent = fileEntry ? await fileEntry.async("string") : null;
      realFileType = detectFileType(info.fileName);
      const annotationsContent = await zipContent.file("annotation/annoti.json")?.async("string");
      annotations = annotationsContent ? JSON.parse(annotationsContent) : [];
    }
  } else if (fileType === 'text' || fileType === 'md') {
    fileContent = await file.text();
  } else if (fileType === 'pdf') {
    fileContent = await file.arrayBuffer();
  } else {
    console.warn('未知文件类型，不做处理');
  }

  return { fileContent, fileType : realFileType, annotations };
}

export function detectFileType(fileName: string): FileType {
  if (fileName.endsWith('.txt')) {
    return 'text';
  } else if (fileName.endsWith('.md')) {
    return 'md';
  } else if (fileName.endsWith('.pdf')) {
    return 'pdf';
  } else if (fileName.endsWith('.diet')) {
    return 'diet';
  } else {
    return 'unknown';
  }
}