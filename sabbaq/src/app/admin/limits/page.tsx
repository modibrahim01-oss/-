import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import { isTier, type Tier } from "@/lib/tiers";
import LimitsEditor from "./LimitsEditor";
import TierLimitsEditor from "./TierLimitsEditor";

export default async function LimitsPage() {
  const locale = await getLocale();
  const supabase = await createClient();

  // بعد 0007 الحد بعدد النبتات؛ غياب الجدول يعني أن الترحيل لم يُشغَّل بعد،
  // فيبقى محرّر النقاط القديم ظاهرًا مع تنبيه
  const tierRes = await supabase.from("tier_limits").select("role, tier, per_day");
  if (!tierRes.error) {
    const byRole = {
      group_supervisor: { green: 0, yellow: 0, purple: 0, red: 0 },
      committee_supervisor: { green: 0, yellow: 0, purple: 0, red: 0 },
    } as Record<"group_supervisor" | "committee_supervisor", Record<Tier, number>>;
    for (const r of tierRes.data ?? []) {
      const role = r.role as string;
      if ((role === "group_supervisor" || role === "committee_supervisor") && isTier(r.tier)) {
        byRole[role][r.tier] = r.per_day as number;
      }
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>{t(locale, "tierLimitsTitle")}</h1>
        <TierLimitsEditor locale={locale} initial={byRole} />
      </div>
    );
  }

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
        <p role="note" style={{ color: "var(--coral)", fontWeight: 700, fontSize: 13, margin: "4px 0 0" }}>
          {t(locale, "needsMigration")}
        </p>
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
