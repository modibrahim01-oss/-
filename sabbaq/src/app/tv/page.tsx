import TvCarousel from "@/components/TvCarousel";
import { toPlants } from "@/lib/farm";
import { createPublicClient } from "@/lib/supabase/public";
import type { Plant, StudentFarmSummary } from "@/lib/types";

/**
 * وضع العرض للشاشات الكبيرة. يجلب أفضل الطلاب ومزارعهم دفعة واحدة، ثم
 * يدوّر بينهم في المتصفح — شاشة معلّقة في ممر لا تعيد الاتصال كل ٦ ثوان.
 *
 * ولا يقرأ لغةً من كوكي: الشاشة تُعاد تحميلها بلا توقّف، وجعلها ديناميكية
 * يعني رحلةً كاملة إلى دالة الخادم مع كل إعادة تحميل بلا مقابل.
 */
export const revalidate = 60;

const ROSTER_SIZE = 12;

export default async function TvPage() {
  const supabase = createPublicClient();

  const { data: top } = await supabase
    .from("student_farms")
    .select("*")
    .gt("plant_count", 0)
    .order("total_points", { ascending: false })
    .limit(ROSTER_SIZE);

  const roster = (top ?? []) as StudentFarmSummary[];

  const farms: Record<string, Plant[]> = {};
  if (roster.length > 0) {
    // التصفية بالفصل النشط إلزامية: خانات الحلزون تُعاد للصفر عند بدء فصل
    // جديد، فبدونها ترسم الشاشة نبتات الفصل الماضي فوق نبتات الفصل الحالي
    // على نفس الإحداثيات — وتخالف الأعداد التي يعرضها student_farms.
    const { data: ledger } = await supabase
      .from("points_ledger")
      .select("student_id, slot_index, grid_x, grid_y, tier, points, awarded_at")
      .in(
        "student_id",
        roster.map((r) => r.student_id),
      )
      .eq("semester_id", roster[0].semester_id)
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

  return <TvCarousel roster={roster} farms={farms} />;
}
