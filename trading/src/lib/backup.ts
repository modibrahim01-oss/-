import { buildLedger } from './calc'
import { todayInRiyadh } from './date'
import { formatAmount, toSAR } from './money'
import type { AppData } from './types'

export type ExportKind = 'backup' | 'trades' | 'daily'

/**
 * أسماء الملفات لاتينية عمداً رغم أن الواجهة عربية بالكامل.
 * كروم يتجاهل خاصية `download` إن كانت غير ASCII وينزّل الملف باسم
 * «download» بلا امتداد أصلاً — وملف نسخة احتياطية بلا امتداد لا يُستورد
 * لاحقاً، وهو خط الدفاع الوحيد عن بيانات المستخدم.
 */
export function backupFileName(kind: ExportKind, extension: string): string {
  return `tadawul-${kind}-${todayInRiyadh()}.${extension}`
}

export function toBackupJSON(data: AppData): string {
  return JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2)
}

function csvCell(value: string | number): string {
  const text = String(value)
  // نقتبس عند أي فاصل قد يقسم الخلية: الفاصلة اللاتينية والعربية (،)
  // والفاصلة المنقوطة بنوعيها — إكسل يختار فاصل القائمة حسب لغة النظام،
  // وعلى نظام عربي قد يكون غير الفاصلة اللاتينية.
  return /["',;\r\n،؛]|^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function csvRows(rows: (string | number)[][]): string {
  // BOM حتى يفتح إكسل الملف بترميز UTF-8 ولا تتحوّل العربية إلى رموز.
  return '﻿' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}

/** صف لكل صفقة، مع أعمدة اليوم المحسوبة بجانبها. */
export function toTradesCSV(data: AppData): string {
  const ledger = buildLedger(data)
  const rows: (string | number)[][] = [
    [
      'التاريخ', 'السهم', 'النتيجة (ريال)', 'المبلغ المستثمر (ريال)',
      'سعر الدخول', 'سعر الخروج', 'الكمية', 'الرسوم (ريال)', 'ملاحظة',
      'ربح اليوم (ريال)', 'نسبة اليوم', 'رصيد نهاية اليوم (ريال)',
    ],
  ]
  for (const day of ledger.days) {
    for (const trade of day.trades) {
      rows.push([
        trade.date,
        trade.symbol,
        trade.resultSAR,
        trade.amountInvestedSAR ?? '',
        trade.entryPrice ?? '',
        trade.exitPrice ?? '',
        trade.quantity ?? '',
        trade.feesSAR ?? '',
        trade.note ?? '',
        toSAR(day.dayPLHalalas),
        day.dayPct === null ? '' : formatAmount(Math.round(day.dayPct * 10000)) + '%',
        toSAR(day.closingBalanceHalalas),
      ])
    }
  }
  return csvRows(rows)
}

/** صف لكل يوم فيه حركة — أقرب شكل لملف الإكسل الأصلي. */
export function toDailyCSV(data: AppData): string {
  const ledger = buildLedger(data)
  const rows: (string | number)[][] = [
    [
      'التاريخ', 'رصيد بداية اليوم', 'ربح/خسارة اليوم', 'نسبة اليوم',
      'إيداع/سحب', 'رصيد نهاية اليوم', 'الربح التراكمي',
      'الرصيد الفعلي', 'فرق غير مسجّل', 'عدد الصفقات',
    ],
  ]
  for (const day of ledger.days) {
    rows.push([
      day.date,
      toSAR(day.openingBalanceHalalas),
      toSAR(day.dayPLHalalas),
      day.dayPct === null ? '' : formatAmount(Math.round(day.dayPct * 10000)) + '%',
      toSAR(day.netFlowHalalas),
      toSAR(day.closingBalanceHalalas),
      toSAR(day.cumulativeProfitHalalas),
      day.actualWalletHalalas === null ? '' : toSAR(day.actualWalletHalalas),
      day.discrepancyHalalas === null ? '' : toSAR(day.discrepancyHalalas),
      day.trades.length,
    ])
  }
  return csvRows(rows)
}

/**
 * دالة حفظ يُركّبها المضيف قبل إقلاع التطبيق.
 *
 * بعض البيئات تمنع الصفحة من تنزيل الملفات بنفسها، فلا يفعل رابط التنزيل
 * المعتاد شيئاً. تلك البيئات تضع بديلها هنا، ونفضّله متى وُجد. تتكفّل هي
 * بإبلاغ المستخدم عند الفشل — لذلك لا نُرجع وعداً ولا ننتظر نتيجة.
 */
type HostSave = (content: string, fileName: string, mimeType: string) => void

declare global {
  interface Window {
    __saveFile?: HostSave
  }
}

export function downloadFile(content: string, fileName: string, mimeType: string): void {
  const hostSave = window.__saveFile
  if (hostSave) {
    hostSave(content, fileName, mimeType)
    return
  }

  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  // نمهل المتصفح دورة قبل تحرير الرابط حتى لا يُلغى التنزيل على الجوال.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
