import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ImportWizard } from "@/components/ImportWizard";
import { requireAdmin } from "@/lib/auth";
import { listUsers } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import type { ParsedOrderRow } from "@/lib/import/parseSeed";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const batchId = params.batch;

  const supabase = await createClient();
  const users = await listUsers();

  const { data: batches } = await supabase
    .from("import_batches")
    .select("*")
    .order("uploaded_at", { ascending: false })
    .limit(10);

  let stagedRows: { id: string; raw: ParsedOrderRow; decision: string | null }[] = [];
  if (batchId) {
    const { data } = await supabase
      .from("import_rows")
      .select("id, raw, decision")
      .eq("batch_id", batchId)
      .order("src_row");
    stagedRows = (data ?? []) as typeof stagedRows;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">الاستيراد من الإكسل</h1>

      <ImportWizard
        batchId={batchId ?? null}
        rows={stagedRows}
        users={users.map((u) => ({ id: u.id, full_name: u.full_name }))}
        defaultRepId={admin.profile.id}
      />

      {(batches ?? []).length > 0 ? (
        <Card title="دفعات سابقة">
          <ul className="divide-y text-sm">
            {(batches ?? []).map((batch: {
              id: string;
              file_name: string;
              status: string;
              uploaded_at: string;
            }) => (
              <li key={batch.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/admin/import?batch=${batch.id}`} className="text-brand-600 hover:underline">
                  {batch.file_name}
                </Link>
                <span className="text-gray-500">
                  {batch.status === "confirmed"
                    ? "مؤكَّدة"
                    : batch.status === "discarded"
                      ? "ملغاة"
                      : "بانتظار المراجعة"}
                </span>
                <span className="text-gray-400 nums">{formatDate(batch.uploaded_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
