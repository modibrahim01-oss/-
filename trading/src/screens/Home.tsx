import { Sparkline } from '../components/Sparkline'
import { IconPlus, IconWarning } from '../components/icons'
import { Amount, Callout, Delta, DeltaPercent, EmptyState, SectionTitle, cx, toneText } from '../components/ui'
import { balanceSeries, findDay } from '../lib/calc'
import { formatDayLabel, todayInRiyadh } from '../lib/date'
import { formatAmount, formatSignedPercent, halalasToCents } from '../lib/money'
import { useStore } from '../lib/store'

export function HomeScreen({
  onAdd,
  navigate,
}: {
  onAdd: () => void
  navigate: (route: 'home' | 'log' | 'charts' | 'projection' | 'settings') => void
}) {
  const { ledger, settings } = useStore()
  const today = todayInRiyadh()
  const todaySummary = findDay(ledger, today)
  const series = balanceSeries(ledger, settings)
  const hasData = ledger.days.length > 0

  const balanceCents = halalasToCents(ledger.currentBalanceHalalas, settings.fxRate)

  if (!hasData) {
    return (
      <div className="px-5 pt-8">
        <p className="mb-1 text-[13px] tracking-[0.14em] text-paper-500">دفتر التداول</p>
        <h1 className="mb-8 text-[22px] font-semibold">
          رأس المال في الانتظار:{' '}
          <Amount halalas={ledger.startingCapitalHalalas} className="text-proj" />
        </h1>
        <EmptyState
          title="لم تُسجّل أي صفقة بعد"
          description="ابدأ بأول صفقة: التاريخ واسم السهم والنتيجة بالريال — ثلاثة حقول فقط. الرصيد والنِسب والرسوم كلها تُحسب لك بعدها."
          action={
            <button type="button" onClick={onAdd} className="btn-primary">
              <IconPlus className="h-[18px] w-[18px]" />
              سجّل أول صفقة
            </button>
          }
        />
        <p className="mt-6 text-center text-[12px] leading-relaxed text-paper-700">
          يمكنك تغيير رأس المال وسعر الصرف من{' '}
          <button
            type="button"
            onClick={() => navigate('settings')}
            className="text-paper-300 underline underline-offset-4"
          >
            الإعدادات
          </button>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="pb-6">
      {/* رقم البطل — دفتر بنك لا بطاقة لوحة تحكم */}
      <section className="px-5 pt-8">
        <p className="mb-2 text-[13px] tracking-[0.14em] text-paper-500">رصيد المحفظة</p>
        <div
          className={cx(
            'flex items-baseline gap-2 text-[44px] font-semibold leading-none',
            ledger.currentBalanceHalalas < 0 && 'text-loss',
          )}
        >
          <span className="num">{formatAmount(ledger.currentBalanceHalalas)}</span>
          <span className="text-[16px] font-normal text-paper-500">ريال</span>
        </div>
        <p className="mt-2 text-[14px] text-paper-500">
          <span className="num">{formatAmount(balanceCents)}</span> دولار
          <span className="mx-2 text-paper-700">·</span>
          سعر الصرف <span className="num">{settings.fxRate}</span>
        </p>
      </section>

      {series.length >= 2 && (
        <div className="mt-6 px-5">
          <Sparkline
            values={series.map((point) => point.balanceHalalas)}
            positive={ledger.totalProfitHalalas >= 0}
            className="h-16 w-full"
          />
        </div>
      )}

      {ledger.currentBalanceHalalas < 0 && (
        <div className="mt-6 px-5">
          <Callout tone="danger" icon={<IconWarning className="h-4 w-4" />}>
            الرصيد المحسوب سالب. راجع صفقاتك المسجّلة — أو أضف إيداعاً إن كنت قد
            موّلت المحفظة دون تسجيل ذلك.
          </Callout>
        </div>
      )}

      {/* قيود الدفتر: خطوط أفقية بدل بطاقات متشابهة */}
      <section className="mt-8 px-5">
        <SectionTitle>الحصيلة</SectionTitle>
        <dl className="text-[15px]">
          <LedgerRow label="صافي الربح منذ البداية">
            <div className="flex items-baseline gap-3">
              <Delta halalas={ledger.totalProfitHalalas} className="font-semibold" />
              <span className={cx('num text-[13px]', toneText(ledger.totalProfitHalalas))}>
                {ledger.totalReturnPct === null ? '—' : formatSignedPercent(ledger.totalReturnPct)}
              </span>
            </div>
          </LedgerRow>

          <LedgerRow label={todaySummary ? `اليوم · ${formatDayLabel(today)}` : 'اليوم'}>
            {todaySummary ? (
              <div className="flex items-baseline gap-3">
                <Delta halalas={todaySummary.dayPLHalalas} className="font-semibold" />
                <DeltaPercent ratio={todaySummary.dayPct} className="text-[13px]" />
              </div>
            ) : (
              <span className="text-[14px] text-paper-700">لا صفقات بعد</span>
            )}
          </LedgerRow>

          <LedgerRow label="رأس المال + الإيداعات (أساس النسبة)">
            <Amount
              halalas={ledger.startingCapitalHalalas + ledger.netDepositsHalalas}
              className="text-paper-300"
            />
          </LedgerRow>

          <LedgerRow label="أيام رابحة / خاسرة">
            <span className="num text-[15px]">
              <span className="text-gain">{ledger.winDays}</span>
              <span className="mx-1.5 text-paper-700">/</span>
              <span className="text-loss">{ledger.lossDays}</span>
            </span>
          </LedgerRow>

          <LedgerRow label="عدد الصفقات" last>
            <span className="num text-paper-300">{ledger.tradeCount}</span>
          </LedgerRow>
        </dl>
      </section>

      <div className="mt-8 hidden px-5 md:block">
        <button type="button" onClick={onAdd} className="btn-primary w-full">
          <IconPlus className="h-[18px] w-[18px]" />
          إضافة صفقة
        </button>
      </div>

      {ledger.days.length > 0 && (
        <section className="mt-8 px-5">
          <SectionTitle
            action={
              <button
                type="button"
                onClick={() => navigate('log')}
                className="text-[13px] text-paper-300 underline underline-offset-4"
              >
                كل السجل
              </button>
            }
          >
            آخر الأيام
          </SectionTitle>
          <ul className="text-[15px]">
            {[...ledger.days]
              .reverse()
              .slice(0, 4)
              .map((day, index, list) => (
                <li
                  key={day.date}
                  className={cx(
                    'flex items-baseline justify-between gap-4 py-3',
                    index < list.length - 1 && 'border-b border-rule',
                  )}
                >
                  <span className="text-paper-300">{formatDayLabel(day.date)}</span>
                  <span className="flex items-baseline gap-3">
                    {day.trades.length === 0 && day.netFlowHalalas !== 0 ? (
                      <span className="num text-[14px] text-proj">
                        {day.netFlowHalalas > 0 ? '+' : '−'}
                        {formatAmount(Math.abs(day.netFlowHalalas))}
                      </span>
                    ) : (
                      <Delta halalas={day.dayPLHalalas} unit="" />
                    )}
                    <span className="num w-20 text-end text-[13px] text-paper-500">
                      {formatAmount(day.closingBalanceHalalas)}
                    </span>
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function LedgerRow({
  label,
  children,
  last,
}: {
  label: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div
      className={cx(
        'flex items-baseline justify-between gap-4 py-3',
        !last && 'border-b border-rule',
      )}
    >
      <dt className="text-[14px] text-paper-500">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
