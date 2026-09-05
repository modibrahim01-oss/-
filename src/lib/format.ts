/**
 * تنسيق الأرقام والعملة بالأرقام العربية الغربية (1234) دائمًا،
 * بغض النظر عن لغة المتصفح — لأن Intl مع locale "ar" قد يستخدم
 * الأرقام الهندية في بعض البيئات.
 */
export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatSAR(value: number): string {
  return `${formatNumber(value, 2)} ر.س`;
}

export function formatPct(value: number, decimals = 1): string {
  return `${formatNumber(value, decimals)}%`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
