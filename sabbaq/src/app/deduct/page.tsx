import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/Brand";
import { LangToggle, ThemeToggle } from "@/components/Toggles";
import { Card, topbar, topbarInner } from "@/components/ui";
import type { Deduction } from "@/lib/actions/deduct";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import type { StudentFarmSummary } from "@/lib/types";
import DeductPanel from "./DeductPanel";

/**
 * صفحة الخصم: للمدير ولمن منحه المدير صلاحية الخصم («الليدر») وحدهم.
 * الصلاحية تُفحص هنا للعرض، وتُفحص فعليًا في deduct_plant (0008).
 */
export default async function DeductPage() {
  const locale = await getLocale();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/deduct");

  const [{ data: me }, permRes] = await Promise.all([
    supabase.from("users").select("role, is_active").eq("id", user.id).maybeSingle(),
    // عمود من 0008: استعلام منفصل فلا يكسر غيابه الصفحة
    supabase.from("users").select("can_deduct").eq("id", user.id).maybeSingle(),
  ]);
  const ready = !permRes.error;
  const allowed =
    Boolean(me?.is_active) && (me?.role === "admin" || Boolean((permRes.data as { can_deduct?: boolean } | null)?.can_deduct));

  let students: StudentFarmSummary[] = [];
  let recent: Deduction[] = [];
  if (ready && allowed) {
    const [{ data: farms }, { data: mine }] = await Promise.all([
      supabase.from("student_farms").select("*").order("full_name").limit(2000),
      supabase.rpc("my_recent_deductions"),
    ]);
    students = (farms ?? []) as StudentFarmSummary[];
    recent = (mine ?? []) as Deduction[];
  }

  return (
    <>
      <header style={topbar}>
        <div style={topbarInner}>
          <Brand locale={locale} href="/supervisor" />
          <div style={{ marginInlineStart: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Link
              href={me?.role === "admin" ? "/admin" : "/supervisor"}
              style={{ fontSize: 14, fontWeight: 700, padding: "8px 14px", color: "var(--ink)", textDecoration: "none" }}
            >
              {t(locale, me?.role === "admin" ? "adminDashboard" : "supervisorPanel")}
            </Link>
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "22px 16px 60px" }}>
        {!ready ? (
          <Card>
            <p style={{ margin: 0, fontWeight: 700, color: "var(--coral)" }}>{t(locale, "needsMigration8")}</p>
          </Card>
        ) : !allowed ? (
          <Card>
            <p style={{ margin: 0, fontWeight: 700 }}>{t(locale, "deductNotAllowed")}</p>
          </Card>
        ) : (
          <DeductPanel locale={locale} students={students} initialRecent={recent} isAdmin={me?.role === "admin"} />
        )}
      </main>
    </>
  );
}
