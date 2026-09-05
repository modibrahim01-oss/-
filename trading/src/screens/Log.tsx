import { useState } from 'react'
import { AddEntrySheet } from './AddEntry'
import { IconChevronDown, IconEdit, IconPlus, IconScale, IconTrash } from '../components/icons'
import { Amount, Delta, DeltaPercent, EmptyState, Screen, cx } from '../components/ui'
import type { DaySummary } from '../lib/calc'
import { formatDayLabel, isWeekend } from '../lib/date'
import { formatAmount, parseAmountInput } from '../lib/money'
import { useStore } from '../lib/store'
import type { Trade } from '../lib/types'

export function LogScreen({ onAdd }: { onAdd: () => void }) {
  const { ledger } = useStore()
  const [editing, setEditing] = useState<Trade | null>(null)
  const days = [...ledger.days].reverse()

  return (
    <Screen
      title="السجل"
      subtitle="كل يوم فيه حركة يظهر مرة واحدة. الأيام الخالية لا تُسجَّل ولا تكسر تسلسل الرصيد."
    >
      {days.length === 0 ? (
        <EmptyState
          title="السجل فارغ"
          description="سجّل أول صفقة وسيبدأ الدفتر بالامتلاء يوماً بعد يوم."
          action={
            <button type="button" onClick={onAdd} className="btn-primary">
              <IconPlus className="h-[18px] w-[18px]" />
              إضافة صفقة
            </button>
          }
        />
      ) : (
        <ul className="pb-8">
          {days.map((day) => (
            <DayRow key={day.date} day={day} onEditTrade={setEditing} />
          ))}
        </ul>
      )}

      <AddEntrySheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        editTrade={editing}
      />
    </Screen>
  )
}

