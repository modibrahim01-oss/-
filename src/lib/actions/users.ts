"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const createUserSchema = z.object({
  fullName: z.string().min(2, "أدخل اسم المستخدم"),
  email: z.string().email("بريد إلكتروني غير صالح"),
  password: z.string().min(8, "كلمة المرور 8 أحرف على الأقل"),
  phone: z.string().optional().nullable(),
  role: z.enum(["admin", "rep"]),
  sharePct: z.coerce.number().min(0).max(100),
});

export interface UserActionState {
  error: string | null;
  success?: string | null;
}

/**
 * إنشاء حساب مندوب. يتطلب service role (Supabase Auth Admin API)، لذلك
 * يُفحص دور المستخدم صراحةً هنا قبل أي استخدام لمفتاح يتجاوز RLS.
 */
export async function createUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  await requireAdmin();

  const parsed = createUserSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone") || null,
    role: formData.get("role") ?? "rep",
    sharePct: formData.get("sharePct") ?? 50,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const input = parsed.data;
  const admin = createAdminClient();

  const { error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName,
      phone: input.phone,
      role: input.role,
      share_pct: input.sharePct,
    },
  });

  if (error) {
    return { error: `تعذّر إنشاء الحساب: ${error.message}` };
  }

  revalidatePath("/admin/users");
  return { error: null, success: "تم إنشاء الحساب" };
}

export async function updateUserAction(
  userId: string,
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  await requireAdmin();

  const sharePct = Number(formData.get("sharePct"));
  const isActive = formData.get("isActive") === "1";

  if (!Number.isFinite(sharePct) || sharePct < 0 || sharePct > 100) {
    return { error: "النسبة يجب أن تكون بين 0 و100" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({ share_pct: sharePct, is_active: isActive })
    .eq("id", userId);

  if (error) return { error: `تعذّر التحديث: ${error.message}` };

  revalidatePath("/admin/users");
  return { error: null, success: "تم التحديث" };
}
