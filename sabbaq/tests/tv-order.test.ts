import { describe, expect, it } from "vitest";
import { applyOrder, moveItem } from "../src/lib/tv-order";

const rows = ["a", "b", "c", "d", "e"].map((student_id) => ({ student_id }));
const ids = (list: { student_id: string }[]) => list.map((r) => r.student_id).join("");

describe("applyOrder", () => {
  it("keeps the points order when nothing was saved", () => {
    expect(ids(applyOrder(rows, null))).toBe("abcde");
  });

  it("follows the saved order", () => {
    expect(ids(applyOrder(rows, ["d", "a", "b", "c", "e"]))).toBe("dabce");
  });

  it("drops saved names that left the board", () => {
    expect(ids(applyOrder(rows.slice(0, 3), ["d", "c", "a", "b"]))).toBe("cab");
  });

  it("slots a newcomer at its natural position among the arranged names", () => {
    // f جديد في الموضع الثاني بالنقاط، والترتيب المحفوظ لا يعرفه
    const withNew = [rows[0], { student_id: "f" }, ...rows.slice(1)];
    expect(ids(applyOrder(withNew, ["e", "d", "c", "b", "a"]))).toBe("efdcba");
  });
});

describe("moveItem", () => {
  it("moves the 4th name to the top and to the 10th place", () => {
    expect(moveItem(["1", "2", "3", "4", "5"], 3, 0)).toEqual(["4", "1", "2", "3", "5"]);
    expect(moveItem(["1", "2", "3", "4", "5"], 0, 9)).toEqual(["2", "3", "4", "5", "1"]);
  });

  it("ignores a move from outside the list", () => {
    expect(moveItem(["1", "2"], 5, 0)).toEqual(["1", "2"]);
  });
});
