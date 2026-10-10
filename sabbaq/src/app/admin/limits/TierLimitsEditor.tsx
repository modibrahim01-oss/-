"use client";

import { useState, useTransition } from "react";
import { PlantIcon } from "@/components/TierLegend";
import { Card, buttonStyle } from "@/components/ui";
import { updateTierLimits } from "@/lib/actions/admin";
import { formatNumber, roleLabel, t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { TIER_LIST, type Tier } from "@/lib/tiers";

type LimitRole = "group_supervisor" | "committee_supervisor";
const ROLES: LimitRole[] = ["group_supervisor", "committee_supervisor"];

/**
 * حدّ كل نوع في اليوم لكل دور: صفّ لكل دور، وعمود لكل نبتة بموجّه +/−.
 * الحفظ لكل دور على حدة، فتعديل صفّ لا يرسل الآخر.
 */
export default function TierLimitsEditor({
  locale,
  initial,
}: {
  locale: Locale;
  initial: Record<LimitRole, Record<Tier, number>>;
}) {
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState<LimitRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set(role: LimitRole, tier: Tier, n: number) {
    setValues((prev) => ({ ...prev, [role]: { ...prev[role], [tier]: Math.max(0, Math.min(10000, n)) } }));
    setSaved(null);
  }

  function save(role: LimitRole) {
    const fd = new FormData();
    fd.set("role", role);
    for (const spec of TIER_LIST) fd.set(`tier:${spec.tier}`, String(values[role][spec.tier]));
    startTransition(async () => {
      const res = await updateTierLimits(fd);
      if (res.ok) {
        setSaved(role);
        setError(null);
      } else setError(res.error);
    });
  }

  return (
    <Card>
      <p style={{ margin: "0 0 14px", color: "var(--ink-soft)", fontWeight: 500 }}>{t(locale, "tierLimitsHint")}</p>
      <div style={{ display: "grid", gap: 14 }}>
        {ROLES.map((role) => (
          <div
            key={role}
            style={{ display: "grid", gap: 10, padding: "12px 12px 14px", borderRadius: 16, border: "2px solid var(--border)" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 16 }}>{roleLabel(locale, role)}</strong>
              <span style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                {saved === role && (
                  <span style={{ fontSize: 13, color: "var(--brand-deep)", fontWeight: 700 }}>✓ {t(locale, "saved")}</span>
                )}
                <button
                  type="button"
                  className="press"
                  disabled={pending}
                  onClick={() => save(role)}
                  style={{ ...buttonStyle("primary"), padding: "7px 16px", fontSize: 14 }}
                >
                  {t(locale, "save")}
                </button>
              </span>
            </div>
            <div className="tier-limit-grid">
              {TIER_LIST.map((spec) => (
                <div
                  key={spec.tier}
                  style={{
                    display: "grid",
                    justifyItems: "center",
                    gap: 6,
                    padding: "10px 6px",
                    borderRadius: 14,
                    background: `color-mix(in oklab, ${spec.color} 26%, var(--surface))`,
                    border: "2px solid var(--outline)",
                  }}
                >
                  <PlantIcon tier={spec.tier} size={40} />
                  <span style={{ fontWeight: 700, fontSize: 14 }}>
                    {locale === "ar" ? spec.labelAr : spec.labelEn}
                  </span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      border: "2.5px solid var(--outline)",
                      borderRadius: 12,
                      overflow: "hidden",
                      background: "var(--surface)",
                    }}
                  >
                    <button type="button" aria-label="−" onClick={() => set(role, spec.tier, values[role][spec.tier] - 1)} style={stepBtn}>
                      −
                    </button>
                    <input
                      type="number"
                      min={0}
                      value={values[role][spec.tier]}
                      aria-label={`${roleLabel(locale, role)} · ${locale === "ar" ? spec.labelAr : spec.labelEn}`}
                      onChange={(e) => set(role, spec.tier, Number(e.target.value) || 0)}
                      className="tabular"
                      style={{
                        font: "inherit",
                        width: 52,
                        border: 0,
                        textAlign: "center",
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        fontSize: 18,
                        background: "transparent",
                        color: "var(--ink)",
                        outline: 0,
                      }}
                    />
                    <button type="button" aria-label="+" onClick={() => set(role, spec.tier, values[role][spec.tier] + 1)} style={stepBtn}>
                      +
                    </button>
                  </div>
                  <span className="tabular" style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)" }}>
                    = {formatNumber(locale, values[role][spec.tier] * spec.points)} {t(locale, "points")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" style={{ color: "var(--coral)", fontSize: 13, marginBottom: 0 }}>
          {error}
        </p>
      )}
      <style
        dangerouslySetInnerHTML={{
          __html: `.tier-limit-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
            @media (max-width: 640px) { .tier-limit-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }`,
        }}
      />
    </Card>
  );
}

const stepBtn: React.CSSProperties = {
  font: "inherit",
  border: 0,
  background: "var(--sun)",
  padding: "5px 11px",
  cursor: "pointer",
  color: "var(--on-fill)",
  fontSize: 17,
  fontWeight: 700,
};
