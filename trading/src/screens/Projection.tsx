import { Fragment, useMemo, useState } from 'react'
import { IconWarning } from '../components/icons'
import { Callout, Field, Screen, SectionTitle, cx } from '../components/ui'
import { formatAmount, formatMultiple, parseAmountInput } from '../lib/money'
import { buildProjection, type ProjectionCell } from '../lib/projection'
import { useStore } from '../lib/store'

export function ProjectionScreen() {
  const { settings, updateSettings } = useStore()
  const [selectedRate, setSelectedRate] = useState<number | 'all'>('all')

  const table = useMemo(() => buildProjection(settings), [settings])
  const visibleRates =
    selectedRate === 'all' ? table.rates : table.rates.filter((rate) => rate === selectedRate)

  return (
    <Screen title="جدول التوقع">
      {/* التنويه أولاً وبحجم مقروء — لا نص رمادي صغير في الأسفل. */}
      <Callout
        tone="warn"
        icon={<IconWarning className="h-5 w-5" />}
        title="هذا حساب رياضي، وليس توقعاً لأداء حقيقي"
      >
        الجدول يفترض أنك تحقق النسبة نفسها كل يوم تداول، بلا يوم خسارة واحد ولا
        عمولة ولا انزلاق سعري. لا أحد يتداول هكذا. استخدمه لتفهم كيف يعمل التراكم
        المركّب، لا لتبني عليه قراراً أو تعتبره هدفاً.
      </Callout>

      <section className="mt-8">
        <SectionTitle>المدخلات</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="رأس المال"
            inputMode="decimal"
            dir="ltr"
            suffix="ريال"
            defaultValue={String(settings.startingCapitalSAR)}
            onBlur={(e) => {
              const value = parseAmountInput(e.target.value)
              if (value !== null && value > 0) updateSettings({ startingCapitalSAR: value })
              else e.target.value = String(settings.startingCapitalSAR)
            }}
          />
          <Field
            label="سعر الصرف"
            inputMode="decimal"
            dir="ltr"
            suffix="ريال/$"
            defaultValue={String(settings.fxRate)}
            onBlur={(e) => {
              const value = parseAmountInput(e.target.value)
              if (value !== null && value > 0) updateSettings({ fxRate: value })
              else e.target.value = String(settings.fxRate)
            }}
          />
        </div>
        <div className="mt-3">
          <Field
            label="أيام التداول في الشهر"
            inputMode="numeric"
            dir="ltr"
            suffix="يوم"
            defaultValue={String(settings.tradingDaysPerMonth)}
            onBlur={(e) => {
              const value = parseAmountInput(e.target.value)
              if (value !== null && value >= 1 && value <= 366)
                updateSettings({ tradingDaysPerMonth: Math.floor(value) })
              else e.target.value = String(settings.tradingDaysPerMonth)
            }}
            hint="22 يوماً = متوسط أيام التداول الشهرية بعد استبعاد الجمعة والسبت."
          />
        </div>
        <p className="mt-3 text-[12px] text-paper-700">
          تغيير رأس المال أو سعر الصرف هنا يغيّرهما في التطبيق كله، بما فيه حساب
          رصيدك الفعلي.
        </p>
      </section>

      <section className="mt-8">
        <SectionTitle>النتيجة بعد {table.days} يوماً</SectionTitle>
        <div className="space-y-px">
          {table.totals.map((total) => (
            <SummaryRow key={total.rate} cell={total} />
          ))}
        </div>
      </section>

      <section className="mt-8 pb-8">
        <SectionTitle>يوماً بيوم</SectionTitle>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <RateChip active={selectedRate === 'all'} onClick={() => setSelectedRate('all')}>
            الكل
          </RateChip>
          {table.rates.map((rate) => (
            <RateChip
              key={rate}
              active={selectedRate === rate}
              onClick={() => setSelectedRate(rate)}
            >
              {Math.round(rate * 100)}%
            </RateChip>
          ))}
        </div>

        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-max border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-rule-strong">
                <th
                  scope="col"
                  className="sticky start-0 bg-ink-800 py-2 pe-3 text-start font-medium text-paper-500"
                >
                  اليوم
                </th>
                {visibleRates.map((rate) => (
                  <th
                    key={rate}
                    scope="colgroup"
                    colSpan={2}
                    className="border-s border-rule px-3 py-2 text-center font-semibold text-proj"
                  >
                    {Math.round(rate * 100)}%
                  </th>
                ))}
              </tr>
              <tr className="border-b border-rule">
                <th scope="col" className="sticky start-0 bg-ink-800 pb-2" />
                {visibleRates.map((rate) => (
                  <Fragment key={rate}>
                    <th
                      scope="col"
                      className="border-s border-rule px-3 pb-2 text-end text-[11px] font-normal text-paper-700"
                    >
                      الرصيد
                    </th>
                    <th
                      scope="col"
                      className="px-3 pb-2 text-end text-[11px] font-normal text-paper-700"
                    >
                      الربح التراكمي
                    </th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={row.day} className="border-b border-rule/60">
                  <th
                    scope="row"
                    className="num sticky start-0 bg-ink-800 py-2.5 pe-3 text-start font-normal text-paper-500"
                  >
                    {row.day}
                  </th>
                  {row.cells
                    .filter((cell) => visibleRates.includes(cell.rate))
                    .map((cell) => (
                      <Fragment key={cell.rate}>
                        <td className="border-s border-rule px-3 py-2.5 text-end align-top">
                          <span className="num block text-paper-100">
                            {formatAmount(cell.balanceHalalas)}
                          </span>
                          <span className="num block text-[11px] text-paper-700">
                            ${formatAmount(cell.balanceCents)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-end align-top">
                          <span className="num block text-gain">
                            +{formatAmount(cell.profitHalalas)}
                          </span>
                          <span className="num block text-[11px] text-paper-700">
                            ${formatAmount(cell.profitCents)}
                          </span>
                        </td>
                      </Fragment>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px] text-paper-700">
          المبالغ بالريال، والسطر الأصغر تحتها بالدولار عند سعر صرف{' '}
          <span className="num">{table.fxRate}</span>.
        </p>
      </section>
    </Screen>
  )
}

function SummaryRow({ cell }: { cell: ProjectionCell }) {
  return (
    <div className="rounded-xl border border-rule bg-ink-700/60 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-semibold text-proj">
          {Math.round(cell.rate * 100)}% يومياً
        </span>
        <span className="num text-[13px] text-paper-500">{formatMultiple(cell.multiple)}</span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
        <div>
          <dt className="text-paper-500">الرصيد النهائي</dt>
          <dd className="num mt-0.5 text-[17px] font-semibold text-paper-100">
            {formatAmount(cell.balanceHalalas)}
          </dd>
          <dd className="num text-[12px] text-paper-700">${formatAmount(cell.balanceCents)}</dd>
        </div>
        <div>
          <dt className="text-paper-500">صافي الربح</dt>
          <dd className="num mt-0.5 text-[17px] font-semibold text-gain">
            +{formatAmount(cell.profitHalalas)}
          </dd>
          <dd className="num text-[12px] text-paper-700">${formatAmount(cell.profitCents)}</dd>
        </div>
      </dl>
    </div>
  )
}

function RateChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'num shrink-0 rounded-full border px-4 py-1.5 text-[13px] transition',
        active
          ? 'border-proj/50 bg-proj/15 text-proj'
          : 'border-rule text-paper-500 hover:text-paper-300',
      )}
    >
      {children}
    </button>
  )
}
