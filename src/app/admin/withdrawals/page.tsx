import { Card } from "@/components/ui/Card";
import { WithdrawalForm } from "@/components/WithdrawalForm";
import { requireAdmin } from "@/lib/auth";
import { listUsers, listWithdrawals } from "@/lib/data";
import { formatDate, formatSAR } from "@/lib/format";

export default async function AdminWithdrawalsPage() {
  await requireAdmin();
  const [users, withdrawals] = await Promise.all([listUsers(), listWithdrawals()]);
  const usersById = new Map(users.map((u) => [u.id, u]));
  const total = withdrawals.reduce((sum, w) => sum + Number(w.amount), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">المسحوبات</h1>

      <Card title="تسجيل مسحوبات">
        <WithdrawalForm users={users.map((u) => ({ id: u.id, full_name: u.full_name }))} />
      </Card>

      <Card
        title="السجل"
        action={
          <span className="text-sm text-gray-500">
            الإجمالي <span className="nums">{formatSAR(total)}</span>
          </span>
        }
      >
        {withdrawals.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">لا توجد مسحوبات</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-right border-b">
                <th className="py-2 font-medium">المندوب</th>
                <th className="py-2 font-medium">المبلغ</th>
                <th className="py-2 font-medium">التاريخ</th>
                <th className="py-2 font-medium">ملاحظة</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w) => (
                <tr key={w.id} className="border-b last:border-0">
                  <td className="py-2">{usersById.get(w.rep_id)?.full_name ?? "—"}</td>
                  <td className="py-2 nums">{formatSAR(Number(w.amount))}</td>
                  <td className="py-2 nums">{formatDate(w.withdrawn_at)}</td>
                  <td className="py-2 text-gray-500">{w.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
