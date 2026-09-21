import type { Locale } from "@/lib/i18n";
import { formatNumber, t } from "@/lib/i18n";
import { TIER_LIST } from "@/lib/tiers";
import type { Tier } from "@/lib/tiers";

/** أيقونة صغيرة تعكس شكل النبتة المجسّمة في المزرعة. */
export function PlantIcon({ tier, size = 22 }: { tier: Tier; size?: number }) {
  const shapes: Record<Tier, React.ReactNode> = {
    green: (
      <>
        <circle cx="8" cy="14" r="5" fill="#4A9E28" />
        <circle cx="16" cy="14" r="5.5" fill="#66C13B" />
        <circle cx="12" cy="9" r="4.5" fill="#66C13B" />
        <circle cx="12" cy="7" r="1.4" fill="#E23B2F" />
      </>
    ),
    yellow: (
      <>
        <path d="M11.2 22h1.6V12h-1.6z" fill="#3B8A28" />
        <path d="M6 22h1.4v-7H6zM16.6 22H18v-8h-1.4z" fill="#3B8A28" />
        <path d="M12 3l3.4 6.2H8.6z" fill="#FFA218" />
        <path d="M6.7 8l2.6 5H4.1z" fill="#FFC833" />
        <path d="M17.3 7l2.6 6h-5.2z" fill="#FFC833" />
      </>
    ),
    purple: (
      <>
        <path d="M10 13h4v9h-4z" fill="#F5EAD1" />
        <path d="M3.5 13a8.5 8.5 0 0 1 17 0z" fill="#A65EBB" />
        <circle cx="9" cy="10" r="1.3" fill="#fff" />
        <circle cx="14.5" cy="9" r="1.1" fill="#fff" />
        <circle cx="12" cy="6.5" r="0.9" fill="#fff" />
      </>
    ),
    red: (
      <>
        <path d="M10.8 22h2.4v-8h-2.4z" fill="#7A4A22" />
        <circle cx="12" cy="8" r="6" fill="#2E7D2B" />
        <circle cx="7" cy="10" r="4" fill="#4EAE3F" />
        <circle cx="17" cy="10" r="4" fill="#4EAE3F" />
        <circle cx="8" cy="8" r="1.5" fill="#E73B2F" />
        <circle cx="15.5" cy="11" r="1.5" fill="#FF6E5A" />
        <circle cx="12.5" cy="5.5" r="1.4" fill="#E73B2F" />
      </>
    ),
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {shapes[tier]}
    </svg>
  );
}

export default function TierLegend({
  locale,
  counts,
}: {
  locale: Locale;
  counts?: Record<Tier, number>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <h3
        style={{
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--ink-mute)",
          fontWeight: 600,
          margin: "0 0 2px",
          fontFamily: "var(--font-body)",
        }}
      >
        {t(locale, "legend")}
      </h3>
      {TIER_LIST.map((spec) => (
        <div
          key={spec.tier}
          style={{
            display: "grid",
            gridTemplateColumns: "26px 1fr auto auto",
            gap: 10,
            alignItems: "center",
            padding: "8px 10px",
            background: "var(--surface)",
            borderRadius: 8,
            border: "1px solid var(--border-soft)",
            fontSize: 13,
          }}
        >
          <PlantIcon tier={spec.tier} />
          <span style={{ fontWeight: 500 }}>
            {locale === "ar" ? spec.labelAr : spec.labelEn}
          </span>
          <span
            className="tabular"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              color: "var(--brand-deep)",
            }}
          >
            {formatNumber(locale, spec.points)}
          </span>
          {counts && (
            <span className="tabular" style={{ fontSize: 11, color: "var(--ink-mute)" }}>
              ×{formatNumber(locale, counts[spec.tier])}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
