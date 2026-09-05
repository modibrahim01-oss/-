import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LEGACY_WITHDRAWALS_TOTAL,
  parseClientsCsv,
  parseOrdersCsv,
} from "./parseSeed";

const ordersCsv = readFileSync(
  join(process.cwd(), "supabase/seed/seed-orders.csv"),
  "utf8",
);
const clientsCsv = readFileSync(
  join(process.cwd(), "supabase/seed/seed-clients.csv"),
  "utf8",
);

describe("parseOrdersCsv على ملف seed-orders.csv الحقيقي", () => {
  const report = parseOrdersCsv(ordersCsv);

  it("يقرأ كل الصفوف الثلاثين", () => {
    expect(report.rows).toHaveLength(30);
  });

  it("لا يمرّر أي صف مشكوك فيه بصمت — كل صف غير سليم له سبب مكتوب", () => {
    for (const row of report.rows) {
      if (row.classification !== "ok") {
        expect(row.issueNote, `صف ${row.srcRow} بلا سبب`).toBeTruthy();
      }
    }
  });

  it("يصنّف قيد الـ20,000 كتسوية لا كطلب", () => {
    const adjustment = report.rows.find((r) => r.classification === "adjustment");
    expect(adjustment).toBeDefined();
    expect(adjustment!.srcRow).toBe(15);
    expect(adjustment!.statedProfit).toBe(20000);
    expect(adjustment!.suggestedDecision).toBe("import_as_adjustment");
    // لا أرقام محسوبة له لأنه بلا تكلفة ولا سعر
    expect(adjustment!.computed).toBeNull();
  });

  it("لا يُدخل قيد التسوية ضمن إجمالي المبيعات", () => {
    const adjustment = report.rows.find((r) => r.classification === "adjustment")!;
    expect(adjustment.clientPrice).toBeNull();
    expect(report.summary.totalSales).toBeGreaterThan(0);
  });

  it("يرصد الصفقات بدون تاريخ ويستوردها بـ order_date = null دون اختراع تواريخ", () => {
    const undated = report.rows.filter((r) => r.orderDate === null);
    // ملاحظة: نصّ الوثيقة يذكر "11 صفقة بدون تاريخ"، لكن ملف seed-orders.csv
    // المرفق يحتوي فعليًا على 17 صفًا بلا تاريخ (16 طلبًا + قيد الـ20,000).
    // الملف هو المصدر المعتمد للاستيراد، فنتحقق من الواقع لا من النص.
    expect(undated.length).toBe(17);
    expect(undated.filter((r) => r.classification === "adjustment")).toHaveLength(1);
    for (const row of undated) {
      expect(row.orderDate).toBeNull();
    }
    const missingDateRows = report.rows.filter((r) => r.classification === "missing_date");
    expect(missingDateRows.length).toBeGreaterThan(0);
    for (const row of missingDateRows) {
      expect(row.suggestedDecision).toBe("import");
      expect(row.issueNote).toContain("تاريخ مفقود");
    }
  });

  it("يعيد حساب الحصص بـ50% ولا ينسخ حصص الملف القديم (60%)", () => {
    const row = report.rows.find((r) => r.srcRow === 16)!; // حقول الربيع
    expect(row.computed).not.toBeNull();
    expect(row.computed!.profit).toBeCloseTo(8778.79, 2);
    expect(row.computed!.profitExVat).toBeCloseTo(7633.73, 2);
    expect(row.computed!.repShare).toBeCloseTo(row.computed!.profitExVat * 0.5, 6);
    // حصة 60% القديمة ستكون أعلى — تأكد أننا لم ننسخها
    expect(row.computed!.repShare).toBeLessThan(row.computed!.profitExVat * 0.6);
  });

  it("يحسب الهامش لكل صف قابل للحساب", () => {
    const row = report.rows.find((r) => r.srcRow === 22)!; // رسام الشمال
    expect(row.computed!.marginPct).toBeCloseTo(35.3, 0);
  });

  it("يرصد تعارض الأرقام حين لا يطابق الربح المكتوب الفرق المحسوب", () => {
    const conflictCsv = [
      "src_row,order_date,client_name,factory_cost,client_price,profit,needs_review,note",
      "40,2025-08-01,مطعم شام وقمر لتقديم الوجبات,4000,5093,1507,NO,",
    ].join("\n");
    const conflictReport = parseOrdersCsv(conflictCsv);
    expect(conflictReport.rows[0].classification).toBe("conflict");
    expect(conflictReport.rows[0].issueNote).toContain("تعارض");
    // المصدر المعتمد هو الجدول الرئيسي: نستورد المحسوب لا المكتوب
    expect(conflictReport.rows[0].computed!.profit).toBeCloseTo(1093, 2);
  });

  it("يرصد التكرار المحتمل ولا يقترح استيراد أي نسخة تلقائيًا", () => {
    const duplicateCsv = [
      "src_row,order_date,client_name,factory_cost,client_price,profit,needs_review,note",
      "50,2025-08-15,مطعم شام وقمر لتقديم الوجبات,4500,5756.25,1256.25,NO,",
      "51,2025-09-15,مطعم شام وقمر لتقديم الوجبات,4500,5756.25,1256.25,NO,",
    ].join("\n");
    const dupReport = parseOrdersCsv(duplicateCsv);
    expect(dupReport.rows).toHaveLength(2);
    for (const row of dupReport.rows) {
      expect(row.classification).toBe("duplicate");
      expect(row.suggestedDecision).toBeNull();
      expect(row.issueNote).toContain("تكرار محتمل");
    }
    expect(dupReport.summary.needsDecision).toBe(2);
  });

  it("يطبّع أسماء العملاء المكتوبة بأشكال عرض عربية", () => {
    const presentationFormsCsv = [
      "src_row,order_date,client_name,factory_cost,client_price,profit,needs_review,note",
      "60,2025-09-14,ﻣﺅﺳﺳﺔ ﺑﻳﻙ ﺭﻭﻝ,4694.30,5732.37,1038.07,NO,",
    ].join("\n");
    const normalizedReport = parseOrdersCsv(presentationFormsCsv);
    const name = normalizedReport.rows[0].clientNameNormalized;
    for (const ch of name) {
      const code = ch.codePointAt(0)!;
      expect(code < 0xfb50 || code > 0xfdff).toBe(true);
      expect(code < 0xfe70 || code > 0xfeff).toBe(true);
    }
  });

  it("ملخّص التقرير يعدّ كل تصنيف", () => {
    const { summary } = report;
    expect(summary.total).toBe(30);
    expect(summary.adjustments).toBe(1);
    expect(summary.missingDate).toBeGreaterThan(0);
    expect(
      summary.ok +
        summary.missingDate +
        summary.conflicts +
        summary.duplicates +
        summary.adjustments +
        summary.errors,
    ).toBe(summary.total);
  });
});

describe("parseClientsCsv على ملف seed-clients.csv الحقيقي", () => {
  const clients = parseClientsCsv(clientsCsv);

  it("يقرأ 18 عميلًا", () => {
    expect(clients).toHaveLength(18);
  });

  it("يحمل إجماليات أكبر عميل (شركة حقول الربيع)", () => {
    const biggest = clients.reduce((a, b) => (a.totalSales > b.totalSales ? a : b));
    expect(biggest.name).toContain("حقول الربيع");
    expect(biggest.totalSales).toBeCloseTo(100839.36, 2);
    expect(biggest.marginPct).toBeCloseTo(9.4, 1);
  });

  it("يطبّع اسم كل عميل", () => {
    for (const client of clients) {
      expect(client.nameNormalized.length).toBeGreaterThan(0);
    }
  });
});

describe("المسحوبات القديمة", () => {
  it("مجموعها 37,950 ريال كما في الوثيقة", () => {
    expect(LEGACY_WITHDRAWALS_TOTAL).toBe(37950);
  });
});
