const RIYADH = 'Asia/Riyadh'

/** YYYY-MM-DD بتوقيت الرياض مهما كانت منطقة الجهاز. */
export function todayInRiyadh(now: Date = new Date()): string {
  // en-CA يعطي ISO مباشرة (YYYY-MM-DD) بأرقام غربية.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: RIYADH,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function isValidISODate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const probe = new Date(Date.UTC(y, m - 1, d))
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d
}

/** ترتيب نصي للتواريخ بصيغة ISO يساوي الترتيب الزمني — نستفيد من ذلك في كل المقارنات. */
export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

const WEEKDAY_NAMES = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const MONTH_NAMES = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

function parts(iso: string): { y: number; m: number; d: number; weekday: number } {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d, weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay() }
}

/** «الأربعاء 5 سبتمبر» — بلا سنة، فالسجل قصير المدى. */
export function formatDayLabel(iso: string): string {
  const { m, d, weekday } = parts(iso)
  return `${WEEKDAY_NAMES[weekday]} ${d} ${MONTH_NAMES[m - 1]}`
}

/** «5 سبتمبر 2026» — للعناوين التي تحتاج السنة. */
export function formatFullDate(iso: string): string {
  const { y, m, d } = parts(iso)
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`
}

/** «5/9» — للمحاور الضيقة في الرسوم. */
export function formatAxisDate(iso: string): string {
  const { m, d } = parts(iso)
  return `${d}/${m}`
}

/** عطلة نهاية الأسبوع في السوق السعودي: الجمعة والسبت. */
export function isWeekend(iso: string): boolean {
  const { weekday } = parts(iso)
  return weekday === 5 || weekday === 6
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

export function addDays(iso: string, count: number): string {
  const base = Date.parse(`${iso}T00:00:00Z`) + count * 86_400_000
  return new Date(base).toISOString().slice(0, 10)
}
