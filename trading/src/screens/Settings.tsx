import { useRef, useState } from 'react'
import { IconDownload, IconUpload, IconWarning } from '../components/icons'
import { Callout, Field, Screen, SectionTitle, Sheet, cx } from '../components/ui'
import { backupFileName, downloadFile, toBackupJSON, toDailyCSV, toTradesCSV } from '../lib/backup'
import { formatAmount, parseAmountInput } from '../lib/money'
import { ImportError, parseBackup } from '../lib/storage'
import { useStore } from '../lib/store'
import type { AppData } from '../lib/types'

type PendingChange = {
  label: string
  description: string
  apply: () => void
}

export function SettingsScreen() {
  const { data, ledger, settings, updateSettings, replaceAll, clearAll } = useStore()
  const [pending, setPending] = useState<PendingChange | null>(null)
  const [importState, setImportState] = useState<{ error?: string; success?: string } | null>(null)
  const [incoming, setIncoming] = useState<AppData | null>(null)
  const [clearStage, setClearStage] = useState<0 | 1 | 2>(0)
  const fileInput = useRef<HTMLInputElement>(null)

  const hasData = data.trades.length > 0 || data.cashFlows.length > 0

  /** التغييرات التي تعيد حساب كل شيء تمر بتأكيد حين توجد بيانات فعلاً. */
  function requestChange(change: PendingChange) {
    if (hasData) setPending(change)
    else change.apply()
  }

  function handleImportFile(file: File) {
    setImportState(null)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        setIncoming(parseBackup(String(reader.result)))
      } catch (error) {
        setImportState({
          error:
            error instanceof ImportError
              ? error.message
              : 'تعذّرت قراءة الملف. لم يُمسّ شيء من بياناتك الحالية.',
        })
      }
    }
    reader.onerror = () =>
      setImportState({ error: 'تعذّرت قراءة الملف من الجهاز. لم يُمسّ شيء من بياناتك الحالية.' })
    reader.readAsText(file)
  }

  return (
    <Screen title="الإعدادات">
      {/* أهم شيء في هذه الشاشة: أن يفهم المستخدم أين تعيش بياناته. */}
      <Callout
        tone="warn"
        icon={<IconWarning className="h-5 w-5" />}
        title="بياناتك محفوظة في هذا المتصفح فقط"
      >
        لا يوجد خادم ولا حساب ولا نسخة في السحابة. مسح بيانات المتصفح، أو استخدام
        تصفح خاص، أو تغيير الجهاز — كل ذلك يعني فقدان السجل نهائياً ما لم تكن قد
        صدّرت ملفاً احتياطياً.
      </Callout>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() =>
            downloadFile(toBackupJSON(data), backupFileName('json'), 'application/json')
          }
          className="btn-primary"
        >
          <IconDownload className="h-[18px] w-[18px]" />
          نسخة احتياطية
        </button>
        <button type="button" onClick={() => fileInput.current?.click()} className="btn-ghost">
          <IconUpload className="h-[18px] w-[18px]" />
          استيراد
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleImportFile(file)
          e.target.value = ''
        }}
      />

      {importState?.error && (
        <div className="mt-3">
          <Callout tone="danger" icon={<IconWarning className="h-4 w-4" />} title="فشل الاستيراد">
            {importState.error}
          </Callout>
        </div>
      )}
      {importState?.success && (
        <p className="mt-3 text-[13px] text-gain">{importState.success}</p>
      )}

      <section className="mt-10">
        <SectionTitle>أرقام أساسية</SectionTitle>
        <div className="space-y-4">
          <Field
            label="رأس المال عند البداية"
            inputMode="decimal"
            dir="ltr"
            suffix="ريال"
            defaultValue={String(settings.startingCapitalSAR)}
            key={`capital-${settings.startingCapitalSAR}`}
            onBlur={(e) => {
              const value = parseAmountInput(e.target.value)
              if (value === null || value <= 0 || value === settings.startingCapitalSAR) {
                e.target.value = String(settings.startingCapitalSAR)
                return
              }
              requestChange({
                label: 'تغيير رأس المال',
                description: `سيصبح رأس المال ${value} ريال بدل ${settings.startingCapitalSAR}. كل الأرصدة والنسب والأرباح التراكمية في السجل ستُعاد حسابتها من جديد.`,
                apply: () => updateSettings({ startingCapitalSAR: value }),
              })
              e.target.value = String(settings.startingCapitalSAR)
            }}
          />

          <Field
            label="سعر الصرف"
            inputMode="decimal"
            dir="ltr"
            suffix="ريال/$"
            defaultValue={String(settings.fxRate)}
            key={`fx-${settings.fxRate}`}
            onBlur={(e) => {
              const value = parseAmountInput(e.target.value)
              if (value === null || value <= 0 || value === settings.fxRate) {
                e.target.value = String(settings.fxRate)
                return
              }
              requestChange({
                label: 'تغيير سعر الصرف',
                description: `سيصبح سعر الصرف ${value} ريال للدولار بدل ${settings.fxRate}. كل المبالغ المعروضة بالدولار ستتغير.`,
                apply: () => updateSettings({ fxRate: value }),
              })
              e.target.value = String(settings.fxRate)
            }}
          />

          <Field
            label="أيام التداول في الشهر"
            inputMode="numeric"
            dir="ltr"
            suffix="يوم"
            defaultValue={String(settings.tradingDaysPerMonth)}
            key={`days-${settings.tradingDaysPerMonth}`}
            onBlur={(e) => {
              const value = parseAmountInput(e.target.value)
              if (value !== null && value >= 1 && value <= 366)
                updateSettings({ tradingDaysPerMonth: Math.floor(value) })
              else e.target.value = String(settings.tradingDaysPerMonth)
            }}
            hint="يستخدمه جدول التوقع فقط — لا يؤثر على السجل الفعلي."
          />

          <Field
            label="بداية فترة المتابعة"
            type="date"
            defaultValue={settings.startDate}
            key={`start-${settings.startDate}`}
            onChange={(e) => {
              if (e.target.value) updateSettings({ startDate: e.target.value })
            }}
            hint="نقطة انطلاق منحنى الرصيد في شاشة الرسوم."
          />
        </div>
      </section>

      <section className="mt-10">
        <SectionTitle>التصدير</SectionTitle>
        <ul className="text-[14px]">
          <ExportRow
            label="نسخة احتياطية كاملة (JSON)"
            hint="كل شيء: الإعدادات والصفقات والحركات والتسويات. هذا الملف وحده يعيد التطبيق كما هو."
            onClick={() =>
              downloadFile(toBackupJSON(data), backupFileName('json'), 'application/json')
            }
          />
          <ExportRow
            label="الصفقات (CSV)"
            hint="صف لكل صفقة، مع أرقام اليوم المحسوبة بجانبها."
            onClick={() => downloadFile(toTradesCSV(data), backupFileName('csv'), 'text/csv')}
          />
          <ExportRow
            label="السجل اليومي (CSV)"
            hint="صف لكل يوم — أقرب شكل لملف الإكسل الأصلي."
            last
            onClick={() =>
              downloadFile(toDailyCSV(data), `تداول-يومي-${backupFileName('csv').slice(7)}`, 'text/csv')
            }
          />
        </ul>
      </section>

      <section className="mt-10 pb-8">
        <SectionTitle>منطقة الخطر</SectionTitle>
        <p className="mb-4 text-[13px] leading-relaxed text-paper-500">
          حالياً في الدفتر <span className="num">{data.trades.length}</span> صفقة و
          <span className="num"> {data.cashFlows.length}</span> حركة نقدية، ورصيد محسوب{' '}
          <span className="num">{formatAmount(ledger.currentBalanceHalalas)}</span> ريال.
        </p>
        <button type="button" onClick={() => setClearStage(1)} className="btn-danger w-full">
          مسح كل البيانات
        </button>
      </section>

      {/* تأكيد تغيير رقم أساسي */}
      <Sheet open={pending !== null} onClose={() => setPending(null)} title={pending?.label ?? ''}>
        <p className="text-[14px] leading-relaxed text-paper-300">{pending?.description}</p>
        <div className="mt-6 grid grid-cols-2 gap-3 pb-6">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              pending?.apply()
              setPending(null)
            }}
          >
            نعم، غيّره
          </button>
          <button type="button" className="btn-ghost" onClick={() => setPending(null)}>
            تراجع
          </button>
        </div>
      </Sheet>

      {/* تأكيد الاستيراد — استبدال كامل */}
      <Sheet open={incoming !== null} onClose={() => setIncoming(null)} title="استيراد نسخة احتياطية">
        <p className="text-[14px] leading-relaxed text-paper-300">
          الملف يحتوي <span className="num">{incoming?.trades.length ?? 0}</span> صفقة و
          <span className="num"> {incoming?.cashFlows.length ?? 0}</span> حركة نقدية. سيحل محل كل
          ما هو موجود الآن في هذا المتصفح.
        </p>
        {hasData && (
          <p className="mt-3 text-[13px] text-loss">
            لديك بيانات حالية ستُفقد. صدّر نسخة احتياطية أولاً إن كنت غير متأكد.
          </p>
        )}
        <div className="mt-6 grid grid-cols-2 gap-3 pb-6">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              if (incoming) {
                replaceAll(incoming)
                setImportState({
                  success: `تم الاستيراد: ${incoming.trades.length} صفقة و ${incoming.cashFlows.length} حركة.`,
                })
              }
              setIncoming(null)
            }}
          >
            استبدل البيانات
          </button>
          <button type="button" className="btn-ghost" onClick={() => setIncoming(null)}>
            إلغاء
          </button>
        </div>
      </Sheet>

      {/* المسح: تأكيد مزدوج */}
      <Sheet open={clearStage > 0} onClose={() => setClearStage(0)} title="مسح كل البيانات">
        {clearStage === 1 ? (
          <>
            <p className="text-[14px] leading-relaxed text-paper-300">
              سيُمسح كل شيء نهائياً: <span className="num">{data.trades.length}</span> صفقة و
              <span className="num"> {data.cashFlows.length}</span> حركة نقدية وكل التسويات. لا
              يمكن التراجع.
            </p>
            <button
              type="button"
              className="btn-ghost mt-5 w-full"
              onClick={() =>
                downloadFile(toBackupJSON(data), backupFileName('json'), 'application/json')
              }
            >
              <IconDownload className="h-[18px] w-[18px]" />
              صدّر نسخة احتياطية أولاً
            </button>
            <div className="mt-3 grid grid-cols-2 gap-3 pb-6">
              <button type="button" className="btn-danger" onClick={() => setClearStage(2)}>
                متابعة المسح
              </button>
              <button type="button" className="btn-ghost" onClick={() => setClearStage(0)}>
                إلغاء
              </button>
            </div>
          </>
        ) : (
          <ClearConfirmation
            onCancel={() => setClearStage(0)}
            onConfirm={() => {
              clearAll()
              setClearStage(0)
            }}
          />
        )}
      </Sheet>
    </Screen>
  )
}

