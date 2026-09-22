import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { quadrantCoord } from "@/lib/layout";
import { isTier } from "@/lib/tiers";

/**
 * تكافؤ التخطيط بين الخادم والعميل.
 *
 * قاعدة البيانات تحسب الإحداثي وقت المنح وتخزّنه، والمتصفح يرسم ما خُزِّن.
 * لكن المعاينة والاختبارات تبني مزارعها بنسخة TypeScript، فلو تباعدت
 * النسختان لاختُبر شكلٌ غير الذي يراه الطلاب. هذا الاختبار يقارن مخرجات
 * quadrant_coord الحقيقية من Postgres بمخرجات quadrantCoord صفًا بصف.
 *
 * الملف المرجعي يولّده `npm run test:db` من الدالة نفسها بعد تطبيق الترحيلات.
 */
const FIXTURE = new URL("./fixtures/sql-quadrant.csv", import.meta.url);

describe("SQL ↔ TypeScript quadrant parity", () => {
  const rows = readFileSync(FIXTURE, "utf8")
    .trim()
    .split("\n")
    .map((line) => {
      const [tier, n, x, y] = line.split(",");
      return { tier, n: Number(n), x: Number(x), y: Number(y) };
    });

  it("has a reference fixture covering every tier deeply", () => {
    expect(rows.length).toBe(4000);
    expect(new Set(rows.map((r) => r.tier))).toEqual(
      new Set(["green", "yellow", "purple", "red"]),
    );
  });

  it("agrees with the database on every cell", () => {
    const mismatches: string[] = [];
    for (const row of rows) {
      if (!isTier(row.tier)) {
        mismatches.push(`unknown tier ${row.tier}`);
        continue;
      }
      const ts = quadrantCoord(row.tier, row.n);
      if (ts.x !== row.x || ts.y !== row.y) {
        mismatches.push(`${row.tier}#${row.n}: sql=(${row.x},${row.y}) ts=(${ts.x},${ts.y})`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});
