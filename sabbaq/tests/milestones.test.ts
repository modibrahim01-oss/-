import { describe, expect, it } from "vitest";
import { milestonesFor, milestoneToCelebrate, nextPointMilestone } from "@/lib/milestones";

describe("milestones", () => {
  it("marks every threshold at or below the total as reached", () => {
    const reached = milestonesFor(250, 2).filter((m) => m.reached).map((m) => m.id);
    expect(reached).toEqual(["points-100", "points-250"]);
  });

  it("all four types is its own milestone", () => {
    expect(milestonesFor(40, 4).find((m) => m.id === "all-types")?.reached).toBe(true);
    expect(milestonesFor(40, 3).find((m) => m.id === "all-types")?.reached).toBe(false);
  });

  it("points to the next threshold with what is left", () => {
    expect(nextPointMilestone(0)).toEqual({ target: 100, toGo: 100, progress: 0 });
    expect(nextPointMilestone(380)).toMatchObject({ target: 500, toGo: 120 });
    expect(nextPointMilestone(380)?.progress).toBeCloseTo(0.52);
    expect(nextPointMilestone(2000)).toBeNull();
  });

  it("celebrates only the biggest unseen milestone, once", () => {
    const all = milestonesFor(620, 2);
    expect(milestoneToCelebrate(all, new Set())?.id).toBe("points-500");
    expect(milestoneToCelebrate(all, new Set(["points-100", "points-250", "points-500"]))).toBeNull();
  });

  it("collecting all four types takes precedence when both are new", () => {
    const all = milestonesFor(260, 4);
    expect(milestoneToCelebrate(all, new Set(["points-100"]))?.id).toBe("all-types");
  });
});
