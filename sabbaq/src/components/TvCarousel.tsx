"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/Brand";
import FarmScene from "@/components/FarmScene";
import { formatNumber, t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import type { Plant, StudentFarmSummary } from "@/lib/types";

const SLIDE_MS = 9000;
// إعادة جلب البيانات كل خمس دقائق: الشاشة تبقى معلّقة أسابيع، ولا بد أن
// تلتقط نقاط اليوم الجديدة دون أن يلمسها أحد.
const REFRESH_MS = 5 * 60 * 1000;

export default function TvCarousel({
  locale,
  roster,
  farms,
}: {
  locale: Locale;
  roster: StudentFarmSummary[];
  farms: Record<string, Plant[]>;
}) {
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
          background: "#0a140f",
          color: "#f0e4c2",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div>
          <BrandMark size={64} />
          <h1 style={{ fontSize: 34, marginTop: 20 }}>{t(locale, "emptyFarm")}</h1>
          <p style={{ opacity: 0.7, fontSize: 18 }}>{t(locale, "emptyFarmHint")}</p>
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
        background: "#0a140f",
        color: "#f0e4c2",
        overflow: "hidden",
      }}
    >
      <FarmScene key={current.student_id} plants={plants} cinematic dusk />

      <header
        style={{
          position: "absolute",
          top: 0,
          insetInline: 0,
          padding: "20px 34px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "linear-gradient(180deg, rgba(0,0,0,0.55), transparent)",
          zIndex: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <BrandMark size={42} />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26 }}>
            {t(locale, "appName")}
          </span>
        </div>
        <span
          className="tabular"
          style={{ fontFamily: "var(--font-display)", fontSize: 22, opacity: 0.85 }}
        >
          {clock}
        </span>
      </header>

      <footer
        style={{
          position: "absolute",
          bottom: 0,
          insetInline: 0,
          padding: "26px 34px 32px",
          background: "linear-gradient(0deg, rgba(0,0,0,0.78), transparent)",
          zIndex: 2,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 16,
            flexWrap: "wrap",
            fontFamily: "var(--font-display)",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "clamp(28px, 4vw, 46px)", fontWeight: 700 }}>
            {current.full_name}
          </h1>
          <span style={{ fontSize: "clamp(15px, 1.6vw, 20px)", color: "#e5b54a" }}>
            {groupName}
          </span>
        </div>
        <div style={{ display: "flex", gap: 34, marginTop: 12, flexWrap: "wrap" }}>
          <TvMetric
            n={formatNumber(locale, current.total_points)}
            label={t(locale, "totalPoints")}
          />
          <TvMetric n={formatNumber(locale, current.plant_count)} label={t(locale, "plants")} />
          <TvMetric n={`#${formatNumber(locale, index + 1)}`} label={t(locale, "topStudents")} />
        </div>
      </footer>

      <div
        style={{
          position: "absolute",
          bottom: 0,
          insetInline: 0,
          height: 3,
          background: "rgba(255,255,255,0.15)",
          zIndex: 3,
        }}
      >
        <div
          key={index}
          style={{
            height: "100%",
            background: "#e5b54a",
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
          fontSize: 12,
          opacity: 0.72,
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
