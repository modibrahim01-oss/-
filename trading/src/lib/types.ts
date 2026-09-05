export const SCHEMA_VERSION = 1 as const

export type Settings = {
  schemaVersion: typeof SCHEMA_VERSION
  /** رأس المال عند بداية المتابعة، بالريال. */
  startingCapitalSAR: number
  /** ريال لكل دولار. */
  fxRate: number
  /** طول جدول التوقع. */
  tradingDaysPerMonth: number
  /** نسب الربح اليومية المفترضة في جدول التوقع، ككسور عشرية. */
  projectionRates: number[]
  /** YYYY-MM-DD — بداية فترة المتابعة. */
  startDate: string
}

export type Trade = {
  id: string
  /** YYYY-MM-DD بتوقيت الرياض. */
  date: string
  symbol: string
  /** موجب = ربح، سالب = خسارة. */
  resultSAR: number
  amountInvestedSAR?: number
  entryPrice?: number
  exitPrice?: number
  quantity?: number
  feesSAR?: number
  note?: string
  createdAt: string
  updatedAt: string
}

export type CashFlow = {
  id: string
  date: string
  type: 'deposit' | 'withdrawal'
  amountSAR: number
  note?: string
  createdAt: string
  updatedAt: string
}

export type DayCheck = {
  date: string
  /** الرصيد الحقيقي كما يظهر في المحفظة نهاية اليوم. */
  actualWalletSAR: number
}

export type AppData = {
  schemaVersion: typeof SCHEMA_VERSION
  settings: Settings
  trades: Trade[]
  cashFlows: CashFlow[]
  dayChecks: DayCheck[]
}

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: SCHEMA_VERSION,
  startingCapitalSAR: 320,
  fxRate: 3.75,
  tradingDaysPerMonth: 22,
  projectionRates: [0.1, 0.15, 0.2],
  startDate: '',
}
