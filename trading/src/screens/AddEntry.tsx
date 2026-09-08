import { useEffect, useMemo, useState } from 'react'
import { IconChevronDown, IconWarning } from '../components/icons'
import { Callout, cx, Field, Sheet } from '../components/ui'
import { todayInRiyadh } from '../lib/date'
import { formatAmount, parseAmountInput, toHalalas } from '../lib/money'
import { useStore } from '../lib/store'
import type { Trade } from '../lib/types'

type Tab = 'trade' | 'cash'
type Direction = 'gain' | 'loss'

export function AddEntrySheet({
  open,
  onClose,
  editTrade,
}: {
  open: boolean
  onClose: () => void
  editTrade?: Trade | null
}) {
  const [tab, setTab] = useState<Tab>('trade')

  useEffect(() => {
    if (open) setTab('trade')
  }, [open])

  const isEditing = Boolean(editTrade)

  return (
    <Sheet open={open} onClose={onClose} title={isEditing ? 'تعديل الصفقة' : 'إضافة'}>
      {!isEditing && (
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-ink-600 p-1">
          <TabButton active={tab === 'trade'} onClick={() => setTab('trade')}>
            صفقة
          </TabButton>
          <TabButton active={tab === 'cash'} onClick={() => setTab('cash')}>
            إيداع أو سحب
          </TabButton>
        </div>
      )}

      {tab === 'trade' || isEditing ? (
        <TradeForm onDone={onClose} editTrade={editTrade ?? null} />
      ) : (
        <CashFlowForm onDone={onClose} />
      )}
    </Sheet>
  )
}

function TabButton({
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
      className={cx(
        'rounded-md py-2.5 text-[14px] font-medium transition',
        active ? 'bg-ink-800 text-paper-100 shadow-sm' : 'text-paper-500',
      )}
    >
      {children}
    </button>
  )
}

// ————————————————————————————————————————————————————————————
// صفقة
// ————————————————————————————————————————————————————————————

function TradeForm({ onDone, editTrade }: { onDone: () => void; editTrade: Trade | null }) {
  const { addTrade, updateTrade, ledger } = useStore()

  const [date, setDate] = useState(() => editTrade?.date ?? todayInRiyadh())
  const [symbol, setSymbol] = useState(() => editTrade?.symbol ?? '')
  const [direction, setDirection] = useState<Direction>(() =>
    editTrade && editTrade.resultSAR < 0 ? 'loss' : 'gain',
  )
  const [amount, setAmount] = useState(() =>
    editTrade ? String(Math.abs(editTrade.resultSAR)) : '',
  )
  const [showMore, setShowMore] = useState(false)
  const [invested, setInvested] = useState(() => optionalToText(editTrade?.amountInvestedSAR))
  const [entryPrice, setEntryPrice] = useState(() => optionalToText(editTrade?.entryPrice))
  const [exitPrice, setExitPrice] = useState(() => optionalToText(editTrade?.exitPrice))
  const [quantity, setQuantity] = useState(() => optionalToText(editTrade?.quantity))
  const [fees, setFees] = useState(() => optionalToText(editTrade?.feesSAR))
  const [note, setNote] = useState(() => editTrade?.note ?? '')
  const [error, setError] = useState<string | null>(null)

  const magnitude = parseAmountInput(amount)
  const resultSAR = magnitude === null ? null : direction === 'loss' ? -Math.abs(magnitude) : Math.abs(magnitude)

  // تحذير مسبق: هل تُخرج هذه الصفقة الرصيد إلى السالب؟ نحذّر ولا نمنع.
  const projectedBalance = useMemo(() => {
    if (resultSAR === null) return null
    const previous = editTrade ? toHalalas(editTrade.resultSAR) : 0
    return ledger.currentBalanceHalalas - previous + toHalalas(resultSAR)
  }, [resultSAR, ledger.currentBalanceHalalas, editTrade])

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!date) return setError('اختر تاريخ الصفقة.')
    if (symbol.trim() === '') return setError('اكتب اسم السهم أو رمزه.')
    if (resultSAR === null) return setError('اكتب نتيجة الصفقة بالريال.')

    const payload = {
      date,
      symbol: symbol.trim(),
      resultSAR,
      amountInvestedSAR: parseAmountInput(invested) ?? undefined,
      entryPrice: parseAmountInput(entryPrice) ?? undefined,
      exitPrice: parseAmountInput(exitPrice) ?? undefined,
      quantity: parseAmountInput(quantity) ?? undefined,
      feesSAR: parseAmountInput(fees) ?? undefined,
      note: note.trim() === '' ? undefined : note.trim(),
    }

    if (editTrade) updateTrade(editTrade.id, payload)
    else addTrade(payload)
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-5 pb-6">
      <Field
        label="التاريخ"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
      />

      <Field
        label="السهم"
        type="text"
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
        placeholder="أرامكو، TSLA، ذهب…"
        autoComplete="off"
        enterKeyHint="next"
        required
      />

      <div>
        <span className="label">النتيجة</span>
        <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-ink-600 p-1">
          <DirectionButton
            active={direction === 'gain'}
            tone="gain"
            onClick={() => setDirection('gain')}
          >
            ▲ ربح
          </DirectionButton>
          <DirectionButton
            active={direction === 'loss'}
            tone="loss"
            onClick={() => setDirection('loss')}
          >
            ▼ خسارة
          </DirectionButton>
        </div>
        <div className="relative">
          <input
            className={cx(
              'field pr-16 text-right text-[24px] font-semibold tnum',
              direction === 'gain' ? 'text-gain' : 'text-loss',
            )}
            inputMode="decimal"
            dir="ltr"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            aria-label="مبلغ النتيجة بالريال"
            required
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-paper-500">
            ريال
          </span>
        </div>
        <p className="mt-1.5 text-[12px] text-paper-700">
          اكتب المبلغ موجباً واختر ربح أو خسارة — لا حاجة لعلامة سالب.
        </p>
      </div>

      {projectedBalance !== null && projectedBalance < 0 && (
        <Callout tone="warn" icon={<IconWarning className="h-4 w-4" />}>
          هذه الصفقة تُنزل الرصيد المحسوب إلى{' '}
          <span className="num font-semibold">{formatAmount(projectedBalance)}</span> ريال. مسموح
          بحفظها، لكن راجع الرقم قبل التأكيد.
        </Callout>
      )}

      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        className="flex w-full items-center justify-between border-y border-rule py-3 text-[14px] text-paper-300"
      >
        تفاصيل أكثر
        <IconChevronDown
          className={cx('h-4 w-4 transition-transform', showMore && 'rotate-180')}
        />
      </button>

      {showMore && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="سعر الدخول"
              inputMode="decimal"
              dir="ltr"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
            />
            <Field
              label="سعر الخروج"
              inputMode="decimal"
              dir="ltr"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
            />
            <Field
              label="الكمية"
              inputMode="decimal"
              dir="ltr"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <Field
              label="المبلغ المستثمر"
              inputMode="decimal"
              dir="ltr"
              suffix="ريال"
              value={invested}
              onChange={(e) => setInvested(e.target.value)}
            />
          </div>
          <Field
            label="الرسوم والعمولات"
            inputMode="decimal"
            dir="ltr"
            suffix="ريال"
            value={fees}
            onChange={(e) => setFees(e.target.value)}
            hint="للتوثيق فقط — النتيجة أعلاه هي ما يدخل في حساب الرصيد."
          />
          <div>
            <label className="label" htmlFor="trade-note">
              ملاحظة
            </label>
            <textarea
              id="trade-note"
              className="field min-h-[80px] resize-y"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="سبب الدخول، الخطأ الذي وقعت فيه…"
            />
          </div>
        </div>
      )}

      {error && <p className="text-[13px] text-loss">{error}</p>}

      <button type="submit" className="btn-primary w-full">
        {editTrade ? 'حفظ التعديل' : 'حفظ الصفقة'}
      </button>
    </form>
  )
}

