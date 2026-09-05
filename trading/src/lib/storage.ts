import { isValidISODate, todayInRiyadh } from './date'
import { DEFAULT_SETTINGS, SCHEMA_VERSION, type AppData, type CashFlow, type DayCheck, type Settings, type Trade } from './types'

const STORAGE_KEY = 'trading-tracker/v1'

export class StorageQuotaError extends Error {
  constructor() {
    super('لم يعد في المتصفح مساحة كافية لحفظ البيانات.')
    this.name = 'StorageQuotaError'
  }
}

export class ImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImportError'
  }
}

function emptyData(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS, startDate: todayInRiyadh() },
    trades: [],
    cashFlows: [],
    dayChecks: [],
  }
}

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false
  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22
  )
}

export const repository = {
  load(): AppData {
    let raw: string | null = null
    try {
      raw = window.localStorage.getItem(STORAGE_KEY)
    } catch {
      // متصفح يمنع التخزين (تصفح خاص مثلاً) — نعمل في الذاكرة فقط.
      return emptyData()
    }
    if (!raw) return emptyData()
    try {
      return normalize(JSON.parse(raw))
    } catch {
      // بيانات تالفة: نبدأ من فراغ بدل الانهيار، والنسخة التالفة تبقى تحت
      // مفتاح منفصل حتى يمكن إنقاذها يدوياً.
      try {
        window.localStorage.setItem(`${STORAGE_KEY}.corrupt`, raw)
      } catch {
        /* لا شيء نفعله */
      }
      return emptyData()
    }
  },

  save(data: AppData): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      if (isQuotaError(error)) throw new StorageQuotaError()
      throw error
    }
  },

  clear(): void {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* لا شيء نفعله */
    }
  },
}

// ————————————————————————————————————————————————————————————
// التحقق من الشكل
// ————————————————————————————————————————————————————————————

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function optionalNum(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function normalizeSettings(value: unknown): Settings {
  const raw = isRecord(value) ? value : {}
  const rates = Array.isArray(raw.projectionRates)
    ? raw.projectionRates.filter((r): r is number => typeof r === 'number' && Number.isFinite(r))
    : []
  const startDate = str(raw.startDate)
  return {
    schemaVersion: SCHEMA_VERSION,
    startingCapitalSAR: num(raw.startingCapitalSAR, DEFAULT_SETTINGS.startingCapitalSAR),
    fxRate: num(raw.fxRate, DEFAULT_SETTINGS.fxRate) || DEFAULT_SETTINGS.fxRate,
    tradingDaysPerMonth: Math.max(1, Math.floor(num(raw.tradingDaysPerMonth, 22))),
    projectionRates: rates.length > 0 ? rates : [...DEFAULT_SETTINGS.projectionRates],
    startDate: isValidISODate(startDate) ? startDate : todayInRiyadh(),
  }
}

function normalizeTrade(value: unknown, index: number): Trade | null {
  if (!isRecord(value)) return null
  const date = str(value.date)
  if (!isValidISODate(date)) return null
  const resultSAR = optionalNum(value.resultSAR)
  if (resultSAR === undefined) return null
  const stamp = str(value.createdAt) || new Date().toISOString()
  return {
    id: str(value.id) || `imported-${index}-${stamp}`,
    date,
    symbol: str(value.symbol),
    resultSAR,
    amountInvestedSAR: optionalNum(value.amountInvestedSAR),
    entryPrice: optionalNum(value.entryPrice),
    exitPrice: optionalNum(value.exitPrice),
    quantity: optionalNum(value.quantity),
    feesSAR: optionalNum(value.feesSAR),
    note: typeof value.note === 'string' ? value.note : undefined,
    createdAt: stamp,
    updatedAt: str(value.updatedAt) || stamp,
  }
}

function normalizeCashFlow(value: unknown, index: number): CashFlow | null {
  if (!isRecord(value)) return null
  const date = str(value.date)
  if (!isValidISODate(date)) return null
  const amountSAR = optionalNum(value.amountSAR)
  if (amountSAR === undefined) return null
  const type = value.type === 'withdrawal' ? 'withdrawal' : 'deposit'
  const stamp = str(value.createdAt) || new Date().toISOString()
  return {
    id: str(value.id) || `imported-flow-${index}-${stamp}`,
    date,
    type,
    amountSAR,
    note: typeof value.note === 'string' ? value.note : undefined,
    createdAt: stamp,
    updatedAt: str(value.updatedAt) || stamp,
  }
}

function normalizeDayCheck(value: unknown): DayCheck | null {
  if (!isRecord(value)) return null
  const date = str(value.date)
  const actualWalletSAR = optionalNum(value.actualWalletSAR)
  if (!isValidISODate(date) || actualWalletSAR === undefined) return null
  return { date, actualWalletSAR }
}

/** يقبل أي شكل ويعيد بنية صالحة، متجاهلاً السجلات المشوّهة بصمت. */
export function normalize(value: unknown): AppData {
  const raw = isRecord(value) ? value : {}
  const trades = Array.isArray(raw.trades)
    ? raw.trades.map(normalizeTrade).filter((t): t is Trade => t !== null)
    : []
  const cashFlows = Array.isArray(raw.cashFlows)
    ? raw.cashFlows.map(normalizeCashFlow).filter((f): f is CashFlow => f !== null)
    : []
  const dayChecks = Array.isArray(raw.dayChecks)
    ? raw.dayChecks.map(normalizeDayCheck).filter((c): c is DayCheck => c !== null)
    : []
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: normalizeSettings(raw.settings),
    trades,
    cashFlows,
    dayChecks,
  }
}

/**
 * تحقّق صارم للاستيراد: يرفض بشرح السبب بدل أن يبتلع الملف بصمت.
 * الاستدعاء لا يمس البيانات الحالية — المُستدعي هو من يقرر الاستبدال.
 */
export function parseBackup(text: string): AppData {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ImportError('الملف ليس بصيغة JSON صالحة. تأكد أنك اخترت ملف النسخة الاحتياطية نفسه.')
  }
  if (!isRecord(parsed)) {
    throw new ImportError('محتوى الملف ليس كائن بيانات. تأكد أنك اخترت ملف النسخة الاحتياطية نفسه.')
  }
  const version = parsed.schemaVersion
  if (version === undefined) {
    throw new ImportError('الملف لا يحمل رقم إصدار (schemaVersion) — على الأرجح ليس نسخة احتياطية من هذا التطبيق.')
  }
  if (version !== SCHEMA_VERSION) {
    throw new ImportError(
      `إصدار الملف ${String(version)} لا يطابق إصدار التطبيق ${SCHEMA_VERSION}. لم يُمسّ شيء من بياناتك الحالية.`,
    )
  }
  if (!Array.isArray(parsed.trades)) {
    throw new ImportError('الملف لا يحتوي قائمة صفقات (trades). لم يُمسّ شيء من بياناتك الحالية.')
  }
  return normalize(parsed)
}
