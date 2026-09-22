import Link from "next/link";
import { Brand } from "@/components/Brand";
import { LangToggle, ThemeToggle } from "@/components/Toggles";
import { topbar, topbarInner } from "@/components/ui";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const locale = await getLocale();
  const { next } = await searchParams;

  return (
    <>
      <header style={topbar}>
        <div style={topbarInner}>
          <Brand locale={locale} />
          <div style={{ marginInlineStart: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main
        style={{
          maxWidth: 420,
          margin: "0 auto",
          padding: "8vh 20px 64px",
        }}
      >
        <h1 style={{ fontSize: 26, margin: "0 0 6px" }}>{t(locale, "loginTitle")}</h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 14, margin: "0 0 26px" }}>
          {t(locale, "loginHint")}
        </p>

        <LoginForm locale={locale} next={next} />

        <Link
          href="/"
          style={{
            display: "inline-block",
            marginTop: 20,
            fontSize: 13,
            color: "var(--ink-mute)",
            textDecoration: "none",
          }}
        >
          ← {t(locale, "findYourFarm")}
        </Link>
      </main>
    </>
  );
}
