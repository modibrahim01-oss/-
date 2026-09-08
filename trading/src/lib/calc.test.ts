import { describe, expect, it } from 'vitest'
import { balanceSeries, buildLedger, findDay } from './calc'
import { formatAmount, formatMultiple, formatPercent, toHalalas, toSAR } from './money'
import { buildProjection } from './projection'
import { DEFAULT_SETTINGS, type AppData, type CashFlow, type Settings, type Trade } from './types'

const settings: Settings = { ...DEFAULT_SETTINGS, startDate: '2026-09-06' }

function trade(date: string, symbol: string, resultSAR: number, seq = 0): Trade {
  const stamp = `2026-09-06T${String(seq).padStart(2, '0')}:00:00.000Z`
  return { id: `t${date}${symbol}${seq}`, date, symbol, resultSAR, createdAt: stamp, updatedAt: stamp }
}

function flow(date: string, type: CashFlow['type'], amountSAR: number, seq = 0): CashFlow {
  const stamp = `2026-09-06T${String(seq).padStart(2, '0')}:00:00.000Z`
  return { id: `f${date}${type}${seq}`, date, type, amountSAR, createdAt: stamp, updatedAt: stamp }
}

function data(partial: Partial<AppData> = {}): AppData {
  return {
    schemaVersion: 1,
    settings,
    trades: [],
    cashFlows: [],
    dayChecks: [],
    ...partial,
  }
}

describe('طبقة المال — التقريب بالهللات', () => {
  it('تحوّل الريال إلى هللات صحيحة بلا انحراف عائم', () => {
    expect(toHalalas(320)).toBe(32000)
    expect(toHalalas(3.405)).toBe(341) // 3.405 * 100 = 340.49999999999994 في الفاصلة العائمة
    expect(toHalalas(0.1 + 0.2)).toBe(30)
    expect(toHalalas(-15)).toBe(-1500)
    expect(toHalalas(-0.005)).toBe(-1) // النصف يقرّب بعيداً عن الصفر في الاتجاهين
  })

  it('لا تتراكم الأخطاء عبر 30 يوماً من مبالغ عشرية', () => {
    let total = 0
    for (let i = 0; i < 30; i += 1) total += toHalalas(0.1)
    expect(total).toBe(300)
    expect(toSAR(total)).toBe(3)
  })
})

describe('جدول التوقع — القيم المرجعية من ملف الإكسل', () => {
  const table = buildProjection(settings) // 320 ريال، 3.75، 22 يوماً

  it('اليوم الأول عند 10% = 352.00 ريال و 93.87 دولار', () => {
    const firstDay = table.rows[0].cells[0]
    expect(formatAmount(firstDay.balanceHalalas)).toBe('352.00')
    expect(formatAmount(firstDay.balanceCents)).toBe('93.87')
  })

  it.each([
    [0, '2,604.89', '2,284.89', '8.14x'],
    [1, '6,926.32', '6,606.32', '21.64x'],
    [2, '17,665.97', '17,345.97', '55.21x'],
  ])('اليوم 22 — النسبة رقم %i', (index, balance, profit, multiple) => {
    const total = table.totals[index]
    expect(formatAmount(total.balanceHalalas)).toBe(balance)
    expect(formatAmount(total.profitHalalas)).toBe(profit)
    expect(formatMultiple(total.multiple)).toBe(multiple)
  })

  it('يتحقق برأس مال 1,000 ريال أيضاً', () => {
    const bigger = buildProjection({ ...settings, startingCapitalSAR: 1000 })
    expect(formatAmount(bigger.totals[0].balanceHalalas)).toBe('8,140.27')
    expect(formatAmount(bigger.totals[1].balanceHalalas)).toBe('21,644.75')
    expect(formatAmount(bigger.totals[2].balanceHalalas)).toBe('55,206.14')
  })

  it('طول الجدول يتبع عدد أيام التداول', () => {
    expect(table.rows).toHaveLength(22)
    expect(buildProjection({ ...settings, tradingDaysPerMonth: 5 }).rows).toHaveLength(5)
  })
})

