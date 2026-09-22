import HomeView, { type Standing } from "@/components/HomeView";
import { createPublicClient } from "@/lib/supabase/public";
import type { Group } from "@/lib/types";

/**
 * الصفحة العامة تُعرض على شاشات تُعيد التحميل باستمرار. التخزين لدقيقة
 * يمنع كل مشاهد من أن يصبح استعلامًا على قاعدة البيانات.
 *
 * ولا تقرأ هذه الصفحة كوكيًا ولا searchParams: أيٌّ منهما يجعلها ديناميكية
 * فيُلغى هذا التخزين بصمت — واللغة ومرشّح المجموعة كلاهما يُقرأ في المتصفح.
 */
export const revalidate = 60;

export default async function HomePage() {
  const supabase = createPublicClient();

  // student_farms يعطي الطلاب النشطين ونقاطهم في الفصل النشط دفعةً واحدة:
  // منه يُحسب عدد طلاب كل مجموعة، ومجموع نقاطها، والمتصدّرون.
  const [{ data: groups }, { data: farms }] = await Promise.all([
    supabase.from("groups").select("*").order("sort_order"),
    supabase
      .from("student_farms")
      .select("student_id, full_name, group_id, group_name_ar, group_name_en, total_points")
      .order("total_points", { ascending: false }),
  ]);

  const rows = (farms ?? []) as Standing[];
  const studentCounts: Record<number, number> = {};
  const groupPoints: Record<number, number> = {};
  for (const row of rows) {
    studentCounts[row.group_id] = (studentCounts[row.group_id] ?? 0) + 1;
    groupPoints[row.group_id] = (groupPoints[row.group_id] ?? 0) + row.total_points;
  }

  return (
    <HomeView
      groups={(groups ?? []) as Group[]}
      studentCounts={studentCounts}
      groupPoints={groupPoints}
      leaders={rows.filter((r) => r.total_points > 0).slice(0, 5)}
    />
  );
}
