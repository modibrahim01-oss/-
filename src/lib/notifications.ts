import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StageName, StageState } from "@/lib/supabase/types";
import { formatPct } from "@/lib/format";

/**
 * طبقة تنبيهات مجرّدة (القسم 7.2): القنوات المفعّلة الآن in_app و email.
 * إضافة قناة واتساب لاحقًا = إضافة Channel جديد في CHANNELS دون تعديل أي
 * مستدعٍ لـ dispatchNotification.
 */

export type NotificationType =
  | "order_status_changed"
  | "order_created"
  | "payment_overdue"
  | "stage_stuck"
  | "low_margin_alert";

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  relatedTable?: string;
  relatedId?: string;
}

interface Channel {
  name: string;
  isEnabled(): boolean;
  send(payload: NotificationPayload, recipientEmail: string | null): Promise<void>;
}

const inAppChannel: Channel = {
  name: "in_app",
  isEnabled: () => true,
  async send(payload) {
    const supabase = createAdminClient();
    await supabase.from("notifications").insert({
      user_id: payload.userId,
      type: payload.type,
      title: payload.title,
      body: payload.body ?? null,
      data: payload.data ?? {},
      channels: ["in_app"],
      related_table: payload.relatedTable ?? null,
      related_id: payload.relatedId ?? null,
    });
  },
};

const emailChannel: Channel = {
  name: "email",
  isEnabled: () => Boolean(process.env.RESEND_API_KEY),
  async send(payload, recipientEmail) {
    if (!recipientEmail) return;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.NOTIFICATIONS_FROM_EMAIL ?? "notifications@example.com",
        to: recipientEmail,
        subject: payload.title,
        html: `<div dir="rtl" style="font-family:Tahoma,sans-serif">
          <h3>${escapeHtml(payload.title)}</h3>
          <p>${escapeHtml(payload.body ?? "")}</p>
        </div>`,
      }),
    }).catch(() => {
      // فشل إرسال البريد لا يجب أن يُسقط العملية الأساسية (حفظ الطلب مثلًا)
    });
  },
};

// قناة واتساب: تُضاف هنا لاحقًا بنفس الواجهة دون تعديل المستدعين
// (تحتاج WhatsApp Business Cloud API وقوالب معتمدة — خارج النسخة الأولى).
const CHANNELS: Channel[] = [inAppChannel, emailChannel];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function dispatchNotification(payload: NotificationPayload): Promise<void> {
  const supabase = createAdminClient();
  const { data: authUser } = await supabase.auth.admin.getUserById(payload.userId);
  const email = authUser?.user?.email ?? null;

  await Promise.all(
    CHANNELS.filter((c) => c.isEnabled()).map((c) =>
      c.send(payload, email).catch(() => undefined),
    ),
  );
}

async function getAdminIds(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true);
  return (data ?? []).map((u: { id: string }) => u.id);
}

async function getOrderRepId(orderId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("orders").select("rep_id").eq("id", orderId).single();
  return data?.rep_id ?? null;
}

export async function notifyOrderCreated(args: {
  orderId: string;
  orderNumber: number;
  repName: string;
}) {
  const adminIds = await getAdminIds();
  await Promise.all(
    adminIds.map((id) =>
      dispatchNotification({
        userId: id,
        type: "order_created",
        title: `طلب جديد رقم ${args.orderNumber}`,
        body: `أنشأ المندوب ${args.repName} طلبًا جديدًا.`,
        relatedTable: "orders",
        relatedId: args.orderId,
      }),
    ),
  );
}

export async function notifyLowMargin(args: {
  orderId: string;
  orderNumber: number;
  marginPct: number;
}) {
  const adminIds = await getAdminIds();
  await Promise.all(
    adminIds.map((id) =>
      dispatchNotification({
        userId: id,
        type: "low_margin_alert",
        title: `تنبيه هامش منخفض — طلب ${args.orderNumber}`,
        body: `هامش الطلب ${formatPct(args.marginPct)} وهو أقل من 10%. راجعه قبل الاعتماد.`,
        data: { margin_pct: args.marginPct },
        relatedTable: "orders",
        relatedId: args.orderId,
      }),
    ),
  );
}

const STAGE_LABELS: Record<StageName, string> = {
  plate: "الكليشة",
  mold: "القالب",
  processing: "قيد التنفيذ",
  ordered_from_factory: "طُلب من المصنع",
  carton_ready: "الكرتون جاهز",
  shipped: "تم الشحن",
  received: "تم الاستلام",
};

const STATE_LABELS: Record<StageState, string> = {
  not_yet: "لم يبدأ",
  in_progress: "جاري",
  done: "تم",
};

export async function notifyStageChanged(args: {
  orderId: string;
  stage: StageName;
  state: StageState;
}) {
  const repId = await getOrderRepId(args.orderId);
  const adminIds = await getAdminIds();
  const recipients = new Set([...(repId ? [repId] : []), ...adminIds]);

  const title = `تحديث مرحلة: ${STAGE_LABELS[args.stage]} → ${STATE_LABELS[args.state]}`;
  await Promise.all(
    [...recipients].map((id) =>
      dispatchNotification({
        userId: id,
        type: "order_status_changed",
        title,
        relatedTable: "orders",
        relatedId: args.orderId,
      }),
    ),
  );
}
