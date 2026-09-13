// 引号内嵌逗号回归（源自用户真实文件 result-user.csv：23 列、note 带
// 引号包裹的逗号）。入仓用同结构合成 fixture；真实文件在本地
// test-fixtures/（gitignore）可用 ?raw 换入复跑。
// 数据完整性优先于样式——竖排问题已由 CSS 修复，这里验证解析不丢不错位。
import { describe, expect, it } from "vitest";
import { parseCsv, renderCsv, sniffDelimiter } from "./csvDoc";
import raw from "../../test-fixtures/mini-quoted.csv?raw";

describe("CSV 引号内嵌逗号（同构 result-user.csv）", () => {
  const delimiter = sniffDelimiter(raw);
  const rows = parseCsv(raw, delimiter);

  it("分隔符嗅探为逗号", () => {
    expect(delimiter).toBe(",");
  });

  it("行数正确（表头 + 2 数据行）", () => {
    expect(rows).toHaveLength(3);
  });

  it("RFC4180：全部行解析为 23 列（引号内逗号不计入）", () => {
    for (const [i, r] of rows.entries()) {
      expect(r, `第 ${i + 1} 行`).toHaveLength(23);
    }
  });

  it("含内嵌逗号的 note 字段完整保留", () => {
    const noteRow = rows.find((r) => r[0] === "qb_fixed_cor_p");
    expect(noteRow?.[22]).toBe(
      "corr only; same 7 rate points as qb_fixed_cor (results2), not merged",
    );
  });

  it("表头与数据未错位", () => {
    expect(rows[0][0]).toBe("model");
    expect(rows[0][22]).toBe("note");
    expect(rows[1][0]).toBe("raf");
  });

  it("渲染：单元格总数 = 2×23，note 逗号保留在单元格内", () => {
    const { html } = renderCsv(raw);
    const doc = new DOMParser().parseFromString(html, "text/html");
    const cells = doc.querySelectorAll("td");
    expect(cells.length).toBe(2 * 23);
    const noteCell = [...doc.querySelectorAll("td")].find((td) =>
      td.textContent?.includes(", not merged"),
    );
    expect(noteCell).toBeDefined();
    // 包一层 csv-scroll 横向滚动容器
    expect(doc.querySelector(".csv-scroll")).not.toBeNull();
  });
});
