"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const withdrawalSchema = z.object({
  repId: z.string().uuid("اختر المندوب"),
  amount: z.coerce.number().positive("أدخل مبلغًا صحيحًا"),
  withdrawnAt: z.string().min(1, "أدخل التاريخ"),
  note: z.string().optional().nullable(),
});

export interface WithdrawalState {
  error: string | null;
  success?: string | null;
}

/** تسجيل مسحوبات المندوبين — المشرف فقط (RLS يمنع المندوب من الإدراج أيضًا). */
export async function createWithdrawalAction(
  _prev: WithdrawalState,
  formData: FormData,
): Promise<WithdrawalState> {
  const admin = await requireAdmin();

  const parsed = withdrawalSchema.safeParse({
    repId: formData.get("repId"),
    amount: formData.get("amount"),
    withdrawnAt: formData.get("withdrawnAt"),
    note: formData.get("note") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("withdrawals").insert({
    rep_id: parsed.data.repId,
    amount: parsed.data.amount,
    withdrawn_at: parsed.data.withdrawnAt,
    note: parsed.data.note,
    created_by: admin.profile.id,
  });

  if (error) return { error: `تعذّر تسجيل المسحوبات: ${error.message}` };

  revalidatePath("/admin/withdrawals");
  revalidatePath("/admin/reps");
  return { error: null, success: "تم تسجيل المسحوبات" };
}
