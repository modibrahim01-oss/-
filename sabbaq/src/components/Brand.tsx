import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        background: "linear-gradient(145deg, var(--lime) 0%, var(--mint) 100%)",
        border: `${Math.max(2, size * 0.07)}px solid var(--outline)`,
        boxShadow: `0 ${Math.max(2, size * 0.09)}px 0 var(--outline)`,
        display: "grid",
        placeItems: "center",
        color: "var(--on-fill)",
        flexShrink: 0,
        transform: "rotate(-6deg)",
      }}
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C7 2 3 6 3 11c0 4 2.5 7.4 6 8.5V22h6v-2.5c3.5-1.1 6-4.5 6-8.5 0-5-4-9-9-9zm0 2c3.9 0 7 3.1 7 7 0 3.2-2.1 5.9-5 6.8v-3.3c1.2-.5 2-1.6 2-2.9v-2h-2v2c0 .6-.4 1-1 1s-1-.4-1-1V9H10v2c0 1.3.8 2.4 2 2.9v3.3c-2.9-.9-5-3.6-5-6.8 0-3.9 3.1-7 7-7z" />
      </svg>
    </span>
  );
}

export function Brand({ locale, href = "/" }: { locale: Locale; href?: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        textDecoration: "none",
        color: "var(--ink)",
      }}
    >
      <BrandMark />
      <span>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 25 }}>
          {t(locale, "appName")}
        </span>
        <span
          style={{
            color: "var(--ink-soft)",
            fontSize: 12,
            fontWeight: 700,
            marginInlineStart: 6,
          }}
        >
          {t(locale, "appTagline")}
        </span>
      </span>
    </Link>
  );
}
