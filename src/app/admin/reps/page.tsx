import { Card } from "@/components/ui/Card";
import { ExportButton } from "@/components/ExportButton";
import { requireAdmin } from "@/lib/auth";
import { listOrders, listUsers, listWithdrawals } from "@/lib/data";
import { sumOrders } from "@/lib/analytics";
import { formatNumber, formatPct, formatSAR } from "@/lib/format";

export default async function RepsPerformancePage() {
  await requireAdmin();

  const [users, orders, withdrawals] = await Promise.all([
    listUsers(),
    listOrders(),
    listWithdrawals(),
  ]);

  const reps = users.filter((u) => u.role === "rep" || u.role === "admin");

  const rows = reps.map((rep) => {
    const repOrders = orders.filter((o) => o.rep_id === rep.id);
    const totals = sumOrders(repOrders);
    const completedShare = repOrders
      .filter((o) => o.status === "completed")
      .reduce((sum, o) => sum + o.rep_share, 0);
    const withdrawn = withdrawals
      .filter((w) => w.rep_id === rep.id)
      .reduce((sum, w) => sum + Number(w.amount), 0);

    return {
      rep,
      totals,
      completedShare,
      withdrawn,
      balance: completedShare - withdrawn,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">أداء المندوبين</h1>
        <ExportButton
          rows={rows.map((r) => ({
            المندوب: r.rep.full_name,
            "عدد الطلبات": r.totals.count,
            المبيعات: r.totals.sales,
            الربح: r.totals.profit,
            "متوسط الهامش %": r.totals.avgMarginPct,
            "العمولة المستحقة": r.completedShare,
            المسحوبات: r.withdrawn,
            الرصيد: r.balance,
          }))}
          fileName="أداء-المندوبين"
          sheetName="المندوبون"
        />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-right border-b">
                <th className="py-2 font-medium">المندوب</th>
                <th className="py-2 font-medium">النسبة</th>
                <th className="py-2 font-medium">الطلبات</th>
                <th className="py-2 font-medium">المبيعات</th>
                <th className="py-2 font-medium">الربح</th>
                <th className="py-2 font-medium">متوسط الهامش</th>
                <th className="py-2 font-medium">العمولة المستحقة</th>
                <th className="py-2 font-medium">المسحوبات</th>
                <th className="py-2 font-medium">الرصيد</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ rep, totals, completedShare, withdrawn, balance }) => (
                <tr key={rep.id} className="border-b last:border-0">
                  <td className="py-2">
                    {rep.full_name}
                    {rep.role === "admin" ? (
                      <span className="text-xs text-gray-400 mr-1">(مشرف)</span>
                    ) : null}
                  </td>
                  <td className="py-2 nums">{formatPct(rep.share_pct, 0)}</td>
                  <td className="py-2 nums">{formatNumber(totals.count, 0)}</td>
                  <td className="py-2 nums">{formatSAR(totals.sales)}</td>
                  <td className="py-2 nums">{formatSAR(totals.profit)}</td>
                  <td className="py-2 nums">{formatPct(totals.avgMarginPct)}</td>
                  <td className="py-2 nums">{formatSAR(completedShare)}</td>
                  <td className="py-2 nums">{formatSAR(withdrawn)}</td>
                  <td className={`py-2 nums ${balance < 0 ? "text-danger-700" : "text-brand-600"}`}>
                    {formatSAR(balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
