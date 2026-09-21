"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@/lib/i18n";
import type { Locale, TranslationKey } from "@/lib/i18n";

const ITEMS: { href: string; key: TranslationKey; icon: React.ReactNode }[] = [
  {
    href: "/admin",
    key: "overview",
    icon: <path d="M3 12l9-9 9 9M5 10v10h14V10" />,
  },
  {
    href: "/admin/students",
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
    <nav
      style={{
        padding: 10,
        border: "1px solid var(--border-soft)",
        borderRadius: 14,
        background: "var(--surface-alt)",
      }}
    >
      {ITEMS.map((item) => {
        // "/admin" يطابق نفسه فقط، وإلا بقي مُفعّلًا على كل صفحات اللوحة
        const active =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 8,
              fontSize: 14,
              marginBottom: 2,
              textDecoration: "none",
              background: active ? "var(--ink)" : "transparent",
              color: active ? "var(--ground)" : "var(--ink-soft)",
              fontWeight: active ? 600 : 400,
            }}
          >
            <svg
              aria-hidden
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ opacity: active ? 1 : 0.7, flexShrink: 0 }}
            >
              {item.icon}
            </svg>
            {t(locale, item.key)}
          </Link>
        );
      })}
    </nav>
  );
}
