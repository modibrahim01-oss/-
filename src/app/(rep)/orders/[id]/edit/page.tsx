import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { OrderForm } from "@/components/OrderForm";
import { updateOrderAction } from "@/lib/actions/orders";
import { requireUser } from "@/lib/auth";
import { getOrder, listClients } from "@/lib/data";

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  // RLS يمنع أصلًا قراءة طلب مندوب آخر، فغياب الطلب هنا يعني إمّا أنه غير
  // موجود أو أنه ليس للمستخدم الحالي — الحالتان تعطيان 404.
  const order = await getOrder(id);
  if (!order) notFound();

  // الطلب المحذوف (soft delete) لا يُعدَّل
  if (order.raw.deleted_at) notFound();

  // المشرف يعدّل أي طلب بأي عميل؛ المندوب مقيَّد بعملائه هو
  const clients = await listClients(
    user.profile.role === "admin" ? undefined : user.profile.id,
  );

  const boundAction = updateOrderAction.bind(null, id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">
          تعديل الطلب رقم <span className="nums">{order.raw.order_number}</span>
        </h1>
        <Link href={`/orders/${id}`} className="text-sm text-gray-500 hover:underline">
          رجوع للتفاصيل
        </Link>
      </div>

      <Card>
        <p className="text-sm text-gray-500 mb-4">
          أي تعديل على المبالغ يُسجَّل في سجل التدقيق بالقيمة القديمة والجديدة واسم من
          عدّلها.
        </p>
        <OrderForm
          clients={clients}
          repSharePct={Number(order.raw.rep_share_pct)}
          action={boundAction}
          submitLabel="حفظ التعديلات"
          redirectOnSuccess={`/orders/${id}`}
          defaults={{
            clientId: order.raw.client_id,
            orderDate: order.raw.order_date,
            costCarton: Number(order.raw.cost_carton),
            costMold: Number(order.raw.cost_mold),
            costPlate: Number(order.raw.cost_plate),
            costShipping: Number(order.raw.cost_shipping),
            clientPrice: Number(order.raw.client_price),
            factoryName: order.raw.factory_name,
            notes: order.raw.notes,
          }}
        />
      </Card>
    </div>
  );
}
