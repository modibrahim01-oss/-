import { describe, expect, it } from 'vitest'
import { backupFileName, toBackupJSON, toDailyCSV, toTradesCSV } from './backup'
import { ImportError, normalize, parseBackup } from './storage'
import { DEFAULT_SETTINGS, type AppData } from './types'

const sample: AppData = {
  schemaVersion: 1,
  settings: { ...DEFAULT_SETTINGS, startDate: '2026-09-06' },
  trades: [
    {
      id: 't1',
      date: '2026-09-06',
      symbol: 'أرامكو',
      resultSAR: 40,
      createdAt: '2026-09-06T10:00:00.000Z',
      updatedAt: '2026-09-06T10:00:00.000Z',
    },
    {
      id: 't2',
      date: '2026-09-06',
      symbol: 'سابك',
      resultSAR: -15,
      note: 'خروج متأخر',
      createdAt: '2026-09-06T11:00:00.000Z',
      updatedAt: '2026-09-06T11:00:00.000Z',
    },
  ],
  cashFlows: [
    {
      id: 'f1',
      date: '2026-09-07',
      type: 'deposit',
      amountSAR: 100,
      createdAt: '2026-09-07T09:00:00.000Z',
      updatedAt: '2026-09-07T09:00:00.000Z',
    },
  ],
  dayChecks: [{ date: '2026-09-07', actualWalletSAR: 440 }],
}

describe('النسخ الاحتياطي — الذهاب والإياب', () => {
  it('التصدير ثم الاستيراد يعيد البيانات كما هي', () => {
    const restored = parseBackup(toBackupJSON(sample))
    expect(restored.trades).toEqual(sample.trades)
    expect(restored.cashFlows).toEqual(sample.cashFlows)
    expect(restored.dayChecks).toEqual(sample.dayChecks)
    expect(restored.settings).toEqual(sample.settings)
  })
})

describe('الاستيراد — الرفض بشرح لا بابتلاع صامت', () => {
  it('يرفض ملفاً ليس JSON', () => {
    expect(() => parseBackup('ليس ملف بيانات')).toThrow(ImportError)
  })

  it('يرفض ملفاً بلا رقم إصدار', () => {
    expect(() => parseBackup(JSON.stringify({ trades: [] }))).toThrow(/schemaVersion/)
  })

  it('يرفض إصداراً مختلفاً ويطمئن أن البيانات الحالية سليمة', () => {
    expect(() => parseBackup(JSON.stringify({ schemaVersion: 9, trades: [] }))).toThrow(
      /لم يُمسّ شيء من بياناتك الحالية/,
    )
  })

  it('يرفض ملفاً بلا قائمة صفقات', () => {
    expect(() => parseBackup(JSON.stringify({ schemaVersion: 1 }))).toThrow(/trades/)
  })

  it('يقبل ملفاً صالحاً فيه سجل مشوّه واحد ويتجاهله وحده', () => {
    const restored = parseBackup(
      JSON.stringify({
        schemaVersion: 1,
        settings: sample.settings,
        trades: [sample.trades[0], { date: 'ليس تاريخاً', resultSAR: 5 }, { date: '2026-09-08' }],
        cashFlows: [],
        dayChecks: [],
      }),
    )
    expect(restored.trades).toHaveLength(1)
    expect(restored.trades[0].symbol).toBe('أرامكو')
  })
})

describe('التطبيع — لا ينهار أمام أي شكل', () => {
  it('يعيد بنية صالحة من قيمة فارغة تماماً', () => {
    const result = normalize(null)
    expect(result.trades).toEqual([])
    expect(result.settings.startingCapitalSAR).toBe(320)
    expect(result.settings.fxRate).toBe(3.75)
  })

  it('يستبدل سعر صرف صفرياً بالافتراضي بدل القسمة على صفر', () => {
    expect(normalize({ settings: { fxRate: 0 } }).settings.fxRate).toBe(3.75)
  })
})

describe('أسماء ملفات التصدير', () => {
  it('لاتينية بالكامل — كروم يُسقط أي اسم غير ASCII وينزّل الملف بلا امتداد', () => {
    for (const name of [
      backupFileName('backup', 'json'),
      backupFileName('trades', 'csv'),
      backupFileName('daily', 'csv'),
    ]) {
      // eslint-disable-next-line no-control-regex
      expect(name).toMatch(/^[\x20-\x7e]+$/)
      expect(name).toMatch(/^tadawul-(backup|trades|daily)-\d{4}-\d{2}-\d{2}\.(json|csv)$/)
    }
  })

  it('الأنواع الثلاثة لا تتصادم في اسم واحد', () => {
    const names = new Set([
      backupFileName('backup', 'json'),
      backupFileName('trades', 'csv'),
      backupFileName('daily', 'csv'),
    ])
    expect(names.size).toBe(3)
  })
})

describe('التصدير إلى CSV', () => {
  it('يبدأ بـ BOM حتى يفتح إكسل العربية بلا رموز', () => {
    expect(toTradesCSV(sample).startsWith('﻿')).toBe(true)
    expect(toDailyCSV(sample).startsWith('﻿')).toBe(true)
  })

  it('ملف الصفقات يحمل صفاً لكل صفقة مع أرقام اليوم', () => {
    const lines = toTradesCSV(sample).split('\r\n')
    expect(lines).toHaveLength(3) // ترويسة + صفقتان
    expect(lines[1]).toContain('أرامكو')
    expect(lines[1]).toContain('345') // رصيد نهاية اليوم بعد الصفقتين
    expect(lines[2]).toContain('-15')
  })

  it('ملف السجل اليومي يحمل صفاً لكل يوم فيه حركة', () => {
    const lines = toDailyCSV(sample).split('\r\n')
    expect(lines).toHaveLength(3) // ترويسة + يومان
    expect(lines[1]).toContain('2026-09-06')
    expect(lines[2]).toContain('-5') // فرق التسوية في اليوم الثاني
  })

  it('يحمي الفواصل داخل النص بعلامات اقتباس', () => {
    const withComma = {
      ...sample,
      trades: [{ ...sample.trades[0], note: 'دخول، ثم خروج' }],
    }
    expect(toTradesCSV(withComma)).toContain('"دخول، ثم خروج"')
  })
})
