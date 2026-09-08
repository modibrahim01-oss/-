import { halalasToCents, scaleHalalas, toHalalas } from './money'
import type { Settings } from './types'

export type ProjectionCell = {
  rate: number
  balanceHalalas: number
  balanceCents: number
  profitHalalas: number
  profitCents: number
  multiple: number
}

export type ProjectionRow = {
  day: number
  cells: ProjectionCell[]
}

export type ProjectionTable = {
  startingCapitalHalalas: number
  startingCapitalCents: number
  fxRate: number
  days: number
  rates: number[]
  rows: ProjectionRow[]
  /** الصف الأخير — الرصيد النهائي وصافي الربح والمضاعف لكل نسبة. */
  totals: ProjectionCell[]
}

/**
 * أرباح مركّبة صافية: الرصيد بعد `day` يوماً = رأس المال × (1 + النسبة)^اليوم.
 *
 * نفس معادلة ملف الإكسل تماماً (`$F$6*(1+$B$10)^$A12` ثم × سعر الصرف)، مع
 * فارق واحد: نحسب بالهللات ونقرّب مرة واحدة في نهاية كل خلية.
 */
export function projectedBalanceHalalas(
  startingCapitalHalalas: number,
  rate: number,
  day: number,
): number {
  return scaleHalalas(startingCapitalHalalas, Math.pow(1 + rate, day))
}

export function buildProjection(settings: Settings): ProjectionTable {
  const startingCapitalHalalas = toHalalas(settings.startingCapitalSAR)
  const fxRate = settings.fxRate
  const days = Math.max(0, Math.floor(settings.tradingDaysPerMonth))
  const rates = settings.projectionRates

  const cellFor = (rate: number, day: number): ProjectionCell => {
    const balanceHalalas = projectedBalanceHalalas(startingCapitalHalalas, rate, day)
    const profitHalalas = balanceHalalas - startingCapitalHalalas
    return {
      rate,
      balanceHalalas,
      balanceCents: halalasToCents(balanceHalalas, fxRate),
      profitHalalas,
      profitCents: halalasToCents(profitHalalas, fxRate),
      multiple:
        startingCapitalHalalas > 0 ? balanceHalalas / startingCapitalHalalas : Number.NaN,
    }
  }

  const rows: ProjectionRow[] = []
  for (let day = 1; day <= days; day += 1) {
    rows.push({ day, cells: rates.map((rate) => cellFor(rate, day)) })
  }

  return {
    startingCapitalHalalas,
    startingCapitalCents: halalasToCents(startingCapitalHalalas, fxRate),
    fxRate,
    days,
    rates,
    rows,
    totals: rates.map((rate) => cellFor(rate, days)),
  }
}

/** نقاط منحنى التوقع لعرضها فوق منحنى الرصيد الفعلي. */
export function projectionSeries(
  startingCapitalHalalas: number,
  rate: number,
  days: number,
): number[] {
  const series: number[] = []
  for (let day = 0; day <= days; day += 1) {
    series.push(projectedBalanceHalalas(startingCapitalHalalas, rate, day))
  }
  return series
}
