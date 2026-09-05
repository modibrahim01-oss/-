import { Card } from "@/components/ui/Card";
import { UserForm, UserRowEditor } from "@/components/UserForms";
import { requireAdmin } from "@/lib/auth";
import { listUsers } from "@/lib/data";
import { formatDate } from "@/lib/format";

export default async function AdminUsersPage() {
  await requireAdmin();
  const users = await listUsers();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">المستخدمون</h1>

      <Card title="حساب جديد">
        <UserForm />
      </Card>

      <Card title="الحسابات الحالية">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-right border-b">
                <th className="py-2 font-medium">الاسم</th>
                <th className="py-2 font-medium">الدور</th>
                <th className="py-2 font-medium">الجوال</th>
                <th className="py-2 font-medium">تاريخ الإنشاء</th>
                <th className="py-2 font-medium">النسبة والحالة</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b last:border-0">
                  <td className="py-2">{user.full_name}</td>
                  <td className="py-2">{user.role === "admin" ? "مشرف" : "مندوب"}</td>
                  <td className="py-2 nums">{user.phone ?? "—"}</td>
                  <td className="py-2 nums">{formatDate(user.created_at)}</td>
                  <td className="py-2">
                    <UserRowEditor
                      userId={user.id}
                      sharePct={user.share_pct}
                      isActive={user.is_active}
                    />
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
