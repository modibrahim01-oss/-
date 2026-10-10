import type { PostgrestClient } from "@supabase/postgrest-js";
import { toPlants } from "./farm";
import { fetchAll } from "./fetch-all";
import type { Plant, StudentFarmSummary } from "./types";
import { loadWeeklyStars, type WeeklyStar } from "./weekly";

/**
 * بيانات شاشة العرض: الشاشة العامة (`groupIds = null`) وشاشة مجموعة المشرف
 * بالاستعلامات نفسها مُصفّاةً بالمجموعة.
 *
 * لوحة الصدارة خمسون اسمًا من student_farms (أعمدة قليلة، استعلام واحد).
 * شاشة المجموعة تعرض **كل** طلاب المجموعة، ومنهم من لم ينل نقطة بعد: المشرف
 * يعرضها على طلابه، وغياب اسم أحدهم عنها يُفهم أنه نُسي.
 * أما البساتين فلأول اثني عشر وأبطال الأسبوع وحدهم: جلب نبتات خمسين طالبًا
 * يثقل الشاشة بآلاف الصفوف، ومن يُضغط اسمه خارجهم يُجلب بستانه عند الطلب.
 */

export const BOARD_SIZE = 50;
// سقف لشاشة المجموعة يحمي من استعلام بلا حدّ، وهو أكبر من أي مجموعة فعلية
const GROUP_BOARD_CAP = 400;
const ROSTER_SIZE = 12;
const WEEKLY_SIZE = 3;

export type BoardRow = Pick<
  StudentFarmSummary,
  "student_id" | "full_name" | "group_name_ar" | "group_name_en" | "total_points"
>;

export type TvData = {
  roster: StudentFarmSummary[];
  leaderCount: number;
  farms: Record<string, Plant[]>;
  weekly: WeeklyStar[];
  board: BoardRow[];
};

type LedgerRow = {
  student_id: string;
  slot_index: number;
  grid_x: number;
  grid_y: number;
  tier: string;
  points: number;
  awarded_at: string;
};

type Reader = Pick<PostgrestClient, "from">;

export async function loadTvData(supabase: Reader, groupIds: readonly number[] | null): Promise<TvData> {
  let topQuery = supabase
    .from("student_farms")
    .select("*")
    .gt("plant_count", 0)
    .order("total_points", { ascending: false })
    .order("student_id")
    .limit(ROSTER_SIZE);
  let boardQuery = supabase
    .from("student_farms")
    .select("student_id, full_name, group_name_ar, group_name_en, total_points")
    .order("total_points", { ascending: false })
    .order("full_name")
    .order("student_id");
  if (groupIds) {
    topQuery = topQuery.in("group_id", [...groupIds]);
    boardQuery = boardQuery.in("group_id", [...groupIds]).limit(GROUP_BOARD_CAP);
  } else {
    boardQuery = boardQuery.gt("plant_count", 0).limit(BOARD_SIZE);
  }

  const [{ data: top }, { data: boardRows }, weekly] = await Promise.all([
    topQuery,
    boardQuery,
    loadWeeklyStars(supabase, WEEKLY_SIZE, Date.now(), groupIds),
  ]);

  const leaders = (top ?? []) as StudentFarmSummary[];

  // أبطال الأسبوع يدخلون دورة العرض ولو لم يكونوا بين الأوائل: الشاشة كانت
  // تعرض نفس الاثني عشر طوال الفصل، والمتأخّر الذي اجتهد هذا الأسبوع يستحق
  // أن يرى بستانه على الشاشة الكبيرة
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
    // بساتين الدورة كلها معًا تتجاوز ألف نبتة سريعًا، وSupabase يقصّ الرد
    // عند الألف بلا خطأ — فتُرسم بساتين ناقصة على الشاشة. الجلب صفحةً صفحة.
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

    const byStudent = new Map<string, LedgerRow[]>();
    for (const row of ledger) {
      const list = byStudent.get(row.student_id) ?? [];
      list.push(row);
      byStudent.set(row.student_id, list);
    }
    for (const r of roster) {
      farms[r.student_id] = toPlants(byStudent.get(r.student_id) ?? []);
    }
  }

  return { roster, leaderCount: leaders.length, farms, weekly, board: (boardRows ?? []) as BoardRow[] };
}

/**
 * مقطع المسار لشاشة مجموعات: «2» أو «2-3». يُرجع null لأي مقطع غير صالح،
 * والمعرّفات مرتّبة بلا تكرار، فلكل مجموعة من المجموعات رابط واحد يُخزَّن.
 */
export function parseGroupSegment(segment: string): number[] | null {
  if (!/^\d{1,2}(-\d{1,2}){0,6}$/.test(segment)) return null;
  const ids = [...new Set(segment.split("-").map(Number))].sort((a, b) => a - b);
  if (ids.some((n) => n < 1 || n > 99)) return null;
  return ids;
}

export function groupSegment(ids: readonly number[]): string {
  return [...new Set(ids)].sort((a, b) => a - b).join("-");
}
