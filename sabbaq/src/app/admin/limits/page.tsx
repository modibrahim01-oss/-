import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import LimitsEditor from "./LimitsEditor";

export default async function LimitsPage() {
  const locale = await getLocale();
  const supabase = await createClient();

  const { data } = await supabase.from("daily_limits").select("role, points_perday, updated_at");

  const limits = {
    group_supervisor:
      (data ?? []).find((r) => r.role === "group_supervisor")?.points_perday ?? 0,
    committee_supervisor:
      (data ?? []).find((r) => r.role === "committee_supervisor")?.points_perday ?? 0,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 26, margin: 0 }}>{t(locale, "dailyLimits")}</h1>
        <p style={{ color: "var(--ink-mute)", fontSize: 13, margin: "4px 0 0" }}>
          {locale === "ar"
            ? "التعديل يسري فورًا على كل المشرفين. من استهلك حدّه الجديد تُعطَّل أزراره في الحال."
            : "Changes apply immediately. Supervisors already past the new limit lose their buttons at once."}
        </p>
      </div>
      <LimitsEditor locale={locale} initial={limits} />
    </div>
  );
}
