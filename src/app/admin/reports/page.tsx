import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/auth";
import { listUsers } from "@/lib/data";

export default async function ReportsIndexPage() {
  await requireAdmin();
  const users = await listUsers();
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const quarter = Math.floor(now.getMonth() / 3) + 1;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">التقارير</h1>

      <Card title="التقرير الشهري">
        <Link href={`/admin/reports/monthly?month=${month}`} className="text-brand-600 hover:underline">
          تقرير شهر <span className="nums">{month}</span>
        </Link>
      </Card>

      <Card title="الكشف الضريبي الربع سنوي">
        <Link
          href={`/admin/reports/vat?year=${now.getFullYear()}&quarter=${quarter}`}
          className="text-brand-600 hover:underline"
        >
          الربع <span className="nums">{quarter}</span> لعام{" "}
          <span className="nums">{now.getFullYear()}</span>
        </Link>
      </Card>

      <Card title="كشوف حساب المندوبين">
        <ul className="space-y-2 text-sm">
          {users.map((user) => (
            <li key={user.id}>
              <Link href={`/admin/reports/rep/${user.id}`} className="text-brand-600 hover:underline">
                كشف حساب: {user.full_name}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
