"use client";

import { useState, useTransition } from "react";
import { PlantIcon } from "@/components/TierLegend";
import { Badge, Card, SectionLabel, buttonStyle, field } from "@/components/ui";
import { cancelGrant, sendGrant } from "@/lib/actions/committee";
import { formatNumber, t, type Locale } from "@/lib/i18n";
import { TIER_LIST, type Tier } from "@/lib/tiers";
import type { CommitteeGrant, GrantRecipient } from "@/lib/types";

const EMPTY: Record<Tier, number> = { green: 0, yellow: 0, purple: 0, red: 0 };

/**
 * لوحة مشرف اللجنة القيمية: يرسل لمشرف مجموعة رصيدًا من النبتات مع عنوان
 * المحتوى، ويتابع ما أرسل: مقفل أو مفتوح، وكم وُزِّع، ويسحب ما بقي متى شاء.
 */
export default function CommitteeSender({
  locale,
  recipients,
  sent,
}: {
  locale: Locale;
  recipients: GrantRecipient[];
  sent: CommitteeGrant[];
}) {
  const [counts, setCounts] = useState(EMPTY);
  const [note, setNote] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const total = TIER_LIST.reduce((n, s) => n + counts[s.tier], 0);

  function bump(tier: Tier, d: number) {
    setCounts((prev) => ({ ...prev, [tier]: Math.max(0, Math.min(50, prev[tier] + d)) }));
  }

  return (
    <main style={{ maxWidth: 1240, margin: "0 auto", padding: "0 20px 64px", display: "grid", gap: 18 }}>
      <Card style={{ background: "color-mix(in oklab, var(--grape-fill) 12%, var(--surface))" }}>
        <SectionLabel>{t(locale, "sendCommittee")}</SectionLabel>
        <p style={{ margin: "-4px 0 14px", color: "var(--ink-soft)", fontWeight: 500 }}>{t(locale, "sendCommitteeHint")}</p>
        <form
          key={formKey}
          action={(fd) =>
            startTransition(async () => {
              for (const spec of TIER_LIST) fd.set(`tier:${spec.tier}`, String(counts[spec.tier]));
              const res = await sendGrant(fd);
              if (res.ok) {
                setCounts(EMPTY);
                setFormKey((k) => k + 1);
                setNote({ tone: "ok", text: t(locale, "grantSent") });
              } else setNote({ tone: "err", text: t(locale, "grantFailed") });
            })
          }
          style={{ display: "grid", gap: 12 }}
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 240px", display: "grid", gap: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{t(locale, "recipient")}</span>
              <select name="recipient" required defaultValue="" style={{ ...field, width: "100%" }}>
                <option value="" disabled>
                  {t(locale, "pickRecipient")}
                </option>
                {recipients.map((r) => (
                  <option key={r.id} value={r.id}>
                    {(locale === "en" && r.full_name_en) || r.full_name_ar}
                    {(locale === "en" ? r.groups_en : r.groups_ar) ? ` — ${locale === "en" ? r.groups_en : r.groups_ar}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ flex: "2 1 280px", display: "grid", gap: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{t(locale, "contentTitle")}</span>
              <input name="title" required minLength={2} maxLength={120} style={{ ...field, width: "100%" }} />
            </label>
          </div>
          <label style={{ display: "grid", gap: 5 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{t(locale, "noteOptional")}</span>
            <input name="note" maxLength={500} style={{ ...field, width: "100%" }} />
          </label>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {TIER_LIST.map((spec) => (
              <div
                key={spec.tier}
                style={{
                  display: "grid",
                  justifyItems: "center",
                  gap: 6,
                  padding: "8px 10px",
                  borderRadius: 14,
                  border: "2px solid var(--outline)",
                  background: `color-mix(in oklab, ${spec.color} 28%, var(--surface))`,
                  minWidth: 120,
                }}
              >
                <PlantIcon tier={spec.tier} size={36} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>
                  {locale === "ar" ? spec.labelAr : spec.labelEn} · +{formatNumber(locale, spec.points)}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button type="button" aria-label="−" onClick={() => bump(spec.tier, -1)} style={stepBtn}>
                    −
                  </button>
                  <strong className="tabular" style={{ fontFamily: "var(--font-display)", fontSize: 20, minWidth: 26, textAlign: "center" }}>
                    {formatNumber(locale, counts[spec.tier])}
                  </strong>
                  <button type="button" aria-label="+" onClick={() => bump(spec.tier, 1)} style={stepBtn}>
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button
              type="submit"
              className="press"
              disabled={pending || total === 0 || recipients.length === 0}
              style={{ ...buttonStyle("primary"), background: "var(--grape-fill)" }}
            >
              {t(locale, "send")}
            </button>
            {note && (
              <span role="status" style={{ fontWeight: 700, color: note.tone === "ok" ? "var(--brand-deep)" : "var(--coral)" }}>
                {note.text}
              </span>
            )}
          </div>
        </form>
      </Card>

      {sent.length > 0 && (
        <Card>
          <SectionLabel>{t(locale, "sentGrants")}</SectionLabel>
          <div style={{ display: "grid", gap: 10 }}>
            {sent.map((g) => (
              <div
                key={g.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: "2px solid var(--border)",
                  opacity: g.status === "cancelled" ? 0.6 : 1,
                }}
              >
                <strong>{g.title}</strong>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-soft)" }}>
                  {t(locale, "grantTo")} {(locale === "en" && g.recipient_en) || g.recipient_ar}
                </span>
                <Badge tone={g.status === "locked" ? "grape" : g.status === "active" ? "brand" : "coral"}>
                  {t(locale, g.status === "locked" ? "grantLocked" : g.status === "active" ? "grantActive" : "grantCancelled")}
                </Badge>
                <span style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {g.items.map((it) => (
                    <span key={it.tier} className="tabular" style={{ display: "flex", alignItems: "center", gap: 3, fontWeight: 700, fontSize: 14 }}>
                      <PlantIcon tier={it.tier} size={24} /> {formatNumber(locale, it.used)}/{formatNumber(locale, it.quantity)}
                    </span>
                  ))}
                </span>
                {g.status !== "cancelled" && (
                  <button
                    type="button"
                    className="press"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm(t(locale, "withdrawConfirm"))) return;
                      startTransition(async () => {
                        const res = await cancelGrant(g.id);
                        if (!res.ok) setNote({ tone: "err", text: t(locale, "grantFailed") });
                      });
                    }}
                    style={{ ...buttonStyle("danger"), padding: "5px 10px", fontSize: 12, marginInlineStart: "auto" }}
                  >
                    {t(locale, "withdrawRest")}
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </main>
  );
}

const stepBtn: React.CSSProperties = {
  font: "inherit",
  width: 30,
  height: 30,
  borderRadius: 10,
  border: "2px solid var(--outline)",
  background: "var(--sun)",
  color: "var(--on-fill)",
  fontWeight: 700,
  fontSize: 16,
  cursor: "pointer",
};
