// CSV：RFC4180 解析（引号、双写转义、内嵌逗号/换行）→ 真 <table>。
// 每个单元格是独立文本节点，文本索引天然支持跨单元格划选与锚定。

import { escapeHtml } from "./text";
import type { RenderedDoc } from "./types";

/** 从表头行嗅探分隔符：逗号 / 制表符 / 分号（引号内不计数） */
export function sniffDelimiter(content: string): string {
  const nl = content.indexOf("\n");
  const head = nl === -1 ? content : content.slice(0, nl);
  const counts: Record<string, number> = { ",": 0, "\t": 0, ";": 0 };
  let inQuotes = false;
  for (const ch of head) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/** RFC4180 状态机解析；\r 仅在 \r\n 组合中消费 */
export function parseCsv(content: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // 文件以换行结尾时最后会多出一条全空行，去掉
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c === "")) rows.pop();
  return rows;
}

export function renderCsv(content: string): RenderedDoc {
  const delimiter = sniffDelimiter(content);
  const rows = parseCsv(content, delimiter);
  if (rows.length === 0) return { html: "", warning: "CSV 为空" };

  const width = Math.max(...rows.map((r) => r.length));
  const [head, ...body] = rows;
  const ths = Array.from({ length: width }, (_, i) => `<th>${escapeHtml(head[i] ?? "")}</th>`).join("");
  const trs = body
    .map((r) => `<tr>${Array.from({ length: width }, (_, i) => `<td>${escapeHtml(r[i] ?? "")}</td>`).join("")}</tr>`)
    .join("");
  return {
    // csv-scroll 提供横向滚动（列多时不压扁）；空 div 不产生文本节点，锚点偏移不变
    html: `<div class="csv-scroll"><table class="csv-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`,
  };
}
