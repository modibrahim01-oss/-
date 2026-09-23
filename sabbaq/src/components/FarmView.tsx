"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Brand } from "@/components/Brand";
import FarmScene from "@/components/FarmScene";
import RankBadge from "@/components/RankBadge";
import TierLegend from "@/components/TierLegend";
import { LangToggle, ThemeToggle } from "@/components/Toggles";
import { EmptyState, Stat, buttonStyle, topbar, topbarInner } from "@/components/ui";
import { countByTier } from "@/lib/farm";
import { type FarmData, farmChanged, loadFarm } from "@/lib/farm-data";
import { MilestoneCelebration, MilestonesCard, useMilestoneCelebration } from "@/components/Milestones";
import { createRestClient } from "@/lib/supabase/rest";
import { formatNumber, localizeDigits, t } from "@/lib/i18n";
import { TIER_LIST } from "@/lib/tiers";
import { useLocale } from "@/lib/useLocale";

/**
 * واجهة صفحة المزرعة. النبتات والإحصاءات تصل من الخادم جاهزة فتُرسم فورًا،
 * ثم تُعاد قراءتها من المتصفح لتلحق بما فات النسخةَ المخزَّنة.
 */
export default function FarmView({ id, initial }: { id: string; initial: FarmData }) {
  const locale = useLocale();
  const [data, setData] = useState(initial);
  const { farm, plants, rank } = data;
  // عدد النبتات التي لحقت بها القراءة من المتصفح — يُحتفل بها لحظةً ثم تختفي
  const [grown, setGrown] = useState(0);
  const shown = useRef(initial.plants.length);

  useEffect(() => {
    let cancelled = false;
    const supabase = createRestClient();

    async function refresh() {
      try {
        const next = await loadFarm(supabase, id);
        // نستبدل فقط إن تغيّر ما يُرى: مصفوفة نبتات جديدة بنفس المحتوى
        // تجعل المشهد يعيد المقارنة بلا داعٍ
        if (!cancelled && next) setData((prev) => (farmChanged(prev, next) ? next : prev));
        if (!cancelled && next && next.plants.length > shown.current) {
          setGrown(next.plants.length - shown.current);
          shown.current = next.plants.length;
        }
      } catch {
        // تعذّر الاتصال: النسخة المعروضة صحيحة حتى لحظة تخزينها، فلا نستبدلها
        // برسالة خطأ — الطالب يرى مزرعته ولو متأخرة دقائق
      }
    }

    // عند الفتح، وكلما عاد الطالب إلى التبويب بعد أن تركه مفتوحًا
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [id]);

  useEffect(() => {
    if (grown === 0) return;
    const timer = setTimeout(() => setGrown(0), 4200);
    return () => clearTimeout(timer);
  }, [grown]);

  const counts = countByTier(plants);
  const typesCollected = TIER_LIST.filter((s) => counts[s.tier] > 0).length;
  const { celebrating, dismiss } = useMilestoneCelebration(id, farm.total_points, typesCollected);
  const groupName = locale === "ar" ? farm.group_name_ar : farm.group_name_en;

  return (
    <>
      <header style={topbar}>
        <div style={topbarInner}>
          <Brand locale={locale} />
          <div style={{ marginInlineStart: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <Link
              href="/"
              className="press"
              style={{ ...buttonStyle(), padding: "6px 14px", fontSize: 14, textDecoration: "none" }}
            >
              {locale === "ar" ? "→" : "←"} {t(locale, "backToSearch")}
            </Link>
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "24px 20px 64px" }}>
        {/* شريط الاسم: صاحب المزرعة ونقاطه وترتيبه قبل أي شيء */}
        <section
          className="pop farm-banner"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            padding: "16px 20px",
            borderRadius: 26,
            marginBottom: 18,
            background:
              "linear-gradient(100deg, color-mix(in oklab, var(--sun) 42%, var(--surface)) 0%, var(--surface) 55%, color-mix(in oklab, var(--sky) 30%, var(--surface)) 100%)",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              display: "grid",
              placeItems: "center",
              background: "var(--lime)",
              border: "3px solid var(--outline)",
              boxShadow: "var(--pop)",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 30,
              color: "var(--on-fill)",
              transform: "rotate(-5deg)",
              flexShrink: 0,
            }}
          >
            {farm.full_name.trim().charAt(0)}
          </span>
          <div style={{ minWidth: 0, flex: "1 1 220px" }}>
            <h1 style={{ margin: 0, fontSize: "clamp(26px, 4vw, 38px)", lineHeight: 1.15 }}>{farm.full_name}</h1>
            <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              <Chip fill="var(--sky)">{groupName}</Chip>
              {farm.grade && <Chip fill="var(--grape-fill)">{localizeDigits(locale, farm.grade)}</Chip>}
            </div>
          </div>
          {rank > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <RankBadge rank={rank} label={formatNumber(locale, rank)} size={58} />
              <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink-soft)", maxWidth: 90, lineHeight: 1.25 }}>
                {t(locale, "rankInGroup")}
              </span>
            </div>
          )}
          <div
            className="tabular"
            style={{
              padding: "8px 18px",
              borderRadius: 20,
              background: "var(--sun)",
              border: "3px solid var(--outline)",
              boxShadow: "var(--pop)",
              color: "var(--on-fill)",
              textAlign: "center",
              lineHeight: 1.1,
            }}
          >
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 34 }}>
              {formatNumber(locale, farm.total_points)}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{t(locale, "totalPoints")}</div>
          </div>
        </section>

        <div className="farm-grid">
          {/* لون السماء نفسه الذي يرسمه المشهد، فلا يومض إطار بلون آخر قبل أول رسم */}
          <div
            className="pop farm-stage"
            style={{ position: "relative", background: "var(--scene-sky)", borderRadius: 26, overflow: "hidden" }}
          >
            {plants.length === 0 ? (
              <div style={{ padding: 32, display: "grid", placeItems: "center", height: "100%" }}>
                <EmptyState title={t(locale, "emptyFarm")} hint={t(locale, "emptyFarmHint")} />
              </div>
            ) : (
              <FarmScene plants={plants} />
            )}
            {plants.length > 0 && (
              <div
                className="farm-hint"
                style={{
                  position: "absolute",
                  bottom: 14,
                  insetInlineStart: 14,
                  background: "var(--surface)",
                  padding: "6px 12px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--ink)",
                  border: "2.5px solid var(--outline)",
                  boxShadow: "0 3px 0 var(--outline)",
                }}
              >
                <span className="hint-mouse">{t(locale, "dragToPan")}</span>
                <span className="hint-touch">{t(locale, "dragToPanTouch")}</span>
              </div>
            )}
            {celebrating && <MilestoneCelebration locale={locale} milestone={celebrating} onDone={dismiss} />}
            {grown > 0 && (
              <div
                role="status"
                className="pop-in"
                style={{
                  position: "absolute",
                  top: 14,
                  insetInlineEnd: 64,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: "var(--lime)",
                  color: "var(--on-fill)",
                  border: "2.5px solid var(--outline)",
                  boxShadow: "var(--pop)",
                  fontWeight: 700,
                }}
              >
                <span
                  className="tabular"
                  style={{
                    fontFamily: "var(--font-display)",
                    background: "#fff",
                    borderRadius: 999,
                    padding: "0 8px",
                    border: "2px solid var(--outline)",
                  }}
                >
                  +{formatNumber(locale, grown)}
                </span>
                {t(locale, "newPlants")}
              </div>
            )}
          </div>

          <aside className="pop" style={{ padding: 18, borderRadius: 26, background: "var(--surface)", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Stat label={t(locale, "plants")} value={formatNumber(locale, farm.plant_count)} accent="brand" />
              {/* الترتيب في شريط الاسم أعلاه؛ هنا هدف صغير بدلًا منه: جمع الأنواع الأربعة */}
              <Stat
                label={t(locale, "typesCollected")}
                value={`${formatNumber(locale, typesCollected)}/${formatNumber(locale, TIER_LIST.length)}`}
                accent="gold"
              />
            </div>
            <TierLegend locale={locale} counts={counts} />
            <MilestonesCard locale={locale} totalPoints={farm.total_points} typesCollected={typesCollected} />
          </aside>
        </div>
      </main>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .farm-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 18px; align-items: start; }
            .farm-stage { min-height: 540px; }
            .hint-touch { display: none; }
            @media (hover: none) and (pointer: coarse) {
              .hint-mouse { display: none; }
              .hint-touch { display: inline; }
            }
            @media (max-width: 480px) { .hide-narrow { display: none; } }
            @media (max-width: 820px) {
              .farm-grid { grid-template-columns: minmax(0, 1fr) !important; }
              /* المزرعة معيّنٌ عرضه ضعف ارتفاعه، والعرض هو ما يحدّ حجمها على
                 الجوّال: إطار طوليّ كان يضيف سماءً فارغة لا أكثر */
              .farm-stage { min-height: 0; aspect-ratio: 6 / 5; }
              /* على الشاشة الضيّقة يغطّي التلميح طرف السور، والإيماءات هناك
                 مألوفة بلا شرح */
              .farm-hint { display: none; }
              .farm-banner > div:last-child { margin-inline-start: auto; }
            }
          `,
        }}
      />
    </>
  );
}

/** رقاقة ملوّنة بحدّ غليظ: المجموعة والصف في شريط الاسم. */
function Chip({ fill, children }: { fill: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 14,
        fontWeight: 700,
        padding: "2px 12px",
        borderRadius: 999,
        background: fill,
        color: "var(--on-fill)",
        border: "2.5px solid var(--outline)",
      }}
    >
      {children}
    </span>
  );
}
