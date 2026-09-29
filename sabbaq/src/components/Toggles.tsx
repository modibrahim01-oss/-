"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { setLocale, useLocale } from "@/lib/useLocale";

const pillWrap: React.CSSProperties = {
  display: "inline-flex",
  padding: 3,
  background: "var(--surface)",
  border: "2.5px solid var(--outline)",
  boxShadow: "0 3px 0 var(--outline)",
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
    // الخيار النشط حبّة شمسية: يُقرأ من نظرة أيّ لغة مختارة
    background: active ? "var(--sun)" : "transparent",
    color: active ? "var(--on-fill)" : "var(--ink-mute)",
  };
}

export function LangToggle() {
  const locale = useLocale();
  const router = useRouter();

  function pick(next: Locale) {
    if (next === locale) return;
    setLocale(next);
    // الصفحات العامّة تبدّل نصوصها فورًا من الكوكي بلا طلب شبكة. التحديث
    // هنا لصفحات الموظّفين وحدها: نصوصها تُرسم على الخادم فلا تتبدّل بدونه.
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
      // نافذة خاصة أو بيانات موقع محجوبة — يبقى الفاتح
    }
    // الفاتح هو الافتراضي للجميع، ولو كان الجهاز على الوضع الليلي: الموقع
    // فاتح فاقع بالتصميم، والداكن اختيار صريح يُحفَظ لمن أراده
    if (stored === "dark") document.documentElement.setAttribute("data-theme", "dark");
    setDark(stored === "dark");
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
      className="press"
      style={{
        display: "grid",
        placeItems: "center",
        width: 38,
        height: 38,
        borderRadius: 12,
        border: "2.5px solid var(--outline)",
        boxShadow: "0 3px 0 var(--outline)",
        background: dark ? "var(--grape-fill)" : "var(--sun)",
        color: "var(--on-fill)",
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
