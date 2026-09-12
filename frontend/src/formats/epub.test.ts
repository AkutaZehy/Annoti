import { describe, expect, it } from "vitest";
import {
  joinRel,
  parseContainer,
  parseNcxXml,
  parseNavHtml,
  parseOpf,
  renderChapterHtml,
} from "./epub";

const CONTAINER = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;

const OPF = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="c1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="text/ch2.xhtml" media-type="application/xhtml+xml"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="c1"/>
    <itemref idref="c2"/>
  </spine>
</package>`;

describe("parseContainer", () => {
  it("提取 rootfile 路径", () => {
    expect(parseContainer(CONTAINER)).toBe("OEBPS/content.opf");
  });

  it("非法 XML 返回 null", () => {
    expect(parseContainer("<not-xml")).toBeNull();
  });
});

describe("parseOpf", () => {
  it("解析 manifest/spine/toc 指向", () => {
    const opf = parseOpf(OPF, "OEBPS/content.opf");
    expect(opf).not.toBeNull();
    expect(opf!.baseDir).toBe("OEBPS");
    expect(opf!.spine).toEqual(["c1", "c2"]);
    expect(opf!.tocId).toBe("ncx");
    expect(opf!.manifest).toHaveLength(4);
  });
});

describe("parseNavHtml", () => {
  it("按嵌套深度提取目录", () => {
    const html = `<html><body><nav>
      <ol><li><a href="text/ch1.xhtml">第一章</a></li>
      <li><a href="text/ch2.xhtml">第二章</a>
        <ol><li><a href="text/ch2.xhtml#s1">第一节</a></li></ol>
      </li></ol></nav></body></html>`;
    const toc = parseNavHtml(html);
    expect(toc).toEqual([
      { label: "第一章", href: "text/ch1.xhtml", level: 1 },
      { label: "第二章", href: "text/ch2.xhtml", level: 1 },
      { label: "第一节", href: "text/ch2.xhtml#s1", level: 2 },
    ]);
  });
});

describe("parseNcxXml", () => {
  it("按 navPoint 祖先深度取层级", () => {
    const xml = `<?xml version="1.0"?>
    <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/">
      <navMap>
        <navPoint id="n1"><navLabel><text>卷一</text></navLabel><content src="text/ch1.xhtml"/>
          <navPoint id="n2"><navLabel><text>章节</text></navLabel><content src="text/ch2.xhtml"/></navPoint>
        </navPoint>
      </navMap>
    </ncx>`;
    expect(parseNcxXml(xml)).toEqual([
      { label: "卷一", href: "text/ch1.xhtml", level: 1 },
      { label: "章节", href: "text/ch2.xhtml", level: 2 },
    ]);
  });
});

describe("joinRel", () => {
  it("解析相对段与 ..", () => {
    expect(joinRel("OEBPS/text", "img.png")).toBe("OEBPS/text/img.png");
    expect(joinRel("OEBPS/text", "../styles/a.css")).toBe("OEBPS/styles/a.css");
    expect(joinRel("", "a/b")).toBe("a/b");
  });
});

describe("renderChapterHtml", () => {
  const resolve = (rel: string) => `/local/RESOLVED(${rel})`;

  it("剥脚本/样式，改写本地图片，保留外链", () => {
    const html = renderChapterHtml(
      `<html><head><style>p{}</style><script>bad()</script></head><body>
        <img src="pic.png" alt="图"><img src="https://x/y.png">
        <a href="ch2.xhtml">内链</a><a href="https://a.b">外链</a>
      </body></html>`,
      resolve,
      true,
    );
    expect(html).toContain("/local/RESOLVED(pic.png)");
    expect(html).toContain("https://x/y.png");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<style");
    expect(html).toContain('href="https://a.b"');
    expect(html).not.toContain('href="ch2.xhtml"');
  });

  it("localres=false 时图片不改写", () => {
    const html = renderChapterHtml(`<img src="pic.png">`, resolve, false);
    expect(html).toContain('src="pic.png"');
  });
});
