import { describe, expect, it } from "vitest";
import { pushRecent } from "./recents";

describe("pushRecent", () => {
  it("新项置顶", () => {
    const list = pushRecent([{ path: "a", name: "a.md", ts: 1 }], "b", "b.md", 2);
    expect(list.map((r) => r.path)).toEqual(["b", "a"]);
  });

  it("同路径去重并移到最前", () => {
    const list = pushRecent(
      [
        { path: "a", name: "a.md", ts: 1 },
        { path: "b", name: "b.md", ts: 2 },
      ],
      "a",
      "a.md",
      3,
    );
    expect(list.map((r) => r.path)).toEqual(["a", "b"]);
  });

  it("超长截断", () => {
    let list: { path: string; name: string; ts: number }[] = [];
    for (let i = 0; i < 15; i++) list = pushRecent(list, `p${i}`, `p${i}.md`, i);
    expect(list).toHaveLength(10);
    expect(list[0].path).toBe("p14");
  });

  it("undefined 初值可用", () => {
    expect(pushRecent(undefined, "x", "x.md", 1)).toEqual([{ path: "x", name: "x.md", ts: 1 }]);
  });
});
