import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { spiralCoord } from "@/lib/spiral";

/**
 * تكافؤ الخوارزمية بين الخادم والعميل.
 *
 * قاعدة البيانات تحسب الإحداثيات وقت المنح، والمتصفح يرسمها. لو تباعدت
 * النسختان، ظهرت النبتة في مكان غير الذي حُجز لها وتراكبت نبتتان. هذا
 * الاختبار يقارن مخرجات spiral_coord الحقيقية من Postgres بمخرجات
 * spiralCoord في TypeScript صفًا بصف.
 *
 * الملف المرجعي يُولَّد بـ:
 *   psql -d sabbaq_test -tAF, \
 *     -c "select n, x, y from generate_series(0, 2999) n, lateral spiral_coord(n);" \
 *     > tests/fixtures/sql-spiral.csv
 */
const FIXTURE = new URL("./fixtures/sql-spiral.csv", import.meta.url);

describe("SQL ↔ TypeScript spiral parity", () => {
  const rows = readFileSync(FIXTURE, "utf8")
    .trim()
    .split("\n")
    .map((line) => {
      const [n, x, y] = line.split(",").map(Number);
      return { n, x, y };
    });

  it("has a reference fixture covering several rings", () => {
    expect(rows.length).toBeGreaterThan(2000);
  });

  it("agrees with the database on every slot", () => {
    const mismatches: string[] = [];
    for (const row of rows) {
      const ts = spiralCoord(row.n);
      if (ts.x !== row.x || ts.y !== row.y) {
        mismatches.push(`slot ${row.n}: sql=(${row.x},${row.y}) ts=(${ts.x},${ts.y})`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});
