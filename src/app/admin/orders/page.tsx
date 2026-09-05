import { Card } from "@/components/ui/Card";
import { OrdersList } from "@/components/OrdersList";
import { OrderFilters } from "@/components/OrderFilters";
import { ExportButton } from "@/components/ExportButton";
import { requireAdmin } from "@/lib/auth";
import { listClients, listOrders, listUsers } from "@/lib/data";
import { sumOrders } from "@/lib/analytics";
import { formatNumber, formatPct, formatSAR } from "@/lib/format";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const [orders, clients, users] = await Promise.all([
    listOrders({
      repId: params.repId || undefined,
      clientId: params.clientId || undefined,
      status: params.status || undefined,
      from: params.from || undefined,
      to: params.to || undefined,
      search: params.q || undefined,
      needsReviewOnly: params.review === "1",
      maxMarginPct: params.maxMargin ? Number(params.maxMargin) : undefined,
    }),
    listClients(),
    listUsers(),
  ]);

  const totals = sumOrders(orders);
  const reps = users.filter((u) => u.role === "rep");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">كل الطلبات</h1>
        <ExportButton
          rows={orders.map((o) => ({
            "رقم الطلب": o.order_number,
            العميل: o.client?.name ?? "",
            المندوب: o.rep?.full_name ?? "",
            التاريخ: o.order_date ?? "",
            "تكلفة المصنع": o.factory_cost,
            "سعر العميل": o.client_price,
            الربح: o.profit,
            "الربح بدون ضريبة": o.profit_ex_vat,
            "حصة المندوب": o.rep_share,
            "حصة الشركة": o.company_share,
            "الهامش %": o.margin_pct,
          }))}
          fileName="كل-الطلبات"
          sheetName="الطلبات"
        />
      </div>

      <Card>
        <OrderFilters clients={clients} reps={reps} />
      </Card>

      <Card
        title={`${formatNumber(totals.count, 0)} طلب`}
        action={
          <span className="text-sm text-gray-500">
            المبيعات <span className="nums">{formatSAR(totals.sales)}</span> · الربح{" "}
            <span className="nums">{formatSAR(totals.profit)}</span> · الهامش{" "}
            <span className="nums">{formatPct(totals.avgMarginPct)}</span>
          </span>
        }
      >
        <OrdersList orders={orders} showRep basePath="/orders" />
      </Card>
    </div>
  );
}
