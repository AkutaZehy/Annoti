import { describe, expect, it } from "vitest";
import { denormalizeInBox, isRegionAnchor, normalizeInBox } from "./regions";
import type { RegionRect } from "@/types";

const BOX = new DOMRect(100, 200, 400, 300);

describe("normalizeInBox / denormalizeInBox", () => {
  it("归一化与还原互逆", () => {
    const rect = new DOMRect(200, 260, 100, 60);
    const region = normalizeInBox(rect, BOX);
    expect(region.x).toBeCloseTo(0.25);
    expect(region.y).toBeCloseTo(0.2);
    expect(region.w).toBeCloseTo(0.25);
    expect(region.h).toBeCloseTo(0.2);

    const back = denormalizeInBox(region, BOX);
    expect(back.left).toBeCloseTo(200);
    expect(back.top).toBeCloseTo(260);
    expect(back.width).toBeCloseTo(100);
    expect(back.height).toBeCloseTo(60);
  });

  it("越界部分夹取到参照框内", () => {
    const rect = new DOMRect(50, 150, 800, 600); // 溢出 BOX
    const region = normalizeInBox(rect, BOX);
    expect(region).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it("零尺寸参照框不产生 NaN", () => {
    const region = normalizeInBox(new DOMRect(1, 2, 3, 4), new DOMRect(0, 0, 0, 0));
    expect(Number.isNaN(region.x)).toBe(false);
    expect(Number.isNaN(region.h)).toBe(false);
  });
});

describe("isRegionAnchor", () => {
  it("按 type 或 region 字段判定", () => {
    const base = { start: 0, end: 0, exact: "", prefix: "", suffix: "" };
    expect(isRegionAnchor({ type: "text", ...base })).toBe(false);
    expect(isRegionAnchor({ type: "region", ...base })).toBe(true);
    const region: RegionRect = { x: 0, y: 0, w: 1, h: 1 };
    expect(isRegionAnchor({ type: "text", ...base, region })).toBe(true);
  });
});
