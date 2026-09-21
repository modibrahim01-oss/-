import TvCarousel from "@/components/TvCarousel";
import { toPlants } from "@/lib/farm";
import { getLocale } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import type { Plant, StudentFarmSummary } from "@/lib/types";

/**
 * وضع العرض للشاشات الكبيرة. يجلب أفضل الطلاب ومزارعهم دفعة واحدة، ثم
 * يدوّر بينهم في المتصفح — شاشة معلّقة في ممر لا تعيد الاتصال كل ٦ ثوان.
 */
export const revalidate = 60;

const ROSTER_SIZE = 12;

export default async function TvPage() {
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: top } = await supabase
    .from("student_farms")
    .select("*")
    .gt("plant_count", 0)
    .order("total_points", { ascending: false })
    .limit(ROSTER_SIZE);

  const roster = (top ?? []) as StudentFarmSummary[];

  const farms: Record<string, Plant[]> = {};
  if (roster.length > 0) {
    const { data: ledger } = await supabase
      .from("points_ledger")
      .select("student_id, slot_index, grid_x, grid_y, tier, points, awarded_at")
      .in(
        "student_id",
        roster.map((r) => r.student_id),
      )
      .is("revoked_at", null)
      .order("slot_index");

    const byStudent = new Map<string, typeof ledger>();
    for (const row of ledger ?? []) {
      const list = byStudent.get(row.student_id) ?? [];
      list.push(row);
      byStudent.set(row.student_id, list);
    }
    for (const r of roster) {
      farms[r.student_id] = toPlants(byStudent.get(r.student_id) ?? []);
    }
  }

  return <TvCarousel locale={locale} roster={roster} farms={farms} />;
}
