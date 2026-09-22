"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@/lib/i18n";
import type { Locale, TranslationKey } from "@/lib/i18n";

/** لكل قسم لونه: التنقّل يُحفظ بالألوان قبل الكلمات. */
const ITEMS: { href: string; key: TranslationKey; hue: string; icon: React.ReactNode }[] = [
  {
    href: "/admin",
    hue: "var(--sky)",
    key: "overview",
    icon: <path d="M3 12l9-9 9 9M5 10v10h14V10" />,
  },
  {
    href: "/admin/students",
    hue: "var(--lime)",
    key: "manageStudents",
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 22c0-4 4-6 8-6s8 2 8 6" />
      </>
    ),
  },
  {
    href: "/admin/supervisors",
    hue: "var(--grape-fill)",
    key: "manageSupervisors",
    icon: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
  {
    href: "/admin/limits",
    hue: "var(--tangerine)",
    key: "dailyLimits",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  },
  {
    href: "/admin/semesters",
    hue: "var(--berry)",
    key: "semesters",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
  },
];

export default function AdminNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();

  return (
    <nav className="pop" style={{ padding: 10, borderRadius: 22, background: "var(--surface)", display: "grid", gap: 6 }}>
      {ITEMS.map((item) => {
        // "/admin" يطابق نفسه فقط، وإلا بقي مُفعّلًا على كل صفحات اللوحة
        const active =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="nav-item"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "7px 10px",
              borderRadius: 14,
              fontSize: 15,
              fontWeight: 700,
              textDecoration: "none",
              border: `2.5px solid ${active ? "var(--outline)" : "transparent"}`,
              boxShadow: active ? "0 3px 0 var(--outline)" : "none",
              background: active ? "var(--sun)" : "transparent",
              color: active ? "var(--on-fill)" : "var(--ink)",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                display: "grid",
                placeItems: "center",
                background: item.hue,
                border: "2px solid var(--outline)",
                flexShrink: 0,
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--on-fill)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                {item.icon}
              </svg>
            </span>
            {t(locale, item.key)}
          </Link>
        );
      })}
      <style dangerouslySetInnerHTML={{ __html: `.nav-item:hover:not([aria-current]) { background: var(--surface-alt) !important; }` }} />
    </nav>
  );
}
