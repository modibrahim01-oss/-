"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeClientName } from "@/lib/normalize";
import { DEFAULT_REP_SHARE_PCT } from "@/lib/finance";
import {
  LEGACY_WITHDRAWALS,
  parseOrdersCsv,
  type ParsedOrderRow,
  type RowDecision,
} from "@/lib/import/parseSeed";

export interface PreviewState {
  error: string | null;
  batchId?: string;
}

/**
 * الخطوة 1→2: رفع الملف وتحليله وتخزينه في جداول المعاينة فقط.
 * لا يُكتب أي صف في orders/clients هنا (القسم 8: لا تستورد شيئًا قبل أن
 * يرى المشرف المعاينة).
 */
export async function previewImportAction(
  _prev: PreviewState,
  formData: FormData,
): Promise<PreviewState> {
  const admin = await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "اختر ملف CSV للرفع" };
  }

  const text = await file.text();
  let report;
  try {
    report = parseOrdersCsv(text);
  } catch {
    return { error: "تعذّر قراءة الملف — تأكد أنه ملف CSV صالح" };
  }

  if (report.rows.length === 0) {
    return { error: "الملف لا يحتوي على أي صفوف" };
  }

  const supabase = await createClient();
  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({ file_name: file.name, uploaded_by: admin.profile.id, status: "previewed" })
    .select("id")
    .single();

  if (batchError || !batch) {
    return { error: `تعذّر إنشاء دفعة الاستيراد: ${batchError?.message ?? ""}` };
  }

  const rowsPayload = report.rows.map((row) => ({
    batch_id: batch.id,
    src_row: row.srcRow,
    raw: row as unknown as Record<string, unknown>,
    client_name_raw: row.clientName || null,
    client_name_normalized: row.clientNameNormalized || null,
    classification: row.classification,
    issue_note: row.issueNote,
    decision: row.suggestedDecision,
  }));

  const { error: rowsError } = await supabase.from("import_rows").insert(rowsPayload);
  if (rowsError) {
    return { error: `تعذّر حفظ صفوف المعاينة: ${rowsError.message}` };
  }

  revalidatePath("/admin/import");
  return { error: null, batchId: batch.id };
}

export interface ConfirmState {
  error: string | null;
  imported?: number;
  adjustments?: number;
  skipped?: number;
}

/**
 * الخطوة 3: تنفيذ قرارات المشرف. يُنشئ العملاء الناقصين، ثم الطلبات،
 * ثم بنود التسوية. الأرقام تُعاد حسابها دائمًا بنسبة 50% ولا تُنسخ من الملف.
 */
export async function confirmImportAction(
  batchId: string,
  _prev: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const repId = String(formData.get("repId") || admin.profile.id);
  const includeLegacyWithdrawals = formData.get("legacyWithdrawals") === "1";

  const { data: stagedRows, error: rowsError } = await supabase
    .from("import_rows")
    .select("*")
    .eq("batch_id", batchId);

  if (rowsError || !stagedRows) {
    return { error: "تعذّر قراءة صفوف المعاينة" };
  }

  // قرارات المشرف من النموذج تتقدّم على الاقتراح الافتراضي
  const decisions = new Map<string, RowDecision>();
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("decision_")) {
      decisions.set(key.replace("decision_", ""), value as RowDecision);
    }
  }

  let imported = 0;
  let adjustments = 0;
  let skipped = 0;

  for (const staged of stagedRows as Array<{
    id: string;
    raw: ParsedOrderRow;
    decision: RowDecision | null;
  }>) {
    const decision = decisions.get(staged.id) ?? staged.decision ?? "skip";
    const row = staged.raw;

    if (decision === "skip") {
      skipped++;
      await supabase.from("import_rows").update({ decision: "skip" }).eq("id", staged.id);
      continue;
    }

    if (decision === "import_as_adjustment") {
      const profit = row.statedProfit ?? 0;
      const { data: adjustment } = await supabase
        .from("adjustments")
        .insert({
          profit,
          profit_ex_vat: profit / 1.15,
          rep_share_pct: DEFAULT_REP_SHARE_PCT,
          status: "pending_review",
          note: row.issueNote ?? row.rawNote,
          source: "import",
          created_by: admin.profile.id,
        })
        .select("id")
        .single();

      adjustments++;
      await supabase
        .from("import_rows")
        .update({ decision, created_adjustment_id: adjustment?.id ?? null })
        .eq("id", staged.id);
      continue;
    }

    // decision === "import"
    if (row.factoryCost === null || row.clientPrice === null || !row.clientName) {
      skipped++;
      await supabase.from("import_rows").update({ decision: "skip" }).eq("id", staged.id);
      continue;
    }

    const clientId = await ensureClient(supabase, row.clientName, repId);
    if (!clientId) {
      skipped++;
      continue;
    }

    const needsReview =
      row.classification === "missing_date" ||
      row.classification === "conflict" ||
      row.classification === "duplicate";

    const { data: order } = await supabase
      .from("orders")
      .insert({
        client_id: clientId,
        rep_id: repId,
        order_date: row.orderDate,
        // الملف القديم لا يفصّل التكلفة (كرتون/قالب/كليشة)، فتُسجَّل
        // كاملة في cost_carton مع ملاحظة توضّح ذلك.
        cost_carton: row.factoryCost,
        client_price: row.clientPrice,
        rep_share_pct: DEFAULT_REP_SHARE_PCT,
        status: "completed",
        needs_review: needsReview,
        review_reason: needsReview ? row.issueNote : null,
        import_note: `مستورد من الإكسل (صف ${row.srcRow}) — التكلفة مسجّلة كاملة في بند الكرتون`,
      })
      .select("id")
      .single();

    imported++;
    await supabase
      .from("import_rows")
      .update({ decision, created_order_id: order?.id ?? null })
      .eq("id", staged.id);
  }

  if (includeLegacyWithdrawals) {
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("withdrawals").insert(
      LEGACY_WITHDRAWALS.map((w) => ({
        rep_id: repId,
        amount: w.amount,
        withdrawn_at: today,
        note: w.note,
        created_by: admin.profile.id,
      })),
    );
  }

  await supabase
    .from("import_batches")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      confirmed_by: admin.profile.id,
    })
    .eq("id", batchId);

  revalidatePath("/admin/import");
  revalidatePath("/admin/orders");
  revalidatePath("/admin");

  return { error: null, imported, adjustments, skipped };
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** يعيد معرّف عميل موجود بنفس الاسم المطبَّع، وإلا ينشئه. */
async function ensureClient(
  supabase: SupabaseServerClient,
  rawName: string,
  ownerId: string,
): Promise<string | null> {
  const normalized = normalizeClientName(rawName);

  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("name_normalized", normalized)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created } = await supabase
    .from("clients")
    .insert({
      name: rawName,
      name_normalized: normalized,
      owner_id: ownerId,
      notes: "مستورد من ملف الإكسل القديم",
    })
    .select("id")
    .single();

  return created?.id ?? null;
}

export async function discardBatchAction(batchId: string) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("import_batches").update({ status: "discarded" }).eq("id", batchId);
  revalidatePath("/admin/import");
}
