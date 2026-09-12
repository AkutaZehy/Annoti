import { describe, expect, it } from "vitest";
import { encodeLocalPath, localizeMarkdownImages, resolveImageSrc, stripFileScheme } from "./resolveImages";

const BASE = "C:/docs/notes";

describe("stripFileScheme", () => {
  it("剥掉盘符 file:// 前缀", () => {
    expect(stripFileScheme("file:///C:/docs/pic.png")).toBe("C:/docs/pic.png");
    expect(stripFileScheme("file:///C:\\docs\\pic.png")).toBe("C:/docs/pic.png");
  });
  it("UNC 保留为双反斜杠", () => {
    expect(stripFileScheme("file://srv/share/p.png")).toBe("\\\\srv/share/p.png");
  });
  it("非 file 协议原样返回", () => {
    expect(stripFileScheme("https://x/a.png")).toBe("https://x/a.png");
  });
});

describe("resolveImageSrc", () => {
  it("enabled=false 时原样返回", () => {
    expect(resolveImageSrc("./p.png", BASE, false)).toBe("./p.png");
  });
  it("外链与 data URI 直接放行", () => {
    expect(resolveImageSrc("https://a.com/p.png", BASE, true)).toBe("https://a.com/p.png");
    expect(resolveImageSrc("data:image/png;base64,AAAA", BASE, true)).toBe(
      "data:image/png;base64,AAAA",
    );
  });
  it("相对路径拼接到文档目录并编码", () => {
    expect(resolveImageSrc("./img/p.png", BASE, true)).toBe(
      "/local/" + encodeLocalPath("C:/docs/notes/img/p.png"),
    );
    expect(resolveImageSrc("img/p.png", BASE, true)).toBe(
      "/local/" + encodeLocalPath("C:/docs/notes/img/p.png"),
    );
  });
  it("file:// 与盘符绝对路径直接编码", () => {
    const want = "/local/" + encodeLocalPath("D:/x/y.webp");
    expect(resolveImageSrc("file:///D:/x/y.webp", BASE, true)).toBe(want);
    expect(resolveImageSrc("D:\\x\\y.webp", BASE, true)).toBe(want);
  });
  it("%20 编码先解码再落盘", () => {
    expect(resolveImageSrc("my%20pic.png", BASE, true)).toBe(
      "/local/" + encodeLocalPath("C:/docs/notes/my pic.png"),
    );
  });
  it("根相对路径补盘符", () => {
    expect(resolveImageSrc("/img/p.png", BASE, true)).toBe(
      "/local/" + encodeLocalPath("C:/img/p.png"),
    );
  });
});

describe("localizeMarkdownImages", () => {
  it("改写 img 的 src 并保留其余属性", () => {
    const html = `<p>前<img src="./a.png" alt="图">后<img src="https://x/b.png" alt="外链"></p>`;
    const out = localizeMarkdownImages(html, BASE + "/readme.md", true);
    expect(out).toContain(`/local/${encodeLocalPath("C:/docs/notes/a.png")}`);
    expect(out).toContain('src="https://x/b.png"');
    expect(out).toContain('alt="图"');
  });
  it("disabled 或无图片时原样返回", () => {
    expect(localizeMarkdownImages("<p>x</p>", BASE, true)).toBe("<p>x</p>");
    expect(localizeMarkdownImages('<img src="./a.png">', BASE, false)).toBe(
      '<img src="./a.png">',
    );
  });
});
