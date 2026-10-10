import { describe, expect, it } from "vitest";
import { normalizeArabic } from "@/lib/arabic";

/**
 * تكافؤ التطبيع بين العميل والخادم.
 *
 * students.search_name يُحسب في القاعدة بـ normalize_arabic، ومربّع البحث
 * يطبّع ما يكتبه المستخدم بـ normalizeArabic ثم يستعلم على ذلك العمود. لو
 * تباعدت النسختان لم يجد المستخدم شيئًا. المخرجات المتوقّعة أدناه مأخوذة من
 * تشغيل normalize_arabic على Postgres حقيقي.
 */
describe("normalizeArabic", () => {
  const cases: [string, string][] = [
    ["أحمد", "احمد"],
    ["احمد", "احمد"],
    ["إبراهيم", "ابراهيم"],
    ["آمنة", "امنه"],
    ["فاطمة", "فاطمه"],
    ["فاطمه", "فاطمه"],
    ["رؤى", "روي"],
    ["مُحَمَّد", "محمد"],
    ["  سعد   الغامدي ", "سعد الغامدي"],
    ["Noura", "noura"],
  ];

  for (const [input, expected] of cases) {
    it(`${input} → ${expected}`, () => {
      expect(normalizeArabic(input)).toBe(expected);
    });
  }

  it("is idempotent — a normalized name normalizes to itself", () => {
    for (const [, expected] of cases) {
      expect(normalizeArabic(expected)).toBe(expected);
    }
  });
});