function DayRow({ day, onEditTrade }: { day: DaySummary; onEditTrade: (trade: Trade) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <li className="border-b border-rule">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 py-4 text-start"
      >
        <IconChevronDown
          className={cx(
            'h-4 w-4 shrink-0 text-paper-700 transition-transform',
            open && 'rotate-180',
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[15px] text-paper-100">
              {formatDayLabel(day.date)}
              {isWeekend(day.date) && (
                <span className="ms-2 text-[11px] text-paper-700">عطلة</span>
              )}
            </span>
            <Delta halalas={day.dayPLHalalas} unit="" className="text-[15px] font-semibold" />
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3 text-[12px]">
            <span className="text-paper-700">
              {day.trades.length > 0 && (
                <>
                  <span className="num">{day.trades.length}</span> صفقة
                </>
              )}
              {day.trades.length > 0 && day.netFlowHalalas !== 0 && ' · '}
              {day.netFlowHalalas !== 0 && (
                <span className="text-proj">
                  {day.netFlowHalalas > 0 ? 'إيداع' : 'سحب'}{' '}
                  <span className="num">{formatAmount(Math.abs(day.netFlowHalalas))}</span>
                </span>
              )}
            </span>
            <span className="flex items-baseline gap-3">
              <DeltaPercent ratio={day.dayPct} />
              <span className="num w-20 text-end text-paper-500">
                {formatAmount(day.closingBalanceHalalas)}
              </span>
            </span>
          </div>
        </div>
      </button>

      {open && (
        <div className="pb-5 ps-7">
          {day.trades.length > 0 && (
            <ul className="mb-4 space-y-px">
              {day.trades.map((trade) => (
                <TradeRow key={trade.id} trade={trade} onEdit={() => onEditTrade(trade)} />
              ))}
            </ul>
          )}

          {day.cashFlows.length > 0 && (
            <ul className="mb-4 space-y-px">
              {day.cashFlows.map((flow) => (
                <CashFlowRow key={flow.id} flowId={flow.id} type={flow.type} amountSAR={flow.amountSAR} note={flow.note} />
              ))}
            </ul>
          )}

          <dl className="mb-4 space-y-1.5 border-y border-rule py-3 text-[13px]">
            <MetaRow label="رصيد بداية اليوم">
              <Amount halalas={day.openingBalanceHalalas} unit="" className="text-paper-300" />
            </MetaRow>
            <MetaRow label="رصيد نهاية اليوم">
              <Amount halalas={day.closingBalanceHalalas} unit="" className="text-paper-100" />
            </MetaRow>
            <MetaRow label="الربح التراكمي">
              <Delta halalas={day.cumulativeProfitHalalas} unit="" showMark={false} />
            </MetaRow>
          </dl>

          <DayCheckEditor day={day} />
        </div>
      )}
    </li>
  )
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-paper-500">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function TradeRow({ trade, onEdit }: { trade: Trade; onEdit: () => void }) {
  const { deleteTrade } = useStore()
  const [confirming, setConfirming] = useState(false)
  const isGain = trade.resultSAR >= 0

  return (
    <li className="group flex items-start gap-3 py-2.5">
      <span
        aria-hidden="true"
        className={cx('mt-1.5 h-4 w-[3px] shrink-0 rounded-full', isGain ? 'bg-gain' : 'bg-loss')}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[14px] text-paper-100">{trade.symbol}</span>
          <Delta halalas={Math.round(trade.resultSAR * 100)} unit="" className="text-[14px]" />
        </div>
        {(trade.entryPrice !== undefined ||
          trade.exitPrice !== undefined ||
          trade.quantity !== undefined ||
          trade.feesSAR !== undefined) && (
          <p className="mt-0.5 text-[12px] text-paper-700">
            {[
              trade.quantity !== undefined && `الكمية ${trade.quantity}`,
              trade.entryPrice !== undefined && `دخول ${trade.entryPrice}`,
              trade.exitPrice !== undefined && `خروج ${trade.exitPrice}`,
              trade.feesSAR !== undefined && `رسوم ${trade.feesSAR}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        {trade.note && <p className="mt-0.5 text-[12px] text-paper-500">{trade.note}</p>}

        {confirming ? (
          <div className="mt-2 flex items-center gap-3 text-[12px]">
            <span className="text-loss">حذف الصفقة نهائياً؟</span>
            <button
              type="button"
              onClick={() => deleteTrade(trade.id)}
              className="rounded-md border border-loss/40 px-2 py-1 text-loss"
            >
              نعم، احذف
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-paper-500 underline underline-offset-4"
            >
              تراجع
            </button>
          </div>
        ) : (
          <div className="mt-1 flex gap-1">
            <button
              type="button"
              onClick={onEdit}
              aria-label={`تعديل صفقة ${trade.symbol}`}
              className="rounded-md p-1.5 text-paper-700 transition hover:bg-ink-700 hover:text-paper-300"
            >
              <IconEdit className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label={`حذف صفقة ${trade.symbol}`}
              className="rounded-md p-1.5 text-paper-700 transition hover:bg-loss/10 hover:text-loss"
            >
              <IconTrash className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

function CashFlowRow({
  flowId,
  type,
  amountSAR,
  note,
}: {
  flowId: string
  type: 'deposit' | 'withdrawal'
  amountSAR: number
  note?: string
}) {
  const { deleteCashFlow } = useStore()
  const [confirming, setConfirming] = useState(false)
  const label = type === 'deposit' ? 'إيداع' : 'سحب'

  return (
    <li className="flex items-start gap-3 py-2.5">
      <span aria-hidden="true" className="mt-1.5 h-4 w-[3px] shrink-0 rounded-full bg-proj" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="flex items-baseline gap-2 text-[14px] text-proj">
            {type === 'deposit' ? '↓' : '↑'} {label}
            {!confirming && (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                aria-label={`حذف ${label}`}
                className="rounded-md p-1 text-paper-700 transition hover:bg-loss/10 hover:text-loss"
              >
                <IconTrash className="h-4 w-4" />
              </button>
            )}
          </span>
          <span className="num text-[14px] text-proj">
            {type === 'deposit' ? '+' : '−'}
            {formatAmount(Math.round(Math.abs(amountSAR) * 100))}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-paper-700">
          يغيّر الرصيد ولا يدخل في الربح{note ? ` · ${note}` : ''}
        </p>
        {confirming && (
          <div className="mt-2 flex items-center gap-3 text-[12px]">
            <span className="text-loss">حذف الحركة؟ الرصيد سيُعاد حسابه.</span>
            <button
              type="button"
              onClick={() => deleteCashFlow(flowId)}
              className="rounded-md border border-loss/40 px-2 py-1 text-loss"
            >
              نعم، احذف
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-paper-500 underline underline-offset-4"
            >
              تراجع
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

/**
 * تسوية اليوم: يقارن الرصيد الحقيقي في المحفظة بالمحسوب من الصفقات.
 * الفرق يكشف ما لم يُسجَّل — العمولات غالباً.
 */
function DayCheckEditor({ day }: { day: DaySummary }) {
  const { setDayCheck, clearDayCheck } = useStore()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(() =>
    day.actualWalletHalalas === null ? '' : String(day.actualWalletHalalas / 100),
  )

  function save() {
    const parsed = parseAmountInput(value)
    if (parsed === null) clearDayCheck(day.date)
    else setDayCheck({ date: day.date, actualWalletSAR: parsed })
    setEditing(false)
  }

  if (!editing && day.actualWalletHalalas === null) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex items-center gap-2 text-[13px] text-paper-500 underline underline-offset-4"
      >
        <IconScale className="h-4 w-4" />
        سجّل الرصيد الفعلي في المحفظة
      </button>
    )
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-rule bg-ink-700 p-3">
        <label className="label" htmlFor={`check-${day.date}`}>
          الرصيد الفعلي في المحفظة نهاية اليوم
        </label>
        <div className="flex gap-2">
          <input
            id={`check-${day.date}`}
            className="field flex-1 text-right"
            inputMode="decimal"
            dir="ltr"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={formatAmount(day.closingBalanceHalalas)}
            autoFocus
          />
          <button type="button" onClick={save} className="btn-primary px-4">
            حفظ
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            clearDayCheck(day.date)
            setValue('')
            setEditing(false)
          }}
          className="mt-2 text-[12px] text-paper-500 underline underline-offset-4"
        >
          إزالة التسوية
        </button>
      </div>
    )
  }

  const discrepancy = day.discrepancyHalalas ?? 0

  return (
    <div className="rounded-xl border border-rule bg-ink-700 p-3 text-[13px]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-paper-500">الرصيد الفعلي</span>
        <Amount halalas={day.actualWalletHalalas!} unit="" className="text-paper-100" />
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-rule pt-2">
        <span className={cx(discrepancy === 0 ? 'text-paper-500' : 'text-proj')}>
          {discrepancy === 0 ? 'مطابق تماماً' : 'فرق غير مسجّل (عمولات أو رسوم)'}
        </span>
        <Delta halalas={discrepancy} unit="" showMark={false} />
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-2 text-[12px] text-paper-500 underline underline-offset-4"
      >
        تعديل
      </button>
    </div>
  )
}
