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

  return { ok: true, result: data as AwardResult };
}

export async function fetchDailyStatus(): Promise<DailyStatus> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_daily_status");
  if (error || !data) return { role: null, limit: 0, used: 0, remaining: 0 };
  return data as DailyStatus;
}
