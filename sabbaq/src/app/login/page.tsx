import Link from "next/link";
import { Brand, BrandMark } from "@/components/Brand";
import HeroSky from "@/components/HeroSky";
import { PlantIcon } from "@/components/TierLegend";
import { LangToggle, ThemeToggle } from "@/components/Toggles";
import { buttonStyle, topbar, topbarInner } from "@/components/ui";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { TIER_LIST } from "@/lib/tiers";
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

      <main className="login-wrap">
        {/* لوحة ترحيب ملوّنة: الدخول للمشرفين، لكنه باب المزرعة نفسها */}
        <section
          aria-hidden
          className="pop login-art"
          style={{
            position: "relative",
            borderRadius: 30,
            overflow: "hidden",
            background: "linear-gradient(180deg, #7fdcff 0%, #c6f1ff 62%, var(--lime) 62%)",
            minHeight: 360,
          }}
        >
          <HeroSky />
          <div style={{ position: "absolute", top: "14%", insetInline: 0, display: "grid", justifyItems: "center", gap: 10 }}>
            <BrandMark size={84} />
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 44,
                color: "var(--on-fill)",
                textShadow: "0 3px 0 #fff, 3px 0 0 #fff, -3px 0 0 #fff",
              }}
            >
              {t(locale, "appName")}
            </span>
          </div>
          <div
            style={{
              position: "absolute",
              bottom: "8%",
              insetInline: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-end",
              gap: "4%",
            }}
          >
            {TIER_LIST.map((spec, i) => (
              <span key={spec.tier} className="bob" style={{ animationDelay: `${i * 0.3}s` }}>
                <PlantIcon tier={spec.tier} size={64 + i * 10} />
              </span>
            ))}
          </div>
        </section>

        <section className="pop" style={{ background: "var(--surface)", borderRadius: 30, padding: "30px 26px 26px" }}>
          <h1 style={{ fontSize: 30, margin: "0 0 6px" }}>{t(locale, "loginTitle")}</h1>
          <p style={{ color: "var(--ink-soft)", fontSize: 15, margin: "0 0 24px" }}>{t(locale, "loginHint")}</p>

          <LoginForm locale={locale} next={next} />

          <Link
            href="/"
            className="press"
            style={{ ...buttonStyle(), marginTop: 18, fontSize: 14, padding: "7px 14px", textDecoration: "none" }}
          >
            {locale === "ar" ? "→" : "←"} {t(locale, "findYourFarm")}
          </Link>
        </section>
      </main>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .login-wrap { max-width: 980px; margin: 0 auto; padding: 6vh 20px 64px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: stretch; }
            @media (max-width: 760px) {
              .login-wrap { grid-template-columns: minmax(0, 1fr); padding-top: 24px; }
              .login-art { min-height: 220px !important; }
            }
          `,
        }}
      />
    </>
  );
}
