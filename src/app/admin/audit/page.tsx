import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/auth";
import { listUsers } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

const TABLE_LABELS: Record<string, string> = {
  orders: "الطلبات",
  clients: "العملاء",
  payments: "المدفوعات",
  withdrawals: "المسحوبات",
};

const ACTION_LABELS: Record<string, string> = {
  insert: "إنشاء",
  update: "تعديل",
  delete: "حذف",
};

/** يستخرج الحقول التي تغيّرت فعليًا بين القيمتين القديمة والجديدة. */
function changedFields(
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null,
): { field: string; from: unknown; to: unknown }[] {
  if (!oldValues || !newValues) return [];
  const skip = new Set(["updated_at", "created_at"]);
  return Object.keys(newValues)
    .filter((key) => !skip.has(key) && String(oldValues[key]) !== String(newValues[key]))
    .map((key) => ({ field: key, from: oldValues[key], to: newValues[key] }));
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const supabase = await createClient();
  let query = supabase
    .from("audit_log")
    .select("*")
    .order("changed_at", { ascending: false })
    .limit(200);

  if (params.table) query = query.eq("table_name", params.table);
  if (params.userId) query = query.eq("changed_by", params.userId);
  if (params.from) query = query.gte("changed_at", params.from);
  if (params.to) query = query.lte("changed_at", `${params.to}T23:59:59`);

  const [{ data: entries }, users] = await Promise.all([query, listUsers()]);
  const usersById = new Map(users.map((u) => [u.id, u.full_name]));

  const rows = (entries ?? []) as Array<{
    id: number;
    table_name: string;
    record_id: string;
    action: string;
    changed_by: string | null;
    changed_at: string;
    old_values: Record<string, unknown> | null;
    new_values: Record<string, unknown> | null;
  }>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">سجل التدقيق</h1>

      <Card>
        <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label htmlFor="table" className="block text-xs text-gray-500 mb-1">
              الجدول
            </label>
            <select
              id="table"
              name="table"
              defaultValue={params.table ?? ""}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-white"
            >
              <option value="">الكل</option>
              {Object.entries(TABLE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="userId" className="block text-xs text-gray-500 mb-1">
              المستخدم
            </label>
            <select
              id="userId"
              name="userId"
              defaultValue={params.userId ?? ""}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-white"
            >
              <option value="">الكل</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="from" className="block text-xs text-gray-500 mb-1">
              من
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={params.from ?? ""}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="to" className="block text-xs text-gray-500 mb-1">
              إلى
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={params.to ?? ""}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <button type="submit" className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm">
            فلترة
          </button>
        </form>
      </Card>

      <Card title={`آخر ${rows.length} حركة`}>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">لا توجد حركات</p>
        ) : (
          <ul className="divide-y">
            {rows.map((entry) => {
              const changes = changedFields(entry.old_values, entry.new_values);
              return (
                <li key={entry.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {ACTION_LABELS[entry.action] ?? entry.action} في{" "}
                      {TABLE_LABELS[entry.table_name] ?? entry.table_name}
                    </span>
                    <span className="text-gray-500">
                      {entry.changed_by ? usersById.get(entry.changed_by) ?? "—" : "النظام"}
                    </span>
                    <span className="text-gray-400 nums">{formatDate(entry.changed_at)}</span>
                  </div>
                  {changes.length > 0 ? (
                    <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
                      {changes.slice(0, 6).map((change) => (
                        <li key={change.field}>
                          <span className="text-gray-500">{change.field}:</span>{" "}
                          <span className="nums line-through">{String(change.from ?? "—")}</span> ←{" "}
                          <span className="nums font-medium">{String(change.to ?? "—")}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
