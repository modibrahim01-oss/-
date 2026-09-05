"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notifyOrderCreated, notifyLowMargin, notifyStageChanged } from "@/lib/notifications";
import { computeOrderFinancials } from "@/lib/finance";
import type { StageName, StageState } from "@/lib/supabase/types";

/** نفس النص الذي يضعه trigger قاعدة البيانات (0003_orders_and_stages.sql). */
const MISSING_DATE_REASON = "تاريخ مفقود";

const orderSchema = z.object({
  clientId: z.string().uuid({ message: "اختر العميل" }),
  orderDate: z.string().optional().nullable(),
  costCarton: z.coerce.number().min(0).default(0),
  costMold: z.coerce.number().min(0).default(0),
  costPlate: z.coerce.number().min(0).default(0),
  costShipping: z.coerce.number().min(0).default(0),
  clientPrice: z.coerce.number().positive({ message: "أدخل سعر العميل" }),
  factoryName: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export interface ActionState {
  error: string | null;
  success?: string | null;
}

function parseOrderForm(formData: FormData) {
  return orderSchema.safeParse({
    clientId: formData.get("clientId"),
    orderDate: formData.get("orderDate") || null,
    costCarton: formData.get("costCarton") || 0,
    costMold: formData.get("costMold") || 0,
    costPlate: formData.get("costPlate") || 0,
    costShipping: formData.get("costShipping") || 0,
    clientPrice: formData.get("clientPrice"),
    factoryName: formData.get("factoryName") || null,
    notes: formData.get("notes") || null,
  });
}

export async function createOrderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseOrderForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }
  const input = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .insert({
      client_id: input.clientId,
      rep_id: user.profile.id,
      order_date: input.orderDate || null,
      cost_carton: input.costCarton,
      cost_mold: input.costMold,
      cost_plate: input.costPlate,
      cost_shipping: input.costShipping,
      client_price: input.clientPrice,
      // لقطة من نسبة المندوب وقت الإنشاء
      rep_share_pct: user.profile.share_pct,
      factory_name: input.factoryName,
      notes: input.notes,
      status: "active",
    })
    .select("id, order_number")
    .single();

  if (error) return { error: `تعذّر حفظ الطلب: ${error.message}` };

  const financials = computeOrderFinancials(
    input.costCarton + input.costMold + input.costPlate + input.costShipping,
    input.clientPrice,
    user.profile.share_pct,
  );

  await notifyOrderCreated({
    orderId: data.id,
    orderNumber: data.order_number,
    repName: user.profile.full_name,
  });

  // هامش أقل من 10% → تنبيه فوري للمشرف قبل الاعتماد (القسم 7.2)
  if (financials.marginPct < 10) {
    await notifyLowMargin({
      orderId: data.id,
      orderNumber: data.order_number,
      marginPct: financials.marginPct,
    });
  }

  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { error: null, success: data.id };
}

export async function updateOrderAction(
  orderId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = parseOrderForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }
  const input = parsed.data;

  const supabase = await createClient();

  // علامة "يحتاج مراجعة" قد تكون بسبب تاريخ مفقود أو بسبب تعارض/تكرار رُصد
  // أثناء الاستيراد. إكمال التاريخ يرفع علامة التاريخ المفقود فقط، ولا يجوز
  // أن يمسح ضمنيًا تحذير تعارض لم يبتّ فيه أحد.
  const { data: current } = await supabase
    .from("orders")
    .select("needs_review, review_reason")
    .eq("id", orderId)
    .single<{ needs_review: boolean; review_reason: string | null }>();

  const wasMissingDateOnly =
    !current?.needs_review || current.review_reason === MISSING_DATE_REASON;

  const reviewFields = input.orderDate
    ? wasMissingDateOnly
      ? { needs_review: false, review_reason: null }
      : { needs_review: true, review_reason: current?.review_reason ?? null }
    : { needs_review: true, review_reason: MISSING_DATE_REASON };

  const { error } = await supabase
    .from("orders")
    .update({
      client_id: input.clientId,
      order_date: input.orderDate || null,
      cost_carton: input.costCarton,
      cost_mold: input.costMold,
      cost_plate: input.costPlate,
      cost_shipping: input.costShipping,
      client_price: input.clientPrice,
      factory_name: input.factoryName,
      notes: input.notes,
      ...reviewFields,
    })
    .eq("id", orderId);

  if (error) return { error: `تعذّر تحديث الطلب: ${error.message}` };

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return { error: null, success: "تم التحديث" };
}

export async function updateStageAction(
  orderId: string,
  stage: StageName,
  state: StageState,
) {
  const user = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("order_stages")
    .update({ state, changed_by: user.profile.id })
    .eq("order_id", orderId)
    .eq("stage", stage);

  if (error) throw new Error(error.message);

  await notifyStageChanged({ orderId, stage, state });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/admin/orders`);
}

export async function updateOrderStatusAction(orderId: string, status: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  if (error) throw new Error(error.message);
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/dashboard");
}

const paymentSchema = z.object({
  amount: z.coerce.number().positive({ message: "أدخل مبلغًا صحيحًا" }),
  paidAt: z.string().min(1, "أدخل تاريخ الدفعة"),
  method: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export async function addPaymentAction(
  orderId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = paymentSchema.safeParse({
    amount: formData.get("amount"),
    paidAt: formData.get("paidAt"),
    method: formData.get("method") || null,
    note: formData.get("note") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("payments").insert({
    order_id: orderId,
    amount: parsed.data.amount,
    paid_at: parsed.data.paidAt,
    method: parsed.data.method,
    note: parsed.data.note,
    created_by: user.profile.id,
  });

  if (error) return { error: `تعذّر تسجيل الدفعة: ${error.message}` };

  revalidatePath(`/orders/${orderId}`);
  return { error: null, success: "تم تسجيل الدفعة" };
}
