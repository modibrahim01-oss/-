import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ExportButton } from "@/components/ExportButton";
import { requireAdmin } from "@/lib/auth";
import { listOrders } from "@/lib/data";
import { aggregateByClient, sumOrders } from "@/lib/analytics";
import { isLowMargin, LOW_MARGIN_THRESHOLD_PCT } from "@/lib/finance";
import { formatNumber, formatPct, formatSAR } from "@/lib/format";

export default async function ClientAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const sortBy = params.sort === "margin" ? "margin" : "profit";

  const orders = await listOrders();
  const totals = sumOrders(orders);
  const clients = aggregateByClient(orders).sort((a, b) =>
    sortBy === "margin" ? a.marginPct - b.marginPct : b.profit - a.profit,
  );

  const lowMarginCount = clients.filter((c) => isLowMargin(c.marginPct)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">تحليل العملاء</h1>
        <ExportButton
          rows={clients.map((c) => ({
            العميل: c.clientName,
            "عدد الطلبات": c.ordersCount,
            المبيعات: c.sales,
            الربح: c.profit,
            "الهامش %": c.marginPct,
          }))}
          fileName="تحليل-العملاء"
          sheetName="العملاء"
        />
      </div>

      {lowMarginCount > 0 ? (
        <div className="rounded-2xl border border-warn-500 bg-warn-50 p-4 text-sm">
          <span className="font-semibold text-warn-700">
            <span className="nums">{lowMarginCount}</span> عميل بهامش أقل من{" "}
            <span className="nums">{LOW_MARGIN_THRESHOLD_PCT}%</span>
          </span>{" "}
          — مميّزون بلون تحذيري في الجدول.
        </div>
      ) : null}

      <Card
        action={
          <div className="flex gap-2 text-sm">
            <Link
              href="?sort=profit"
              className={sortBy === "profit" ? "text-brand-600 font-medium" : "text-gray-500"}
            >
              ترتيب بالربح
            </Link>
            <Link
              href="?sort=margin"
              className={sortBy === "margin" ? "text-brand-600 font-medium" : "text-gray-500"}
            >
              ترتيب بالهامش
            </Link>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-right border-b">
                <th className="py-2 font-medium">العميل</th>
                <th className="py-2 font-medium">الطلبات</th>
                <th className="py-2 font-medium">المبيعات</th>
                <th className="py-2 font-medium">نسبة من المبيعات</th>
                <th className="py-2 font-medium">الربح</th>
                <th className="py-2 font-medium">الهامش</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => {
                const low = isLowMargin(client.marginPct);
                return (
                  <tr
                    key={client.clientId}
                    className={`border-b last:border-0 ${low ? "bg-danger-50" : ""}`}
                  >
                    <td className="py-2">
                      <Link href={`/clients/${client.clientId}`} className="hover:underline">
                        {client.clientName}
                      </Link>
                    </td>
                    <td className="py-2 nums">{formatNumber(client.ordersCount, 0)}</td>
                    <td className="py-2 nums">{formatSAR(client.sales)}</td>
                    <td className="py-2 nums">
                      {formatPct(totals.sales ? (client.sales / totals.sales) * 100 : 0)}
                    </td>
                    <td className="py-2 nums">{formatSAR(client.profit)}</td>
                    <td className={`py-2 nums font-medium ${low ? "text-danger-700" : ""}`}>
                      {formatPct(client.marginPct)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
