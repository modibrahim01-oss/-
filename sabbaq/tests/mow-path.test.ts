import { describe, expect, it } from "vitest";
import { cumulative, mowRoute, pointAt } from "../src/lib/mow-path";

describe("mowRoute", () => {
  it("visits every cell exactly once", () => {
    const cells = [
      { x: 4, y: 4 },
      { x: -2, y: 1 },
      { x: 0, y: 0 },
      { x: 3, y: -5 },
      { x: 1, y: 1 },
    ];
    const order = mowRoute(cells);
    expect([...order].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it("starts at the corner-most cell and goes to the nearest next", () => {
    const cells = [
      { x: 5, y: 5 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 5, y: 4 },
    ];
    expect(mowRoute(cells)).toEqual([1, 2, 3, 0]);
  });

  it("handles one cell and none", () => {
    expect(mowRoute([{ x: 2, y: 3 }])).toEqual([0]);
    expect(mowRoute([])).toEqual([]);
  });
});

describe("pointAt", () => {
  const pts = [
    { x: 0, z: 0 },
    { x: 4, z: 0 },
    { x: 4, z: 3 },
  ];
  const cum = cumulative(pts);

  it("measures the path", () => {
    expect(cum).toEqual([0, 4, 7]);
  });

  it("walks along each leg with its heading", () => {
    expect(pointAt(pts, cum, 2)).toMatchObject({ x: 2, z: 0, dx: 4, dz: 0 });
    expect(pointAt(pts, cum, 5.5)).toMatchObject({ x: 4, z: 1.5, dx: 0, dz: 3 });
  });

  it("clamps before the start and after the end", () => {
    expect(pointAt(pts, cum, -1)).toMatchObject({ x: 0, z: 0 });
    expect(pointAt(pts, cum, 99)).toMatchObject({ x: 4, z: 3 });
  });
});
