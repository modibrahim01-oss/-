import { useEffect, useId, useRef } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { formatAmount, formatSigned, formatSignedPercent } from '../lib/money'
import { IconClose } from './icons'

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

/** لون + رمز معاً — لا نعتمد على اللون وحده للدلالة على الربح والخسارة. */
export function toneOf(value: number): 'gain' | 'loss' | 'flat' {
  if (value > 0) return 'gain'
  if (value < 0) return 'loss'
  return 'flat'
}

const TONE_TEXT = {
  gain: 'text-gain',
  loss: 'text-loss',
  flat: 'text-paper-500',
} as const

const TONE_MARK = { gain: '▲', loss: '▼', flat: '–' } as const

/** مبلغ محايد (رصيد مثلاً): رقم جدولي + وحدة أصغر بجانبه. */
export function Amount({
  halalas,
  unit = 'ريال',
  className,
  unitClassName,
}: {
  halalas: number
  unit?: string
  className?: string
  unitClassName?: string
}) {
  return (
    <span className={cx('inline-flex items-baseline gap-1.5', className)}>
      <span className="num">{formatAmount(halalas)}</span>
      <span className={cx('text-[0.62em] font-normal text-paper-500', unitClassName)}>{unit}</span>
    </span>
  )
}

/** مبلغ ذو إشارة: سهم + علامة + لون. الثلاثة معاً حتى لا يُفقد المعنى بلا لون. */
export function Delta({
  halalas,
  unit = 'ريال',
  className,
  showMark = true,
}: {
  halalas: number
  unit?: string
  className?: string
  showMark?: boolean
}) {
  const tone = toneOf(halalas)
  return (
    <span className={cx('inline-flex items-baseline gap-1.5', TONE_TEXT[tone], className)}>
      {showMark && <span className="text-[0.6em] leading-none">{TONE_MARK[tone]}</span>}
      <span className="num">{formatSigned(halalas)}</span>
      <span className="text-[0.62em] font-normal opacity-70">{unit}</span>
    </span>
  )
}

export function DeltaPercent({
  ratio,
  className,
}: {
  ratio: number | null
  className?: string
}) {
  if (ratio === null) return <span className={cx('num text-paper-700', className)}>—</span>
  const tone = toneOf(ratio)
  return (
    <span className={cx('num', TONE_TEXT[tone], className)}>{formatSignedPercent(ratio)}</span>
  )
}

export function toneText(value: number): string {
  return TONE_TEXT[toneOf(value)]
}

/** عنوان قسم بأسلوب الدفتر: نص صغير متباعد فوق خط. */
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3 border-b border-rule pb-2">
      <h2 className="text-[13px] font-medium tracking-[0.14em] text-paper-500">{children}</h2>
      {action}
    </div>
  )
}

export function Screen({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="px-5 pt-6">
      <header className="mb-6">
        <h1 className="text-[22px] font-semibold leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] leading-relaxed text-paper-500">{subtitle}</p>}
      </header>
      {children}
    </div>
  )
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
  suffix?: string
}

export function Field({ label, hint, suffix, className, ...props }: FieldProps) {
  const id = useId()
  // حقول الأرقام تُكتب بـ dir="ltr" داخل صفحة RTL. نُحاذيها لليمين ونضع
  // الوحدة عند الحافة اليمنى، فيلتصق الرقم بوحدته عند جهة بدء القراءة —
  // ولو تركنا `end-*` المنطقية لجلست الوحدة فوق الرقم نفسه.
  const numeric = props.dir === 'ltr'
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className={cx('field', suffix && (numeric ? 'pr-16 text-right' : 'pe-16'), className)}
          {...props}
        />
        {suffix && (
          <span
            className={cx(
              'pointer-events-none absolute inset-y-0 flex items-center text-[13px] text-paper-500',
              numeric ? 'right-3' : 'end-3',
            )}
          >
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="mt-1.5 text-[12px] leading-relaxed text-paper-700">{hint}</p>}
    </div>
  )
}

/** لوحة منزلقة من الأسفل — النمط الطبيعي على الجوال، ومركّزة على الشاشات الكبيرة. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="إغلاق"
        className="absolute inset-0 bg-ink-900/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative max-h-[92vh] w-full max-w-app overflow-y-auto rounded-t-2xl border border-rule
                   bg-ink-800 pb-[max(1.25rem,env(safe-area-inset-bottom))] outline-none sm:rounded-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-rule bg-ink-800/95 px-5 py-4 backdrop-blur">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-lg p-1.5 text-paper-500 transition hover:bg-ink-700 hover:text-paper-100"
          >
            <IconClose />
          </button>
        </div>
        <div className="px-5 pt-5">{children}</div>
      </div>
    </div>
  )
}

export function Callout({
  tone = 'neutral',
  icon,
  title,
  children,
}: {
  tone?: 'neutral' | 'warn' | 'danger'
  icon?: ReactNode
  title?: string
  children: ReactNode
}) {
  const tones = {
    neutral: 'border-rule-strong bg-ink-700 text-paper-300',
    warn: 'border-proj/35 bg-proj/[0.07] text-proj',
    danger: 'border-loss/40 bg-loss/[0.08] text-loss',
  } as const
  return (
    <div className={cx('flex gap-3 rounded-xl border p-4 text-[13px] leading-relaxed', tones[tone])}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">
        {title && <p className="mb-1 font-semibold">{title}</p>}
        <div className={tone === 'neutral' ? '' : 'text-paper-300'}>{children}</div>
      </div>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed border-rule-strong px-6 py-10 text-center">
      <p className="text-[16px] font-semibold text-paper-100">{title}</p>
      <p className="mx-auto mt-2 max-w-[30ch] text-[13px] leading-relaxed text-paper-500">
        {description}
      </p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}
