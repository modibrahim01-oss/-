import type { Locale } from "@/lib/i18n";
import { formatNumber, t } from "@/lib/i18n";
import { TIER_LIST } from "@/lib/tiers";
import type { Tier } from "@/lib/tiers";

/**
 * رسم النبتة بأسلوب الهوية: حشو فاقع وحدّ نيليّ غليظ، على كومة تراب.
 *
 * الرسمة نفسها في كل مقاس — من دليل النبتات الصغير إلى واجهة الصفحة
 * الرئيسية — والحدّ يُرسم بعرض ثابت نسبةً إلى إطار ٦٤ فيبقى مقروءًا صغيرًا.
 */
export function PlantIcon({ tier, size = 22 }: { tier: Tier; size?: number }) {
  const O = "var(--outline)";
  const W = 2.6;
  const mound = <ellipse cx="32" cy="56" rx="19" ry="5.5" fill="#E38A3E" stroke={O} strokeWidth={W} />;

  const shapes: Record<Tier, React.ReactNode> = {
    green: (
      <>
        {mound}
        <circle cx="20" cy="41" r="11" fill="#52A832" stroke={O} strokeWidth={W} />
        <circle cx="44" cy="41" r="11" fill="#52A832" stroke={O} strokeWidth={W} />
        <circle cx="32" cy="31" r="14" fill="#7BD44E" stroke={O} strokeWidth={W} />
        <path d="M25 26c2-3 6-4 9-3" stroke="#C8F5A8" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <circle cx="26" cy="37" r="3.2" fill="#FF4436" stroke={O} strokeWidth="1.8" />
        <circle cx="38" cy="33" r="3.2" fill="#FF4436" stroke={O} strokeWidth="1.8" />
        <circle cx="45" cy="44" r="3" fill="#FF4436" stroke={O} strokeWidth="1.8" />
      </>
    ),
    yellow: (
      <>
        {mound}
        <path d="M32 55V26M20 55V32M44 55V30" stroke="#2F8A2A" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M32 46c-6-1-10-5-11-10 6 0 10 4 11 10zM32 42c6-1 10-5 11-10-6 0-10 4-11 10z" fill="#5CC23B" stroke={O} strokeWidth="2" strokeLinejoin="round" />
        {[
          [32, 20, "#FFD23F"],
          [20, 27, "#FFB01F"],
          [44, 25, "#FFB01F"],
        ].map(([x, y, c]) => (
          <path
            key={`${x}`}
            d={`M${Number(x) - 7} ${Number(y) - 3}l3.5 3 3.5-6 3.5 6 3.5-3v6c0 5-3.2 8-7 8s-7-3-7-8z`}
            fill={String(c)}
            stroke={O}
            strokeWidth={W}
            strokeLinejoin="round"
          />
        ))}
      </>
    ),
    purple: (
      <>
        {mound}
        <path d="M27 54c0-7 1-13 2-17h8c1 4 2 10 2 17z" fill="#FFF3DC" stroke={O} strokeWidth={W} strokeLinejoin="round" />
        <path d="M11 38c0-13 9-22 21-22s21 9 21 22c0 2-2 3-4 3H15c-2 0-4-1-4-3z" fill="#BB6EE0" stroke={O} strokeWidth={W} strokeLinejoin="round" />
        <circle cx="23" cy="29" r="3.4" fill="#fff" />
        <circle cx="36" cy="24" r="2.6" fill="#fff" />
        <circle cx="42" cy="33" r="3" fill="#fff" />
        <circle cx="30" cy="35" r="2" fill="#fff" />
        <path d="M46 55c0-3 .5-6 1-8h4c.5 2 1 5 1 8z" fill="#FFF3DC" stroke={O} strokeWidth="2" />
        <path d="M42 48c0-5 4-8 7-8s7 3 7 8z" fill="#9A4FC4" stroke={O} strokeWidth="2" strokeLinejoin="round" />
      </>
    ),
    red: (
      <>
        {mound}
        <path d="M29 55l1-15-6-7 3-2 5 5 5-6 3 2-6 8 1 15z" fill="#8B5A2B" stroke={O} strokeWidth={W} strokeLinejoin="round" />
        <circle cx="32" cy="23" r="16" fill="#4EAE3F" stroke={O} strokeWidth={W} />
        <circle cx="18" cy="31" r="9" fill="#5CC23B" stroke={O} strokeWidth={W} />
        <circle cx="46" cy="31" r="9" fill="#5CC23B" stroke={O} strokeWidth={W} />
        <path d="M24 15c3-3 8-4 12-2" stroke="#B7F09A" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <circle cx="25" cy="25" r="4" fill="#FF4436" stroke={O} strokeWidth="2" />
        <circle cx="39" cy="20" r="4" fill="#FF4436" stroke={O} strokeWidth="2" />
        <circle cx="45" cy="33" r="3.6" fill="#FF6E5A" stroke={O} strokeWidth="2" />
        <circle cx="19" cy="34" r="3.6" fill="#FF6E5A" stroke={O} strokeWidth="2" />
      </>
    ),
  };

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden style={{ overflow: "visible" }}>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <h3 style={{ fontSize: 17, margin: "0 0 2px" }}>{t(locale, "legend")}</h3>
      {TIER_LIST.map((spec) => (
        <div
          key={spec.tier}
          className="pop"
          style={{
            display: "grid",
            gridTemplateColumns: "40px 1fr auto auto",
            gap: 10,
            alignItems: "center",
            padding: "6px 12px 6px 8px",
            background: `color-mix(in oklab, ${spec.color} 30%, var(--surface))`,
            borderRadius: 14,
            fontSize: 14,
          }}
        >
          <PlantIcon tier={spec.tier} size={38} />
          <span style={{ fontWeight: 700 }}>{locale === "ar" ? spec.labelAr : spec.labelEn}</span>
          <span
            className="tabular"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 13,
              padding: "1px 9px",
              borderRadius: 999,
              background: spec.color,
              color: "var(--on-fill)",
              border: "2px solid var(--outline)",
            }}
          >
            +{formatNumber(locale, spec.points)}
          </span>
          {counts && (
            <span
              className="tabular"
              style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, minWidth: 34, textAlign: "end" }}
            >
              ×{formatNumber(locale, counts[spec.tier])}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
