import { compareDates } from './date'
import { halalasToCents, toHalalas } from './money'
import type { AppData, CashFlow, DayCheck, Settings, Trade } from './types'

export type DaySummary = {
  date: string
  trades: Trade[]
  cashFlows: CashFlow[]
  /** مجموع نتائج صفقات اليوم. */
  dayPLHalalas: number
  /** إيداعات اليوم ناقص سحوباته. لا يدخل في الربح إطلاقاً. */
  netFlowHalalas: number
  /** رصيد إقفال آخر يوم فيه حركة قبل هذا اليوم. */
  openingBalanceHalalas: number
  closingBalanceHalalas: number
  /** ربح اليوم ÷ رصيد الافتتاح. `null` حين لا يوجد رصيد افتتاح موجب. */
  dayPct: number | null
  /** الربح المتراكم منذ البداية حتى نهاية هذا اليوم — بلا الإيداعات. */
  cumulativeProfitHalalas: number
  actualWalletHalalas: number | null
  /** الفعلي ناقص المحسوب. سالب = خرج من المحفظة ما لم يُسجَّل (عمولات غالباً). */
  discrepancyHalalas: number | null
}

export type SymbolPerformance = {
  symbol: string
  resultHalalas: number
  tradeCount: number
  winCount: number
  lossCount: number
}

export type Ledger = {
  days: DaySummary[]
  startingCapitalHalalas: number
  netDepositsHalalas: number
  currentBalanceHalalas: number
  /** صافي الربح منذ البداية = مجموع نتائج كل الصفقات. الإيداعات ليست ربحاً. */
  totalProfitHalalas: number
  /** الربح ÷ (رأس المال + صافي الإيداعات). `null` حين لا يوجد أساس موجب. */
  totalReturnPct: number | null
  tradeCount: number
  winDays: number
  lossDays: number
  flatDays: number
  bySymbol: SymbolPerformance[]
  /** أول يوم فيه حركة، أو `null` حين لا توجد بيانات. */
  firstActiveDate: string | null
  lastActiveDate: string | null
}

function sumTrades(trades: Trade[]): number {
  return trades.reduce((total, trade) => total + toHalalas(trade.resultSAR), 0)
}

function sumFlows(flows: CashFlow[]): number {
  return flows.reduce((total, flow) => {
    const magnitude = Math.abs(toHalalas(flow.amountSAR))
    return total + (flow.type === 'deposit' ? magnitude : -magnitude)
  }, 0)
}

function groupByDate<T extends { date: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const bucket = map.get(item.date)
    if (bucket) bucket.push(item)
    else map.set(item.date, [item])
  }
  return map
}

/**
 * يبني السجل الكامل من الصفر في كل مرة.
 *
 * لا رصيد محفوظ ولا حساب تفاضلي: تعديل صفقة قديمة أو حذفها يعيد بناء كل
 * الأيام اللاحقة تلقائياً لأنها مشتقّة بالكامل. حجم البيانات (مئات السجلات)
 * يجعل هذا أرخص من أي بديل.
 */