describe('الحسابات الفعلية — سيناريو معايير القبول', () => {
  it('صفقة ‎+40‎ ريال → الرصيد 360، ربح اليوم 40، النسبة 12.5%', () => {
    const ledger = buildLedger(data({ trades: [trade('2026-09-06', 'أرامكو', 40)] }))
    const day = findDay(ledger, '2026-09-06')!
    expect(toSAR(ledger.currentBalanceHalalas)).toBe(360)
    expect(toSAR(day.dayPLHalalas)).toBe(40)
    expect(formatPercent(day.dayPct!)).toBe('12.50%')
  })

  it('ثم صفقة ‎−15‎ في نفس اليوم → الرصيد 345، ربح اليوم 25، النسبة 7.81%', () => {
    const ledger = buildLedger(
      data({
        trades: [trade('2026-09-06', 'أرامكو', 40, 1), trade('2026-09-06', 'سابك', -15, 2)],
      }),
    )
    const day = findDay(ledger, '2026-09-06')!
    expect(toSAR(ledger.currentBalanceHalalas)).toBe(345)
    expect(toSAR(day.dayPLHalalas)).toBe(25)
    expect(day.dayPct).toBeCloseTo(0.078125, 10)
    expect(formatPercent(day.dayPct!)).toBe('7.81%')
    expect(ledger.days).toHaveLength(1) // صفقتان في يوم واحد تُجمعان في صف واحد
  })

  it('ثم إيداع 100 ريال → الرصيد 445 وصافي الربح يبقى 25 ريال', () => {
    const ledger = buildLedger(
      data({
        trades: [trade('2026-09-06', 'أرامكو', 40, 1), trade('2026-09-06', 'سابك', -15, 2)],
        cashFlows: [flow('2026-09-07', 'deposit', 100)],
      }),
    )
    expect(toSAR(ledger.currentBalanceHalalas)).toBe(445)
    expect(toSAR(ledger.totalProfitHalalas)).toBe(25)
    expect(toSAR(ledger.netDepositsHalalas)).toBe(100)
  })

  it('يوم بلا صفقات لا يظهر في السجل ولا يكسر تسلسل الرصيد', () => {
    const ledger = buildLedger(
      data({
        trades: [trade('2026-09-06', 'أرامكو', 40, 1), trade('2026-09-06', 'سابك', -15, 2)],
        cashFlows: [flow('2026-09-07', 'deposit', 100)],
      }),
    )
    // 2026-09-08 بلا حركة إطلاقاً
    expect(findDay(ledger, '2026-09-08')).toBeNull()
    expect(ledger.days.map((d) => d.date)).toEqual(['2026-09-06', '2026-09-07'])
    expect(toSAR(ledger.currentBalanceHalalas)).toBe(445)
  })

  it('تسوية: الرصيد الفعلي 440 مقابل محسوب 445 → فرق غير مسجّل ‎−5‎ ريال', () => {
    const ledger = buildLedger(
      data({
        trades: [trade('2026-09-06', 'أرامكو', 40, 1), trade('2026-09-06', 'سابك', -15, 2)],
        cashFlows: [flow('2026-09-07', 'deposit', 100)],
        dayChecks: [{ date: '2026-09-07', actualWalletSAR: 440 }],
      }),
    )
    const day = findDay(ledger, '2026-09-07')!
    expect(toSAR(day.discrepancyHalalas!)).toBe(-5)
  })
})

