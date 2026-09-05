import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { StageBar } from "@/components/StageBar";
import { PaymentsPanel } from "@/components/PaymentsPanel";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { requireUser } from "@/lib/auth";
import {
  getOrder,
  getOrderAuditTrail,
  getOrderPayments,
  getOrderStages,
} from "@/lib/data";
import { formatDate, formatPct, formatSAR } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { AttachmentRow } from "@/lib/supabase/types";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const order = await getOrder(id);
  if (!order) notFound();

  const [stages, payments, audit] = await Promise.all([
    getOrderStages(id),
    getOrderPayments(id),
    user.profile.role === "admin" ? getOrderAuditTrail(id) : Promise.resolve([]),
  ]);

  const supabase = await createClient();
  const { data: attachmentsData } = await supabase
    .from("attachments")
    .select("*")
    .eq("order_id", id)
    .order("uploaded_at", { ascending: false });
  const attachments = (attachmentsData ?? []) as AttachmentRow[];

  const f = order.financials;
  const paidTotal = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = f.client_price - paidTotal;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">
            طلب رقم <span className="nums">{f.order_number}</span>
          </h1>
          <p className="text-sm text-gray-500">
            {order.raw.client?.name ?? "—"} · <span className="nums">{formatDate(f.order_date)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {f.needs_review ? (
            <span className="rounded-lg bg-warn-50 text-warn-700 px-3 py-1 text-sm font-medium">
              يحتاج مراجعة: {order.raw.review_reason ?? "—"}
            </span>
          ) : null}
          {order.raw.deleted_at ? (
            <span className="rounded-lg bg-gray-100 text-gray-600 px-3 py-1 text-sm font-medium">
              طلب محذوف
            </span>
          ) : (
            <Link
              href={`/orders/${id}/edit`}
              className="rounded-lg border border-brand-500 text-brand-700 px-4 py-1.5 text-sm font-medium hover:bg-brand-50"
            >
              تعديل الطلب
            </Link>
          )}
        </div>
      </div>

      <Card title="مراحل الطلب">
        <StageBar orderId={id} stages={stages} />
        <p className="text-xs text-gray-400 mt-3">اضغط على المرحلة لتغيير حالتها</p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="الأرقام">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-gray-500">تكلفة الكرتون</dt>
            <dd className="text-left nums">{formatSAR(Number(order.raw.cost_carton))}</dd>
            <dt className="text-gray-500">تكلفة القالب</dt>
            <dd className="text-left nums">{formatSAR(Number(order.raw.cost_mold))}</dd>
            <dt className="text-gray-500">تكلفة الكليشة</dt>
            <dd className="text-left nums">{formatSAR(Number(order.raw.cost_plate))}</dd>
            <dt className="text-gray-500">تكلفة الشحن</dt>
            <dd className="text-left nums">{formatSAR(Number(order.raw.cost_shipping))}</dd>
            <dt className="text-gray-700 font-medium border-t pt-2">تكلفة المصنع</dt>
            <dd className="text-left font-medium border-t pt-2 nums">{formatSAR(f.factory_cost)}</dd>
            <dt className="text-gray-700 font-medium">سعر العميل</dt>
            <dd className="text-left font-medium nums">{formatSAR(f.client_price)}</dd>
            <dt className="text-gray-700 font-medium">الربح</dt>
            <dd className="text-left font-medium nums">{formatSAR(f.profit)}</dd>
            <dt className="text-gray-500">الربح بدون ضريبة</dt>
            <dd className="text-left nums">{formatSAR(f.profit_ex_vat)}</dd>
            <dt className="text-gray-500">ضريبة القيمة المضافة</dt>
            <dd className="text-left nums">{formatSAR(f.vat_due)}</dd>
            <dt className="text-gray-500">هامش الربح</dt>
            <dd className="text-left nums">{formatPct(f.margin_pct)}</dd>
            <dt className="text-brand-700 font-medium border-t pt-2">
              حصة المندوب ({formatPct(f.rep_share_pct, 0)})
            </dt>
            <dd className="text-left text-brand-700 font-medium border-t pt-2 nums">
              {formatSAR(f.rep_share)}
            </dd>
            {user.profile.role === "admin" ? (
              <>
                <dt className="text-gray-700 font-medium">حصة الشركة</dt>
                <dd className="text-left font-medium nums">{formatSAR(f.company_share)}</dd>
              </>
            ) : null}
          </dl>
        </Card>

        <Card title="التحصيل">
          <PaymentsPanel
            orderId={id}
            payments={payments}
            clientPrice={f.client_price}
            paidTotal={paidTotal}
            remaining={remaining}
          />
        </Card>
      </div>

      <Card title="المرفقات">
        <AttachmentsPanel orderId={id} attachments={attachments} />
      </Card>

      {user.profile.role === "admin" && audit.length > 0 ? (
        <Card title="سجل التغييرات على هذا الطلب">
          <ul className="space-y-2 text-sm">
            {audit.map((entry) => {
              const row = entry as unknown as {
                id: number;
                action: string;
                changed_at: string;
                users: { full_name: string } | null;
              };
              return (
                <li key={row.id} className="flex justify-between gap-3 border-b last:border-0 pb-2">
                  <span className="text-gray-700">
                    {row.action === "insert" ? "إنشاء" : row.action === "update" ? "تعديل" : "حذف"}
                  </span>
                  <span className="text-gray-500">{row.users?.full_name ?? "—"}</span>
                  <span className="text-gray-400 nums">{formatDate(row.changed_at)}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
