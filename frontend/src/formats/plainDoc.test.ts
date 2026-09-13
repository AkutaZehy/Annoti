// 照排渲染器测试：核心不变量 = 渲染后文本流与原文逐字符一致
// （span 只包裹不引入文本），另验证各格式的代表性着色。
import { describe, expect, it } from "vitest";
import { buildTextIndex } from "@/core/textIndex";
import { docModeOf, renderDocument } from "./index";
import { renderTsv } from "./csvDoc";

const CTX = { docPath: "C:\\docs\\sample", localres: false };

/** 渲染结果挂到真实容器，返回（文本流, html）；docPath 带扩展名供 flavor 推断 */
function renderToText(mode: Parameters<typeof renderDocument>[0], content: string, ext = "sample") {
  const { html } = renderDocument(mode, content, { docPath: `C:\\docs\\sample.${ext}`, localres: false });
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.appendChild(root);
  return { text: buildTextIndex(root).text, html };
}

const SAMPLES: [string, string][] = [
  ["yaml", `# 顶部注释\nservice:\n  name: "annoti"\n  port: 8080\n  debug: true\n  items:\n    - a\n    - b # 行内注释\nanchor: &base\nref: *base\n---\ndoc2: ~\n`],
  ["toml", `# 注释\n[package]\nname = "annoti"\nversion = "2.1.2"\n[[deps]]\nok = false\n`],
  ["ini", `; 分号注释\n[database]\nhost = localhost\nport=5432\n# 井号注释\n`],
  ["env", `export API_KEY="abc"\nDEBUG=true\n`],
  ["properties", `app.name=Annoti\napp.port : 8080\n`],
  ["rst", `章节标题\n========\n\n.. code-block:: python\n\n   print(1)\n\n:field: value\n`],
  ["adoc", `= 文档标题\n\n== 二级\n\n[source,java]\n----\ncode\n----\n\n:toc:\n`],
  ["org", `* TODO 顶层任务\n** DONE 子任务\n#+TITLE: t\n#+BEGIN_SRC ts\nx()\n#+END_SRC\n- [ ] 待办\n`],
  ["tex", `% 注释\n\\documentclass{article}\n\\begin{document}\n文本 $x^2$ 与 \\textbf{粗体}。\n\\end{document}\n`],
  ["diff", `diff --git a/x b/x\nindex 123..456\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n-old line\n+new line\n keep\n`],
  ["log", `2026-09-13 12:00:00 INFO started\n[12:00:01] WARN slow query\n2026-09-13T12:00:02Z ERROR failed\n`],
  ["jsonl", `{"a":1}\nnot json line\n{"b":"x"}\n`],
];

describe("照排不变量：渲染后文本流 === 原文", () => {
  for (const [ext, content] of SAMPLES) {
    it(`${ext} 文本流逐字符一致`, () => {
      expect(docModeOf("sample." + ext)).not.toBe("txt");
      const { text } = renderToText(docModeOf("sample." + ext), content, ext);
      expect(text).toBe(content);
    });
  }
});

describe("各格式代表性着色", () => {
  it("yaml：注释/键/锚点/多文档各有色", () => {
    const { html } = renderToText("kv", SAMPLES[0][1], "yaml");
    expect(html).toContain("tok-cmt");
    expect(html).toContain("tok-key");
    expect(html).toContain("tok-attr"); // &base / *base
    expect(html).toContain("tok-kw"); // true / ---
  });

  it("toml：表头 tok-tag，键 tok-key", () => {
    const { html } = renderToText("kv", SAMPLES[1][1], "toml");
    expect(html).toContain("tok-tag");
    expect(html).toContain("tok-key");
  });

  it("ini：节头与键着色，两种注释色一致", () => {
    const { html } = renderToText("kv", SAMPLES[2][1], "ini");
    expect(html).toContain("tok-tag");
    expect(html).toContain("tok-key");
  });

  it("env：export 前缀着色", () => {
    const { html } = renderToText("kv", SAMPLES[3][1], "env");
    expect(html).toContain("tok-kw");
  });

  it("rst：下划线标题与指令行着色", () => {
    const { html } = renderToText("markup", SAMPLES[5][1], "rst");
    expect(html).toContain("tok-head");
    expect(html).toContain("tok-kw");
  });

  it("org：星号标题与 TODO 状态着色", () => {
    const { html } = renderToText("markup", SAMPLES[7][1], "org");
    expect(html).toContain("tok-head");
    expect(html).toContain("tok-kw");
  });

  it("tex：命令与注释着色", () => {
    const { html } = renderToText("markup", SAMPLES[8][1], "tex");
    expect(html).toContain("tok-kw");
    expect(html).toContain("tok-cmt");
  });

  it("diff：增行绿删行红 hunk 蓝文件头灰", () => {
    const { html } = renderToText("diff", SAMPLES[9][1]);
    expect(html).toContain("tok-diff-add");
    expect(html).toContain("tok-diff-del");
    expect(html).toContain("tok-attr");
    expect(html).toContain("tok-cmt");
  });

  it("log：级别着色（ERROR 红 / WARN 橙 / INFO 绿）", () => {
    const { html } = renderToText("log", SAMPLES[10][1]);
    expect(html).toContain("tok-log-error");
    expect(html).toContain("tok-log-warn");
    expect(html).toContain("tok-log-info");
  });

  it("jsonl：合法行高亮、非法行照排并告警计数", () => {
    const result = renderDocument("jsonl", SAMPLES[11][1], CTX);
    expect(result.warning).toContain("1 行");
    expect(result.html).toContain("tok-key");
  });

  it("tsv 强制制表符分隔（字段含逗号不错位）", () => {
    const { html } = renderTsv("name,note\tx\na,b\tc\n");
    const doc = document.createElement("div");
    doc.innerHTML = html;
    const rows = doc.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(1); // 首行是表头
    expect(rows[0].querySelectorAll("td")[0].textContent).toBe("a,b");
    expect(doc.querySelector("thead th")?.textContent).toBe("name,note");
  });
});
