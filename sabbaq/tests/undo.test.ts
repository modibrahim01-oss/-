import { describe, expect, it } from "vitest";
import { UNDO_WINDOW_MS, undoSecondsLeft } from "@/lib/undo";

describe("undoSecondsLeft", () => {
  const at = Date.parse("2026-09-23T10:00:00Z");

  it("counts down the two-minute window", () => {
    expect(undoSecondsLeft(at, at)).toBe(120);
    expect(undoSecondsLeft(at, at + 61_000)).toBe(59);
  });

  it("is zero once the window has passed", () => {
    expect(undoSecondsLeft(at, at + UNDO_WINDOW_MS)).toBe(0);
    expect(undoSecondsLeft(at, at + UNDO_WINDOW_MS + 5_000)).toBe(0);
  });

  it("is zero before the clock is set, so server and browser render the same", () => {
    expect(undoSecondsLeft(at, 0)).toBe(0);
  });

  it("accepts the ISO string the database returns", () => {
    expect(undoSecondsLeft("2026-09-23T10:00:00Z", at + 30_000)).toBe(90);
    expect(undoSecondsLeft("not a date", at)).toBe(0);
  });
});
