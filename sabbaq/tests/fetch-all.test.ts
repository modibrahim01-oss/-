import { describe, expect, it } from "vitest";
import { fetchAll } from "@/lib/fetch-all";

describe("fetchAll", () => {
  const source = Array.from({ length: 2345 }, (_, i) => i);
  const page = async (from: number, to: number) => ({ data: source.slice(from, Math.min(to + 1, from + 1000)), error: null });

  it("walks past the 1000-row cap until a short page", async () => {
    expect(await fetchAll(page)).toEqual(source);
  });

  it("stops after one request when everything fits", async () => {
    let calls = 0;
    const rows = await fetchAll(async (from, to) => {
      calls++;
      return { data: [1, 2, 3].slice(from, to + 1), error: null };
    });
    expect(rows).toEqual([1, 2, 3]);
    expect(calls).toBe(1);
  });

  it("surfaces an error instead of returning partial data", async () => {
    await expect(fetchAll(async () => ({ data: null, error: new Error("boom") }))).rejects.toThrow("boom");
  });
});