describe('حالات حديّة', () => {
  it('السحب يخفض الرصيد ولا يمس الربح', () => {
    const ledger = buildLedger(
      data({
        trades: [trade('2026-09-06', 'أرامكو', 40)],
        cashFlows: [flow('2026-09-07', 'withdrawal', 50)],
      }),
    )
    expect(toSAR(ledger.currentBalanceHalalas)).toBe(310)
    expect(toSAR(ledger.totalProfitHalalas)).toBe(40)
    expect(toSAR(ledger.netDepositsHalalas)).toBe(-50)
  })

  it('خسارة تتجاوز الرصيد مسموحة ويظهر الرصيد سالباً', () => {
    const ledger = buildLedger(data({ trades: [trade('2026-09-06', 'سابك', -400)] }))
    expect(toSAR(ledger.currentBalanceHalalas)).toBe(-80)
    expect(toSAR(ledger.totalProfitHalalas)).toBe(-400)
  })

  it('رصيد افتتاح غير موجب يُلغي نسبة اليوم بدل إظهار رقم مضلّل', () => {
    const ledger = buildLedger(
      data({
        trades: [trade('2026-09-06', 'سابك', -400, 1), trade('2026-09-07', 'أرامكو', 20, 2)],
      }),
    )
    expect(findDay(ledger, '2026-09-07')!.dayPct).toBeNull()
  })

  it('رصيد الافتتاح هو إقفال آخر يوم فيه حركة، وليس اليوم السابق تقويمياً', () => {
    const ledger = buildLedger(
      data({
        trades: [trade('2026-09-06', 'أرامكو', 40, 1), trade('2026-09-20', 'سابك', 36, 2)],
      }),
    )
    const later = findDay(ledger, '2026-09-20')!
    expect(toSAR(later.openingBalanceHalalas)).toBe(360)
    expect(formatPercent(later.dayPct!)).toBe('10.00%')
  })

  it('حذف صفقة قديمة يعيد حساب كل الأيام اللاحقة', () => {
    const all = [trade('2026-09-06', 'أرامكو', 40, 1), trade('2026-09-20', 'سابك', 36, 2)]
    const without = buildLedger(data({ trades: all.slice(1) }))
    expect(toSAR(without.currentBalanceHalalas)).toBe(356)
    expect(toSAR(findDay(without, '2026-09-20')!.openingBalanceHalalas)).toBe(320)
  })

  it('أداء الأسهم يُجمع لكل رمز ويُرتّب تنازلياً', () => {
    const ledger = buildLedger(
      data({
        trades: [
          trade('2026-09-06', 'أرامكو', 40, 1),
          trade('2026-09-06', 'سابك', -15, 2),
          trade('2026-09-07', 'أرامكو', 10, 3),
        ],
      }),
    )
    expect(ledger.bySymbol).toEqual([
      { symbol: 'أرامكو', resultHalalas: 5000, tradeCount: 2, winCount: 2, lossCount: 0 },
      { symbol: 'سابك', resultHalalas: -1500, tradeCount: 1, winCount: 0, lossCount: 1 },
    ])
  })

  it('سلسلة الرسم تبدأ من رأس المال في تاريخ البداية', () => {
    const ledger = buildLedger(data({ trades: [trade('2026-09-10', 'أرامكو', 40)] }))
    const series = balanceSeries(ledger, settings)
    expect(series[0]).toMatchObject({ date: '2026-09-06', balanceHalalas: 32000 })
    expect(series[1]).toMatchObject({ date: '2026-09-10', balanceHalalas: 36000 })
  })

  it('لا تتكرر نقطة البداية حين يكون يوم البداية نفسه فيه حركة', () => {
    const ledger = buildLedger(data({ trades: [trade('2026-09-06', 'أرامكو', 40)] }))
    const series = balanceSeries(ledger, settings)
    expect(series).toHaveLength(1)
    expect(series[0]).toMatchObject({ date: '2026-09-06', balanceHalalas: 36000 })
  })

  it('السجل الفارغ لا ينهار', () => {
    const ledger = buildLedger(data())
    expect(ledger.days).toEqual([])
    expect(toSAR(ledger.currentBalanceHalalas)).toBe(320)
    expect(ledger.totalProfitHalalas).toBe(0)
    expect(ledger.firstActiveDate).toBeNull()
  })
})
