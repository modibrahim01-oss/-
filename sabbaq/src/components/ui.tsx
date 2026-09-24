import type { CSSProperties, ReactNode } from "react";

/**
 * لبنات الواجهة المشتركة. كل صفحات الإدارة تُبنى منها، فتغيير الهوية هنا
 * يصل إلى كل جدول وزرّ وبطاقة دفعة واحدة.
 *
 * القاعدة اللونية: الحشو الفاقع نصّه `--on-fill` الداكن دائمًا، والنصّ على
 * السطح الأبيض بألوان النصّ الداكنة (`--brand-deep` وأخواتها). انظر globals.css.
 */

export const page: CSSProperties = {
  maxWidth: 1240,
  margin: "0 auto",
  paddingInline: 20,
  paddingBlock: "28px 72px",
};

/** شريط قوس قزح أعلى كل صفحة: توقيع الهوية بألوان الفئات والسماء. */
export const RAINBOW =
  "linear-gradient(90deg, var(--lime) 0 17%, var(--sun) 17% 34%, var(--tangerine) 34% 51%, var(--berry) 51% 68%, var(--grape-fill) 68% 84%, var(--sky) 84% 100%)";

export const topbar: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 50,
  backgroundColor: "color-mix(in oklab, var(--surface) 92%, transparent)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  backgroundImage: RAINBOW,
  backgroundSize: "100% 5px",
  backgroundRepeat: "no-repeat",
  borderBottom: "2.5px solid var(--outline)",
};

export const topbarInner: CSSProperties = {
  maxWidth: 1240,
  margin: "0 auto",
  padding: "15px 20px 11px",
  display: "flex",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
};

/** حقل إدخال موحّد. بلا `outline: 0` عمدًا: حلقة التركيز للوحة المفاتيح تبقى. */
export const field: CSSProperties = {
  font: "inherit",
  padding: "10px 13px",
  borderRadius: 12,
  border: "2px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  minWidth: 0,
};

export function Card({
  children,
  style,
  as: Tag = "div",
}: {
  children: ReactNode;
  style?: CSSProperties;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag
      className="pop"
      style={{
        background: "var(--surface)",
        borderRadius: 20,
        padding: 20,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2
      style={{
        fontSize: 18,
        color: "var(--ink)",
        margin: "0 0 12px",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 10,
          height: 10,
          borderRadius: 3,
          background: "var(--sun)",
          border: "2px solid var(--outline)",
          transform: "rotate(45deg)",
        }}
      />
      {children}
    </h2>
  );
}

const STAT_FILL = {
  brand: "var(--brand-soft)",
  gold: "var(--gold-soft)",
  coral: "var(--coral-soft)",
  sky: "color-mix(in oklab, var(--sky) 20%, var(--surface))",
} as const;

export function Stat({
  label,
  value,
  accent = "sky",
}: {
  label: string;
  value: string;
  accent?: keyof typeof STAT_FILL;
}) {
  return (
    <div
      className="pop"
      style={{
        padding: "12px 14px 10px",
        background: STAT_FILL[accent],
        borderRadius: 16,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)" }}>{label}</div>
      <div
        className="tabular"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 28,
          fontWeight: 700,
          lineHeight: 1.15,
          color: "var(--ink)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

type ButtonTone = "primary" | "default" | "danger";

/**
 * زرّ بحافة غليظة وظلّ صلب. يُمرَّر معه `className="press"` ليغوص عند الضغط —
 * الأنماط السطرية لا تملك :active.
 */
export function buttonStyle(tone: ButtonTone = "default"): CSSProperties {
  const base: CSSProperties = {
    font: "inherit",
    fontWeight: 700,
    padding: "10px 18px",
    borderRadius: 14,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    border: "2.5px solid var(--outline)",
    boxShadow: "var(--pop)",
    background: "var(--surface)",
    color: "var(--ink)",
  };
  if (tone === "primary") return { ...base, background: "var(--lime)", color: "var(--on-fill)" };
  // الحذف يتكرّر في كل صفّ من الجداول: حشو مرجانيّ فاقع فيها يطغى على البيانات
  // نفسها، فالخطر هنا لونُ النصّ والحدّ لا مساحةٌ صارخة
  if (tone === "danger") return { ...base, background: "var(--coral-soft)", color: "var(--coral)" };
  return base;
}

const BADGE_FILL = {
  brand: "var(--lime)",
  gold: "var(--sun)",
  grape: "var(--grape-fill)",
  coral: "var(--coral-fill)",
  sky: "var(--sky)",
} as const;

export function Badge({
  children,
  tone = "brand",
}: {
  children: ReactNode;
  tone?: keyof typeof BADGE_FILL;
}) {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        padding: "2px 10px",
        borderRadius: 999,
        background: BADGE_FILL[tone],
        color: "var(--on-fill)",
        border: "2px solid var(--outline)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function Th({ children }: { children: ReactNode }) {
  return (
    <th
      style={{
        padding: "10px 12px",
        textAlign: "start",
        background: "var(--gold-soft)",
        borderBottom: "2.5px solid var(--outline)",
        fontSize: 12,
        color: "var(--ink)",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  muted,
  strong,
}: {
  children: ReactNode;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <td
      className="tabular"
      style={{
        padding: "10px 12px",
        borderBottom: "1.5px solid var(--border-soft)",
        color: muted ? "var(--ink-mute)" : undefined,
        fontWeight: strong ? 700 : undefined,
        fontFamily: strong ? "var(--font-display)" : undefined,
      }}
    >
      {children}
    </td>
  );
}

/** برعم صغير: حالة فارغة تَعِدُ بنموّ لا رسالة خطأ. */
function Sprout() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden className="bob">
      <ellipse cx="32" cy="55" rx="18" ry="5" fill="var(--tangerine)" stroke="var(--outline)" strokeWidth="2.5" />
      <path d="M32 54V32" stroke="var(--outline)" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M32 36C32 24 22 18 12 20c1 10 9 16 20 16z"
        fill="var(--lime)"
        stroke="var(--outline)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M32 32c0-10 8-16 18-15-1 9-8 15-18 15z"
        fill="var(--mint)"
        stroke="var(--outline)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div
      style={{
        padding: "28px 24px 32px",
        textAlign: "center",
        color: "var(--ink-mute)",
        border: "2.5px dashed var(--border)",
        borderRadius: 20,
        background: "var(--surface)",
      }}
    >
      <Sprout />
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 19,
          fontWeight: 700,
          color: "var(--ink)",
          marginTop: 6,
        }}
      >
        {title}
      </div>
      {hint && <div style={{ fontSize: 14, marginTop: 6 }}>{hint}</div>}
    </div>
  );
}
