import { Card } from "@/components/ui/Card";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export default async function NotificationsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.profile.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const notifications = (data ?? []) as Array<{
    id: string;
    title: string;
    body: string | null;
    created_at: string;
    read_at: string | null;
  }>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">التنبيهات</h1>
      <Card>
        {notifications.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">لا توجد تنبيهات</p>
        ) : (
          <ul className="divide-y">
            {notifications.map((n) => (
              <li key={n.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-sm ${n.read_at ? "text-gray-600" : "font-medium"}`}>
                      {n.title}
                    </p>
                    {n.body ? <p className="text-xs text-gray-500 mt-0.5">{n.body}</p> : null}
                  </div>
                  <span className="text-xs text-gray-400 nums shrink-0">
                    {formatDate(n.created_at)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
