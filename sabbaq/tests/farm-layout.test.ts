import { describe, expect, it } from "vitest";
import { arrangeBounds, defaultCells, farmBounds, insideBounds } from "@/lib/farm-layout";
import { quadrantCoord } from "@/lib/layout";
import type { Plant } from "@/lib/types";

const plant = (slot: number, tier: Plant["tier"], x: number, y: number): Plant => ({
  slot_index: slot, tier, grid_x: x, grid_y: y, points: 10, awarded_at: "",
});

describe("farm layout", () => {
  it("ranks each plant within its tier by award order", () => {
    const cells = defaultCells([plant(4, "red", 9, 9), plant(1, "red", 0, 0), plant(2, "green", 5, 5)]);
    expect(cells.get(1)).toEqual(quadrantCoord("red", 0));
    expect(cells.get(4)).toEqual(quadrantCoord("red", 1));
    expect(cells.get(2)).toEqual(quadrantCoord("green", 0));
  });

  it("the arrange fence depends on the default layout, not where plants were moved", () => {
    const home = [plant(0, "green", 1, 1), plant(1, "red", -1, -1)];
    const moved = [plant(0, "green", 3, -3), plant(1, "red", -3, 3)];
    expect(arrangeBounds(moved)).toEqual(arrangeBounds(home));
    // حدود SQL: هامش ٢ حول أبعد نبتة، و ±٣ على الأقل
    expect(arrangeBounds(home)).toEqual({ minX: -3, maxX: 3, minZ: -3, maxZ: 3 });
  });

  it("the drawn fence always contains every plant", () => {
    const stray = [plant(0, "green", 9, -7)];
    const b = farmBounds(stray);
    expect(insideBounds(b, 9, -7)).toBe(true);
    expect(insideBounds(arrangeBounds(stray), 9, -7)).toBe(false);
  });
});
