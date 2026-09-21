"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";

const pillWrap: React.CSSProperties = {
  display: "inline-flex",
  padding: 3,
  background: "var(--surface-alt)",
  border: "1px solid var(--border-soft)",
  borderRadius: 999,
};

function pillButton(active: boolean): React.CSSProperties {
  return {
    font: "inherit",
    fontSize: 12,
    fontWeight: 700,
    padding: "5px 12px",
    borderRadius: 999,
    border: 0,
    cursor: "pointer",
    background: active ? "var(--surface)" : "transparent",
    color: active ? "var(--ink)" : "var(--ink-mute)",
    boxShadow: active ? "var(--shadow-sm)" : "none",
  };
}

export function LangToggle({ locale }: { locale: Locale }) {
  const router = useRouter();

  function pick(next: Locale) {
    if (next === locale) return;
    // سنة كاملة: شاشة المدرسة تُضبط مرة ولا يُعاد ضبطها كل فصل
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div style={pillWrap} role="group" aria-label="Language">
      <button type="button" style={pillButton(locale === "ar")} onClick={() => pick("ar")}>
        عربي
      </button>
      <button type="button" style={pillButton(locale === "en")} onClick={() => pick("en")}>
        EN
      </button>
    </div>
  );
}

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("sabbaq-theme");
    } catch {
      // نافذة خاصة أو بيانات موقع محجوبة — نكتفي بتفضيل النظام
    }
    if (stored === "dark" || stored === "light") {
      document.documentElement.setAttribute("data-theme", stored);
      setDark(stored === "dark");
    } else {
      setDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
  }, []);

  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("sabbaq-theme", next);
    } catch {
      // التبديل يبقى فعّالًا لهذه الجلسة وإن لم يُحفَظ
    }
    setDark(!dark);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      style={{
        display: "grid",
        placeItems: "center",
        width: 34,
        height: 34,
        borderRadius: 10,
        border: "1px solid var(--border-soft)",
        background: "var(--surface-alt)",
        color: "var(--ink-soft)",
        cursor: "pointer",
      }}
    >
      {dark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M5 12H3M21 12h-2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
        </svg>
      )}
    </button>
  );
}
