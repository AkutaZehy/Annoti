import { describe, expect, it } from "vitest";
import { collectMatches } from "./find";

describe("collectMatches", () => {
  it("返回全部起始偏移", () => {
    expect(collectMatches("abcabc", "abc")).toEqual([0, 3]);
  });

  it("默认大小写不敏感，且偏移基于原文", () => {
    expect(collectMatches("Ab ab AB", "ab")).toEqual([0, 3, 6]);
  });

  it("正则特殊字符按字面匹配", () => {
    // "aXb" 不应被通配匹配；两处字面量分别在 0 与 8
    expect(collectMatches("a.b aXb a.b", "a.b")).toEqual([0, 8]);
    expect(collectMatches("aXb", "a.b")).toEqual([]);
  });

  it("空查询与无命中返回空数组", () => {
    expect(collectMatches("abc", "")).toEqual([]);
    expect(collectMatches("abc", "  ")).toEqual([]);
    expect(collectMatches("abc", "zzz")).toEqual([]);
  });

  it("尊重上限", () => {
    const text = "ab".repeat(100);
    expect(collectMatches(text, "ab", 5)).toHaveLength(5);
  });
});
