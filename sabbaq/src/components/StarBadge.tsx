/**
 * نجمة أبطال الأسبوع: SVG لا رمز تعبيري — شاشات المدرسة لا يُضمن فيها خطّ
 * الرموز (انظر RankBadge). الأولى ذهبية كبيرة، ومن بعدها بلون الشمس.
 */
export default function StarBadge({ label, size = 40, gold = false }: { label?: string; size?: number; gold?: boolean }) {
  return (
    <span style={{ position: "relative", width: size, height: size, display: "inline-grid", placeItems: "center", flexShrink: 0 }}>
      <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden style={{ position: "absolute", inset: 0 }}>
        <path
          d="M24 3.5l6.1 12.9 14.1 1.8-10.4 9.7 2.7 14-12.5-6.9-12.5 6.9 2.7-14L3.8 18.2l14.1-1.8z"
          fill={gold ? "#ffc21a" : "var(--sun)"}
          stroke="var(--outline)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M17 17.5l3-.4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
      </svg>
      {label && (
        <span
          className="tabular"
          style={{
            position: "relative",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: size * 0.34,
            color: "var(--on-fill)",
            marginTop: size * 0.06,
          }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
