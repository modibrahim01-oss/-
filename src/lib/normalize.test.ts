import { describe, expect, it } from "vitest";
import { findSimilarNames, levenshteinRatio, normalizeArabicText, normalizeClientName } from "./normalize";

describe("normalizeClientName", () => {
  it("removes tashkeel and normalizes hamza forms", () => {
    expect(normalizeClientName("أَحْمَد")).toBe("احمد");
    expect(normalizeClientName("إحسان")).toBe("احسان");
    expect(normalizeClientName("آدم")).toBe("ادم");
  });

  it("normalizes ta marbuta and hamza-on-waw", () => {
    expect(normalizeClientName("مؤسسة الوفد التقني")).toBe("موسسه الوفد التقني");
  });

  it("fixes Arabic Presentation Forms via NFKC (مؤسسة بيك رول)", () => {
    // أشكال عرض عربية (presentation forms) لنفس الكلمة "مؤسسة"
    const presentationForm = "ﻣﻤﻣﻢﺍ"; // مقطع مموه بأشكال عرض
    // النتيجة يجب ألا تحتوي على نطاق أشكال العرض العربية بعد NFKC
    const result = normalizeClientName(presentationForm);
    for (const ch of result) {
      const code = ch.codePointAt(0)!;
      expect(code < 0xfb50 || code > 0xfdff).toBe(true);
      expect(code < 0xfe70 || code > 0xfeff).toBe(true);
    }
  });

  it("collapses extra whitespace and separators", () => {
    expect(normalizeClientName("أ.خالد  :  حذوه")).toBe(normalizeClientName("أ خالد حذوه"));
    expect(normalizeClientName("  عالم   نهران  ")).toBe("عالم نهران");
  });

  it("strips trailing numbers", () => {
    expect(normalizeClientName("مطعم شام وقمر 2")).toBe(normalizeClientName("مطعم شام وقمر"));
  });

  it("unifies حذوه vs أ.خالد : حذوه is NOT automatic (different tokens) — needs fuzzy warning, not exact match", () => {
    expect(normalizeClientName("حذوه")).not.toBe(normalizeClientName("أ.خالد : حذوه"));
  });
});

describe("normalizeArabicText", () => {
  it("trims and collapses whitespace, applies NFKC", () => {
    expect(normalizeArabicText("  شركة   حقول الربيع  ")).toBe("شركة حقول الربيع");
  });
});

describe("levenshteinRatio + findSimilarNames (تحذير عميل مشابه)", () => {
  it("flags حذوه as similar to أ.خالد : حذوه", () => {
    const ratio = levenshteinRatio("حذوه", "خالد حذوه");
    expect(ratio).toBeGreaterThan(0.4);
  });

  it("finds an existing similar name in a list of clients", () => {
    const existing = ["أ.خالد : حذوه", "عالم نهران", "مزرعة الوابل"];
    const matches = findSimilarNames("حذوه", existing);
    expect(matches).toContain("أ.خالد : حذوه");
  });

  it("does not flag unrelated names", () => {
    const existing = ["مزرعة الوابل", "مصنع ادوية الوطني"];
    const matches = findSimilarNames("شركة جديدة تمامًا", existing);
    expect(matches).toHaveLength(0);
  });
});
