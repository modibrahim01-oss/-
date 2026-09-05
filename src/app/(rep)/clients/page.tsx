import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { requireUser } from "@/lib/auth";
import { listClients, listOrders } from "@/lib/data";
import { aggregateByClient } from "@/lib/analytics";
import { formatNumber, formatPct, formatSAR } from "@/lib/format";
import { isLowMargin } from "@/lib/finance";

export default async function RepClientsPage() {
  const user = await requireUser();
  const [clients, orders] = await Promise.all([
    listClients(user.profile.id),
    listOrders({ repId: user.profile.id }),
  ]);

  const aggregates = new Map(aggregateByClient(orders).map((a) => [a.clientId, a]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">عملائي</h1>
        <Link
          href="/clients/new"
          className="rounded-lg bg-brand-500 text-white px-3 py-2 text-sm font-medium hover:bg-brand-600"
        >
          عميل جديد
        </Link>
      </div>

      <Card>
        {clients.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">لا يوجد عملاء بعد</p>
        ) : (
          <ul className="divide-y">
            {clients.map((client) => {
              const agg = aggregates.get(client.id);
              return (
                <li key={client.id}>
                  <Link
                    href={`/clients/${client.id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:bg-gray-50 px-1 rounded"
                  >
                    <div>
                      <p className="font-medium">{client.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {client.city ?? "—"} · <span className="nums">{client.phone ?? "—"}</span>
                      </p>
                    </div>
                    <div className="text-left text-sm shrink-0">
                      <p className="nums">{formatSAR(agg?.sales ?? 0)}</p>
                      <p
                        className={`text-xs nums ${
                          agg && isLowMargin(agg.marginPct) ? "text-danger-700" : "text-gray-500"
                        }`}
                      >
                        {formatNumber(agg?.ordersCount ?? 0, 0)} طلب ·{" "}
                        {formatPct(agg?.marginPct ?? 0)}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
