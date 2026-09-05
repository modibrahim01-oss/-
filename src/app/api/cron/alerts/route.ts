import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchNotification } from "@/lib/notifications";
import { formatSAR } from "@/lib/format";

/**
 * تنبيهات مجدولة (القسم 7.2):
 *  - مرّ 14 يومًا على طلب "تم الاستلام" وما زال غير محصَّل بالكامل
 *  - طلب عالق في نفس المرحلة أكثر من 7 أيام
 * تُستدعى يوميًا من Vercel Cron. محمية بـ CRON_SECRET.
 */

const OVERDUE_DAYS = 14;
const STUCK_DAYS = 7;

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();

  const { data: admins } = await supabase
    .from("users")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true);
  const adminIds = (admins ?? []).map((a: { id: string }) => a.id);

  let overdueCount = 0;
  let stuckCount = 0;

  // 1) طلبات "تم الاستلام" منذ أكثر من 14 يومًا وغير محصّلة بالكامل
  const { data: receivedStages } = await supabase
    .from("order_stages")
    .select("order_id, changed_at")
    .eq("stage", "received")
    .eq("state", "done")
    .lt("changed_at", daysAgo(OVERDUE_DAYS));

  for (const stage of (receivedStages ?? []) as { order_id: string; changed_at: string }[]) {
    const { data: order } = await supabase
      .from("orders")
      .select("id, order_number, rep_id, client_price")
      .eq("id", stage.order_id)
      .is("deleted_at", null)
      .single();
    if (!order) continue;

    const { data: payments } = await supabase
      .from("payments")
      .select("amount")
      .eq("order_id", order.id);
    const paid = (payments ?? []).reduce(
      (sum: number, p: { amount: number }) => sum + Number(p.amount),
      0,
    );
    const remaining = Number(order.client_price) - paid;
    if (remaining <= 0.01) continue;

    // لا تكرّر التنبيه لنفس الطلب إن أُرسل خلال آخر 14 يومًا
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("type", "payment_overdue")
      .eq("related_id", order.id)
      .gte("created_at", daysAgo(OVERDUE_DAYS))
      .limit(1);
    if (existing && existing.length > 0) continue;

    const recipients = new Set([order.rep_id, ...adminIds]);
    for (const userId of recipients) {
      await dispatchNotification({
        userId,
        type: "payment_overdue",
        title: `تحصيل متأخر — طلب ${order.order_number}`,
        body: `مرّ ${OVERDUE_DAYS} يومًا على استلام الطلب وما زال المتبقي ${formatSAR(remaining)}.`,
        relatedTable: "orders",
        relatedId: order.id,
      });
    }
    overdueCount++;
  }

  // 2) طلبات عالقة في نفس المرحلة أكثر من 7 أيام
  const { data: stuckStages } = await supabase
    .from("order_stages")
    .select("order_id, stage, changed_at")
    .eq("state", "in_progress")
    .lt("changed_at", daysAgo(STUCK_DAYS));

  for (const stage of (stuckStages ?? []) as {
    order_id: string;
    stage: string;
    changed_at: string;
  }[]) {
    const { data: order } = await supabase
      .from("orders")
      .select("id, order_number, rep_id")
      .eq("id", stage.order_id)
      .is("deleted_at", null)
      .single();
    if (!order) continue;

    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("type", "stage_stuck")
      .eq("related_id", order.id)
      .gte("created_at", daysAgo(STUCK_DAYS))
      .limit(1);
    if (existing && existing.length > 0) continue;

    const recipients = new Set([order.rep_id, ...adminIds]);
    for (const userId of recipients) {
      await dispatchNotification({
        userId,
        type: "stage_stuck",
        title: `طلب عالق — رقم ${order.order_number}`,
        body: `الطلب في نفس المرحلة منذ أكثر من ${STUCK_DAYS} أيام.`,
        data: { stage: stage.stage },
        relatedTable: "orders",
        relatedId: order.id,
      });
    }
    stuckCount++;
  }

  return NextResponse.json({ overdueCount, stuckCount });
}
