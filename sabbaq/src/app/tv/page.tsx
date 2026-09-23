import TvCarousel from "@/components/TvCarousel";
import { toPlants } from "@/lib/farm";
import { fetchAll } from "@/lib/fetch-all";
import { createPublicClient } from "@/lib/supabase/public";
import type { Plant, StudentFarmSummary } from "@/lib/types";
import { loadWeeklyStars } from "@/lib/weekly";

/**
 * وضع العرض للشاشات الكبيرة. يجلب أفضل الطلاب ومزارعهم دفعة واحدة، ثم
 * يدوّر بينهم في المتصفح — شاشة معلّقة في ممر لا تعيد الاتصال كل ٦ ثوان.
 *
 * ولا يقرأ لغةً من كوكي: الشاشة تُعاد تحميلها بلا توقّف، وجعلها ديناميكية
 * يعني رحلةً كاملة إلى دالة الخادم مع كل إعادة تحميل بلا مقابل.
 */
export const revalidate = 60;

const ROSTER_SIZE = 12;

type LedgerRow = {
  student_id: string;
  slot_index: number;
  grid_x: number;
  grid_y: number;
  tier: string;
  points: number;
  awarded_at: string;
};
const WEEKLY_SIZE = 3;

export default async function TvPage() {
  const supabase = createPublicClient();

  const [{ data: top }, weekly] = await Promise.all([
    supabase
      .from("student_farms")
      .select("*")
      .gt("plant_count", 0)
      .order("total_points", { ascending: false })
      .limit(ROSTER_SIZE),
    loadWeeklyStars(supabase, WEEKLY_SIZE),
  ]);

  const leaders = (top ?? []) as StudentFarmSummary[];

  // أبطال الأسبوع يدخلون دورة العرض ولو لم يكونوا بين الأوائل: الشاشة كانت
  // تعرض نفس الاثني عشر طوال الفصل، والمتأخّر الذي اجتهد هذا الأسبوع يستحق
  // أن يرى مزرعته على الشاشة الكبيرة
  const inTop = new Set(leaders.map((r) => r.student_id));
  const extraIds = weekly.map((w) => w.student_id).filter((id) => !inTop.has(id));
  let extras: StudentFarmSummary[] = [];
  if (extraIds.length > 0) {
    const { data } = await supabase.from("student_farms").select("*").in("student_id", extraIds);
    extras = (data ?? []) as StudentFarmSummary[];
  }
  const roster = [...leaders, ...extras];

  const farms: Record<string, Plant[]> = {};
  if (roster.length > 0) {
    // التصفية بالفصل النشط إلزامية: خانات البساتين تُعاد للصفر عند بدء فصل
    // جديد، فبدونها ترسم الشاشة نبتات الفصل الماضي فوق نبتات الفصل الحالي
    // على نفس الإحداثيات — وتخالف الأعداد التي يعرضها student_farms.
    // مزارع الدورة كلها معًا تتجاوز ألف نبتة سريعًا، وSupabase يقصّ الرد
    // عند الألف بلا خطأ — فتُرسم مزارع ناقصة على الشاشة. الجلب صفحةً صفحة.
    const ledger = await fetchAll<LedgerRow>((from, to) =>
      supabase
        .from("points_ledger")
        .select("student_id, slot_index, grid_x, grid_y, tier, points, awarded_at")
        .in(
          "student_id",
          roster.map((r) => r.student_id),
        )
        .eq("semester_id", roster[0].semester_id)
        .is("revoked_at", null)
        .order("student_id")
        .order("slot_index")
        .range(from, to),
    ).catch(() => [] as LedgerRow[]);

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

  return <TvCarousel roster={roster} leaderCount={leaders.length} farms={farms} weekly={weekly} />;
}
