/**
 * طبقة المال الوحيدة في التطبيق.
 *
 * كل حساب داخلي يجري على **الهللات كأعداد صحيحة** (320 ريال = 32000 هللة)،
 * فلا تتراكم أخطاء الفاصلة العائمة عبر ثلاثين يوماً. التحويل من/إلى الريال
 * يحدث هنا فقط — لا يُسمح بضرب أو قسمة مبالغ خارج هذا الملف.
 */

/** تقريب لأقرب صحيح مع تقريب النصف بعيداً عن الصفر (‎−0.5 → ‎−1 وليس 0). */
function roundHalfAwayFromZero(value: number): number {
  // toFixed(6) يصحّح تمثيل الفاصلة العائمة قبل التقريب:
  // 3.405 * 100 = 340.49999999999994 → "340.500000" → 341
  const corrected = Number(Math.abs(value).toFixed(6))
  return Math.sign(value) * Math.round(corrected)
}

/** ريال (عدد عشري من واجهة الإدخال أو ملف الاستيراد) → هللات صحيحة. */
export function toHalalas(sar: number): number {
  if (!Number.isFinite(sar)) return 0
  return roundHalfAwayFromZero(sar * 100)
}

/** هللات صحيحة → ريال بخانتين عشريتين. صيغة التخزين والتصدير. */
export function toSAR(halalas: number): number {
  return roundHalfAwayFromZero(halalas) / 100
}

/** هللات ريال → سنتات دولار، حسب سعر الصرف. */
export function halalasToCents(halalas: number, fxRate: number): number {
  if (!Number.isFinite(fxRate) || fxRate <= 0) return 0
  return roundHalfAwayFromZero(halalas / fxRate)
}

/** ضرب مبلغ بنسبة (مثل معامل النمو المركّب) مع البقاء في نطاق الأعداد الصحيحة. */
export function scaleHalalas(halalas: number, factor: number): number {
  return roundHalfAwayFromZero(halalas * factor)
}

const decimalFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const wholeFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/**
 * أرقام غربية بفواصل آلاف، بخانتين عشريتين دائماً حتى تصطف الأعمدة.
 * لا تُلحق اسم العملة — الواجهة تضع «ريال» أو «$» بحجم أصغر بجانب الرقم.
 */
export function formatAmount(halalas: number): string {
  return decimalFormatter.format(toSAR(halalas))
}

/** صيغة مختصرة بلا كسور — للمحاور والتسميات الضيقة. */
export function formatAmountShort(halalas: number): string {
  return wholeFormatter.format(Math.round(halalas / 100))
}

/** يسبق الموجب بعلامة ‎+‎ صراحةً؛ السالب يحمل ‎−‎ (شرطة الطرح لا الواصلة). */
export function formatSigned(halalas: number): string {
  const body = formatAmount(Math.abs(halalas))
  if (halalas > 0) return `+${body}`
  if (halalas < 0) return `−${body}`
  return body
}

/** نسبة عشرية (0.078125) → «7.81%». */
export function formatPercent(ratio: number, fractionDigits = 2): string {
  if (!Number.isFinite(ratio)) return '—'
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
  return `${formatter.format(ratio * 100)}%`
}

export function formatSignedPercent(ratio: number, fractionDigits = 2): string {
  if (!Number.isFinite(ratio)) return '—'
  const body = formatPercent(Math.abs(ratio), fractionDigits)
  if (ratio > 0) return `+${body}`
  if (ratio < 0) return `−${body}`
  return body
}

/** مضاعف رأس المال: 8.140274 → «8.14x». */
export function formatMultiple(multiple: number): string {
  if (!Number.isFinite(multiple)) return '—'
  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(multiple)}x`
}

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩'
const EASTERN_ARABIC_INDIC = '۰۱۲۳۴۵۶۷۸۹'

/**
 * يقرأ ما يكتبه المستخدم فعلاً: أرقام عربية أو هندية، فاصلة عشرية عربية (٫)،
 * فواصل آلاف، ومسافات. يعيد `null` حين لا يوجد رقم صالح.
 */
export function parseAmountInput(text: string): number | null {
  if (typeof text !== 'string') return null
  let normalized = ''
  for (const char of text.trim()) {
    const arabicIndex = ARABIC_INDIC.indexOf(char)
    if (arabicIndex >= 0) {
      normalized += String(arabicIndex)
      continue
    }
    const easternIndex = EASTERN_ARABIC_INDIC.indexOf(char)
    if (easternIndex >= 0) {
      normalized += String(easternIndex)
      continue
    }
    if (char === '٫' || char === '،') {
      normalized += '.'
      continue
    }
    if (char === ',' || char === ' ' || char === '٬' || char === '‏' || char === '‎') {
      continue // فاصل آلاف أو محرف اتجاه — نتجاهله
    }
    normalized += char
  }
  if (normalized === '' || normalized === '-' || normalized === '.') return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}
