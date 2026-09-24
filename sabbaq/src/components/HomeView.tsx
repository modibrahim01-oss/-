"use client";

import Link from "next/link";
import { Brand } from "@/components/Brand";
import HeroSky from "@/components/HeroSky";
import RankBadge from "@/components/RankBadge";
import StarBadge from "@/components/StarBadge";
import StudentSearch from "@/components/StudentSearch";
import { PlantIcon } from "@/components/TierLegend";
import { LangToggle, ThemeToggle } from "@/components/Toggles";
import { page, topbar, topbarInner } from "@/components/ui";
import { formatNumber, t, type Locale } from "@/lib/i18n";
import { TIER_LIST } from "@/lib/tiers";
import type { Group } from "@/lib/types";
import { useLocale } from "@/lib/useLocale";
import type { WeeklyStar } from "@/lib/weekly";

/**
 * واجهة الصفحة العامّة. مكوّن عميل عن قصد: الصفحة نفسها ساكنة تُخدَم من
 * الحافة، واللغة تُقرأ هنا في المتصفح — فلا تحتاج الصفحة أن تُرسم على
 * الخادم لكل زائر لمجرّد معرفة لغته.
 *
 * البرنامج تحفيزي فيه فرح ومنافسة، والصفحة تقول ذلك بالصورة قبل الكلام:
 * سماء وتلّة تنمو عليها النبتات الأربع بأثمانها، ومنصّة تتويج، وسباق
 * للمجموعات بمتسابقين يتقدّمون على مضمار.
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

/** لون لكل مجموعة بترتيبها: ألوان الهوية الفاقعة نفسها. */
const GROUP_HUES = [
  "var(--sky)",
  "var(--lime)",
  "var(--sun)",
  "var(--grape-fill)",
  "var(--tangerine)",
  "var(--mint)",
  "var(--berry)",
];

const navLink: React.CSSProperties = {
  font: "inherit",
  fontSize: 14,
  fontWeight: 700,
  padding: "8px 14px",
  borderRadius: 999,
  color: "var(--ink)",
  textDecoration: "none",
};

