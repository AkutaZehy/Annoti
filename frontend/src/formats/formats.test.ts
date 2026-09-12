import { describe, expect, it } from "vitest";
import { buildTextIndex } from "@/core/textIndex";
import { docModeOf, renderDocument } from "./index";
import { highlightJson, renderJson } from "./jsonDoc";
import { highlightXml, renderXml } from "./xmlDoc";
import { parseCsv, renderCsv, sniffDelimiter } from "./csvDoc";
import { renderHtml } from "./htmlDoc";
import { escapeHtml } from "./text";

const CTX = { docPath: "C:\\docs\\sample", localres: false };

/** 把渲染结果挂到真实容器上，返回文本索引（验证文本流稳定性） */
function indexOf(html: string) {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  const index = buildTextIndex(host);
  host.remove();
  return index;
}

describe("docModeOf", () => {
  it("按扩展名分发，未知类型回退 txt", () => {
    expect(docModeOf("a.md")).toBe("md");
    expect(docModeOf("b.HTML")).toBe("html");
    expect(docModeOf("c.json")).toBe("json");
    expect(docModeOf("d.csv")).toBe("csv");
    expect(docModeOf("no-ext")).toBe("txt");
  });
});

describe("md/txt", () => {
  it("markdown 渲染保留标题与强调", () => {
    const r = renderDocument("md", "# 标题\n\n**粗体**文字", CTX);
    expect(r.html).toContain("<h1>");
    expect(r.html).toContain("<strong>粗体</strong>");
  });

  it("纯文本转义且文本流逐字符一致", () => {
    const src = "a<b> & \"c\"\n第二行";
    const r = renderDocument("txt", src, CTX);
    expect(r.html).not.toContain("<b>");
    expect(indexOf(r.html).text).toBe(src);
  });
});

describe("html", () => {
  it("剥掉脚本与框架，保留正文结构", () => {
    const r = renderHtml(
      "<body><h1>T</h1><script>alert(1)</script><iframe src='x'></iframe><p>正文</p></body>",
      "C:\\x\\a.html",
      false,
    );
    expect(r).not.toContain("script");
    expect(r).not.toContain("iframe");
    expect(r).toContain("<h1>T</h1>");
    expect(r).toContain("<p>正文</p>");
  });

  it("本地图片改写为 /local/ 端点", () => {
    const r = renderHtml('<img src="pic.png"><img src="https://e.com/x.png">', "C:\\x\\a.html", true);
    expect(r).toContain("/local/");
    expect(r).toContain("https://e.com/x.png");
  });

  it("渲染确定性与文本流稳定", () => {
    const src = "<div><p>段落一</p><p>段落二</p></div>";
    expect(indexOf(renderHtml(src, "", false)).text).toBe("段落一段落二");
  });
});

describe("json", () => {
  const sample = '{"name":"注释 & <标签>","n":1.5,"ok":true,"nil":null,"arr":[1,2]}';

  it("pretty-print 后文本流稳定且可重建", () => {
    const r = renderJson(sample);
    expect(r.warning).toBeUndefined();
    const text = indexOf(r.html).text;
    expect(text).toBe(JSON.stringify(JSON.parse(sample), null, 2));
  });

  it("记号高亮包裹 span 不引入文本", () => {
    const pretty = JSON.stringify(JSON.parse(sample), null, 2);
    expect(indexOf(`<pre>${highlightJson(pretty)}</pre>`).text).toBe(pretty);
    expect(highlightJson(pretty)).toContain('tok-key');
    expect(highlightJson(pretty)).toContain('tok-num');
  });

  it("解析失败回退原文并告警", () => {
    const r = renderJson("{bad json");
    expect(r.warning).toBeTruthy();
    expect(r.html).toContain("{bad json");
  });

  it("渲染确定性：同一输入两次结果一致", () => {
    expect(renderJson(sample).html).toBe(renderJson(sample).html);
  });
});

describe("xml", () => {
  const sample = `<?xml version="1.0"?>
<!-- 注释 --><root id="a1"><![CDATA[原文 <x>]]><child>文本</child></root>`;

  it("高亮 span 不改变文本流", () => {
    expect(indexOf(`<pre>${highlightXml(sample)}</pre>`).text).toBe(sample);
    expect(renderXml(sample).warning).toBeUndefined();
  });

  it("标签/属性/注释着色", () => {
    const h = highlightXml(sample);
    expect(h).toContain("tok-tag");
    expect(h).toContain("tok-attr");
    expect(h).toContain("tok-cmt");
  });

  it("非法 XML 告警但原文照显", () => {
    const r = renderXml("<a><b></a>");
    expect(r.warning).toBeTruthy();
    expect(indexOf(r.html).text).toBe("<a><b></a>");
  });
});

describe("csv", () => {
  it("RFC4180：引号、双写、内嵌逗号与换行", () => {
    const rows = parseCsv('a,"b,1","c""q"""\r\n"x\ny",2,', ",");
    expect(rows).toEqual([["a", "b,1", 'c"q"'], ["x\ny", "2", ""]]);
  });

  it("分隔符嗅探：逗号/制表/分号", () => {
    expect(sniffDelimiter("a,b,c\n1,2,3")).toBe(",");
    expect(sniffDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
    expect(sniffDelimiter("a;b\nc;d")).toBe(";");
  });

  it("渲染为表格，文本流按单元格拼接", () => {
    const r = renderCsv("名称,数量\n苹果,3");
    expect(r.html).toContain("<th>名称</th>");
    expect(r.html).toContain("<td>3</td>");
    expect(indexOf(r.html).text).toBe("名称数量苹果3");
  });

  it("短行补齐到表头宽度", () => {
    const r = renderCsv("a,b,c\n1,2");
    expect(r.html).toMatch(/<tr><td>1<\/td><td>2<\/td><td><\/td><\/tr>/);
    expect(renderCsv("a,b\n1,2,3").html).toContain("<th></th>");
  });
});

describe("escapeHtml", () => {
  it("只做单字符替换，不影响偏移", () => {
    expect(escapeHtml('a<b>&"c"')).toBe("a&lt;b&gt;&amp;&quot;c&quot;");
  });
});