/** الخطوة الثانية: كتابة الكلمة يدوياً — لا زر يُضغط بالخطأ. */
function ClearConfirmation({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  onConfirm: () => void
}) {
  const [text, setText] = useState('')
  const ready = text.trim() === 'مسح'
  return (
    <>
      <p className="text-[14px] leading-relaxed text-loss">
        تأكيد أخير. اكتب كلمة <span className="font-semibold">مسح</span> في الحقل لتفعيل الزر.
      </p>
      <input
        className="field mt-4 text-center text-[18px]"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="مسح"
        autoFocus
      />
      <div className="mt-5 grid grid-cols-2 gap-3 pb-6">
        <button type="button" className="btn-danger" disabled={!ready} onClick={onConfirm}>
          امسح كل شيء
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          إلغاء
        </button>
      </div>
    </>
  )
}

function ExportRow({
  label,
  hint,
  onClick,
  last,
}: {
  label: string
  hint: string
  onClick: () => void
  last?: boolean
}) {
  return (
    <li className={cx(!last && 'border-b border-rule')}>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-start gap-3 py-3.5 text-start transition hover:opacity-80"
      >
        <IconDownload className="mt-0.5 h-[18px] w-[18px] shrink-0 text-paper-500" />
        <span className="min-w-0">
          <span className="block text-paper-100">{label}</span>
          <span className="mt-0.5 block text-[12px] leading-relaxed text-paper-700">{hint}</span>
        </span>
      </button>
    </li>
  )
}
