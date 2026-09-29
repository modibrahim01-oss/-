"use client";

import { useState, useTransition } from "react";
import { PlantIcon } from "@/components/TierLegend";
import { buttonStyle, field } from "@/components/ui";
import { updateSupervisorTierLimits } from "@/lib/actions/admin";
import { formatNumber, t, type Locale } from "@/lib/i18n";
import { TIER_LIST, type Tier } from "@/lib/tiers";

/**
 * حدّ خاص لمشرف: خانة لكل نبتة. الفارغة تعني «حدّ دوره» ويظهر فيها رقمه
 * باهتًا، فيعرف المدير ما سيسري قبل أن يكتب.
 */
export default function SupervisorLimitsForm({
  locale,
  supervisorId,
  roleLimits,
  overrides,
}: {
  locale: Locale;
  supervisorId: string;
  roleLimits: Record<Tier, number>;
  overrides: Partial<Record<Tier, number>>;
}) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          fd.set("supervisorId", supervisorId);
          const res = await updateSupervisorTierLimits(fd);
          setSaved(res.ok);
          setError(res.ok ? null : res.error);
        })
      }
      style={{ display: "grid", gap: 10 }}
    >
      <span style={{ fontSize: 13, color: "var(--ink-soft)", fontWeight: 500 }}>{t(locale, "customLimitHint")}</span>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {TIER_LIST.map((spec) => (
          <label key={spec.tier} style={{ display: "grid", justifyItems: "center", gap: 4, fontSize: 13, fontWeight: 700 }}>
            <PlantIcon tier={spec.tier} size={30} />
            {locale === "ar" ? spec.labelAr : spec.labelEn}
            <input
              name={`tier:${spec.tier}`}
              type="number"
              min={0}
              defaultValue={overrides[spec.tier] ?? ""}
              placeholder={formatNumber(locale, roleLimits[spec.tier])}
              onChange={() => setSaved(false)}
              className="tabular"
              style={{ ...field, width: 72, textAlign: "center", padding: "6px 8px" }}
            />
          </label>
        ))}
        <span style={{ alignSelf: "end", display: "flex", gap: 8, alignItems: "center" }}>
          <button type="submit" className="press" disabled={pending} style={{ ...buttonStyle("primary"), padding: "7px 14px", fontSize: 13 }}>
            {t(locale, "save")}
          </button>
          {saved && <span style={{ fontSize: 13, fontWeight: 700, color: "var(--brand-deep)" }}>✓ {t(locale, "saved")}</span>}
        </span>
      </div>
      {error && (
        <p role="alert" style={{ margin: 0, color: "var(--coral)", fontSize: 13 }}>
          {error}
        </p>
      )}
    </form>
  );
}
