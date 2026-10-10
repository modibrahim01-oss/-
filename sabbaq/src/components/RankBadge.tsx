/**
 * شارة الترتيب: ذهبية وفضية وبرونزية للثلاثة الأوائل، هادئة لمن بعدهم.
 *
 * ألوان لا رموز تعبيرية: شاشات المدرسة تعمل بمتصفّحات لا يُضمن فيها خطّ
 * الرموز، فيظهر 🥇 مربّعًا فارغًا في أكثر مكان يُرى فيه.
 */
const MEDALS = [
  { fill: "linear-gradient(145deg, #ffe07a, #e0aa33)", ring: "#c48d1f" },
  { fill: "linear-gradient(145deg, #f1f4f7, #b3bec8)", ring: "#8f9ba6" },
  { fill: "linear-gradient(145deg, #f3c08e, #c98a4b)", ring: "#a86d33" },
];

export default function RankBadge({ rank, label, size = 34 }: { rank: number; label: string; size?: number }) {
  const medal = MEDALS[rank - 1];
  return (
    <span
      className="tabular"
      aria-label={`#${rank}`}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: size * 0.46,
        // النصّ داكن ثابت على الأوسمة الثلاثة: كلها فاتحة في الوضعين
        color: medal ? "#2a2412" : "var(--ink-soft)",
        background: medal ? medal.fill : "var(--surface-alt)",
        border: `2px solid ${medal ? medal.ring : "var(--border)"}`,
        boxShadow: medal ? "inset 0 -2px 0 rgba(0,0,0,0.12)" : "none",
      }}
    >
      {label}
    </span>
  );
}
