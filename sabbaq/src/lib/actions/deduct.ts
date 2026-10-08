"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { TIERS, type Tier } from "@/lib/tiers";

/**
 * الخصم بيد «الليدر»: المدير ومن يمنحه صلاحية الخصم. الصلاحية واختيار النبتة
 * وقفل الطالب كلها في deduct_plant (0008)؛ هنا تحقّق شكلي وترجمة الرفض.
 */

export type DeductReason =
  | "forbidden"
  | "invalid"
  | "reason"
  | "none_of_tier"
  | "expired"
  | "not_yours"
  | "already"
  | "cell_taken"
  | "unavailable"
  | "unknown";

export type Deduction = {
  id: number;
  student_id: string;
  full_name: string;
  tier: Tier;
  points: number;
  reason: string;
  created_at: string;
  undone_at: string | null;
  actor_name?: string;
};

function reasonOf(message: string, code?: string): DeductReason {
  if (message.includes("NOT_ALLOWED") || message.includes("AUTH_REQUIRED")) return "forbidden";
  if (message.includes("REASON_REQUIRED")) return "reason";
  if (message.includes("NO_PLANT_OF_TIER")) return "none_of_tier";
  if (message.includes("UNDO_WINDOW_PASSED")) return "expired";
  if (message.includes("UNDO_NOT_YOURS")) return "not_yours";
  if (message.includes("UNDO_ALREADY_REVOKED")) return "already";
  if (message.includes("CELL_TAKEN")) return "cell_taken";
  if (code === "PGRST202") return "unavailable";
  return "unknown";
}

function refresh(studentId: string) {
  // البستان والقوائم والشاشات تُخزَّن؛ الخصم يظهر فيها فورًا
  revalidatePath(`/farm/${studentId}`);
  revalidatePath("/tv");
  revalidatePath("/tv/[groups]", "page");
  revalidatePath("/");
  revalidatePath("/deduct");
}

const deductInput = z.object({
  studentId: z.string().uuid(),
  tier: z.enum(TIERS),
  reason: z.string().trim().min(2).max(200),
});

export async function deductPlant(
  studentId: string,
  tier: string,
  reason: string,
): Promise<{ ok: true; id: number; points: number } | { ok: false; reason: DeductReason }> {
  const parsed = deductInput.safeParse({ studentId, tier, reason });
  if (!parsed.success) {
    return { ok: false, reason: parsed.error.issues.some((i) => i.path[0] === "reason") ? "reason" : "invalid" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("deduct_plant", {
    p_student: parsed.data.studentId,
    p_tier: parsed.data.tier,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, reason: reasonOf(error.message ?? "", error.code) };

  refresh(parsed.data.studentId);
  const row = data as { deduction_id: number; points: number };
  return { ok: true, id: row.deduction_id, points: row.points };
}

export async function undoDeduction(
  id: number,
  studentId: string,
): Promise<{ ok: true } | { ok: false; reason: DeductReason }> {
  if (!Number.isSafeInteger(id) || id <= 0 || !z.string().uuid().safeParse(studentId).success) {
    return { ok: false, reason: "invalid" };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("undo_deduction", { p_id: id });
  if (error) return { ok: false, reason: reasonOf(error.message ?? "", error.code) };
  refresh(studentId);
  return { ok: true };
}
