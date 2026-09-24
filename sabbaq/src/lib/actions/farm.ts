"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * ترتيب الطالب لمزرعته. لا جلسة: المفتاح نفسه هو الإذن، وقاعدة البيانات
 * تتحقق منه في arrange_farm و reset_farm (0007) — هنا تحقّق شكلي وترجمة للرفض
 * وإبطال تخزين صفحة المزرعة لتظهر للجميع بترتيبها الجديد.
 */

export type ArrangeOutcome =
  | { ok: true }
  | { ok: false; reason: "key" | "bounds" | "taken" | "invalid" | "unavailable" | "unknown" };

const idSchema = z.string().uuid();
const keySchema = z.string().regex(/^[A-Za-z0-9_-]{32,128}$/);
const movesSchema = z
  .array(z.object({ slot: z.number().int().min(0), x: z.number().int().min(-500).max(500), y: z.number().int().min(-500).max(500) }))
  .max(5000);

function reasonOf(message: string, code?: string): Exclude<ArrangeOutcome, { ok: true }>["reason"] {
  if (message.includes("FARM_KEY_INVALID")) return "key";
  if (message.includes("FARM_MOVE_OUT_OF_BOUNDS")) return "bounds";
  if (message.includes("FARM_CELL_TAKEN")) return "taken";
  if (message.includes("FARM_MOVES_INVALID")) return "invalid";
  if (code === "PGRST202") return "unavailable";
  return "unknown";
}

function refresh(studentId: string) {
  revalidatePath(`/farm/${studentId}`);
  revalidatePath("/tv");
}

export async function saveArrangement(
  studentId: string,
  key: string,
  moves: { slot: number; x: number; y: number }[],
): Promise<ArrangeOutcome> {
  const parsed = z.tuple([idSchema, keySchema, movesSchema]).safeParse([studentId, key, moves]);
  if (!parsed.success) return { ok: false, reason: "invalid" };

  const { error } = await createPublicClient().rpc("arrange_farm", {
    p_student: studentId,
    p_key: key,
    p_moves: moves,
  });
  if (error) return { ok: false, reason: reasonOf(error.message ?? "", error.code) };
  refresh(studentId);
  return { ok: true };
}

export async function resetArrangement(studentId: string, key: string): Promise<ArrangeOutcome> {
  if (!idSchema.safeParse(studentId).success || !keySchema.safeParse(key).success) {
    return { ok: false, reason: "invalid" };
  }
  const { error } = await createPublicClient().rpc("reset_farm", { p_student: studentId, p_key: key });
  if (error) return { ok: false, reason: reasonOf(error.message ?? "", error.code) };
  refresh(studentId);
  return { ok: true };
}