export function buildLedger(data: AppData): Ledger {
  const startingCapitalHalalas = toHalalas(data.settings.startingCapitalSAR)

  const tradesByDate = groupByDate(data.trades)
  const flowsByDate = groupByDate(data.cashFlows)
  const checksByDate = new Map<string, DayCheck>(data.dayChecks.map((c) => [c.date, c]))

  // يوم «فيه حركة» = فيه صفقة أو إيداع/سحب أو تسوية رصيد.
  // اليوم الخالي لا يظهر في السجل ولا يكسر تسلسل الرصيد لأنه ببساطة غير موجود.
  const activeDates = [
    ...new Set([...tradesByDate.keys(), ...flowsByDate.keys(), ...checksByDate.keys()]),
  ].sort(compareDates)

  let runningBalance = startingCapitalHalalas
  let runningProfit = 0
  let runningNetDeposits = 0

  const days: DaySummary[] = activeDates.map((date) => {
    const trades = (tradesByDate.get(date) ?? []).slice()
    const cashFlows = (flowsByDate.get(date) ?? []).slice()
    trades.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    cashFlows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

    const dayPLHalalas = sumTrades(trades)
    const netFlowHalalas = sumFlows(cashFlows)
    const openingBalanceHalalas = runningBalance

    runningBalance += dayPLHalalas + netFlowHalalas
    runningProfit += dayPLHalalas
    runningNetDeposits += netFlowHalalas

    const check = checksByDate.get(date)
    const actualWalletHalalas = check ? toHalalas(check.actualWalletSAR) : null

    return {
      date,
      trades,
      cashFlows,
      dayPLHalalas,
      netFlowHalalas,
      openingBalanceHalalas,
      closingBalanceHalalas: runningBalance,
      dayPct: openingBalanceHalalas > 0 ? dayPLHalalas / openingBalanceHalalas : null,
      cumulativeProfitHalalas: runningProfit,
      actualWalletHalalas,
      discrepancyHalalas:
        actualWalletHalalas === null ? null : actualWalletHalalas - runningBalance,
    }
  })

  const bySymbol = buildSymbolPerformance(data.trades)
  const invested = startingCapitalHalalas + runningNetDeposits

  let winDays = 0
  let lossDays = 0
  let flatDays = 0
  for (const day of days) {
    if (day.trades.length === 0) continue
    if (day.dayPLHalalas > 0) winDays += 1
    else if (day.dayPLHalalas < 0) lossDays += 1
    else flatDays += 1
  }

  return {
    days,
    startingCapitalHalalas,
    netDepositsHalalas: runningNetDeposits,
    currentBalanceHalalas: runningBalance,
    totalProfitHalalas: runningProfit,
    totalReturnPct: invested > 0 ? runningProfit / invested : null,
    tradeCount: data.trades.length,
    winDays,
    lossDays,
    flatDays,
    bySymbol,
    firstActiveDate: days.length > 0 ? days[0].date : null,
    lastActiveDate: days.length > 0 ? days[days.length - 1].date : null,
  }
}

function buildSymbolPerformance(trades: Trade[]): SymbolPerformance[] {
  const map = new Map<string, SymbolPerformance>()
  for (const trade of trades) {
    const symbol = trade.symbol.trim() || 'بلا اسم'
    const result = toHalalas(trade.resultSAR)
    const entry = map.get(symbol) ?? {
      symbol,
      resultHalalas: 0,
      tradeCount: 0,
      winCount: 0,
      lossCount: 0,
    }
    entry.resultHalalas += result
    entry.tradeCount += 1
    if (result > 0) entry.winCount += 1
    else if (result < 0) entry.lossCount += 1
    map.set(symbol, entry)
  }
  return [...map.values()].sort((a, b) => b.resultHalalas - a.resultHalalas)
}

/** ملخص يوم بعينه — يعيد `null` إن لم يكن فيه حركة. */
export function findDay(ledger: Ledger, date: string): DaySummary | null {
  return ledger.days.find((day) => day.date === date) ?? null
}

export type BalancePoint = {
  date: string
  balanceHalalas: number
  dayPLHalalas: number
  cumulativeProfitHalalas: number
}

/**
 * سلسلة الرصيد للرسم البياني، مسبوقة بنقطة البداية (رأس المال) حتى لا يبدأ
 * المنحنى من فراغ عند أول يوم.
 */
export function balanceSeries(ledger: Ledger, settings: Settings): BalancePoint[] {
  const points: BalancePoint[] = []
  const anchorDate = settings.startDate || ledger.firstActiveDate
  if (anchorDate) {
    points.push({
      date: anchorDate,
      balanceHalalas: ledger.startingCapitalHalalas,
      dayPLHalalas: 0,
      cumulativeProfitHalalas: 0,
    })
  }
  for (const day of ledger.days) {
    // لو صادف أن يوم البداية نفسه فيه حركة، استبدل نقطة الإرساء بدل تكرار التاريخ.
    if (points.length === 1 && points[0].date === day.date) points.pop()
    points.push({
      date: day.date,
      balanceHalalas: day.closingBalanceHalalas,
      dayPLHalalas: day.dayPLHalalas,
      cumulativeProfitHalalas: day.cumulativeProfitHalalas,
    })
  }
  return points
}

export function toUSD(halalas: number, fxRate: number): number {
  return halalasToCents(halalas, fxRate)
}
