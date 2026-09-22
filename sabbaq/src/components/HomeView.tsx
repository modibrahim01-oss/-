"use client";

import Link from "next/link";
import { Brand } from "@/components/Brand";
import StudentSearch from "@/components/StudentSearch";
import { LangToggle, ThemeToggle } from "@/components/Toggles";
import { page, topbar, topbarInner } from "@/components/ui";
import { formatNumber, t } from "@/lib/i18n";
import type { Group } from "@/lib/types";
import { useLocale } from "@/lib/useLocale";

/**
 * واجهة الصفحة العامّة. مكوّن عميل عن قصد: الصفحة نفسها ساكنة تُخدَم من
 * الحافة، واللغة تُقرأ هنا في المتصفح — فلا تحتاج الصفحة أن تُرسم على
 * الخادم لكل زائر لمجرّد معرفة لغته.
 */

const navLink: React.CSSProperties = {
  font: "inherit",
  fontSize: 13,
  fontWeight: 500,
  padding: "8px 14px",
  borderRadius: 999,
  color: "var(--ink-soft)",
  textDecoration: "none",
};

export default function HomeView({
  groups,
  studentCounts,
}: {
  groups: Group[];
  studentCounts: Record<number, number>;
}) {
  const locale = useLocale();

  return (
    <>
      <header style={topbar}>
        <div style={topbarInner}>
          <Brand locale={locale} />
          <div style={{ marginInlineStart: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <Link href="/tv" style={navLink}>
              {t(locale, "tvMode")}
            </Link>
            <Link href="/login" style={navLink}>
              {t(locale, "login")}
            </Link>
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main style={page}>
        <section
          style={{
            padding: "44px 24px 36px",
            textAlign: "center",
            background:
              "radial-gradient(circle at 22% 20%, var(--brand-soft) 0%, transparent 46%), radial-gradient(circle at 82% 28%, var(--gold-soft) 0%, transparent 52%), linear-gradient(180deg, var(--surface) 0%, var(--surface-alt) 100%)",
            border: "1px solid var(--border-soft)",
            borderRadius: 20,
          }}
        >
          <h1
            style={{
              fontSize: "clamp(28px, 5vw, 42px)",
              margin: "0 0 8px",
              letterSpacing: "-0.01em",
            }}
          >
            {t(locale, "findYourFarm")}
          </h1>
          <p style={{ color: "var(--ink-soft)", margin: "0 auto 26px", maxWidth: "48ch" }}>
            {t(locale, "publicIntro")}
          </p>
          <StudentSearch groups={groups} />
        </section>

        <section style={{ marginTop: 40 }}>
          <h2
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--ink-mute)",
              fontWeight: 600,
              margin: "0 0 14px",
              fontFamily: "var(--font-body)",
            }}
          >
            {t(locale, "groups")}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
              gap: 12,
            }}
          >
            {groups.map((g) => (
              <Link
                key={g.id}
                href={`/?group=${g.id}#student-query`}
                style={{
                  padding: "18px 16px",
                  borderRadius: 14,
                  background: "var(--surface-alt)",
                  border: "1px solid var(--border-soft)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                  textDecoration: "none",
                  color: "var(--ink)",
                }}
              >
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>
                  {locale === "ar" ? g.name_ar : g.name_en}
                </span>
                <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                  {locale === "ar" ? g.stage_ar : g.stage_en}
                </span>
                <span
                  className="tabular"
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--brand-deep)",
                  }}
                >
                  {formatNumber(locale, studentCounts[g.id] ?? 0)} {t(locale, "students")}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
