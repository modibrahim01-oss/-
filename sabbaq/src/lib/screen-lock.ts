/**
 * قفل شاشة العرض: يمنع الطلاب من مغادرة الشاشة إلى لوحة المشرف ومنح النقاط
 * لأنفسهم إن غاب المشرف عن جهاز مسجَّل الدخول.
 *
 * القفل كوكي في متصفح الشاشة يحمل مسار الشاشة المقفلة. الوسيط
 * (middleware.ts) يقرؤه: كل صفحة للمشرف أو الإدارة تُحوَّل إلى الشاشة، وكل
 * إجراء (منح، تراجع، خصم) يُرفض — حتى من تبويب لوحة كان مفتوحًا قبل القفل.
 * يُفتح بضغطة مطوّلة على شعار الشاشة يعرفها المشرف، بلا رمز.
 */

export const LOCK_COOKIE = "sabbaq-lock";
export const UNLOCK_HOLD_MS = 3000;

/** مسار مقبول للقفل: شاشة عرض فقط، فلا يصير الكوكي تحويلًا إلى أي مكان. */
export function isLockPath(value: string | undefined | null): value is string {
  return typeof value === "string" && /^\/tv(\/\d{1,2}(-\d{1,2}){0,6})?$/.test(value);
}

export function readLock(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${LOCK_COOKIE}=([^;]*)`));
  const value = m ? decodeURIComponent(m[1]) : null;
  return isLockPath(value) ? value : null;
}

export function writeLock(path: string | null) {
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = path
    ? `${LOCK_COOKIE}=${encodeURIComponent(path)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax${secure}`
    : `${LOCK_COOKIE}=; path=/; max-age=0; samesite=lax${secure}`;
}