function DirectionButton({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean
  tone: Direction
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'rounded-md py-2.5 text-[14px] font-semibold transition',
        !active && 'text-paper-500',
        active && tone === 'gain' && 'bg-gain/15 text-gain ring-1 ring-gain/40',
        active && tone === 'loss' && 'bg-loss/15 text-loss ring-1 ring-loss/40',
      )}
    >
      {children}
    </button>
  )
}

function optionalToText(value: number | undefined): string {
  return value === undefined ? '' : String(value)
}

// ————————————————————————————————————————————————————————————
// إيداع أو سحب
// ————————————————————————————————————————————————————————————

function CashFlowForm({ onDone }: { onDone: () => void }) {
  const { addCashFlow } = useStore()
  const [date, setDate] = useState(todayInRiyadh)
  const [type, setType] = useState<'deposit' | 'withdrawal'>('deposit')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const value = parseAmountInput(amount)
    if (value === null || value === 0) return setError('اكتب المبلغ بالريال.')
    addCashFlow({
      date,
      type,
      amountSAR: Math.abs(value),
      note: note.trim() === '' ? undefined : note.trim(),
    })
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-5 pb-6">
      <Callout tone="neutral">
        الإيداع والسحب يغيّران رصيد المحفظة ولا يغيّران الربح إطلاقاً — المال الذي
        تضيفه من جيبك ليس ربحاً حققته.
      </Callout>

      <Field label="التاريخ" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />

      <div>
        <span className="label">النوع</span>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-ink-600 p-1">
          <button
            type="button"
            onClick={() => setType('deposit')}
            aria-pressed={type === 'deposit'}
            className={cx(
              'rounded-md py-2.5 text-[14px] font-semibold transition',
              type === 'deposit' ? 'bg-ink-800 text-paper-100' : 'text-paper-500',
            )}
          >
            ↓ إيداع
          </button>
          <button
            type="button"
            onClick={() => setType('withdrawal')}
            aria-pressed={type === 'withdrawal'}
            className={cx(
              'rounded-md py-2.5 text-[14px] font-semibold transition',
              type === 'withdrawal' ? 'bg-ink-800 text-paper-100' : 'text-paper-500',
            )}
          >
            ↑ سحب
          </button>
        </div>
      </div>

      <div className="relative">
        <label className="label" htmlFor="flow-amount">
          المبلغ
        </label>
        <input
          id="flow-amount"
          className="field pr-16 text-right text-[24px] font-semibold tnum"
          inputMode="decimal"
          dir="ltr"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          required
        />
        <span className="pointer-events-none absolute bottom-0 right-3 flex h-[52px] items-center text-[13px] text-paper-500">
          ريال
        </span>
      </div>

      <Field
        label="ملاحظة"
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="اختياري"
      />

      {error && <p className="text-[13px] text-loss">{error}</p>}

      <button type="submit" className="btn-primary w-full">
        حفظ الحركة
      </button>
    </form>
  )
}
