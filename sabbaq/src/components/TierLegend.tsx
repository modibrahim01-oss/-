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

  // السنبلة: ثلاث سيقان تنفرج كمروحة، على كلٍّ حبّات متناوبة وسُفا
  const ear = (x: number, y: number, tilt: number, key: string) => (
    <g key={key} transform={`rotate(${tilt} ${x} ${y + 22})`}>
      <path d={`M${x} ${y + 34}V${y + 12}`} stroke="#C9962E" strokeWidth="2.6" strokeLinecap="round" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <ellipse cx={x - 3.2} cy={y + 12 - i * 5} rx="3.2" ry="4.4" fill={i % 2 ? "#E0A52E" : "#F5C542"} stroke={O} strokeWidth="1.6" transform={`rotate(-24 ${x - 3.2} ${y + 12 - i * 5})`} />
          <ellipse cx={x + 3.2} cy={y + 10 - i * 5} rx="3.2" ry="4.4" fill={i % 2 ? "#F5C542" : "#E0A52E"} stroke={O} strokeWidth="1.6" transform={`rotate(24 ${x + 3.2} ${y + 10 - i * 5})`} />
        </g>
      ))}
      <path d={`M${x} ${y - 9}v-8M${x - 3} ${y - 8}l-3-7M${x + 3} ${y - 8}l3-7`} stroke="#B98A22" strokeWidth="1.4" strokeLinecap="round" />
    </g>
  );

  const shapes: Record<Tier, React.ReactNode> = {
    green: (
      <>
        {mound}
        <path d="M22 55c1-6 3-9 6-11M42 55c-1-6-3-9-6-11" stroke="#7BB43A" strokeWidth="3" strokeLinecap="round" fill="none" />
        {ear(20, 24, -16, "l")}
        {ear(44, 24, 16, "r")}
        {ear(32, 18, 0, "c")}
      </>
    ),
    yellow: (
      <>
        {mound}
        <path d="M32 55V24" stroke="#3E8E2A" strokeWidth="3.2" strokeLinecap="round" />
        {/* نبتة خضراء: أوراق عريضة متقابلة تكبر نحو الأسفل */}
        <path d="M32 50c-9 0-16-5-18-13 9-1 16 4 18 13z" fill="#52A832" stroke={O} strokeWidth={W} strokeLinejoin="round" />
        <path d="M32 50c9 0 16-5 18-13-9-1-16 4-18 13z" fill="#52A832" stroke={O} strokeWidth={W} strokeLinejoin="round" />
        <path d="M32 38c-7 0-12-4-13-10 7-1 12 3 13 10z" fill="#7BD44E" stroke={O} strokeWidth={W} strokeLinejoin="round" />
        <path d="M32 38c7 0 12-4 13-10-7-1-12 3-13 10z" fill="#7BD44E" stroke={O} strokeWidth={W} strokeLinejoin="round" />
        <path d="M32 27c-4-2-6-6-5-11 4 2 6 6 5 11zM32 27c4-2 6-6 5-11-4 2-6 6-5 11z" fill="#A8E874" stroke={O} strokeWidth="2" strokeLinejoin="round" />
      </>
    ),
    purple: (
      <>
        {mound}
        <path d="M32 55V28M20 55V34M44 55V32" stroke="#2F8A2A" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M32 47c-6-1-10-5-11-10 6 0 10 4 11 10zM32 43c6-1 10-5 11-10-6 0-10 4-11 10z" fill="#5CC23B" stroke={O} strokeWidth="2" strokeLinejoin="round" />
        {/* زهرة بنفسجية: خمس بتلات حول قلب ذهبي */}
        {[
          [32, 22, 9, "#B96FF0"],
          [20, 30, 7, "#9B4FDC"],
          [44, 28, 7, "#9B4FDC"],
        ].map(([x, y, r, c]) => (
          <g key={`${x}`}>
            {[0, 72, 144, 216, 288].map((a) => (
              <ellipse
                key={a}
                cx={Number(x)}
                cy={Number(y) - Number(r) * 0.62}
                rx={Number(r) * 0.46}
                ry={Number(r) * 0.66}
                fill={String(c)}
                stroke={O}
                strokeWidth="1.8"
                transform={`rotate(${a} ${x} ${y})`}
              />
            ))}
            <circle cx={Number(x)} cy={Number(y)} r={Number(r) * 0.36} fill="#FFC93C" stroke={O} strokeWidth="1.8" />
          </g>
        ))}
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
