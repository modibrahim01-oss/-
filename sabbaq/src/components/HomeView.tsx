"use client";

import Link from "next/link";
import { Brand } from "@/components/Brand";
import RankBadge from "@/components/RankBadge";
import StudentSearch from "@/components/StudentSearch";
import { PlantIcon } from "@/components/TierLegend";
import { LangToggle, ThemeToggle } from "@/components/Toggles";
import { page, topbar, topbarInner } from "@/components/ui";
import { formatNumber, t } from "@/lib/i18n";
import { TIER_LIST } from "@/lib/tiers";
import type { Group } from "@/lib/types";
import { useLocale } from "@/lib/useLocale";

/**
 * واجهة الصفحة العامّة. مكوّن عميل عن قصد: الصفحة نفسها ساكنة تُخدَم من
 * الحافة، واللغة تُقرأ هنا في المتصفح — فلا تحتاج الصفحة أن تُرسم على
 * الخادم لكل زائر لمجرّد معرفة لغته.
 *
 * البرنامج تحفيزي فيه فرح ومنافسة، فالصفحة لا تكتفي بمربّع بحث: تعرض
 * المتصدّرين وسباق المجموعات، وتشرح بالصورة أن كل نقطة نبتة.
 */

/** طالب في لوحة الصدارة — صفّ من student_farms. */
export type Standing = {
  student_id: string;
  full_name: string;
  group_id: number;
  group_name_ar: string;
  group_name_en: string;
  total_points: number;
};

/**
 * لون لكل مجموعة، بترتيبها. ألوان المزرعة نفسها (سماء، عشب، شمس، عنب)
 * ثم ثلاثة مكمّلة — فتبدو الصفحة والمزرعة من عالم واحد.
 */
const GROUP_HUES = ["#4fb8e8", "#6cc24a", "#f2b632", "#b566d9", "#f08a4b", "#35b5a0", "#e2679b"];

const navLink: React.CSSProperties = {
  font: "inherit",
  fontSize: 13,
  fontWeight: 500,
  padding: "8px 14px",
  borderRadius: 999,
  color: "var(--ink-soft)",
  textDecoration: "none",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 20,
  margin: 0,
};

const card: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border-soft)",
  borderRadius: 20,
  padding: "20px 20px 14px",
  boxShadow: "var(--shadow)",
};

