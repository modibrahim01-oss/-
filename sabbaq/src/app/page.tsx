import HomeView from "@/components/HomeView";
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

  const [{ data: groups }, { data: counts }] = await Promise.all([
    supabase.from("groups").select("*").order("sort_order"),
    supabase.from("students").select("group_id").eq("is_active", true),
  ]);

  const studentCounts: Record<number, number> = {};
  for (const row of counts ?? []) {
    studentCounts[row.group_id] = (studentCounts[row.group_id] ?? 0) + 1;
  }

  return <HomeView groups={(groups ?? []) as Group[]} studentCounts={studentCounts} />;
}
