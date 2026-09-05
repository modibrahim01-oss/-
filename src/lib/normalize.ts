/**
 * تطبيع أسماء العملاء لمنع التكرار (القسم 5، عمود clients.name_normalized).
 * يعالج: أشكال العرض العربية (Arabic Presentation Forms)، التشكيل، الهمزات،
 * التاء المربوطة، المسافات الزائدة، والأرقام اللاحقة في نهاية الاسم.
 */

// حركات التشكيل العربية (فتحة، ضمة، كسرة، سكون، تنوين، شدة...)
const TASHKEEL_REGEX = /[ً-ٰٟۖ-ۭ]/g;

// إزالة أي رموز تحكّم اتجاه (RLM/LRM) قد تتسرب من نسخ/لصق الإكسل
const DIRECTION_MARKS_REGEX = /[‎‏‪-‮]/g;

export function normalizeClientName(raw: string): string {
  if (!raw) return "";

  let s = raw;

  // 1) NFKC: يحوّل أشكال العرض العربية (Presentation Forms) للحروف الأساسية
  s = s.normalize("NFKC");

  // 2) إزالة رموز الاتجاه والتشكيل
  s = s.replace(DIRECTION_MARKS_REGEX, "");
  s = s.replace(TASHKEEL_REGEX, "");

  // 3) تطبيع الهمزات والألف المقصورة والتاء المربوطة
  s = s
    .replace(/[أإآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي");

  // 4) توحيد الفواصل الشائعة في الإكسل (نقطة، نقطتين رأسيتين) إلى مسافة
  s = s.replace(/[.:،,]/g, " ");

  // 5) ضغط المسافات المتعددة إلى مسافة واحدة، وقصّ الأطراف
  s = s.replace(/\s+/g, " ").trim();

  // 6) إزالة الأرقام اللاحقة في نهاية الاسم (مثل "طلب 2" أو ترقيم آلي)
  s = s.replace(/\s*\d+$/g, "").trim();

  return s;
}

export function normalizeArabicText(raw: string): string {
  if (!raw) return "";
  return raw
    .normalize("NFKC")
    .replace(DIRECTION_MARKS_REGEX, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** مسافة Levenshtein بين نصّين. */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

/**
 * نسبة تشابه بين 0 و1 مبنية على مسافة Levenshtein بعد التطبيع،
 * مع مكافأة إضافية إذا كان أحد الاسمين مجرّد جزء (توكن) من الآخر
 * — يغطي حالة "حذوه" داخل "أ.خالد : حذوه".
 */
export function levenshteinRatio(a: string, b: string): number {
  const na = normalizeClientName(a);
  const nb = normalizeClientName(b);
  if (!na || !nb) return 0;

  const maxLen = Math.max(na.length, nb.length);
  const dist = levenshteinDistance(na, nb);
  const baseRatio = 1 - dist / maxLen;

  // معامل الاحتواء: نسبة التوكنات المشتركة إلى أصغر الاسمين (توكنات) —
  // يغطي حالة اسم قصير كـ"حذوه" وارد ضمن اسم أطول كـ"أ.خالد : حذوه"
  const tokensA = new Set(na.split(" ").filter(Boolean));
  const tokensB = new Set(nb.split(" ").filter(Boolean));
  const shared = [...tokensA].filter((t) => tokensB.has(t)).length;
  const containmentRatio = shared / Math.max(Math.min(tokensA.size, tokensB.size), 1);

  return Math.max(baseRatio, containmentRatio);
}

const SIMILARITY_THRESHOLD = 0.4;

/** يبحث عن أسماء عملاء موجودة تشبه اسمًا جديدًا مُدخَلًا، لعرض تحذير قبل الحفظ. */
export function findSimilarNames(
  candidate: string,
  existingNames: string[],
  threshold: number = SIMILARITY_THRESHOLD,
): string[] {
  return existingNames.filter((name) => {
    if (normalizeClientName(name) === normalizeClientName(candidate)) return false;
    return levenshteinRatio(candidate, name) >= threshold;
  });
}
