import type { PostgrestClient } from "@supabase/postgrest-js";
import { fetchAll } from "./fetch-all";

/**
 * أبطال الأسبوع: الأكثر جمعًا للنقاط في آخر سبعة أيام.
 *
 * لوحة الصدارة الكلية يتصدّرها نفس الأسماء طوال الفصل، فمن تأخّر يرى أنه لن
 * يلحق فيفقد حماسه. سباق الأسبوع يبدأ من الصفر لكل الطلاب كل أسبوع، فالمتأخّر
 * يستطيع أن يكون نجم هذا الأسبوع.
 *
 * يُحسب من points_ledger مباشرة (قراءته متاحة للعامّة كما في صفحة المزرعة)
 * فلا يحتاج دالة أو عرضًا في قاعدة البيانات.
 */

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type WeeklyStar = {
  student_id: string;
  full_name: string;
  group_id: number;
  group_name_ar: string;
  group_name_en: string;
  week_points: number;
  total_points: number;
};

type LedgerRow = { student_id: string; points: number };

/**
 * يجمع نقاط كل طالب ويرتّبهم تنازليًا. التعادل يُحسم بمعرّف الطالب لا بترتيب
 * وصول الصفوف: القائمة نفسها في كل رسم، فلا يتبادل المتعادلان مكانيهما
 * بين إعادة تحميل وأخرى.
 */
export function rankWeekly(rows: readonly LedgerRow[], limit: number): { student_id: string; week_points: number }[] {
  const sums = new Map<string, number>();
  for (const r of rows) sums.set(r.student_id, (sums.get(r.student_id) ?? 0) + r.points);
  return [...sums]
    .filter(([, p]) => p > 0)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, limit)
    .map(([student_id, week_points]) => ({ student_id, week_points }));
}

/**
 * أبطال الأسبوع في الفصل النشط. يعيد قائمة فارغة عند أي خطأ: قسمٌ مكمّل في
 * الصفحة الرئيسية وشاشة العرض لا يستحق أن يُسقط أيًّا منهما.
 */
export async function loadWeeklyStars(
  supabase: Pick<PostgrestClient, "from">,
  limit: number,
  now: number = Date.now(),
): Promise<WeeklyStar[]> {
  try {
    const { data: semester } = await supabase.from("semesters").select("id").eq("is_active", true).maybeSingle();
    if (!semester) return [];

    const since = new Date(now - WEEK_MS).toISOString();
    const rows = await fetchAll<LedgerRow>((from, to) =>
      supabase
        .from("points_ledger")
        .select("student_id, points")
        .eq("semester_id", semester.id)
        .is("revoked_at", null)
        .gte("awarded_at", since)
        .order("id")
        .range(from, to),
    );

    const top = rankWeekly(rows, limit);
    if (top.length === 0) return [];

    const { data: farms } = await supabase
      .from("student_farms")
      .select("student_id, full_name, group_id, group_name_ar, group_name_en, total_points")
      .in(
        "student_id",
        top.map((t) => t.student_id),
      );

    const byId = new Map((farms ?? []).map((f) => [f.student_id as string, f]));
    // طالب عُطّل هذا الأسبوع يغيب عن student_farms فيسقط من القائمة
    return top.flatMap((t) => {
      const f = byId.get(t.student_id);
      return f ? [{ ...(f as Omit<WeeklyStar, "week_points">), week_points: t.week_points }] : [];
    });
  } catch {
    return [];
  }
}
