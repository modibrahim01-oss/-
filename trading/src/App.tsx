import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { AddEntrySheet } from './screens/AddEntry'
import { HomeScreen } from './screens/Home'
import { LogScreen } from './screens/Log'
import { ProjectionScreen } from './screens/Projection'
import { SettingsScreen } from './screens/Settings'
import { IconChart, IconHome, IconLedger, IconPlus, IconSettings, IconTable, IconWarning } from './components/icons'
import { cx } from './components/ui'
import { useStore } from './lib/store'

const ROUTES = ['home', 'log', 'charts', 'projection', 'settings'] as const
type Route = (typeof ROUTES)[number]

const TABS: { route: Route; label: string; Icon: typeof IconHome }[] = [
  { route: 'home', label: 'الرئيسية', Icon: IconHome },
  { route: 'log', label: 'السجل', Icon: IconLedger },
  { route: 'charts', label: 'الرسوم', Icon: IconChart },
  { route: 'projection', label: 'التوقع', Icon: IconTable },
  { route: 'settings', label: 'الإعدادات', Icon: IconSettings },
]

// Recharts وحدها ثلثا حجم الحزمة، وشاشة الرسوم ليست ما يُفتح كل مساء.
const ChartsScreen = lazy(() =>
  import('./screens/Charts').then((module) => ({ default: module.ChartsScreen })),
)

function readRoute(): Route {
  const hash = window.location.hash.replace('#/', '').replace('#', '')
  return (ROUTES as readonly string[]).includes(hash) ? (hash as Route) : 'home'
}

export default function App() {
  const [route, setRoute] = useState<Route>(readRoute)
  const [addOpen, setAddOpen] = useState(false)
  const { saveError, dismissSaveError } = useStore()

  useEffect(() => {
    const onHashChange = () => {
      setRoute(readRoute())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = useCallback((next: Route) => {
    window.location.hash = `#/${next}`
  }, [])

  const openAdd = useCallback(() => setAddOpen(true), [])

  return (
    <div className="min-h-dvh bg-ink-900 md:flex md:justify-center md:gap-8 md:px-6 md:py-10">
      <SideRail route={route} navigate={navigate} onAdd={openAdd} />

      <main className="mx-auto w-full max-w-app bg-ink-800 pb-32 md:mx-0 md:min-h-[80vh] md:rounded-2xl md:border md:border-rule md:pb-10 md:shadow-2xl md:shadow-black/40">
        {saveError && (
          <div className="flex items-start gap-3 border-b border-loss/30 bg-loss/10 px-5 py-3 text-[13px] leading-relaxed text-loss">
            <IconWarning className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="min-w-0 flex-1">{saveError}</p>
            <button type="button" onClick={dismissSaveError} className="shrink-0 underline underline-offset-4">
              إخفاء
            </button>
          </div>
        )}

        {route === 'home' && <HomeScreen onAdd={openAdd} navigate={navigate} />}
        {route === 'log' && <LogScreen onAdd={openAdd} />}
        {route === 'charts' && (
          <Suspense fallback={<ChartsFallback />}>
            <ChartsScreen onAdd={openAdd} />
          </Suspense>
        )}
        {route === 'projection' && <ProjectionScreen />}
        {route === 'settings' && <SettingsScreen />}
      </main>

      <BottomBar route={route} navigate={navigate} onAdd={openAdd} />
      <AddEntrySheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}

function ChartsFallback() {
  return (
    <div className="px-5 pt-6">
      <h1 className="text-[22px] font-semibold">الرسوم البيانية</h1>
      <div className="mt-8 space-y-6">
        <div className="h-4 w-32 animate-pulse rounded bg-ink-600" />
        <div className="h-56 w-full animate-pulse rounded-xl bg-ink-700" />
        <div className="h-48 w-full animate-pulse rounded-xl bg-ink-700" />
      </div>
    </div>
  )
}

function SideRail({
  route,
  navigate,
  onAdd,
}: {
  route: Route
  navigate: (route: Route) => void
  onAdd: () => void
}) {
  return (
    <nav className="sticky top-10 hidden h-fit w-52 shrink-0 md:block">
      <p className="mb-6 px-3 text-[13px] font-semibold tracking-[0.14em] text-paper-500">
        دفتر التداول
      </p>
      <ul className="space-y-1">
        {TABS.map(({ route: target, label, Icon }) => (
          <li key={target}>
            <button
              type="button"
              onClick={() => navigate(target)}
              aria-current={route === target ? 'page' : undefined}
              className={cx(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] transition',
                route === target
                  ? 'bg-ink-700 text-paper-100'
                  : 'text-paper-500 hover:bg-ink-800 hover:text-paper-300',
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onAdd} className="btn-primary mt-6 w-full">
        <IconPlus className="h-[18px] w-[18px]" />
        إضافة صفقة
      </button>
    </nav>
  )
}

function BottomBar({
  route,
  navigate,
  onAdd,
}: {
  route: Route
  navigate: (route: Route) => void
  onAdd: () => void
}) {
  return (
    <>
      <button
        type="button"
        onClick={onAdd}
        aria-label="إضافة صفقة"
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] end-5 z-30 flex h-14 w-14
                   items-center justify-center rounded-full bg-paper-100 text-ink-900 shadow-lg
                   shadow-black/50 transition active:scale-95 md:hidden"
      >
        <IconPlus className="h-6 w-6" />
      </button>

      <nav
        aria-label="التنقل"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-ink-800/95 backdrop-blur
                   pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="mx-auto flex max-w-app">
          {TABS.map(({ route: target, label, Icon }) => (
            <li key={target} className="flex-1">
              <button
                type="button"
                onClick={() => navigate(target)}
                aria-current={route === target ? 'page' : undefined}
                className={cx(
                  'flex w-full flex-col items-center gap-1 py-2.5 text-[11px] transition',
                  route === target ? 'text-paper-100' : 'text-paper-700',
                )}
              >
                <Icon className="h-[19px] w-[19px]" />
                {label}
                <span
                  className={cx(
                    'h-[2px] w-6 rounded-full transition',
                    route === target ? 'bg-proj' : 'bg-transparent',
                  )}
                />
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
