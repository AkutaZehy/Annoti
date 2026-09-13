// 便签定位边界样例（2.1.0-alpha 用户实测反馈驱动）：
// 长文档顶部批注 rect 在视口上方（top 为负）→ 旧实现便签"飞上天"。
import { describe, expect, it } from "vitest";
import { clampPosition, pickNotePosition } from "./noteLayout";

const VW = 1280;
const VH = 850;
const VP = { width: VW, height: VH };

describe("pickNotePosition 边界样例", () => {
  it("常规：锚点在视口中部 → 便签贴右侧", () => {
    const pos = pickNotePosition({ left: 400, top: 300, right: 700, bottom: 330 }, VP);
    expect(pos.x).toBe(712); // right + 12
    expect(pos.y).toBe(300);
  });

  it("长文档顶部批注：锚点整体在视口上方（负 top）→ 便签贴顶可见", () => {
    const pos = pickNotePosition({ left: 100, top: -220, right: 500, bottom: -180 }, VP);
    expect(pos.y).toBeGreaterThanOrEqual(12);
    expect(pos.y).toBeLessThan(VH - 220);
    expect(pos.x).toBeGreaterThanOrEqual(12);
  });

  it("划线后滚动到很下方：锚点在视口下方 → 便签贴底可见", () => {
    const pos = pickNotePosition({ left: 100, top: 1200, right: 500, bottom: 1240 }, VP);
    expect(pos.y).toBeLessThanOrEqual(VH - 12);
    expect(pos.y).toBeGreaterThan(0);
    expect(pos.y + 220 <= VH || pos.y <= 12).toBe(true);
  });

  it("锚点在右缘 → 便签换到左侧", () => {
    const pos = pickNotePosition({ left: 1100, top: 300, right: 1270, bottom: 330 }, VP);
    expect(pos.x).toBe(1100 - 340 - 12);
  });

  it("锚点占满宽度（大区块批注）→ 夹回视口内", () => {
    const pos = pickNotePosition({ left: 0, top: 100, right: VW, bottom: 400 }, VP);
    expect(pos.x).toBeGreaterThanOrEqual(12);
    expect(pos.x).toBeLessThanOrEqual(VW - 340 - 12);
  });

  it("视口极小（窗口被拽到很矮）→ 仍返回夹取后的合法位置", () => {
    const tiny = { width: 500, height: 320 };
    const pos = pickNotePosition({ left: 100, top: -400, right: 400, bottom: -380 }, tiny);
    expect(pos.x).toBeGreaterThanOrEqual(12);
    expect(pos.y).toBeGreaterThanOrEqual(12);
  });
});

describe("clampPosition", () => {
  it("越界位置夹回", () => {
    expect(clampPosition({ x: -500, y: -500 }, VP)).toEqual({ x: 12, y: 12 });
    expect(clampPosition({ x: 5000, y: 5000 }, VP)).toEqual({
      x: VW - 340 - 12,
      y: VH - 220 - 12,
    });
  });

  it("合法位置原样返回", () => {
    expect(clampPosition({ x: 100, y: 100 }, VP)).toEqual({ x: 100, y: 100 });
  });
});
