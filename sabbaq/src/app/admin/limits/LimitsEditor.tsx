"use client";

import { useState, useTransition } from "react";
import { Card, buttonStyle } from "@/components/ui";
import { updateDailyLimit } from "@/lib/actions/admin";
import { formatNumber, roleLabel, t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type LimitRole = "group_supervisor" | "committee_supervisor";

const STEP = 10;

export default function LimitsEditor({
  locale,
  initial,
}: {
  locale: Locale;
  initial: Record<LimitRole, number>;
}) {
  const [values, setValues] = useState(initial);
  const [savedRole, setSavedRole] = useState<LimitRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(role: LimitRole) {
    const fd = new FormData();
    fd.set("role", role);
    fd.set("points", String(values[role]));
    startTransition(async () => {
      const res = await updateDailyLimit(fd);
      if (res.ok) {
        setSavedRole(role);
        setError(null);
      } else {
        setError(res.error);
      }
    });
  }

  function nudge(role: LimitRole, delta: number) {
    setValues((prev) => ({ ...prev, [role]: Math.max(0, prev[role] + delta) }));
    setSavedRole(null);
  }

  return (
    <Card>
      {(["group_supervisor", "committee_supervisor"] as LimitRole[]).map((role, i) => (
        <div
          key={role}
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            padding: "14px 0",
            borderBottom: i === 0 ? "1px dashed var(--border-soft)" : undefined,
          }}
        >
          <div style={{ fontWeight: 600, flex: "1 1 180px" }}>{roleLabel(locale, role)}</div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              border: "2.5px solid var(--outline)",
              borderRadius: 14,
              boxShadow: "var(--pop)",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => nudge(role, -STEP)}
              aria-label="−"
              style={stepBtn}
            >
              −
            </button>
            <input
              type="number"
              min={0}
              value={values[role]}
              onChange={(e) => {
                setValues((prev) => ({ ...prev, [role]: Math.max(0, Number(e.target.value) || 0) }));
                setSavedRole(null);
              }}
              aria-label={roleLabel(locale, role)}
              className="tabular"
              style={{
                font: "inherit",
                border: 0,
                width: 84,
                textAlign: "center",
                padding: "9px 6px",
                background: "var(--surface)",
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                color: "var(--ink)",
                outline: 0,
              }}
            />
            <button type="button" onClick={() => nudge(role, STEP)} aria-label="+" style={stepBtn}>
              +
            </button>
          </div>

          <span style={{ color: "var(--ink-mute)", fontSize: 13 }}>
            {t(locale, "pointsPerDay")}
          </span>

          <button
            type="button"
            onClick={() => save(role)}
            disabled={pending}
            className="press"
            style={{ ...buttonStyle("primary"), padding: "8px 18px", fontSize: 14 }}
          >
            {t(locale, "save")}
          </button>

          {savedRole === role && (
            <span style={{ fontSize: 12, color: "var(--brand-deep)", fontWeight: 600 }}>
              ✓ {t(locale, "saved")}
            </span>
          )}
        </div>
      ))}

      {error && (
        <p role="alert" style={{ color: "var(--coral)", fontSize: 13, marginBottom: 0 }}>
          {error}
        </p>
      )}

      <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: "14px 0 0" }}>
        {locale === "ar"
          ? `المدير بلا حد — كل ما يمنحه يُسجَّل باسمه في السجل. القيم الحالية: ${formatNumber(locale, values.group_supervisor)} و ${formatNumber(locale, values.committee_supervisor)}.`
          : `The admin has no limit — every award is logged under their name. Current values: ${values.group_supervisor} and ${values.committee_supervisor}.`}
      </p>
    </Card>
  );
}

const stepBtn: React.CSSProperties = {
  font: "inherit",
  border: 0,
  background: "var(--sun)",
  padding: "8px 16px",
  cursor: "pointer",
  color: "var(--on-fill)",
  fontSize: 18,
  fontWeight: 700,
};