export default function HomeView({
  groups,
  studentCounts,
  groupPoints,
  leaders,
  weekly,
}: {
  groups: Group[];
  studentCounts: Record<number, number>;
  groupPoints: Record<number, number>;
  leaders: Standing[];
  weekly: WeeklyStar[];
}) {
  const locale = useLocale();
  const hueOf = new Map(groups.map((g, i) => [g.id, GROUP_HUES[i % GROUP_HUES.length]]));

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
          className="pop hero"
          style={{
            position: "relative",
            borderRadius: 30,
            overflow: "hidden",
            textAlign: "center",
            background: "linear-gradient(180deg, #7fdcff 0%, #b9ecff 48%, #e6f9ff 100%)",
          }}
        >
          <HeroSky />

          <div className="hero-body" style={{ position: "relative", padding: "46px 20px 30px" }}>
            <span
              className="pop-in"
              style={{
                display: "inline-block",
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 15,
                padding: "4px 14px",
                borderRadius: 999,
                background: "var(--sun)",
                color: "var(--on-fill)",
                border: "2.5px solid var(--outline)",
                boxShadow: "0 3px 0 var(--outline)",
                transform: "rotate(-2deg)",
                marginBottom: 14,
              }}
            >
              {t(locale, "heroKicker")}
            </span>
            <h1
              style={{
                fontSize: "clamp(34px, 6.4vw, 60px)",
                lineHeight: 1.1,
                margin: "0 0 10px",
                color: "var(--on-fill)",
                // حدّ أبيض حول الحروف يفصلها عن الغيوم والسماء
                textShadow: "0 3px 0 #fff, 3px 0 0 #fff, -3px 0 0 #fff, 0 -2px 0 #fff",
              }}
            >
              {t(locale, "findYourFarm")}
            </h1>
            <p
              style={{
                color: "var(--on-fill)",
                fontWeight: 500,
                fontSize: 17,
                margin: "0 auto 24px",
                maxWidth: "44ch",
              }}
            >
              {t(locale, "publicIntro")}
            </p>
            <StudentSearch groups={groups} />
          </div>

          <Garden locale={locale} />
        </section>

        <section aria-labelledby="weekly-title" style={{ marginTop: 34 }}>
          <BoardTitle id="weekly-title" color="var(--berry)">
            {t(locale, "weeklyStars")}
          </BoardTitle>
          <p style={{ margin: "-6px 0 14px", color: "var(--ink-soft)", fontWeight: 500 }}>{t(locale, "weeklyStarsHint")}</p>
          <WeeklyStars locale={locale} weekly={weekly} hueOf={hueOf} />
        </section>

        <div className="home-boards">
          <section aria-labelledby="leaders-title">
            <BoardTitle id="leaders-title" color="var(--sun)">
              {t(locale, "leaders")}
            </BoardTitle>
            <Podium locale={locale} leaders={leaders} />
          </section>

          <section aria-labelledby="race-title">
            <BoardTitle id="race-title" color="var(--sky)">
              {t(locale, "groupRace")}
            </BoardTitle>
            <RaceTrack
              locale={locale}
              groups={groups}
              groupPoints={groupPoints}
              studentCounts={studentCounts}
              hueOf={hueOf}
            />
          </section>
        </div>
      </main>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .home-boards { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; align-items: start; margin-top: 34px; }
            .weekly-row { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; }
            @media (max-width: 1000px) { .weekly-row { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
            @media (max-width: 640px) { .weekly-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } .weekly-row > :first-child { grid-column: 1 / -1; } }
            .garden-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
            @media (max-width: 860px) { .home-boards { grid-template-columns: minmax(0, 1fr); } }
            @media (max-width: 640px) {
              .garden-row { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 16px; }
              /* الشمس والغيوم فوق المحتوى لا خلفه: تُزاح الكتابة تحتها */
              .hero-body { padding-top: 92px !important; }
              .hero-sun { width: 84px; height: 84px; top: 8px !important; }
              .hero-cloud:nth-of-type(3) { display: none; }
            }
            @media (max-width: 480px) { .hide-narrow { display: none; } }
          `,
        }}
      />
    </>
  );
}

function BoardTitle({ id, color, children }: { id: string; color: string; children: React.ReactNode }) {
  return (
    <h2 id={id} style={{ fontSize: 26, margin: "0 0 14px", display: "flex", alignItems: "center", gap: 10 }}>
      <span
        aria-hidden
        style={{
          width: 16,
          height: 16,
          borderRadius: 5,
          background: color,
          border: "2.5px solid var(--outline)",
          transform: "rotate(45deg)",
        }}
      />
      {children}
    </h2>
  );
}

/**
 * التلّة أسفل الواجهة: النبتات الأربع واقفة على العشب، وفوق كل واحدة ثمنها.
 * هي الشرح كلّه بلا فقرة: «كل نقطة نبتة، والنبتة الأكبر بنقاط أكثر».
 */
function Garden({ locale }: { locale: Locale }) {
  return (
    <div style={{ position: "relative", marginTop: 8 }}>
      <svg
        aria-hidden
        viewBox="0 0 1200 60"
        preserveAspectRatio="none"
        style={{ display: "block", width: "100%", height: 46, marginBottom: -2 }}
      >
        <path
          d="M0 40C120 12 240 12 360 30s240 26 360 6 240-30 360-14 120 18 120 18V60H0z"
          fill="var(--lime)"
          stroke="var(--outline)"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div style={{ background: "var(--lime)", padding: "6px 16px 22px" }}>
        <div className="garden-row" style={{ maxWidth: 860, margin: "0 auto" }}>
          {TIER_LIST.map((spec, i) => (
            <div
              key={spec.tier}
              className="bob"
              style={{ animationDelay: `${i * 0.35}s`, display: "grid", justifyItems: "center", gap: 2 }}
            >
              <span
                className="tabular"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 17,
                  padding: "1px 12px",
                  borderRadius: 999,
                  background: "#fff",
                  color: "var(--on-fill)",
                  border: "2.5px solid var(--outline)",
                  boxShadow: `0 3px 0 var(--outline), inset 0 -4px 0 ${spec.color}`,
                }}
              >
                +{formatNumber(locale, spec.points)}
              </span>
              <PlantIcon tier={spec.tier} size={74 + i * 8} />
              <span style={{ fontWeight: 700, color: "var(--on-fill)", fontSize: 15 }}>
                {locale === "ar" ? spec.labelAr : spec.labelEn}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * أبطال الأسبوع: بطاقة لكل بطل، والأول أعرض بنجمة ذهبية ولقب «نجم الأسبوع».
 * الرقم على البطاقة نقاط الأسبوع لا المجموع: هو ما يتنافس عليه الجميع من الصفر.
 */
function WeeklyStars({
  locale,
  weekly,
  hueOf,
}: {
  locale: Locale;
  weekly: WeeklyStar[];
  hueOf: Map<number, string>;
}) {
  if (weekly.length === 0) {
    return (
      <div
        className="pop"
        style={{
          background: "var(--surface)",
          borderRadius: 24,
          padding: "22px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          textAlign: "center",
        }}
      >
        <StarBadge size={44} />
        <p style={{ margin: 0, fontWeight: 700, color: "var(--ink-soft)" }}>{t(locale, "noWeeklyYet")}</p>
      </div>
    );
  }

  return (
    <ol className="weekly-row" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {weekly.map((s, i) => {
        const first = i === 0;
        return (
          <li key={s.student_id} style={{ minWidth: 0 }}>
            <Link
              href={`/farm/${s.student_id}`}
              className="pop lift"
              style={{
                display: "grid",
                justifyItems: "center",
                gap: 6,
                height: "100%",
                padding: "14px 10px 12px",
                borderRadius: 20,
                textAlign: "center",
                textDecoration: "none",
                color: "var(--ink)",
                background: first
                  ? "linear-gradient(180deg, color-mix(in oklab, var(--sun) 55%, var(--surface)), var(--surface))"
                  : "var(--surface)",
              }}
            >
              <StarBadge label={formatNumber(locale, i + 1)} size={first ? 58 : 44} gold={first} />
              {first && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "1px 10px",
                    borderRadius: 999,
                    background: "var(--berry)",
                    color: "var(--on-fill)",
                    border: "2px solid var(--outline)",
                  }}
                >
                  {t(locale, "starOfWeek")}
                </span>
              )}
              <span
                style={{
                  fontWeight: 700,
                  fontSize: first ? 18 : 15,
                  lineHeight: 1.3,
                  maxWidth: "100%",
                  overflowWrap: "anywhere",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {s.full_name}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "0 10px",
                  borderRadius: 999,
                  background: hueOf.get(s.group_id) ?? "var(--sky)",
                  color: "var(--on-fill)",
                  border: "2px solid var(--outline)",
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {locale === "ar" ? s.group_name_ar : s.group_name_en}
              </span>
              <span className="tabular" style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--brand-deep)", fontSize: first ? 20 : 17 }}>
                +{formatNumber(locale, s.week_points)}{" "}
                <span style={{ fontSize: 12, fontFamily: "var(--font-body)", color: "var(--ink-mute)" }}>{t(locale, "thisWeek")}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

const PODIUM = [
  { place: 2, height: 96, fill: "linear-gradient(180deg, #f1f4f7, #b3bec8)" },
  { place: 1, height: 132, fill: "linear-gradient(180deg, #ffe680, #ffc21a)" },
  { place: 3, height: 74, fill: "linear-gradient(180deg, #f6c99a, #d9914f)" },
];

/**
 * منصّة التتويج للثلاثة الأوائل، ثم الرابع والخامس.
 *
 * المكان الشاغر لا يُخفى: يظهر منصّةً منقّطة عليها «مكانك هنا؟» — دعوة لا
 * فراغ. في أول الفصل حيث يكون المتصدّر واحدًا، يرى كل طالب مكانين ينتظرانه.
 */
function Podium({ locale, leaders }: { locale: Locale; leaders: Standing[] }) {
  if (leaders.length === 0) {
    return (
      <div className="pop" style={{ background: "var(--surface)", borderRadius: 24, padding: "26px 20px", textAlign: "center" }}>
        <p style={{ margin: 0, fontWeight: 700, color: "var(--ink-soft)" }}>{t(locale, "noLeadersYet")}</p>
      </div>
    );
  }

  const rest = leaders.slice(3);

  return (
    <div className="pop" style={{ background: "var(--surface)", borderRadius: 24, padding: "20px 18px 16px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", alignItems: "end", gap: 10 }}>
        {PODIUM.map(({ place, height, fill }) => {
          const s = leaders[place - 1];
          return (
            <div key={place} style={{ display: "grid", justifyItems: "center", gap: 6, minWidth: 0 }}>
              {s ? (
                <Link
                  href={`/farm/${s.student_id}`}
                  className="lift"
                  style={{
                    display: "grid",
                    justifyItems: "center",
                    gap: 3,
                    textDecoration: "none",
                    color: "var(--ink)",
                    minWidth: 0,
                    maxWidth: "100%",
                    borderRadius: 14,
                    padding: "4px 6px",
                  }}
                >
                  <RankBadge rank={place} label={formatNumber(locale, place)} size={place === 1 ? 46 : 38} />
                  {/* سطران لا بتر: الاسم الكامل هو الجائزة على المنصّة */}
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: place === 1 ? 17 : 15,
                      lineHeight: 1.3,
                      textAlign: "center",
                      maxWidth: "100%",
                      overflowWrap: "anywhere",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {s.full_name}
                  </span>
                  <span
                    className="tabular"
                    style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--brand-deep)" }}
                  >
                    {formatNumber(locale, s.total_points)} {t(locale, "points")}
                  </span>
                </Link>
              ) : (
                <span style={{ fontWeight: 700, color: "var(--ink-mute)", fontSize: 14, padding: "0 4px 6px" }}>
                  {t(locale, "yourSpot")}
                </span>
              )}
              <div
                style={{
                  width: "100%",
                  height,
                  borderRadius: "14px 14px 6px 6px",
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 38,
                  color: "var(--on-fill)",
                  ...(s
                    ? { background: fill, border: "2.5px solid var(--outline)", boxShadow: "var(--pop)" }
                    : { border: "2.5px dashed var(--border)", color: "var(--ink-mute)" }),
                }}
              >
                {formatNumber(locale, place)}
              </div>
            </div>
          );
        })}
      </div>

      {rest.length > 0 && (
        <ol style={{ listStyle: "none", margin: "16px 0 0", padding: 0, display: "grid", gap: 8 }}>
          {rest.map((s, i) => (
            <li key={s.student_id}>
              <Link
                href={`/farm/${s.student_id}`}
                className="lift"
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto minmax(0, 1fr) auto",
                  alignItems: "center",
                  gap: 12,
                  padding: "8px 12px",
                  borderRadius: 14,
                  border: "2px solid var(--border)",
                  textDecoration: "none",
                  color: "var(--ink)",
                  background: "var(--surface-alt)",
                }}
              >
                <RankBadge rank={i + 4} label={formatNumber(locale, i + 4)} size={32} />
                <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.full_name}
                </span>
                <span className="tabular" style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--brand-deep)" }}>
                  {formatNumber(locale, s.total_points)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * سباق المجموعات على مضمار: لكل مجموعة حارة، ومتسابقها يتقدّم نحو خط النهاية
 * بنسبة نقاطها إلى المتصدّرة. الحارة نفسها رابط يفتح بحث المجموعة.
 */
function RaceTrack({
  locale,
  groups,
  groupPoints,
  studentCounts,
  hueOf,
}: {
  locale: Locale;
  groups: Group[];
  groupPoints: Record<number, number>;
  studentCounts: Record<number, number>;
  hueOf: Map<number, string>;
}) {
  const race = [...groups].sort((a, b) => (groupPoints[b.id] ?? 0) - (groupPoints[a.id] ?? 0));
  const top = Math.max(0, ...race.map((g) => groupPoints[g.id] ?? 0));

  return (
    <div className="pop" style={{ background: "var(--surface)", borderRadius: 24, padding: "16px 16px 12px" }}>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
        {race.map((g, i) => {
          const pts = groupPoints[g.id] ?? 0;
          const hue = hueOf.get(g.id) ?? GROUP_HUES[0];
          const pct = top > 0 ? (pts / top) * 100 : 0;
          const name = locale === "ar" ? g.name_ar : g.name_en;
          const leading = i === 0 && pts > 0;
          return (
            <li key={g.id}>
              <Link
                href={`/?group=${g.id}#student-query`}
                style={{ display: "grid", gap: 4, textDecoration: "none", color: "var(--ink)" }}
              >
                <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17 }}>{name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)" }}>
                    {formatNumber(locale, studentCounts[g.id] ?? 0)} {t(locale, "students")}
                  </span>
                  {leading && (
                    <span
                      className="pop-in"
                      style={{
                        alignSelf: "center",
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "0 8px",
                        borderRadius: 999,
                        background: "var(--sun)",
                        color: "var(--on-fill)",
                        border: "2px solid var(--outline)",
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
                      fontSize: 17,
                      color: "var(--brand-deep)",
                    }}
                  >
                    {formatNumber(locale, pts)}
                  </span>
                </span>
                <span
                  style={{
                    position: "relative",
                    height: 30,
                    borderRadius: 999,
                    border: "2.5px solid var(--outline)",
                    // الحارة: أرضية مضمار وخطّ منقّط في منتصفها
                    background:
                      "repeating-linear-gradient(90deg, transparent 0 10px, color-mix(in oklab, var(--outline) 16%, transparent) 10px 18px) center / 100% 3px no-repeat, var(--surface-alt)",
                    overflow: "hidden",
                  }}
                >
                  {/* الأثر الملوّن خلف المتسابق */}
                  <span
                    style={{
                      position: "absolute",
                      insetBlock: 0,
                      insetInlineStart: 0,
                      width: `${pct}%`,
                      background: `color-mix(in oklab, ${hue} 55%, transparent)`,
                    }}
                  />
                  {/* المتسابق: حرف المجموعة الأول على قرص بلونها */}
                  <span
                    style={{
                      position: "absolute",
                      top: "50%",
                      insetInlineStart: `clamp(0px, calc(${pct}% - 24px), calc(100% - 26px))`,
                      transform: "translateY(-50%)",
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      background: hue,
                      border: "2.5px solid var(--outline)",
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: 13,
                      color: "var(--on-fill)",
                    }}
                  >
                    {name.charAt(0)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
