import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { buildLedger, type Ledger } from './calc'
import { repository, StorageQuotaError } from './storage'
import type { AppData, CashFlow, DayCheck, Settings, Trade } from './types'

type TradeInput = Omit<Trade, 'id' | 'createdAt' | 'updatedAt'>
type CashFlowInput = Omit<CashFlow, 'id' | 'createdAt' | 'updatedAt'>

type StoreValue = {
  data: AppData
  ledger: Ledger
  settings: Settings
  /** رسالة خطأ حفظ معلّقة (امتلاء المساحة غالباً) — تعرضها الواجهة كشريط تحذير. */
  saveError: string | null
  dismissSaveError: () => void
  addTrade: (input: TradeInput) => void
  updateTrade: (id: string, patch: Partial<TradeInput>) => void
  deleteTrade: (id: string) => void
  addCashFlow: (input: CashFlowInput) => void
  deleteCashFlow: (id: string) => void
  setDayCheck: (check: DayCheck) => void
  clearDayCheck: (date: string) => void
  updateSettings: (patch: Partial<Settings>) => void
  replaceAll: (next: AppData) => void
  clearAll: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => repository.load())
  const [saveError, setSaveError] = useState<string | null>(null)
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    try {
      repository.save(data)
      setSaveError(null)
    } catch (error) {
      setSaveError(
        error instanceof StorageQuotaError
          ? 'امتلأت مساحة التخزين في المتصفح، وآخر تعديل لم يُحفظ. صدّر نسخة احتياطية الآن ثم امسح بيانات قديمة.'
          : 'تعذّر الحفظ في هذا المتصفح. صدّر نسخة احتياطية حتى لا تفقد ما أدخلته.',
      )
    }
  }, [data])

  const addTrade = useCallback((input: TradeInput) => {
    const now = new Date().toISOString()
    setData((current) => ({
      ...current,
      trades: [...current.trades, { ...input, id: newId(), createdAt: now, updatedAt: now }],
    }))
  }, [])

  const updateTrade = useCallback((id: string, patch: Partial<TradeInput>) => {
    const now = new Date().toISOString()
    setData((current) => ({
      ...current,
      trades: current.trades.map((trade) =>
        trade.id === id ? { ...trade, ...patch, updatedAt: now } : trade,
      ),
    }))
  }, [])

  const deleteTrade = useCallback((id: string) => {
    setData((current) => ({ ...current, trades: current.trades.filter((t) => t.id !== id) }))
  }, [])

  const addCashFlow = useCallback((input: CashFlowInput) => {
    const now = new Date().toISOString()
    setData((current) => ({
      ...current,
      cashFlows: [...current.cashFlows, { ...input, id: newId(), createdAt: now, updatedAt: now }],
    }))
  }, [])

  const deleteCashFlow = useCallback((id: string) => {
    setData((current) => ({ ...current, cashFlows: current.cashFlows.filter((f) => f.id !== id) }))
  }, [])

  const setDayCheck = useCallback((check: DayCheck) => {
    setData((current) => ({
      ...current,
      dayChecks: [...current.dayChecks.filter((c) => c.date !== check.date), check],
    }))
  }, [])

  const clearDayCheck = useCallback((date: string) => {
    setData((current) => ({
      ...current,
      dayChecks: current.dayChecks.filter((c) => c.date !== date),
    }))
  }, [])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setData((current) => ({ ...current, settings: { ...current.settings, ...patch } }))
  }, [])

  const replaceAll = useCallback((next: AppData) => setData(next), [])

  const clearAll = useCallback(() => {
    repository.clear()
    setData(repository.load())
  }, [])

  const ledger = useMemo(() => buildLedger(data), [data])

  const value = useMemo<StoreValue>(
    () => ({
      data,
      ledger,
      settings: data.settings,
      saveError,
      dismissSaveError: () => setSaveError(null),
      addTrade,
      updateTrade,
      deleteTrade,
      addCashFlow,
      deleteCashFlow,
      setDayCheck,
      clearDayCheck,
      updateSettings,
      replaceAll,
      clearAll,
    }),
    [
      data, ledger, saveError, addTrade, updateTrade, deleteTrade, addCashFlow,
      deleteCashFlow, setDayCheck, clearDayCheck, updateSettings, replaceAll, clearAll,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore خارج StoreProvider')
  return value
}
