import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { OrdersList } from "@/components/OrdersList";
import { OrderFilters } from "@/components/OrderFilters";
import { requireUser } from "@/lib/auth";
import { listClients, listOrders } from "@/lib/data";
import { sumOrders } from "@/lib/analytics";
import { formatNumber, formatSAR } from "@/lib/format";

export default async function RepOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const orders = await listOrders({
    repId: user.profile.id,
    clientId: params.clientId || undefined,
    status: params.status || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
    search: params.q || undefined,
    needsReviewOnly: params.review === "1",
  });

  const clients = await listClients(user.profile.id);
  const totals = sumOrders(orders);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">طلباتي</h1>
        <Link
          href="/orders/new"
          className="rounded-lg bg-brand-500 text-white px-3 py-2 text-sm font-medium hover:bg-brand-600"
        >
          طلب جديد
        </Link>
      </div>

      <Card>
        <OrderFilters clients={clients} />
      </Card>

      <Card
        title={`${formatNumber(totals.count, 0)} طلب`}
        action={
          <span className="text-sm text-gray-500">
            المبيعات <span className="nums">{formatSAR(totals.sales)}</span> · الربح{" "}
            <span className="nums">{formatSAR(totals.profit)}</span>
          </span>
        }
      >
        <OrdersList orders={orders} basePath="/orders" />
      </Card>
    </div>
  );
}
