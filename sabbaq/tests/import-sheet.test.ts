import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

/**
 * يختبر منطق تحويل ورقة Excel إلى أسطر — نفس المنطق الموجود في
 * parseStudentSheet، معزولًا عن Server Action ليمكن تشغيله في vitest.
 *
 * ما يهمّ هنا أن الملف الحقيقي يُقرأ فعلًا: الأسماء العربية، الترويسة
 * المتخطّاة، الخلايا الفارغة، والأرقام التي يخزّنها Excel كأرقام لا كنصّ.
 */

const HEADER_HINTS = [
  "الاسم", "اسم", "الطالب", "المجموعة", "الصف",
  "name", "student", "group", "grade", "class",
];

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text).join("").trim();
    }
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
  }
  return "";
}

function sheetToLines(sheet: ExcelJS.Worksheet) {
  const lines: string[] = [];
  let skippedHeader = false;
  sheet.eachRow((row, rowNumber) => {
    const name = cellText(row.getCell(1).value);
    const group = cellText(row.getCell(2).value);
    const grade = cellText(row.getCell(3).value);
    if (!name) return;
    if (rowNumber === 1 && HEADER_HINTS.some((h) => name.toLowerCase().includes(h))) {
      skippedHeader = true;
      return;
    }
    lines.push([name, group, grade].join("\t"));
  });
  return { text: lines.join("\n"), rows: lines.length, skippedHeader };
}

async function roundTrip(rows: (string | number | null)[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("students");
  for (const r of rows) ws.addRow(r);
  const buf = await wb.xlsx.writeBuffer();

  const read = new ExcelJS.Workbook();
  await read.xlsx.load(buf as ArrayBuffer);
  return sheetToLines(read.worksheets[0]);
}

describe("Excel student sheet parsing", () => {
  it("reads Arabic names, groups and grades from a real workbook", async () => {
    const out = await roundTrip([
      ["محمد الأحمد", "باسل ١", "الخامس"],
      ["نورة السالم", "تميز", "العاشر"],
    ]);
    expect(out.rows).toBe(2);
    expect(out.text).toBe("محمد الأحمد\tباسل ١\tالخامس\nنورة السالم\tتميز\tالعاشر");
    expect(out.skippedHeader).toBe(false);
  });

  it("skips a header row instead of importing it as a student", async () => {
    const out = await roundTrip([
      ["الاسم", "المجموعة", "الصف"],
      ["سالم الدوسري", "قبس", "الأول"],
    ]);
    expect(out.skippedHeader).toBe(true);
    expect(out.rows).toBe(1);
    expect(out.text).toBe("سالم الدوسري\tقبس\tالأول");
  });

  it("skips an English header too", async () => {
    const out = await roundTrip([
      ["Name", "Group", "Grade"],
      ["Sara Ali", "Sumou", "7"],
    ]);
    expect(out.skippedHeader).toBe(true);
    expect(out.rows).toBe(1);
  });

  it("keeps a first row that is a real student, not a header", async () => {
    const out = await roundTrip([["خالد القحطاني", "قبس", "الأول"]]);
    expect(out.skippedHeader).toBe(false);
    expect(out.rows).toBe(1);
  });

  it("stringifies grades Excel stored as numbers", async () => {
    // مدير يكتب الصف "5" فيخزّنه Excel رقمًا؛ بلا تحويل يضيع الحقل
    const out = await roundTrip([["ماجد الشمري", "سمو", 7]]);
    expect(out.text).toBe("ماجد الشمري\tسمو\t7");
  });

  it("drops rows with no name but keeps the rest", async () => {
    const out = await roundTrip([
      ["فهد الحربي", "قبس", "الأول"],
      [null, "قبس", "الثاني"],
      ["ريم القحطاني", "سمو", "الثامن"],
    ]);
    expect(out.rows).toBe(2);
    expect(out.text).not.toContain("الثاني");
  });

  it("tolerates missing group and grade columns", async () => {
    // قائمة بأسماء فقط: المجموعة تُملأ لاحقًا بالمجموعة الاحتياطية
    const out = await roundTrip([["أنس الخالدي"]]);
    expect(out.rows).toBe(1);
    expect(out.text).toBe("أنس الخالدي\t\t");
  });

  it("produces text the paste parser splits back into the same fields", async () => {
    const out = await roundTrip([["بندر المالكي", "مجد ٢", "الرابع"]]);
    // نفس التقسيم الذي يفعله ImportBox
    const cells = out.text.split("\n")[0].split(/\t|,|;/).map((c) => c.trim());
    expect(cells).toEqual(["بندر المالكي", "مجد ٢", "الرابع"]);
  });
});
