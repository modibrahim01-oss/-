import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { MonthlyChart } from "@/components/MonthlyChart";
import { requireAdmin } from "@/lib/auth";
import { listAdjustments, listOrders } from "@/lib/data";
import { aggregateByClient, buildMonthlySeries, isInCurrentMonth, sumOrders } from "@/lib/analytics";
import { computeClientConcentration, isLowMargin } from "@/lib/finance";
import { formatNumber, formatPct, formatSAR } from "@/lib/format";

export default async function AdminDashboardPage() {
  await requireAdmin();

  const [orders, adjustments] = await Promise.all([listOrders(), listAdjustments()]);
  const totals = sumOrders(orders);
  const monthTotals = sumOrders(orders.filter((o) => isInCurrentMonth(o.order_date)));
  const series = buildMonthlySeries(orders, 12);

  const clientAggregates = aggregateByClient(orders);
  const { topClientPct, top3ClientsPct } = computeClientConcentration(
    clientAggregates.map((c) => c.sales),
    totals.sales,
  );
  const topClient = clientAggregates[0];

  const needsReview = orders.filter((o) => o.needs_review);
  const pendingAdjustments = adjustments.filter((a) => a.status === "pending_review");
  const lowMarginClients = clientAggregates.filter((c) => isLowMargin(c.marginPct));

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">لوحة الشركة</h1>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="إجمالي المبيعات" value={formatSAR(totals.sales)} />
        <StatCard label="إجمالي التكلفة" value={formatSAR(totals.cost)} />
        <StatCard label="إجمالي الربح" value={formatSAR(totals.profit)} tone="good" />
        <StatCard
          label="متوسط الهامش"
          value={formatPct(totals.avgMarginPct)}
          tone={totals.avgMarginPct < 15 ? "warn" : "good"}
        />
        <StatCard
          label="الضريبة المستحقة"
          value={formatSAR(totals.vatDue)}
          hint="15% من القيمة المضافة"
        />
      </div>

      {/* مؤشر تركّز العملاء — مخاطرة حقيقية يجب أن تظهر كتنبيه */}
      {topClient && topClientPct >= 25 ? (
        <div className="rounded-2xl border border-warn-500 bg-warn-50 p-4">
          <h2 className="font-semibold text-warn-700">تحذير: تركّز العملاء</h2>
          <p className="text-sm text-gray-700 mt-1">
            أكبر عميل (<span className="font-medium">{topClient.clientName}</span>) يمثّل{" "}
            <span className="nums font-medium">{formatPct(topClientPct)}</span> من المبيعات بهامش{" "}
            <span className="nums font-medium">{formatPct(topClient.marginPct)}</span>. أكبر 3 عملاء
            يمثّلون <span className="nums font-medium">{formatPct(top3ClientsPct)}</span> من
            المبيعات.
          </p>
        </div>
      ) : null}

      {needsReview.length > 0 || pendingAdjustments.length > 0 ? (
        <div className="rounded-2xl border border-danger-500 bg-danger-50 p-4">
          <h2 className="font-semibold text-danger-700">بنود تحتاج مراجعة</h2>
          <ul className="text-sm text-gray-700 mt-1 space-y-1">
            {needsReview.length > 0 ? (
              <li>
                <Link href="/admin/orders?review=1" className="hover:underline">
                  <span className="nums font-medium">{needsReview.length}</span> طلب بحاجة إكمال بيانات
                  (تواريخ مفقودة أو تعارضات)
                </Link>
              </li>
            ) : null}
            {pendingAdjustments.length > 0 ? (
              <li>
                <span className="nums font-medium">{pendingAdjustments.length}</span> قيد تسوية معلّق
                بإجمالي{" "}
                <span className="nums font-medium">
                  {formatSAR(pendingAdjustments.reduce((s, a) => s + Number(a.profit), 0))}
                </span>{" "}
                بدون عميل أو تكلفة
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="طلبات هذا الشهر" value={formatNumber(monthTotals.count, 0)} />
        <StatCard label="مبيعات هذا الشهر" value={formatSAR(monthTotals.sales)} />
        <StatCard label="ربح هذا الشهر" value={formatSAR(monthTotals.profit)} />
        <StatCard
          label="عملاء بهامش منخفض"
          value={formatNumber(lowMarginClients.length, 0)}
          hint="أقل من 12%"
          tone={lowMarginClients.length > 0 ? "warn" : "good"}
        />
      </div>

      <Card title="المقارنة الشهرية (آخر 12 شهرًا)">
        <MonthlyChart data={series} />
      </Card>

      <Card
        title="أكبر العملاء"
        action={
          <Link href="/admin/clients" className="text-sm text-brand-600 hover:underline">
            تحليل العملاء
          </Link>
        }
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-right border-b">
              <th className="py-2 font-medium">العميل</th>
              <th className="py-2 font-medium">المبيعات</th>
              <th className="py-2 font-medium">النسبة</th>
              <th className="py-2 font-medium">الهامش</th>
            </tr>
          </thead>
          <tbody>
            {clientAggregates.slice(0, 5).map((client) => (
              <tr key={client.clientId} className="border-b last:border-0">
                <td className="py-2">{client.clientName}</td>
                <td className="py-2 nums">{formatSAR(client.sales)}</td>
                <td className="py-2 nums">
                  {formatPct(totals.sales ? (client.sales / totals.sales) * 100 : 0)}
                </td>
                <td className={`py-2 nums ${isLowMargin(client.marginPct) ? "text-danger-700" : ""}`}>
                  {formatPct(client.marginPct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
