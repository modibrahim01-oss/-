/**
 * نافذة تراجع المشرف عن منحه كما تعرضها الواجهة.
 *
 * الخادم (undo_my_award في 0006) يقبل نصف دقيقة زائدة: هامشٌ لفرق الساعة
 * بين الجهاز والخادم ولتأخّر الشبكة، فلا يُرفض تراجعٌ ضُغط في ثانيته الأخيرة.
 * فلا تُطال هذه القيمة دون تعديل الدالة معها.
 */
export const UNDO_WINDOW_MS = 2 * 60 * 1000;

/** الثواني المتبقّية للتراجع عن منح تمّ في `awardedAt`، أو صفر إن انقضت. */
export function undoSecondsLeft(awardedAt: string | number, now: number): number {
  // صفر = الساعة لم تُضبط بعد (الرسم الأول قبل التركيب): لا نافذة مفتوحة
  if (now <= 0) return 0;
  const at = typeof awardedAt === "number" ? awardedAt : Date.parse(awardedAt);
  if (!Number.isFinite(at)) return 0;
  return Math.max(0, Math.ceil((at + UNDO_WINDOW_MS - now) / 1000));
}
