import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildResultsWorkbook } from "@/lib/export-results";

describe("buildResultsWorkbook", () => {
  const students = [
    { student_id: "a", full_name: "أحمد", group_id: 1, group_name: "قبس", grade: "5", total_points: 80 },
    { student_id: "b", full_name: "سارة", group_id: 2, group_name: "مجد ١", grade: null, total_points: 120 },
    { student_id: "c", full_name: "خالد", group_id: 1, group_name: "قبس", grade: "4", total_points: 80 },
  ];
  const ledger = [
    { student_id: "a", tier: "green", points: 10 },
    { student_id: "a", tier: "red", points: 50 },
    { student_id: "a", tier: "yellow", points: 20 },
    { student_id: "b", tier: "red", points: 50 },
    { student_id: "b", tier: "red", points: 50 },
    { student_id: "b", tier: "yellow", points: 20 },
    { student_id: "c", tier: "purple", points: 30 },
    { student_id: "c", tier: "red", points: 50 },
  ];

  async function read(locale: "ar" | "en") {
    const wb = new ExcelJS.Workbook();
    const file = await buildResultsWorkbook(locale, "الفصل الأول", students, ledger);
    await wb.xlsx.load(new Uint8Array(file).buffer);
    return wb;
  }

  it("lists students by points with per-type plant counts", async () => {
    const ws = (await read("ar")).worksheets[0];
    const rows = ws.getSheetValues().slice(2) as unknown[][];
    // [rank, name, group, grade, green, yellow, purple, red, plants, total] — ExcelJS يبدأ من العمود ١
    expect(rows.map((r) => r.slice(1))).toEqual([
      [1, "سارة", "مجد ١", "", 0, 1, 0, 2, 3, 120],
      [2, "أحمد", "قبس", "5", 1, 1, 0, 1, 3, 80],
      [2, "خالد", "قبس", "4", 0, 0, 1, 1, 2, 80],
    ]);
  });

  it("totals each group and ranks the groups", async () => {
    const wg = (await read("ar")).worksheets[1];
    const rows = (wg.getSheetValues().slice(2) as unknown[][]).map((r) => r.slice(1));
    expect(rows).toEqual([
      [1, "قبس", 2, 160, 80],
      [2, "مجد ١", 1, 120, 120],
    ]);
  });

  it("reads right-to-left in Arabic and left-to-right in English", async () => {
    expect((await read("ar")).worksheets[0].views[0].rightToLeft).toBe(true);
    const en = await read("en");
    expect(en.worksheets[0].views[0].rightToLeft).toBe(false);
    expect(en.worksheets[0].getRow(1).getCell(2).value).toBe("Name");
  });
});
