import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import type { Group, UserRole } from "@/lib/types";
import SupervisorsManager from "./SupervisorsManager";

export default async function SupervisorsPage() {
  const locale = await getLocale();
  const supabase = await createClient();

  const [{ data: groups }, { data: staff }, { data: assignments }] = await Promise.all([
    supabase.from("groups").select("*").order("sort_order"),
    supabase
      .from("users")
      .select("id, full_name_ar, full_name_en, role, is_active")
      .order("full_name_ar"),
    supabase.from("supervisor_groups").select("supervisor_id, group_id"),
  ]);

  const groupsBySupervisor = new Map<string, number[]>();
  for (const a of assignments ?? []) {
    const list = groupsBySupervisor.get(a.supervisor_id) ?? [];
    list.push(a.group_id);
    groupsBySupervisor.set(a.supervisor_id, list);
  }

  const rows = (staff ?? []).map((u) => ({
    id: u.id as string,
    nameAr: u.full_name_ar as string,
    nameEn: u.full_name_en as string | null,
    role: u.role as UserRole,
    isActive: u.is_active as boolean,
    groupIds: groupsBySupervisor.get(u.id as string) ?? [],
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <h1 style={{ fontSize: 26, margin: 0 }}>{t(locale, "manageSupervisors")}</h1>
      <SupervisorsManager locale={locale} groups={(groups ?? []) as Group[]} staff={rows} />
    </div>
  );
}
