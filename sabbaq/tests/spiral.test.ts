import { describe, expect, it } from "vitest";
import { capacityUpToRing, ringOf, spiralCoord } from "@/lib/spiral";

describe("spiralCoord", () => {
  it("places the first plant at the exact centre", () => {
    expect(spiralCoord(0)).toEqual({ x: 0, y: 0 });
  });

  it("walks the first ring in order, starting to the right of centre", () => {
    // ring 1 is the 8 cells surrounding the origin, traversed
    // right → up → left → down
    expect(spiralCoord(1)).toEqual({ x: 1, y: 0 });
    expect(spiralCoord(2)).toEqual({ x: 1, y: 1 });
    expect(spiralCoord(3)).toEqual({ x: 0, y: 1 });
    expect(spiralCoord(4)).toEqual({ x: -1, y: 1 });
    expect(spiralCoord(5)).toEqual({ x: -1, y: 0 });
    expect(spiralCoord(6)).toEqual({ x: -1, y: -1 });
    expect(spiralCoord(7)).toEqual({ x: 0, y: -1 });
    expect(spiralCoord(8)).toEqual({ x: 1, y: -1 });
  });

  it("starts the second ring immediately after the first is full", () => {
    // ring 1 ends at slot 8 (9 cells total incl. centre); slot 9 opens ring 2
    expect(spiralCoord(9)).toEqual({ x: 2, y: -1 });
    expect(ringOf(8)).toBe(1);
    expect(ringOf(9)).toBe(2);
  });

  it("never reuses a coordinate across 5000 slots", () => {
    const seen = new Set<string>();
    for (let n = 0; n < 5000; n++) {
      const { x, y } = spiralCoord(n);
      const key = `${x},${y}`;
      expect(seen.has(key), `slot ${n} reused coordinate ${key}`).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe(5000);
  });

  it("expands outward: every slot stays inside its own ring", () => {
    for (let n = 0; n < 5000; n++) {
      const { x, y } = spiralCoord(n);
      const k = ringOf(n);
      // Chebyshev distance from centre equals the ring index
      expect(Math.max(Math.abs(x), Math.abs(y))).toBe(k);
    }
  });

  it("fills each ring completely before opening the next", () => {
    // a ring k is complete when the cumulative count hits (2k+1)^2
    for (let k = 0; k <= 12; k++) {
      const capacity = capacityUpToRing(k);
      expect(ringOf(capacity - 1)).toBe(k);
      expect(ringOf(capacity)).toBe(k + 1);
    }
  });

  it("stays correct at perfect-square boundaries where float rounding bites", () => {
    // n = (2k+1)^2 - 1 is the last slot of ring k; naive ceil() can push these
    // one ring too far when sqrt returns a hair above the integer
    for (let k = 1; k <= 40; k++) {
      const last = (2 * k + 1) ** 2 - 1;
      expect(ringOf(last), `last slot of ring ${k}`).toBe(k);
      expect(ringOf(last + 1), `first slot of ring ${k + 1}`).toBe(k + 1);
    }
  });

  it("holds a full 90-day semester at the maximum award rate", () => {
    // worst case: 90 days of nothing but 50-point awards from every
    // supervisor pool — far more plants than a real student accumulates
    const plants = 90 * 20;
    const ring = ringOf(plants - 1);
    expect(capacityUpToRing(ring)).toBeGreaterThanOrEqual(plants);
    // and the farm stays compact enough to fit on screen
    expect(ring).toBeLessThan(25);
  });

  it("rejects invalid slot indices instead of returning a wrong cell", () => {
    expect(() => spiralCoord(-1)).toThrow(RangeError);
    expect(() => spiralCoord(1.5)).toThrow(RangeError);
    expect(() => spiralCoord(Number.NaN)).toThrow(RangeError);
  });
});

describe("capacityUpToRing", () => {
  it("grows as the odd squares", () => {
    expect(capacityUpToRing(0)).toBe(1);
    expect(capacityUpToRing(1)).toBe(9);
    expect(capacityUpToRing(2)).toBe(25);
    expect(capacityUpToRing(3)).toBe(49);
  });
});
