import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import type { Group } from "@/lib/types";
import StudentsManager from "./StudentsManager";

export default async function StudentsPage() {
  const locale = await getLocale();
  const supabase = await createClient();

  const [{ data: groups }, { data: students }] = await Promise.all([
    supabase.from("groups").select("*").order("sort_order"),
    supabase
      .from("students")
      .select("id, full_name, group_id, grade, is_active, next_slot_index")
      .eq("is_active", true)
      .order("full_name")
      .limit(1000),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <h1 style={{ fontSize: 26, margin: 0 }}>{t(locale, "manageStudents")}</h1>
      <StudentsManager
        locale={locale}
        groups={(groups ?? []) as Group[]}
        students={students ?? []}
      />
    </div>
  );
}
