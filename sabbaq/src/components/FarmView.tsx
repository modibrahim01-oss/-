"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Brand } from "@/components/Brand";
import FarmScene from "@/components/FarmScene";
import TierLegend from "@/components/TierLegend";
import { LangToggle, ThemeToggle } from "@/components/Toggles";
import { EmptyState, Stat, topbar, topbarInner } from "@/components/ui";
import { countByTier } from "@/lib/farm";
import { type FarmData, farmChanged, loadFarm } from "@/lib/farm-data";
import { createRestClient } from "@/lib/supabase/rest";
import { formatNumber, localizeDigits, t } from "@/lib/i18n";
import { useLocale } from "@/lib/useLocale";

/**
 * واجهة صفحة المزرعة. النبتات والإحصاءات تصل من الخادم جاهزة فتُرسم فورًا،
 * ثم تُعاد قراءتها من المتصفح لتلحق بما فات النسخةَ المخزَّنة.
 */
export default function FarmView({ id, initial }: { id: string; initial: FarmData }) {
  const locale = useLocale();
  const [data, setData] = useState(initial);
  const { farm, plants, rank } = data;

  useEffect(() => {
    let cancelled = false;
    const supabase = createRestClient();

    async function refresh() {
      try {
        const next = await loadFarm(supabase, id);
        // نستبدل فقط إن تغيّر ما يُرى: مصفوفة نبتات جديدة بنفس المحتوى
        // تجعل المشهد يعيد المقارنة بلا داعٍ
        if (!cancelled && next) setData((prev) => (farmChanged(prev, next) ? next : prev));
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

  const counts = countByTier(plants);
  const groupName = locale === "ar" ? farm.group_name_ar : farm.group_name_en;

  return (
    <>
      <header style={topbar}>
        <div style={topbarInner}>
          <Brand locale={locale} />
          <div style={{ marginInlineStart: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <Link
              href="/"
              style={{
                font: "inherit",
                fontSize: 13,
                fontWeight: 500,
                padding: "8px 14px",
                borderRadius: 999,
                color: "var(--ink-soft)",
                textDecoration: "none",
              }}
            >
              {t(locale, "backToSearch")}
            </Link>
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "24px 20px 64px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 300px",
            gap: 0,
            border: "1px solid var(--border)",
            borderRadius: 20,
            overflow: "hidden",
            background: "var(--surface)",
            boxShadow: "var(--shadow)",
          }}
          className="farm-grid"
        >
          {/* لون السماء نفسه الذي يرسمه المشهد، فلا يومض إطار بلون آخر قبل أول رسم */}
          <div className="farm-stage" style={{ position: "relative", background: "var(--sky)" }}>
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
                  bottom: 12,
                  insetInlineStart: 12,
                  background: "color-mix(in oklab, var(--surface) 90%, transparent)",
                  backdropFilter: "blur(6px)",
                  padding: "8px 12px",
                  borderRadius: 10,
                  fontSize: 12,
                  color: "var(--ink-soft)",
                  border: "1px solid var(--border-soft)",
                }}
              >
                <span className="hint-mouse">{t(locale, "dragToPan")}</span>
                <span className="hint-touch">{t(locale, "dragToPanTouch")}</span>
              </div>
            )}
          </div>

          <aside
            style={{
              padding: 22,
              borderInlineStart: "1px solid var(--border-soft)",
              background: "var(--surface-alt)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ paddingBottom: 14, borderBottom: "1px solid var(--border-soft)" }}>
              <h1 style={{ margin: "0 0 4px", fontSize: 21 }}>{farm.full_name}</h1>
              <div style={{ color: "var(--ink-mute)", fontSize: 13 }}>
                {groupName}
                {farm.grade ? ` · ${localizeDigits(locale, farm.grade)}` : ""}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Stat
                label={t(locale, "totalPoints")}
                value={formatNumber(locale, farm.total_points)}
              />
              <Stat label={t(locale, "plants")} value={formatNumber(locale, farm.plant_count)} />
            </div>

            {rank > 0 && (
              <Stat
                label={t(locale, "rankInGroup")}
                value={`#${formatNumber(locale, rank)}`}
                accent="gold"
              />
            )}

            <TierLegend locale={locale} counts={counts} />
          </aside>
        </div>
      </main>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .farm-stage { min-height: 520px; }
            .hint-touch { display: none; }
            @media (hover: none) and (pointer: coarse) {
              .hint-mouse { display: none; }
              .hint-touch { display: inline; }
            }
            @media (max-width: 820px) {
              .farm-grid { grid-template-columns: minmax(0, 1fr) !important; }
              /* المزرعة معيّنٌ عرضه ضعف ارتفاعه، والعرض هو ما يحدّ حجمها على
                 الجوّال: إطار طوليّ كان يضيف سماءً فارغة لا أكثر */
              .farm-stage { min-height: 0; aspect-ratio: 6 / 5; }
              /* على الشاشة الضيّقة يغطّي التلميح طرف السور، والإيماءات هناك
                 مألوفة بلا شرح */
              .farm-hint { display: none; }
              .farm-grid > aside { border-inline-start: 0 !important; border-top: 1px solid var(--border-soft); }
            }
          `,
        }}
      />
    </>
  );
}