export default function HomeView({
  groups,
  studentCounts,
  groupPoints,
  leaders,
}: {
  groups: Group[];
  studentCounts: Record<number, number>;
  groupPoints: Record<number, number>;
  leaders: Standing[];
}) {
  const locale = useLocale();
  const hueOf = new Map(groups.map((g, i) => [g.id, GROUP_HUES[i % GROUP_HUES.length]]));

  // سباق المجموعات بالنقاط، وتبقى المجموعات بلا نقاط بترتيبها الأصلي
  const race = [...groups].sort((a, b) => (groupPoints[b.id] ?? 0) - (groupPoints[a.id] ?? 0));
  const topPoints = Math.max(0, ...race.map((g) => groupPoints[g.id] ?? 0));

  return (
    <>
      <header style={topbar}>
        <div style={topbarInner}>
          <Brand locale={locale} />
          <div style={{ marginInlineStart: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <Link href="/tv" style={navLink} className="hide-narrow">
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
            padding: "44px 24px 30px",
            textAlign: "center",
            // سماء المزرعة تذوب في سطح الصفحة، وشريط عشب يحدّها من أسفل
            background:
              "linear-gradient(180deg, color-mix(in oklab, var(--sky) 45%, var(--surface)) 0%, var(--surface) 82%)",
            border: "1px solid var(--border-soft)",
            borderBottom: "6px solid color-mix(in oklab, #7fcf55 78%, var(--surface))",
            borderRadius: 20,
          }}
        >
          <h1
            style={{
              fontSize: "clamp(28px, 5vw, 44px)",
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

          <p
            style={{
              margin: "30px 0 12px",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ink-soft)",
            }}
          >
            {t(locale, "everyPointPlants")}
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            {TIER_LIST.map((spec) => (
              <span
                key={spec.tier}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 14px 7px 10px",
                  borderRadius: 999,
                  background: `color-mix(in oklab, ${spec.color} 24%, var(--surface))`,
                  border: `1px solid color-mix(in oklab, ${spec.color} 55%, var(--surface))`,
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                <PlantIcon tier={spec.tier} size={26} />
                <span>{locale === "ar" ? spec.labelAr : spec.labelEn}</span>
                <span
                  className="tabular"
                  style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: spec.ink }}
                >
                  {formatNumber(locale, spec.points)}
                </span>
              </span>
            ))}
          </div>
        </section>

        <div className="home-boards" style={{ marginTop: 28 }}>
          <section style={card} aria-labelledby="leaders-title">
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
              <h2 id="leaders-title" style={sectionTitle}>
                {t(locale, "leaders")}
              </h2>
              <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                {t(locale, "leadersHint")}
              </span>
            </div>

            {leaders.length === 0 ? (
              <p style={{ color: "var(--ink-mute)", fontSize: 14, margin: "18px 0 22px" }}>
                {t(locale, "noLeadersYet")}
              </p>
            ) : (
              <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {leaders.map((s, i) => (
                  <li key={s.student_id}>
                    <Link
                      href={`/farm/${s.student_id}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "auto minmax(0, 1fr) auto",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 6px",
                        borderTop: i === 0 ? "none" : "1px solid var(--border-soft)",
                        textDecoration: "none",
                        color: "var(--ink)",
                      }}
                    >
                      <RankBadge rank={i + 1} label={formatNumber(locale, i + 1)} />
                      <span style={{ minWidth: 0 }}>
                        <span
                          style={{
                            display: "block",
                            fontWeight: 700,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {s.full_name}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                          {locale === "ar" ? s.group_name_ar : s.group_name_en}
                        </span>
                      </span>
                      <span
                        className="tabular"
                        style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          fontSize: 18,
                          color: "var(--brand-deep)",
                        }}
                      >
                        {formatNumber(locale, s.total_points)}{" "}
                        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>
                          {t(locale, "points")}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section style={card} aria-labelledby="race-title">
            <h2 id="race-title" style={{ ...sectionTitle, marginBottom: 12 }}>
              {t(locale, "groupRace")}
            </h2>
            <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {race.map((g, i) => {
                const pts = groupPoints[g.id] ?? 0;
                const hue = hueOf.get(g.id) ?? GROUP_HUES[0];
                const leading = i === 0 && pts > 0;
                return (
                  <li key={g.id}>
                    <Link
                      href={`/?group=${g.id}#student-query`}
                      style={{
                        display: "grid",
                        gap: 6,
                        padding: "10px 6px",
                        borderTop: i === 0 ? "none" : "1px solid var(--border-soft)",
                        textDecoration: "none",
                        color: "var(--ink)",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          aria-hidden
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 3,
                            background: hue,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
                          {locale === "ar" ? g.name_ar : g.name_en}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                          {formatNumber(locale, studentCounts[g.id] ?? 0)} {t(locale, "students")}
                        </span>
                        {leading && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 999,
                              background: "var(--gold-soft)",
                              color: "var(--ink)",
                              border: "1px solid color-mix(in oklab, var(--gold) 60%, transparent)",
                            }}
                          >
                            {t(locale, "leadingGroup")}
                          </span>
                        )}
                        <span
                          className="tabular"
                          style={{
                            marginInlineStart: "auto",
                            fontFamily: "var(--font-display)",
                            fontWeight: 700,
                            color: "var(--brand-deep)",
                          }}
                        >
                          {formatNumber(locale, pts)}
                        </span>
                      </span>
                      <span
                        aria-hidden
                        style={{
                          height: 8,
                          borderRadius: 999,
                          background: "var(--surface-alt)",
                          overflow: "hidden",
                        }}
                      >
                        <span
                          style={{
                            display: "block",
                            height: "100%",
                            // مجموعة بلا نقاط شريطها فارغ فعلًا؛ والحدّ الأدنى
                            // للمجموعات التي بدأت يُبقي أول نقطة مرئية
                            width: `${pts > 0 ? Math.max(3, (pts / topPoints) * 100) : 0}%`,
                            background: hue,
                            borderRadius: 999,
                          }}
                        />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </main>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .home-boards { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
            @media (max-width: 860px) { .home-boards { grid-template-columns: minmax(0, 1fr); } }
            @media (max-width: 480px) { .hide-narrow { display: none; } }
          `,
        }}
      />
    </>
  );
}
