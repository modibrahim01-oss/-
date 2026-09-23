import { describe, expect, it } from "vitest";
import { farmChanged, type FarmData } from "@/lib/farm-data";
import { quadrantCoord } from "@/lib/layout";
import { fieldBoundsFor } from "@/lib/plants";
import type { StudentFarmSummary } from "@/lib/types";

describe("fieldBoundsFor", () => {
  it("an empty farm is the minimum plot, centred on the path cross", () => {
    expect(fieldBoundsFor([])).toEqual({ minX: -3, maxX: 3, minZ: -3, maxZ: 3 });
  });

  it("keeps a two-cell margin around the farthest plant on each side separately", () => {
    // بستان أحمر كبير يمدّ الساحة نحوه وحده، لا في الجهات الأربع
    const reds = Array.from({ length: 30 }, (_, n) => quadrantCoord("red", n));
    const b = fieldBoundsFor(reds);
    const minX = Math.min(...reds.map((c) => c.x));
    const minY = Math.min(...reds.map((c) => c.y));
    expect(b.minX).toBe(minX - 2);
    expect(b.minZ).toBe(minY - 2);
    // الجهتان الأخريان بقيتا على الحدّ الأدنى
    expect(b.maxX).toBe(3);
    expect(b.maxZ).toBe(3);
  });

  it("every plant sits inside the fence", () => {
    const cells = (["green", "yellow", "purple", "red"] as const).flatMap((t, i) =>
      Array.from({ length: 40 * (i + 1) }, (_, n) => quadrantCoord(t, n)),
    );
    const b = fieldBoundsFor(cells);
    for (const c of cells) {
      expect(c.x).toBeGreaterThan(b.minX);
      expect(c.x).toBeLessThan(b.maxX);
      expect(c.y).toBeGreaterThan(b.minZ);
      expect(c.y).toBeLessThan(b.maxZ);
    }
  });
});

describe("farmChanged", () => {
  const farm = { total_points: 670, plant_count: 18 } as StudentFarmSummary;
  const plant = (slot: number) => ({
    slot_index: slot,
    grid_x: 1,
    grid_y: 1,
    tier: "green" as const,
    points: 10,
    awarded_at: "",
  });
  const base: FarmData = { farm, plants: [plant(0), plant(1)], rank: 1 };

  it("an identical read is not a change — the scene is left alone", () => {
    expect(farmChanged(base, { ...base, plants: [...base.plants] })).toBe(false);
  });

  it("a new plant is a change", () => {
    expect(farmChanged(base, { ...base, plants: [...base.plants, plant(2)] })).toBe(true);
  });

  it("a revoke plus a new award (same count) is still a change", () => {
    expect(farmChanged(base, { ...base, plants: [plant(0), plant(2)] })).toBe(true);
  });

  it("a rank change from a classmate's points is a change", () => {
    expect(farmChanged(base, { ...base, rank: 2 })).toBe(true);
  });
});
