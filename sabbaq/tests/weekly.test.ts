import { describe, expect, it } from "vitest";
import { rankWeekly } from "@/lib/weekly";

describe("rankWeekly", () => {
  it("sums each student's points and ranks them high to low", () => {
    const rows = [
      { student_id: "a", points: 10 },
      { student_id: "b", points: 50 },
      { student_id: "a", points: 50 },
      { student_id: "c", points: 20 },
    ];
    expect(rankWeekly(rows, 5)).toEqual([
      { student_id: "a", week_points: 60 },
      { student_id: "b", week_points: 50 },
      { student_id: "c", week_points: 20 },
    ]);
  });

  it("keeps only the requested number of stars", () => {
    const rows = ["a", "b", "c", "d"].map((id, i) => ({ student_id: id, points: (i + 1) * 10 }));
    expect(rankWeekly(rows, 2).map((r) => r.student_id)).toEqual(["d", "c"]);
  });

  it("breaks ties the same way every time, whatever the row order", () => {
    const one = rankWeekly([{ student_id: "z", points: 30 }, { student_id: "m", points: 30 }], 5);
    const two = rankWeekly([{ student_id: "m", points: 30 }, { student_id: "z", points: 30 }], 5);
    expect(one).toEqual(two);
  });

  it("an empty week has no stars", () => {
    expect(rankWeekly([], 5)).toEqual([]);
  });
});
