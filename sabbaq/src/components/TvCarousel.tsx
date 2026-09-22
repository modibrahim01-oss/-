"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/Brand";
import FarmScene from "@/components/FarmScene";
import RankBadge from "@/components/RankBadge";
import { formatNumber, t } from "@/lib/i18n";
import type { Plant, StudentFarmSummary } from "@/lib/types";
import { useLocale } from "@/lib/useLocale";

const SLIDE_MS = 9000;
// إعادة جلب البيانات كل خمس دقائق: الشاشة تبقى معلّقة أسابيع، ولا بد أن
// تلتقط نقاط اليوم الجديدة دون أن يلمسها أحد.
const REFRESH_MS = 5 * 60 * 1000;
// لوحة الصدارة على الشاشة: ثمانية أسماء تُقرأ من آخر الممرّ، لا اثنا عشر
const BOARD_SIZE = 8;

/**
 * بطاقة زجاجية فاتحة فوق المزرعة.
 *
 * الشاشة كانت بالوضع الليلي وأشرطة سوداء متدرّجة — عكس ما يطلبه برنامج
 * تحفيزي فيه فرح. البطاقات الفاتحة تُبقي النصّ مقروءًا فوق السماء والعشب معًا
 * دون أن تُظلم المشهد.
 */
const glass: React.CSSProperties = {
  background: "color-mix(in oklab, var(--surface) 86%, transparent)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  border: "1px solid color-mix(in oklab, var(--border) 70%, transparent)",
  borderRadius: 22,
  boxShadow: "0 10px 30px rgba(20, 60, 90, 0.18)",
  color: "var(--ink)",
};

export default function TvCarousel({
  roster,
  farms,
}: {
  roster: StudentFarmSummary[];
  farms: Record<string, Plant[]>;
}) {
  const locale = useLocale();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [clock, setClock] = useState("");

  useEffect(() => {
    if (roster.length === 0) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % roster.length), SLIDE_MS);
    return () => clearInterval(timer);
  }, [roster.length]);

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(
        now.toLocaleTimeString(locale === "ar" ? "ar-SA-u-nu-arab" : "en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    };
    tick();
    const timer = setInterval(tick, 10000);
    return () => clearInterval(timer);
  }, [locale]);

  if (roster.length === 0) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(180deg, var(--sky) 0%, var(--ground) 100%)",
          color: "var(--ink)",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div>
          <BrandMark size={64} />
          <h1 style={{ fontSize: 34, marginTop: 20 }}>{t(locale, "emptyFarm")}</h1>
          <p style={{ color: "var(--ink-soft)", fontSize: 18 }}>{t(locale, "emptyFarmHint")}</p>
        </div>
      </div>
    );
  }

  const current = roster[index];
  const plants = farms[current.student_id] ?? [];
  const groupName = locale === "ar" ? current.group_name_ar : current.group_name_en;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--sky)",
        color: "var(--ink)",
        overflow: "hidden",
      }}
    >
      <FarmScene key={current.student_id} plants={plants} cinematic />

      <header
        style={{
          position: "absolute",
          top: 20,
          insetInline: 28,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 2,
        }}
      >
        <div style={{ ...glass, display: "flex", alignItems: "center", gap: 12, padding: "10px 18px 10px 12px" }}>
          <BrandMark size={42} />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26 }}>
            {t(locale, "appName")}
          </span>
        </div>
        <span
          className="tabular"
          style={{ ...glass, fontFamily: "var(--font-display)", fontSize: 22, padding: "10px 18px" }}
        >
          {clock}
        </span>
      </header>

      <aside
        style={{
          ...glass,
          position: "absolute",
          top: 104,
          insetInlineEnd: 28,
          width: "min(300px, 28vw)",
          padding: "16px 14px 10px",
          zIndex: 2,
        }}
      >
        <h2 style={{ margin: "0 6px 10px", fontSize: 20 }}>{t(locale, "leaders")}</h2>
        <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {roster.slice(0, BOARD_SIZE).map((s, i) => {
            const active = i === index;
            return (
              <li
                key={s.student_id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto minmax(0, 1fr) auto",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 8px",
                  borderRadius: 12,
                  // الطالب المعروض الآن يُضاء في اللوحة، فيربط المشاهد بين
                  // المزرعة واسم صاحبها وترتيبه
                  background: active ? "color-mix(in oklab, var(--gold) 26%, transparent)" : "transparent",
                  transition: "background 400ms ease",
                }}
              >
                <RankBadge rank={i + 1} label={formatNumber(locale, i + 1)} size={28} />
                <span
                  style={{
                    fontWeight: active ? 700 : 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.full_name}
                </span>
                <span
                  className="tabular"
                  style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--brand-deep)" }}
                >
                  {formatNumber(locale, s.total_points)}
                </span>
              </li>
            );
          })}
        </ol>
      </aside>

      <footer
        style={{
          ...glass,
          position: "absolute",
          bottom: 28,
          insetInlineStart: 28,
          maxWidth: "min(760px, 60vw)",
          padding: "18px 24px 20px",
          display: "flex",
          alignItems: "center",
          gap: 20,
          zIndex: 2,
        }}
      >
        <RankBadge rank={index + 1} label={formatNumber(locale, index + 1)} size={64} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 14,
              flexWrap: "wrap",
              fontFamily: "var(--font-display)",
            }}
          >
            <h1 style={{ margin: 0, fontSize: "clamp(28px, 3.6vw, 46px)", fontWeight: 700 }}>
              {current.full_name}
            </h1>
            <span style={{ fontSize: "clamp(15px, 1.6vw, 20px)", color: "var(--brand-deep)", fontWeight: 700 }}>
              {groupName}
            </span>
          </div>
          <div style={{ display: "flex", gap: 30, marginTop: 10, flexWrap: "wrap" }}>
            <TvMetric
              n={formatNumber(locale, current.total_points)}
              label={t(locale, "totalPoints")}
            />
            <TvMetric n={formatNumber(locale, current.plant_count)} label={t(locale, "plants")} />
          </div>
        </div>
      </footer>

      <div
        style={{
          position: "absolute",
          bottom: 0,
          insetInline: 0,
          height: 5,
          background: "color-mix(in oklab, var(--surface) 55%, transparent)",
          zIndex: 3,
        }}
      >
        <div
          key={index}
          style={{
            height: "100%",
            background: "var(--gold)",
            animation: `tvSlide ${SLIDE_MS}ms linear forwards`,
          }}
        />
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes tvSlide { from { width: 0 } to { width: 100% } }
          `,
        }}
      />
    </div>
  );
}

function TvMetric({ n, label }: { n: string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span
        className="tabular"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(22px, 2.6vw, 32px)",
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {n}
      </span>
      <span
        style={{
          fontSize: 13,
          color: "var(--ink-soft)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginTop: 5,
        }}
      >
        {label}
      </span>
    </div>
  );
}
