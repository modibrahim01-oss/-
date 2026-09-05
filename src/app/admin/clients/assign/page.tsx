import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ClientTransferForm } from "@/components/ClientTransferForm";
import { requireAdmin } from "@/lib/auth";
import { listClientsWithOwners, listUsers } from "@/lib/data";
import { formatDate, formatNumber } from "@/lib/format";

export default async function AssignClientsPage() {
  await requireAdmin();

  const [clients, users] = await Promise.all([listClientsWithOwners(), listUsers()]);
  const reps = users
    .filter((u) => u.role === "rep")
    .map((u) => ({ id: u.id, full_name: u.full_name, is_active: u.is_active }));

  const unassigned = clients.filter((c) => !c.owner_id).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">إسناد العملاء للمندوبين</h1>
        <Link href="/admin/clients" className="text-sm text-gray-500 hover:underline">
          تحليل العملاء
        </Link>
      </div>

      <div className="rounded-2xl border bg-white p-4 text-sm text-gray-600">
        تحويل العميل ينقل ملكيته وطلباته المستقبلية للمندوب الجديد. الطلبات السابقة
        تبقى منسوبة لمندوبها الأصلي بعمولاتها كما هي — لا يُعاد احتساب عمولة سبق
        استحقاقها. المندوب الجديد يرى العميل وتاريخه معه، ولا يرى طلبات المندوب
        السابق.
      </div>

      {unassigned > 0 ? (
        <div className="rounded-2xl border border-warn-500 bg-warn-50 p-4 text-sm text-warn-700">
          <span className="nums">{unassigned}</span> عميل بدون مندوب مسؤول — يديره المشرف
          حاليًا.
        </div>
      ) : null}

      {reps.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-600">
            لا يوجد مندوبون بعد.{" "}
            <Link href="/admin/users" className="text-brand-600 hover:underline">
              أنشئ حساب مندوب أولًا
            </Link>
          </p>
        </Card>
      ) : (
        <Card>
          {/* جدول على الشاشات الكبيرة */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-right border-b">
                  <th className="py-2 font-medium">العميل</th>
                  <th className="py-2 font-medium">المندوب الحالي</th>
                  <th className="py-2 font-medium">الطلبات</th>
                  <th className="py-2 font-medium">أُضيف في</th>
                  <th className="py-2 font-medium">تحويل إلى</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="border-b last:border-0 align-middle">
                    <td className="py-3">
                      <Link href={`/clients/${client.id}`} className="hover:underline">
                        {client.name}
                      </Link>
                    </td>
                    <td className="py-3 text-gray-600">
                      {client.owner?.full_name ?? <span className="text-warn-700">بدون مندوب</span>}
                    </td>
                    <td className="py-3 nums">{formatNumber(client.ordersCount, 0)}</td>
                    <td className="py-3 nums text-gray-500">{formatDate(client.created_at)}</td>
                    <td className="py-3">
                      <ClientTransferForm
                        clientId={client.id}
                        clientName={client.name}
                        currentOwnerId={client.owner_id}
                        ordersCount={client.ordersCount}
                        reps={reps}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* بطاقات على الجوال */}
          <ul className="md:hidden space-y-3">
            {clients.map((client) => (
              <li key={client.id} className="rounded-xl border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/clients/${client.id}`} className="font-medium hover:underline">
                    {client.name}
                  </Link>
                  <span className="text-xs text-gray-500 shrink-0">
                    <span className="nums">{formatNumber(client.ordersCount, 0)}</span> طلب
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  المندوب الحالي:{" "}
                  {client.owner?.full_name ?? <span className="text-warn-700">بدون مندوب</span>}
                </p>
                <ClientTransferForm
                  clientId={client.id}
                  clientName={client.name}
                  currentOwnerId={client.owner_id}
                  ordersCount={client.ordersCount}
                  reps={reps}
                />
              </li>
            ))}
          </ul>

          {clients.length === 0 ? (
            <p className="text-sm text-gray-500">لا يوجد عملاء بعد.</p>
          ) : null}
        </Card>
      )}
    </div>
  );
}
