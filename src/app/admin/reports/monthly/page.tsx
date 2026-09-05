import { PrintButton } from "@/components/PrintButton";
import { requireAdmin } from "@/lib/auth";
import { listOrders, listUsers } from "@/lib/data";
import { aggregateByClient, monthLabel, sumOrders } from "@/lib/analytics";
import { formatDate, formatNumber, formatPct, formatSAR } from "@/lib/format";

export default async function MonthlyReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const now = new Date();
  const month =
    params.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [allOrders, users] = await Promise.all([listOrders(), listUsers()]);
  const orders = allOrders.filter((o) => o.order_date?.startsWith(month));
  const totals = sumOrders(orders);
  const clients = aggregateByClient(orders);
  const usersById = new Map(users.map((u) => [u.id, u.full_name]));

  const byRep = new Map<string, { count: number; sales: number; profit: number; share: number }>();
  for (const order of orders) {
    const entry = byRep.get(order.rep_id) ?? { count: 0, sales: 0, profit: 0, share: 0 };
    entry.count += 1;
    entry.sales += order.client_price;
    entry.profit += order.profit;
    entry.share += order.rep_share;
    byRep.set(order.rep_id, entry);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 no-print">
        <h1 className="text-xl font-bold">التقرير الشهري</h1>
        <PrintButton />
      </div>

      <div className="print-page bg-white rounded-2xl border shadow-sm p-6 space-y-6">
        <header className="text-center border-b pb-4">
          <h2 className="text-lg font-bold">إتقان المقاس — التقرير الشهري</h2>
          <p className="text-sm text-gray-500 mt-1">
            {monthLabel(month)} · صدر بتاريخ <span className="nums">{formatDate(new Date())}</span>
          </p>
        </header>

        <section>
          <h3 className="font-semibold mb-2">الملخص</h3>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-gray-500">عدد الطلبات</dt>
              <dd className="font-medium nums">{formatNumber(totals.count, 0)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">إجمالي المبيعات</dt>
              <dd className="font-medium nums">{formatSAR(totals.sales)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">إجمالي التكلفة</dt>
              <dd className="font-medium nums">{formatSAR(totals.cost)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">إجمالي الربح</dt>
              <dd className="font-medium nums">{formatSAR(totals.profit)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">الربح بدون ضريبة</dt>
              <dd className="font-medium nums">{formatSAR(totals.profitExVat)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">متوسط الهامش</dt>
              <dd className="font-medium nums">{formatPct(totals.avgMarginPct)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">حصص المندوبين</dt>
              <dd className="font-medium nums">{formatSAR(totals.repShare)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">حصة الشركة</dt>
              <dd className="font-medium nums">{formatSAR(totals.companyShare)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">الضريبة المستحقة</dt>
              <dd className="font-medium nums">{formatSAR(totals.vatDue)}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h3 className="font-semibold mb-2">حسب المندوب</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-right border-b">
                <th className="py-1.5 font-medium">المندوب</th>
                <th className="py-1.5 font-medium">الطلبات</th>
                <th className="py-1.5 font-medium">المبيعات</th>
                <th className="py-1.5 font-medium">الربح</th>
                <th className="py-1.5 font-medium">حصته</th>
              </tr>
            </thead>
            <tbody>
              {[...byRep.entries()].map(([repId, entry]) => (
                <tr key={repId} className="border-b last:border-0">
                  <td className="py-1.5">{usersById.get(repId) ?? "—"}</td>
                  <td className="py-1.5 nums">{formatNumber(entry.count, 0)}</td>
                  <td className="py-1.5 nums">{formatSAR(entry.sales)}</td>
                  <td className="py-1.5 nums">{formatSAR(entry.profit)}</td>
                  <td className="py-1.5 nums">{formatSAR(entry.share)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h3 className="font-semibold mb-2">حسب العميل</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-right border-b">
                <th className="py-1.5 font-medium">العميل</th>
                <th className="py-1.5 font-medium">الطلبات</th>
                <th className="py-1.5 font-medium">المبيعات</th>
                <th className="py-1.5 font-medium">الربح</th>
                <th className="py-1.5 font-medium">الهامش</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.clientId} className="border-b last:border-0">
                  <td className="py-1.5">{client.clientName}</td>
                  <td className="py-1.5 nums">{formatNumber(client.ordersCount, 0)}</td>
                  <td className="py-1.5 nums">{formatSAR(client.sales)}</td>
                  <td className="py-1.5 nums">{formatSAR(client.profit)}</td>
                  <td className="py-1.5 nums">{formatPct(client.marginPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {orders.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">لا توجد طلبات في هذا الشهر</p>
        ) : null}
      </div>
    </div>
  );
}
