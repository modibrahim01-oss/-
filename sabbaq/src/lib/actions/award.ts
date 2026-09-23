"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TIERS } from "@/lib/tiers";
import { createClient } from "@/lib/supabase/server";
import type { AwardResult, DailyStatus } from "@/lib/types";

const awardInput = z.object({
  studentId: z.string().uuid(),
  tier: z.enum(TIERS),
});

export type AwardOutcome =
  | { ok: true; result: AwardResult }
  | { ok: false; reason: "invalid" | "limit" | "scope" | "no_semester" | "unknown" };

/**
 * منح نقاط. لا يحسب شيئًا بنفسه: كل التحقق (الصلاحية، الحد اليومي، حجز
 * خانة النبتة) يجري داخل award_points في قاعدة البيانات، ذرّيًا. لو مرّر العميل
 * فئة أو معرّفًا مزوّرًا، الخادم يرفض.
 */
export async function awardPoints(studentId: string, tier: string): Promise<AwardOutcome> {
  const parsed = awardInput.safeParse({ studentId, tier });
  if (!parsed.success) return { ok: false, reason: "invalid" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("award_points", {
    p_student_id: parsed.data.studentId,
    p_tier: parsed.data.tier,
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("DAILY_LIMIT_EXCEEDED")) return { ok: false, reason: "limit" };
    if (message.includes("STUDENT_OUT_OF_SCOPE")) return { ok: false, reason: "scope" };
    if (message.includes("NO_ACTIVE_SEMESTER")) return { ok: false, reason: "no_semester" };
    return { ok: false, reason: "unknown" };
  }

  // المزرعة العامة والقوائم تُخزَّن؛ نُبطل تخزينها فورًا لتظهر النبتة الجديدة
  revalidatePath(`/farm/${parsed.data.studentId}`);
  revalidatePath("/tv");
  revalidatePath("/");

  return { ok: true, result: data as AwardResult };
}

export type UndoOutcome =
  | { ok: true; points: number; studentId: string }
  | { ok: false; reason: "expired" | "not_yours" | "already" | "unavailable" | "unknown" };

/**
 * تراجع المشرف عن منحه خلال دقيقتين. الشروط كلها (منحُه هو، لم يُلغَ، داخل
 * النافذة) تُفحص في undo_my_award ذرّيًا؛ هنا ترجمة الرفض إلى سبب تعرضه الواجهة.
 */
export async function undoAward(ledgerId: number): Promise<UndoOutcome> {
  if (!Number.isSafeInteger(ledgerId) || ledgerId <= 0) return { ok: false, reason: "unknown" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("undo_my_award", { p_ledger_id: ledgerId });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("UNDO_WINDOW_PASSED")) return { ok: false, reason: "expired" };
    if (message.includes("UNDO_NOT_YOURS")) return { ok: false, reason: "not_yours" };
    if (message.includes("UNDO_ALREADY_REVOKED")) return { ok: false, reason: "already" };
    // الدالة غير موجودة: ترحيل 0006 لم يُشغَّل بعد على هذه القاعدة
    if (error.code === "PGRST202" || message.includes("undo_my_award")) {
      return { ok: false, reason: "unavailable" };
    }
    return { ok: false, reason: "unknown" };
  }

  const row = data as { student_id: string; points: number };
  revalidatePath(`/farm/${row.student_id}`);
  revalidatePath("/tv");
  revalidatePath("/");

  return { ok: true, points: row.points, studentId: row.student_id };
}

export async function fetchDailyStatus(): Promise<DailyStatus> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_daily_status");
  if (error || !data) return { role: null, limit: 0, used: 0, remaining: 0 };
  return data as DailyStatus;
}
