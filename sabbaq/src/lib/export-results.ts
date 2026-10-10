import ExcelJS from "exceljs";
import type { Locale } from "./i18n";
import { TIER_LIST, type Tier } from "./tiers";

/**
 * ملف نتائج الفصل: ورقة للطلاب (نقاط كل طالب مفصّلة حسب النوع) وورقة
 * للمجموعات. البناء منفصل عن جلب البيانات ليُختبر بلا قاعدة بيانات.
 */

export type ExportStudent = {
  student_id: string;
  full_name: string;
  group_id: number;
  group_name: string;
  grade: string | null;
  total_points: number;
};

export type ExportLedgerRow = { student_id: string; tier: string; points: number };

const HEAD = {
  ar: {
    students: "الطلاب",
    groups: "المجموعات",
    rank: "الترتيب",
    name: "الاسم",
    group: "المجموعة",
    grade: "الصف",
    plants: "النبتات",
    total: "مجموع النقاط",
    count: "عدد الطلاب",
    avg: "متوسط الطالب",
  },
  en: {
    students: "Students",
    groups: "Groups",
    rank: "Rank",
    name: "Name",
    group: "Group",
    grade: "Grade",
    plants: "Plants",
    total: "Total points",
    count: "Students",
    avg: "Average per student",
  },
} as const;

export async function buildResultsWorkbook(
  locale: Locale,
  semesterName: string,
  students: readonly ExportStudent[],
  ledger: readonly ExportLedgerRow[],
): Promise<Buffer> {
  const h = HEAD[locale];
  const tierLabel = (tier: Tier) => {
    const spec = TIER_LIST.find((s) => s.tier === tier)!;
    return `${locale === "ar" ? spec.labelAr : spec.labelEn} (${spec.points})`;
  };

  // عدد نبتات كل نوع لكل طالب
  const perTier = new Map<string, Record<string, number>>();
  for (const r of ledger) {
    const row = perTier.get(r.student_id) ?? {};
    row[r.tier] = (row[r.tier] ?? 0) + 1;
    perTier.set(r.student_id, row);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Sabbaq";
  wb.title = semesterName;
  const rtl = locale === "ar";

  // ── الطلاب ──
  const ws = wb.addWorksheet(h.students, { views: [{ rightToLeft: rtl, state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: h.rank, key: "rank", width: 8 },
    { header: h.name, key: "name", width: 32 },
    { header: h.group, key: "group", width: 16 },
    { header: h.grade, key: "grade", width: 10 },
    ...TIER_LIST.map((s) => ({ header: tierLabel(s.tier), key: s.tier, width: 15 })),
    { header: h.plants, key: "plants", width: 10 },
    { header: h.total, key: "total", width: 14 },
  ];

  const sorted = [...students].sort((a, b) => b.total_points - a.total_points || a.full_name.localeCompare(b.full_name, "ar"));
  let rank = 0;
  let prev = Number.NaN;
  sorted.forEach((s, i) => {
    // المتعادلون يتشاركون الترتيب (١، ٢، ٢، ٤) كما في أي لوحة نتائج عادلة
    if (s.total_points !== prev) rank = i + 1;
    prev = s.total_points;
    const counts = perTier.get(s.student_id) ?? {};
    ws.addRow({
      rank,
      name: s.full_name,
      group: s.group_name,
      grade: s.grade ?? "",
      ...Object.fromEntries(TIER_LIST.map((t) => [t.tier, counts[t.tier] ?? 0])),
      plants: TIER_LIST.reduce((n, t) => n + (counts[t.tier] ?? 0), 0),
      total: s.total_points,
    });
  });
  styleHeader(ws);

  // ── المجموعات ──
  const groups = new Map<number, { name: string; count: number; total: number }>();
  for (const s of students) {
    const g = groups.get(s.group_id) ?? { name: s.group_name, count: 0, total: 0 };
    g.count += 1;
    g.total += s.total_points;
    groups.set(s.group_id, g);
  }
  const wg = wb.addWorksheet(h.groups, { views: [{ rightToLeft: rtl, state: "frozen", ySplit: 1 }] });
  wg.columns = [
    { header: h.rank, key: "rank", width: 8 },
    { header: h.group, key: "group", width: 20 },
    { header: h.count, key: "count", width: 12 },
    { header: h.total, key: "total", width: 14 },
    { header: h.avg, key: "avg", width: 16 },
  ];
  [...groups.values()]
    .sort((a, b) => b.total - a.total)
    .forEach((g, i) =>
      wg.addRow({ rank: i + 1, group: g.name, count: g.count, total: g.total, avg: g.count ? Math.round(g.total / g.count) : 0 }),
    );
  styleHeader(wg);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

function styleHeader(ws: ExcelJS.Worksheet) {
  const row = ws.getRow(1);
  row.font = { bold: true };
  row.alignment = { vertical: "middle", horizontal: "center" };
  row.height = 22;
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFCE1F" } };
    cell.border = { bottom: { style: "medium" } };
  });
}
