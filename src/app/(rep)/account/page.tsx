import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { requireUser } from "@/lib/auth";
import { getRepBalance } from "@/lib/data";
import { monthLabel } from "@/lib/analytics";
import { formatDate, formatPct, formatSAR } from "@/lib/format";

export default async function RepAccountPage() {
  const user = await requireUser();
  const { orders, withdrawals, withdrawn, balance, completedShare, allShare } =
    await getRepBalance(user.profile.id);

  // العمولات شهرًا بشهر
  const byMonth = new Map<string, { share: number; count: number }>();
  for (const order of orders) {
    const key = order.order_date?.slice(0, 7) ?? "بدون تاريخ";
    const bucket = byMonth.get(key) ?? { share: 0, count: 0 };
    bucket.share += order.rep_share;
    bucket.count += 1;
    byMonth.set(key, bucket);
  }
  const months = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">حسابي</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="نسبتي"
          value={formatPct(user.profile.share_pct, 0)}
          hint="من الربح بعد الضريبة"
        />
        <StatCard
          label="عمولتي المستحقة"
          value={formatSAR(completedShare)}
          hint="من الطلبات المكتملة"
        />
        <StatCard label="إجمالي مسحوباتي" value={formatSAR(withdrawn)} />
        <StatCard
          label="الرصيد المتبقي"
          value={formatSAR(balance)}
          tone={balance < 0 ? "bad" : "good"}
        />
      </div>

      <Card title="عمولاتي شهرًا بشهر">
        {months.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">لا توجد بيانات</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-right border-b">
                <th className="py-2 font-medium">الشهر</th>
                <th className="py-2 font-medium">عدد الطلبات</th>
                <th className="py-2 font-medium">حصتي</th>
              </tr>
            </thead>
            <tbody>
              {months.map(([key, value]) => (
                <tr key={key} className="border-b last:border-0">
                  <td className="py-2">{key === "بدون تاريخ" ? key : monthLabel(key)}</td>
                  <td className="py-2 nums">{value.count}</td>
                  <td className="py-2 nums">{formatSAR(value.share)}</td>
                </tr>
              ))}
              <tr className="font-medium">
                <td className="py-2">الإجمالي (كل الطلبات)</td>
                <td className="py-2 nums">{orders.length}</td>
                <td className="py-2 nums">{formatSAR(allShare)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </Card>

      <Card title="مسحوباتي">
        {withdrawals.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">لا توجد مسحوبات</p>
        ) : (
          <ul className="divide-y text-sm">
            {withdrawals.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 py-2">
                <span className="nums font-medium">{formatSAR(Number(w.amount))}</span>
                <span className="text-gray-500 grow px-2 truncate">{w.note ?? "—"}</span>
                <span className="text-gray-400 nums shrink-0">{formatDate(w.withdrawn_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
