/**
 * تطبيع الأسماء العربية للبحث.
 *
 * نسخة حرفية من normalize_arabic في supabase/migrations/0002_functions.sql.
 * العمود students.search_name يُحسب في القاعدة بتلك الدالة، ومربّع البحث
 * يستعلم عليه — فلو تباعدت النسختان لم يجد المستخدم شيئًا. أي تعديل هنا
 * يجب أن يُنسخ هناك.
 */

const FOLD: Record<string, string> = {
  "أ": "ا", // أ → ا
  "إ": "ا", // إ → ا
  "آ": "ا", // آ → ا
  "ؤ": "و", // ؤ → و
  "ئ": "ي", // ئ → ي
  "ى": "ي", // ى → ي
  "ة": "ه", // ة → ه
};

// التشكيل وعلامات الوقف تُحذف: U+0610–0615، U+064B–0655، U+0670
const STRIP = /[ؐ-ًؕ-ٰٕ]/g;

export function normalizeArabic(input: string): string {
  return input
    .replace(STRIP, "")
    .replace(/[أإآؤئىة]/g, (c) => FOLD[c])
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}
