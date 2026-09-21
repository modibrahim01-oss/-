import type { CSSProperties, ReactNode } from "react";

export const page: CSSProperties = {
  maxWidth: 1240,
  margin: "0 auto",
  paddingInline: 20,
  paddingBlock: "28px 72px",
};

export const topbar: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 50,
  background: "var(--ground)",
  borderBottom: "1px solid var(--border-soft)",
};

export const topbarInner: CSSProperties = {
  maxWidth: 1240,
  margin: "0 auto",
  padding: "12px 20px",
  display: "flex",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
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
      style={{
        background: "var(--surface-alt)",
        border: "1px solid var(--border-soft)",
        borderRadius: 14,
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
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "var(--ink-mute)",
        fontWeight: 600,
        margin: "0 0 12px",
        fontFamily: "var(--font-body)",
      }}
    >
      {children}
    </h2>
  );
}

export function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "brand" | "gold" | "coral";
}) {
  const color =
    accent === "gold" ? "var(--gold)" : accent === "coral" ? "var(--coral)" : "var(--brand-deep)";
  return (
    <div
      style={{
        padding: 14,
        background: "var(--surface)",
        borderRadius: 10,
        border: "1px solid var(--border-soft)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--ink-mute)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
      <div
        className="tabular"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 24,
          fontWeight: 700,
          marginTop: 2,
          color,
        }}
      >
        {value}
      </div>
    </div>
  );
}

type ButtonTone = "primary" | "default" | "danger";

export function buttonStyle(tone: ButtonTone = "default"): CSSProperties {
  const base: CSSProperties = {
    font: "inherit",
    fontWeight: 600,
    padding: "10px 16px",
    borderRadius: 10,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--ink)",
  };
  if (tone === "primary") {
    return { ...base, background: "var(--brand)", borderColor: "var(--brand)", color: "#fbf7ec" };
  }
  if (tone === "danger") {
    return { ...base, borderColor: "var(--coral)", color: "var(--coral)" };
  }
  return base;
}

export function Badge({
  children,
  tone = "brand",
}: {
  children: ReactNode;
  tone?: "brand" | "gold" | "grape" | "coral";
}) {
  const map = {
    brand: ["var(--brand-soft)", "var(--brand-deep)"],
    gold: ["var(--gold-soft)", "var(--gold)"],
    grape: ["var(--grape-soft)", "var(--grape)"],
    coral: ["var(--coral-soft)", "var(--coral)"],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 9px",
        borderRadius: 999,
        background: bg,
        color: fg,
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
        padding: "9px 12px",
        textAlign: "start",
        borderBottom: "1px solid var(--border-soft)",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: "var(--ink-mute)",
        fontWeight: 600,
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
        padding: "9px 12px",
        borderBottom: "1px solid var(--border-soft)",
        color: muted ? "var(--ink-mute)" : undefined,
        fontWeight: strong ? 700 : undefined,
        fontFamily: strong ? "var(--font-display)" : undefined,
      }}
    >
      {children}
    </td>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div
      style={{
        padding: "40px 24px",
        textAlign: "center",
        color: "var(--ink-mute)",
        border: "1px dashed var(--border)",
        borderRadius: 14,
      }}
    >
      <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--ink-soft)" }}>
        {title}
      </div>
      {hint && <div style={{ fontSize: 13, marginTop: 6 }}>{hint}</div>}
    </div>
  );
}
