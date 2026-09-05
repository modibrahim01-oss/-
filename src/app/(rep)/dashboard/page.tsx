import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { MonthlyChart } from "@/components/MonthlyChart";
import { OrdersList } from "@/components/OrdersList";
import { requireUser } from "@/lib/auth";
import { getRepBalance } from "@/lib/data";
import { buildMonthlySeries, isInCurrentMonth, sumOrders } from "@/lib/analytics";
import { formatNumber, formatPct, formatSAR } from "@/lib/format";

export default async function RepDashboardPage() {
  const user = await requireUser();
  const { orders, withdrawn, balance, completedShare } = await getRepBalance(user.profile.id);

  const monthOrders = orders.filter((o) => isInCurrentMonth(o.order_date));
  const monthTotals = sumOrders(monthOrders);
  const series = buildMonthlySeries(orders, 6);
  const recent = orders.slice(0, 5);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">لوحتي</h1>
        <p className="text-sm text-gray-500">أهلًا {user.profile.full_name}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="عدد طلباتي هذا الشهر" value={formatNumber(monthTotals.count, 0)} />
        <StatCard label="مبيعاتي هذا الشهر" value={formatSAR(monthTotals.sales)} />
        <StatCard
          label="ربحي هذا الشهر"
          value={formatSAR(monthTotals.profit)}
          hint={`الهامش ${formatPct(monthTotals.avgMarginPct)}`}
          tone="good"
        />
        <StatCard
          label="عمولتي المستحقة"
          value={formatSAR(completedShare)}
          hint={`نسبتي ${formatPct(user.profile.share_pct, 0)} من الربح بعد الضريبة`}
        />
        <StatCard
          label="المتبقي لي بعد المسحوبات"
          value={formatSAR(balance)}
          hint={`المسحوبات ${formatSAR(withdrawn)}`}
          tone={balance < 0 ? "bad" : "good"}
        />
      </div>

      <Card title="آخر 6 أشهر">
        <MonthlyChart data={series} />
      </Card>

      <Card
        title="آخر طلباتي"
        action={
          <Link href="/orders" className="text-sm text-brand-600 hover:underline">
            عرض الكل
          </Link>
        }
      >
        <OrdersList orders={recent} showRep={false} basePath="/orders" />
      </Card>
    </div>
  );
}
