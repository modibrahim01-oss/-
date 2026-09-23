import type { PostgrestClient } from "@supabase/postgrest-js";
import { toPlants } from "./farm";
import type { Plant, StudentFarmSummary } from "./types";

export type FarmData = {
  farm: StudentFarmSummary;
  plants: Plant[];
  rank: number;
};

/**
 * ما يحتاجه التحميل من العميل: بناء الاستعلامات وحده. يقبله عميل الخادم
 * (supabase-js) وعميل المتصفح الخفيف (postgrest-js) كلاهما.
 */
export type FarmReader = Pick<PostgrestClient, "from">;

/**
 * كل ما تعرضه صفحة المزرعة، بثلاثة استعلامات على دور anon.
 *
 * مشترك بين الخادم والمتصفح: الخادم يرسم به الصفحة المخزَّنة، والمتصفح
 * يعيد قراءته فور الفتح ليُكمل ما فات التخزينَ. الاستعلام نفسه في المكانين،
 * فلا يمكن أن يعرض أحدهما مزرعة غير التي يعرضها الآخر.
 */
export async function loadFarm(supabase: FarmReader, id: string): Promise<FarmData | null> {
  const { data: summary, error } = await supabase
    .from("student_farms")
    .select("*")
    .eq("student_id", id)
    .maybeSingle();

  if (error) throw error;
  if (!summary) return null;
  const farm = summary as StudentFarmSummary;

  const [ledger, peers] = await Promise.all([
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

  if (ledger.error) throw ledger.error;
  if (peers.error) throw peers.error;

  const rank = (peers.data ?? []).findIndex((p) => p.student_id === id) + 1;
  return { farm, plants: toPlants(ledger.data ?? []), rank };
}

/**
 * هل تختلف قراءتان للمزرعة فيما يُرى؟
 *
 * تُقارَن خانة كل نبتة لا عددها وحده: إعادة ترتيب المزرعة (ترحيل التوزيع
 * على الزوايا) تنقل النبتات نفسها دون أن يتغيّر عددها ولا آخرها، وكانت
 * المقارنة بالعدد تُبقي الطالب على الترتيب القديم. والمجموع والترتيب
 * يتغيّران بمنح زملاء المجموعة أيضًا.
 */
export function farmChanged(a: FarmData, b: FarmData): boolean {
  if (
    a.plants.length !== b.plants.length ||
    a.farm.total_points !== b.farm.total_points ||
    a.rank !== b.rank
  ) {
    return true;
  }
  return a.plants.some((p, i) => {
    const q = b.plants[i];
    return (
      p.slot_index !== q.slot_index ||
      p.grid_x !== q.grid_x ||
      p.grid_y !== q.grid_y ||
      p.tier !== q.tier
    );
  });
}
