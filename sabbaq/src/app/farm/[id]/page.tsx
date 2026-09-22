import { notFound } from "next/navigation";
import FarmView from "@/components/FarmView";
import { toPlants } from "@/lib/farm";
import { createPublicClient } from "@/lib/supabase/public";
import type { StudentFarmSummary } from "@/lib/types";

/**
 * المزارع تُعرض على شاشات تُحدَّث تلقائيًا. ٣٠ ثانية تعطي إحساسًا فوريًا
 * دون أن يصل كل مشاهد إلى قاعدة البيانات.
 *
 * لا تُقرأ اللغة هنا: قراءة الكوكي تُسقِط هذا التخزين وتجعل كل فتح لمزرعة
 * رحلةً إلى دالة الخادم — وهي أكثر صفحة يفتحها الطلاب.
 */
export const revalidate = 30;

/**
 * لا مزرعة تُبنى وقت البناء — قائمة الطلاب تتغيّر ولا تُعرف حينها. وجود
 * الدالة فارغةً هو ما يجعل Next يعامل المسار كصفحة ساكنة تُولَّد عند أول
 * طلب ثم تُخزَّن، بدل أن يُعيد رسمها لكل زائر.
 */
export function generateStaticParams() {
  return [];
}

export default async function FarmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createPublicClient();

  const { data: summary } = await supabase
    .from("student_farms")
    .select("*")
    .eq("student_id", id)
    .maybeSingle();

  if (!summary) notFound();
  const farm = summary as StudentFarmSummary;

  const [{ data: ledger }, { data: groupPeers }] = await Promise.all([
    supabase
      .from("points_ledger")
      .select("slot_index, grid_x, grid_y, tier, points, awarded_at")
      .eq("student_id", id)
      .eq("semester_id", farm.semester_id)
      .is("revoked_at", null)
      .order("slot_index"),
    supabase
      .from("student_farms")
      .select("student_id, total_points")
      .eq("group_id", farm.group_id)
      .order("total_points", { ascending: false }),
  ]);

  const rank = (groupPeers ?? []).findIndex((p) => p.student_id === id) + 1;

  return <FarmView farm={farm} plants={toPlants(ledger ?? [])} rank={rank} />;
}
