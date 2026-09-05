import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { OrderForm } from "@/components/OrderForm";
import { createOrderAction } from "@/lib/actions/orders";
import { requireUser } from "@/lib/auth";
import { listClients } from "@/lib/data";

export default async function NewOrderPage() {
  const user = await requireUser();
  const clients = await listClients(user.profile.id);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">طلب جديد</h1>

      {clients.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-600">
            لا يوجد لديك عملاء بعد.{" "}
            <Link href="/clients/new" className="text-brand-600 hover:underline">
              أضف عميلًا أولًا
            </Link>
          </p>
        </Card>
      ) : (
        <Card>
          <OrderForm
            clients={clients}
            repSharePct={user.profile.share_pct}
            action={createOrderAction}
          />
        </Card>
      )}
    </div>
  );
}
