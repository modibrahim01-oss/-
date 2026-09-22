"use client";

import Link from "next/link";
import { Brand } from "@/components/Brand";
import FarmScene from "@/components/FarmScene";
import TierLegend from "@/components/TierLegend";
import { LangToggle, ThemeToggle } from "@/components/Toggles";
import { EmptyState, Stat, topbar, topbarInner } from "@/components/ui";
import { countByTier } from "@/lib/farm";
import { formatNumber, t } from "@/lib/i18n";
import type { Plant, StudentFarmSummary } from "@/lib/types";
import { useLocale } from "@/lib/useLocale";

/**
 * واجهة صفحة المزرعة. النبتات والإحصاءات تُحسب على الخادم وتصل جاهزة،
 * واللغة وحدها تُقرأ هنا — فتبقى الصفحة قابلة للتخزين على الحافة.
 */
export default function FarmView({
  farm,
  plants,
  rank,
}: {
  farm: StudentFarmSummary;
  plants: Plant[];
  rank: number;
}) {
  const locale = useLocale();
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
          <div style={{ position: "relative", minHeight: 520, background: "#5cb8e4" }}>
            {plants.length === 0 ? (
              <div style={{ padding: 32, display: "grid", placeItems: "center", height: "100%" }}>
                <EmptyState title={t(locale, "emptyFarm")} hint={t(locale, "emptyFarmHint")} />
              </div>
            ) : (
              <FarmScene plants={plants} />
            )}
            {plants.length > 0 && (
              <div
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
                {t(locale, "dragToPan")}
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
                {farm.grade ? ` · ${farm.grade}` : ""}
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
            @media (max-width: 820px) {
              .farm-grid { grid-template-columns: minmax(0, 1fr) !important; }
              .farm-grid > div:first-child { min-height: 420px; }
              .farm-grid > aside { border-inline-start: 0 !important; border-top: 1px solid var(--border-soft); }
            }
          `,
        }}
      />
    </>
  );
}
