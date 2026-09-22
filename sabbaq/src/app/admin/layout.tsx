import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { Brand } from "@/components/Brand";
import { LangToggle, ThemeToggle } from "@/components/Toggles";
import { buttonStyle, topbar, topbarInner } from "@/components/ui";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "./AdminNav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data: me } = await supabase
    .from("users")
    .select("role, is_active, full_name_ar, full_name_en")
    .eq("id", user.id)
    .maybeSingle();

  // غير المدير يُحوَّل لواجهته، لا يُعرض له خطأ. الحماية الحقيقية في RLS
  // وفي requireAdmin داخل كل Server Action — هذا للتنقّل فقط.
  if (!me || me.role !== "admin" || !me.is_active) redirect("/supervisor");

  const displayName = locale === "en" && me.full_name_en ? me.full_name_en : me.full_name_ar;

  return (
    <>
      <header style={topbar}>
        <div style={topbarInner}>
          <Brand locale={locale} href="/admin" />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-soft)" }}>{displayName}</span>
          <div style={{ marginInlineStart: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <Link
              href="/supervisor"
              style={{
                font: "inherit",
                fontSize: 14,
                fontWeight: 700,
                padding: "8px 14px",
                borderRadius: 999,
                color: "var(--ink)",
                textDecoration: "none",
              }}
            >
              {t(locale, "supervisorPanel")}
            </Link>
            <LangToggle />
            <ThemeToggle />
            <form action={signOut}>
              <button className="press" type="submit" style={{ ...buttonStyle(), padding: "7px 13px", fontSize: 13 }}>
                {t(locale, "logout")}
              </button>
            </form>
          </div>
        </div>
      </header>

      <div
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          padding: "22px 20px 64px",
          display: "grid",
          gridTemplateColumns: "236px minmax(0, 1fr)",
          gap: 22,
          alignItems: "start",
        }}
        className="admin-grid"
      >
        <AdminNav locale={locale} />
        <main style={{ minWidth: 0 }}>{children}</main>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `@media (max-width: 800px) {
            .admin-grid { grid-template-columns: minmax(0, 1fr) !important; }
          }`,
        }}
      />
    </>
  );
}
