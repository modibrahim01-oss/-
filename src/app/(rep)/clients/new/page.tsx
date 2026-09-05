import { Card } from "@/components/ui/Card";
import { ClientForm } from "@/components/ClientForm";
import { requireUser } from "@/lib/auth";

export default async function NewClientPage() {
  await requireUser();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">عميل جديد</h1>
      <Card>
        <ClientForm />
      </Card>
    </div>
  );
}
