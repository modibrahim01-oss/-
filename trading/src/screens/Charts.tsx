import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { IconPlus, IconWarning } from '../components/icons'
import { Callout, Delta, EmptyState, Screen, SectionTitle, cx } from '../components/ui'
import { balanceSeries } from '../lib/calc'
import { formatAxisDate, formatDayLabel } from '../lib/date'
import { formatAmount, formatAmountShort, formatPercent } from '../lib/money'
import { projectedBalanceHalalas } from '../lib/projection'
import { useStore } from '../lib/store'

const GAIN = '#3FA96A'
const LOSS = '#D45C50'
const PROJ = '#C9A227'
const GRID = 'rgba(232,230,225,0.08)'
const AXIS = '#5F5E59'

const AXIS_PROPS = {
  stroke: AXIS,
  tick: { fill: AXIS, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const

export function ChartsScreen({ onAdd }: { onAdd: () => void }) {
  const { ledger, settings } = useStore()
  const [showProjection, setShowProjection] = useState(false)
  const [logScale, setLogScale] = useState(false)

  const series = useMemo(() => balanceSeries(ledger, settings), [ledger, settings])

  const chartData = useMemo(
    () =>
      series.map((point, index) => {
        const row: Record<string, number | string> = {
          date: point.date,
          label: formatAxisDate(point.date),
          balance: point.balanceHalalas / 100,
          dayPL: point.dayPLHalalas / 100,
        }
        for (const rate of settings.projectionRates) {
          row[`proj${Math.round(rate * 100)}`] =
            projectedBalanceHalalas(ledger.startingCapitalHalalas, rate, index) / 100
        }
        return row
      }),
    [series, settings.projectionRates, ledger.startingCapitalHalalas],
  )

  // المقياس اللوغاريتمي لا يقبل صفراً ولا سالباً.
  const logAllowed = useMemo(
    () => chartData.every((row) => Number(row.balance) > 0),
    [chartData],
  )
  const useLog = logScale && logAllowed

  const dayBars = useMemo(
    () =>
      ledger.days
        .filter((day) => day.trades.length > 0)
        .map((day) => ({
          date: day.date,
          label: formatAxisDate(day.date),
          value: day.dayPLHalalas / 100,
        })),
    [ledger.days],
  )

  const symbolBars = useMemo(
    () =>
      ledger.bySymbol.map((entry) => ({
        symbol: entry.symbol,
        value: entry.resultHalalas / 100,
        tradeCount: entry.tradeCount,
      })),
    [ledger.bySymbol],
  )

  if (ledger.days.length === 0) {
    return (
      <Screen title="الرسوم البيانية">
        <EmptyState
          title="لا شيء لنرسمه بعد"
          description="سجّل بضع صفقات وستظهر هنا منحنيات الرصيد وأعمدة الأيام وأداء كل سهم."
          action={
            <button type="button" onClick={onAdd} className="btn-primary">
              <IconPlus className="h-[18px] w-[18px]" />
              إضافة صفقة
            </button>
          }
        />
      </Screen>
    )
  }

  const totalDays = ledger.winDays + ledger.lossDays + ledger.flatDays

  return (
    <Screen title="الرسوم البيانية">
      <section className="mb-10">
        <SectionTitle>تطور الرصيد</SectionTitle>
        <div className="h-56 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" reversed {...AXIS_PROPS} minTickGap={24} />
              <YAxis
                orientation="right"
                width={54}
                scale={useLog ? 'log' : 'auto'}
                domain={useLog ? ['auto', 'auto'] : ['auto', 'auto']}
                allowDataOverflow={false}
                tickFormatter={(value: number) => formatAmountShort(value * 100)}
                {...AXIS_PROPS}
              />
              <Tooltip content={<BalanceTooltip />} cursor={{ stroke: GRID }} />
              <ReferenceLine
                y={ledger.startingCapitalHalalas / 100}
                stroke={AXIS}
                strokeDasharray="3 4"
              />
              <Line
                type="monotone"
                dataKey="balance"
                name="الرصيد الفعلي"
                stroke={GAIN}
                strokeWidth={2}
                dot={chartData.length <= 20 ? { r: 2.5, fill: GAIN, strokeWidth: 0 } : false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
              {showProjection &&
                settings.projectionRates.map((rate, index) => (
                  <Line
                    key={rate}
                    type="monotone"
                    dataKey={`proj${Math.round(rate * 100)}`}
                    name={`توقع ${Math.round(rate * 100)}%`}
                    stroke={PROJ}
                    strokeWidth={1.25}
                    strokeOpacity={0.35 + index * 0.22}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 space-y-3">
          <Toggle
            checked={showProjection}
            onChange={setShowProjection}
            label="إظهار منحنيات التوقع"
            hint="التوقع رياضي بحت — مقياسه يبتلع الرصيد الفعلي."
          />
          {showProjection && (
            <>
              <Toggle
                checked={useLog}
                onChange={setLogScale}
                disabled={!logAllowed}
                label="مقياس لوغاريتمي"
                hint={
                  logAllowed
                    ? 'يضغط الفارق الهائل حتى يبقى المنحنى الفعلي مقروءاً.'
                    : 'غير متاح: المقياس اللوغاريتمي يحتاج أرصدة موجبة في كل النقاط.'
                }
              />
              {!useLog && (
                <Callout tone="warn" icon={<IconWarning className="h-4 w-4" />}>
                  الفارق بين التوقع والواقع بمئات الأضعاف، فالمنحنى الفعلي ينبطح على
                  المحور. فعّل المقياس اللوغاريتمي لتقرأ الاثنين معاً.
                </Callout>
              )}
            </>
          )}
        </div>
      </section>

      <section className="mb-10">
        <SectionTitle>ربح وخسارة كل يوم</SectionTitle>
        <div className="h-48 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dayBars} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" reversed {...AXIS_PROPS} minTickGap={20} />
              <YAxis
                orientation="right"
                width={54}
                tickFormatter={(value: number) => formatAmountShort(value * 100)}
                {...AXIS_PROPS}
              />
              <Tooltip content={<DayTooltip />} cursor={{ fill: 'rgba(232,230,225,0.05)' }} />
              <ReferenceLine y={0} stroke={AXIS} />
              <Bar
                dataKey="value"
                name="ربح اليوم"
                isAnimationActive={false}
                maxBarSize={30}
                radius={[2, 2, 0, 0]}
              >
                {dayBars.map((bar) => (
                  <Cell key={bar.date} fill={bar.value >= 0 ? GAIN : LOSS} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mb-10">
        <SectionTitle>توزيع الأيام</SectionTitle>
        {totalDays === 0 ? (
          <p className="py-4 text-[13px] text-paper-700">لا توجد أيام فيها صفقات بعد.</p>
        ) : (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-ink-600">
              <span
                className="bg-gain"
                style={{ width: `${(ledger.winDays / totalDays) * 100}%` }}
              />
              <span
                className="bg-paper-700"
                style={{ width: `${(ledger.flatDays / totalDays) * 100}%` }}
              />
              <span
                className="bg-loss"
                style={{ width: `${(ledger.lossDays / totalDays) * 100}%` }}
              />
            </div>
            <dl className="mt-4 text-[14px]">
              <DistributionRow
                label="▲ أيام رابحة"
                count={ledger.winDays}
                total={totalDays}
                tone="text-gain"
              />
              <DistributionRow
                label="– أيام متعادلة"
                count={ledger.flatDays}
                total={totalDays}
                tone="text-paper-500"
              />
              <DistributionRow
                label="▼ أيام خاسرة"
                count={ledger.lossDays}
                total={totalDays}
                tone="text-loss"
                last
              />
            </dl>
          </>
        )}
      </section>

      <section className="pb-8">
        <SectionTitle>أداء الأسهم</SectionTitle>
        <div style={{ height: Math.max(120, symbolBars.length * 34 + 24) }} dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={symbolBars}
              layout="vertical"
              margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
            >
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis
                type="number"
                reversed
                tickFormatter={(value: number) => formatAmountShort(value * 100)}
                {...AXIS_PROPS}
              />
              <YAxis
                type="category"
                dataKey="symbol"
                orientation="right"
                width={88}
                {...AXIS_PROPS}
              />
              <Tooltip content={<SymbolTooltip />} cursor={{ fill: 'rgba(232,230,225,0.05)' }} />
              <ReferenceLine x={0} stroke={AXIS} />
              <Bar dataKey="value" isAnimationActive={false} maxBarSize={22} radius={2}>
                {symbolBars.map((bar) => (
                  <Cell key={bar.symbol} fill={bar.value >= 0 ? GAIN : LOSS} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </Screen>
  )
}

function DistributionRow({
  label,
  count,
  total,
  tone,
  last,
}: {
  label: string
  count: number
  total: number
  tone: string
  last?: boolean
}) {
  return (
    <div
      className={cx(
        'flex items-baseline justify-between gap-3 py-2.5',
        !last && 'border-b border-rule',
      )}
    >
      <dt className={tone}>{label}</dt>
      <dd className="flex items-baseline gap-3">
        <span className="num text-paper-100">{count}</span>
        <span className="num w-16 text-end text-[13px] text-paper-500">
          {formatPercent(total === 0 ? 0 : count / total, 0)}
        </span>
      </dd>
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint?: string
  disabled?: boolean
}) {
  return (
    <label
      className={cx(
        'flex cursor-pointer items-start gap-3',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cx(
          'mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition',
          checked ? 'bg-proj' : 'bg-ink-500',
        )}
      >
        <span
          className={cx(
            'h-4 w-4 rounded-full bg-paper-100 transition-transform',
            checked ? '-translate-x-4' : 'translate-x-0',
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] text-paper-100">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] leading-relaxed text-paper-700">{hint}</span>}
      </span>
    </label>
  )
}

// ————————————————————————————————————————————————————————————
// تلميحات مخصّصة — الافتراضية لا تدعم RTL ولا الأرقام الجدولية
// ————————————————————————————————————————————————————————————

type TooltipProps = {
  active?: boolean
  payload?: { payload: Record<string, unknown> }[]
}

function TooltipShell({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="rounded-lg border border-rule-strong bg-ink-700 px-3 py-2 text-[12px] shadow-xl">
      {children}
    </div>
  )
}

function BalanceTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <TooltipShell>
      <p className="mb-1 text-paper-500">{formatDayLabel(String(row.date))}</p>
      <p className="num text-paper-100">{formatAmount(Number(row.balance) * 100)} ريال</p>
      {Number(row.dayPL) !== 0 && (
        <p className="mt-1">
          <Delta halalas={Number(row.dayPL) * 100} unit="" />
        </p>
      )}
    </TooltipShell>
  )
}

function DayTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <TooltipShell>
      <p className="mb-1 text-paper-500">{formatDayLabel(String(row.date))}</p>
      <Delta halalas={Number(row.value) * 100} />
    </TooltipShell>
  )
}

function SymbolTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <TooltipShell>
      <p className="mb-1 text-paper-100">{String(row.symbol)}</p>
      <Delta halalas={Number(row.value) * 100} />
      <p className="mt-1 text-paper-500">
        <span className="num">{String(row.tradeCount)}</span> صفقة
      </p>
    </TooltipShell>
  )
}
