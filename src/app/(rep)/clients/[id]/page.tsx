import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { OrdersList } from "@/components/OrdersList";
import { requireUser } from "@/lib/auth";
import { getClient, listOrders } from "@/lib/data";
import { sumOrders } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/server";
import { formatNumber, formatPct, formatSAR } from "@/lib/format";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const client = await getClient(id);
  if (!client) notFound();

  const orders = await listOrders({ clientId: id });
  const totals = sumOrders(orders);

  // المتبقي على العميل = إجمالي أسعار طلباته − ما حُصِّل منها
  const supabase = await createClient();
  const orderIds = orders.map((o) => o.id);
  let paidTotal = 0;
  if (orderIds.length > 0) {
    const { data } = await supabase.from("payments").select("amount").in("order_id", orderIds);
    paidTotal = (data ?? []).reduce(
      (sum: number, p: { amount: number }) => sum + Number(p.amount),
      0,
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">{client.name}</h1>
        <p className="text-sm text-gray-500">
          {client.city ?? "—"} · <span className="nums">{client.phone ?? "—"}</span>
          {client.vat_number ? (
            <>
              {" "}
              · الرقم الضريبي <span className="nums">{client.vat_number}</span>
            </>
          ) : null}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="عدد الطلبات" value={formatNumber(totals.count, 0)} />
        <StatCard label="إجمالي المشتريات" value={formatSAR(totals.sales)} />
        <StatCard
          label="الربح منه"
          value={formatSAR(totals.profit)}
          hint={`الهامش ${formatPct(totals.avgMarginPct)}`}
          tone={totals.avgMarginPct < 12 ? "warn" : "good"}
        />
        <StatCard
          label="المتبقي عليه"
          value={formatSAR(totals.sales - paidTotal)}
          tone={totals.sales - paidTotal > 0 ? "bad" : "good"}
        />
      </div>

      <Card title="تاريخ الطلبات معه">
        <OrdersList orders={orders} basePath="/orders" />
      </Card>
    </div>
  );
}
