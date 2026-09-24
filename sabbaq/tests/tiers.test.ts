import { describe, expect, it } from "vitest";
import { TIER_LIST, TIER_SPECS, isTier, tierPoints } from "@/lib/tiers";

describe("point tiers", () => {
  it("maps each tier to the point value from the spec", () => {
    expect(tierPoints("green")).toBe(10);
    expect(tierPoints("yellow")).toBe(20);
    expect(tierPoints("purple")).toBe(30);
    expect(tierPoints("red")).toBe(50);
  });

  it("offers exactly the four preset values and nothing else", () => {
    expect(TIER_LIST.map((s) => s.points)).toEqual([10, 20, 30, 50]);
  });

  it("gives every tier a visually distinct plant, not just a colour", () => {
    const plants = TIER_LIST.map((s) => s.plant);
    expect(new Set(plants).size).toBe(4);
  });

  it("orders tiers ascending so the buttons render low to high", () => {
    const points = TIER_LIST.map((s) => s.points);
    expect([...points].sort((a, b) => a - b)).toEqual(points);
  });

  it("assigns a unique colour per tier", () => {
    const colors = TIER_LIST.map((s) => s.color);
    expect(new Set(colors).size).toBe(4);
  });

  it("guards against unknown tier strings from the wire", () => {
    expect(isTier("green")).toBe(true);
    expect(isTier("blue")).toBe(false);
    expect(isTier(10)).toBe(false);
    expect(isTier(undefined)).toBe(false);
  });

  it("keeps the record key and the spec's own tier field in sync", () => {
    for (const [key, spec] of Object.entries(TIER_SPECS)) {
      expect(spec.tier).toBe(key);
    }
  });
});
