import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { requireAdmin } from "@/lib/auth";
import { getRepBalance, listUsers } from "@/lib/data";
import { formatDate, formatNumber, formatPct, formatSAR } from "@/lib/format";

export default async function RepStatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const users = await listUsers();
  const rep = users.find((u) => u.id === id);
  if (!rep) notFound();

  const { orders, withdrawals, withdrawn, balance, completedShare } = await getRepBalance(id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 no-print">
        <h1 className="text-xl font-bold">كشف حساب مندوب</h1>
        <PrintButton />
      </div>

      <div className="print-page bg-white rounded-2xl border shadow-sm p-6 space-y-6">
        <header className="text-center border-b pb-4">
          <h2 className="text-lg font-bold">إتقان المقاس — كشف حساب</h2>
          <p className="text-sm text-gray-700 mt-1">{rep.full_name}</p>
          <p className="text-xs text-gray-400 mt-1">
            النسبة <span className="nums">{formatPct(rep.share_pct, 0)}</span> · صدر بتاريخ{" "}
            <span className="nums">{formatDate(new Date())}</span>
          </p>
        </header>

        <section>
          <h3 className="font-semibold mb-2">الطلبات</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-right border-b">
                <th className="py-1.5 font-medium">#</th>
                <th className="py-1.5 font-medium">العميل</th>
                <th className="py-1.5 font-medium">التاريخ</th>
                <th className="py-1.5 font-medium">المبيعات</th>
                <th className="py-1.5 font-medium">الربح</th>
                <th className="py-1.5 font-medium">حصته</th>
                <th className="py-1.5 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b last:border-0">
                  <td className="py-1.5 nums">{order.order_number}</td>
                  <td className="py-1.5">{order.client?.name ?? "—"}</td>
                  <td className="py-1.5 nums">{formatDate(order.order_date)}</td>
                  <td className="py-1.5 nums">{formatSAR(order.client_price)}</td>
                  <td className="py-1.5 nums">{formatSAR(order.profit)}</td>
                  <td className="py-1.5 nums">{formatSAR(order.rep_share)}</td>
                  <td className="py-1.5 text-gray-600">
                    {order.status === "completed" ? "مكتمل" : "غير مكتمل"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-3">لا توجد طلبات</p>
          ) : null}
        </section>

        <section>
          <h3 className="font-semibold mb-2">المسحوبات</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-right border-b">
                <th className="py-1.5 font-medium">التاريخ</th>
                <th className="py-1.5 font-medium">المبلغ</th>
                <th className="py-1.5 font-medium">ملاحظة</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w) => (
                <tr key={w.id} className="border-b last:border-0">
                  <td className="py-1.5 nums">{formatDate(w.withdrawn_at)}</td>
                  <td className="py-1.5 nums">{formatSAR(Number(w.amount))}</td>
                  <td className="py-1.5 text-gray-600">{w.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {withdrawals.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-3">لا توجد مسحوبات</p>
          ) : null}
        </section>

        <section className="border-t pt-4">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <dt className="text-gray-500">عدد الطلبات</dt>
              <dd className="font-medium nums">{formatNumber(orders.length, 0)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">العمولة المستحقة</dt>
              <dd className="font-medium nums">{formatSAR(completedShare)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">إجمالي المسحوبات</dt>
              <dd className="font-medium nums">{formatSAR(withdrawn)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">الرصيد المتبقي</dt>
              <dd className="font-bold nums">{formatSAR(balance)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
