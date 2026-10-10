import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ground: "var(--ground)",
        "ground-warm": "var(--ground-warm)",
        surface: "var(--surface)",
        "surface-alt": "var(--surface-alt)",
        border: "var(--border)",
        "border-soft": "var(--border-soft)",
        ink: "var(--ink)",
        "ink-soft": "var(--ink-soft)",
        "ink-mute": "var(--ink-mute)",
        brand: "var(--brand)",
        "brand-deep": "var(--brand-deep)",
        "brand-soft": "var(--brand-soft)",
        gold: "var(--gold)",
        "gold-soft": "var(--gold-soft)",
        grape: "var(--grape)",
        "grape-soft": "var(--grape-soft)",
        coral: "var(--coral)",
        "coral-soft": "var(--coral-soft)",
        sky: "var(--sky)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
      borderRadius: { xl2: "20px" },
    },
  },
  plugins: [],
};

export default config;
