"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { findSimilarNames, normalizeClientName } from "@/lib/normalize";

const clientSchema = z.object({
  name: z.string().min(2, "أدخل اسم العميل"),
  phone: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export interface ClientActionState {
  error: string | null;
  similarNames?: string[];
  success?: string | null;
}

/**
 * إنشاء عميل. إن وُجد اسم مشابه، لا نحفظ مباشرة — نُعيد تحذيرًا للمستخدم
 * ليؤكد صراحةً (confirmSimilar) أنه عميل مختلف فعلًا (القسم 5، القاعدة 2).
 */
export async function createClientAction(
  _prev: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  const user = await requireUser();
  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") || null,
    city: formData.get("city") || null,
    vatNumber: formData.get("vatNumber") || null,
    notes: formData.get("notes") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const input = parsed.data;
  const confirmSimilar = formData.get("confirmSimilar") === "1";
  const supabase = await createClient();

  const { data: existing } = await supabase.from("clients").select("name, name_normalized");
  const existingNames = (existing ?? []).map((c: { name: string }) => c.name);

  const normalized = normalizeClientName(input.name);
  const exactDuplicate = (existing ?? []).some(
    (c: { name_normalized: string }) => c.name_normalized === normalized,
  );
  if (exactDuplicate) {
    return { error: `يوجد عميل مسجّل بنفس الاسم: ${input.name}` };
  }

  if (!confirmSimilar) {
    const similar = findSimilarNames(input.name, existingNames);
    if (similar.length > 0) {
      return {
        error: null,
        similarNames: similar,
      };
    }
  }

  const { error } = await supabase.from("clients").insert({
    name: input.name,
    // name_normalized يُحسب في قاعدة البيانات عبر trigger لضمان التطابق
    name_normalized: normalized,
    phone: input.phone,
    city: input.city,
    vat_number: input.vatNumber,
    notes: input.notes,
    owner_id: user.profile.id,
  });

  if (error) return { error: `تعذّر حفظ العميل: ${error.message}` };

  revalidatePath("/clients");
  revalidatePath("/orders/new");
  return { error: null, success: "تم حفظ العميل" };
}

/**
 * تحويل عميل من مندوب لآخر (القسم 2: "عملاء لم يُسجَّلوا باسمه إلا إذا
 * حوّلهم المشرف له"). المشرف فقط.
 *
 * الطلبات السابقة تبقى منسوبة لمندوبها الأصلي بعمولاتها كما هي — التحويل
 * ينقل ملكية العميل وطلباته المستقبلية فقط، ولا يعيد كتابة عمولة مستحقة
 * سبق أن كُسبت. سياسة RLS تعتمد على orders.rep_id لا على clients.owner_id،
 * فالمندوب الأصلي يبقى يرى طلباته القديمة، والمندوب الجديد لا يراها.
 */
export async function transferClientAction(
  _prev: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  const user = await requireUser();
  if (user.profile.role !== "admin") return { error: "غير مصرّح" };

  const clientId = String(formData.get("clientId") ?? "");
  const ownerIdRaw = String(formData.get("ownerId") ?? "");
  if (!clientId) return { error: "لم يُحدَّد العميل" };

  // قيمة فارغة تعني إلغاء الإسناد (عميل يديره المشرف مباشرة)
  const ownerId = ownerIdRaw === "" ? null : ownerIdRaw;

  const supabase = await createClient();

  if (ownerId) {
    const { data: target } = await supabase
      .from("users")
      .select("id, role, is_active, full_name")
      .eq("id", ownerId)
      .single<{ id: string; role: string; is_active: boolean; full_name: string }>();

    if (!target) return { error: "المندوب المستهدف غير موجود" };
    if (!target.is_active) return { error: `حساب ${target.full_name} معطّل` };
    if (target.role !== "rep" && target.role !== "admin") {
      return { error: "لا يمكن إسناد العميل لهذا الحساب" };
    }
  }

  const { error } = await supabase
    .from("clients")
    .update({ owner_id: ownerId })
    .eq("id", clientId);
  if (error) return { error: `تعذّر تحويل العميل: ${error.message}` };

  revalidatePath("/admin/clients");
  revalidatePath("/admin/clients/assign");
  revalidatePath("/clients");
  return { error: null, success: "تم تحويل العميل" };
}
