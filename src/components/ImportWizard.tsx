"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Card } from "@/components/ui/Card";
import {
  confirmImportAction,
  previewImportAction,
  type ConfirmState,
  type PreviewState,
} from "@/lib/actions/import";
import {
  LEGACY_WITHDRAWALS_TOTAL,
  type ParsedOrderRow,
  type RowClassification,
} from "@/lib/import/parseSeed";
import { formatNumber, formatPct, formatSAR } from "@/lib/format";

const CLASSIFICATION_LABELS: Record<RowClassification, string> = {
  ok: "جاهز",
  missing_date: "تاريخ مفقود",
  conflict: "تعارض أرقام",
  duplicate: "تكرار محتمل",
  adjustment: "قيد تسوية",
  error: "صف تالف",
};

const CLASSIFICATION_STYLES: Record<RowClassification, string> = {
  ok: "bg-brand-50 text-brand-700",
  missing_date: "bg-warn-50 text-warn-700",
  conflict: "bg-warn-50 text-warn-700",
  duplicate: "bg-danger-50 text-danger-700",
  adjustment: "bg-danger-50 text-danger-700",
  error: "bg-gray-100 text-gray-600",
};

const previewInitial: PreviewState = { error: null };
const confirmInitial: ConfirmState = { error: null };

export function ImportWizard({
  batchId,
  rows,
  users,
  defaultRepId,
}: {
  batchId: string | null;
  rows: { id: string; raw: ParsedOrderRow; decision: string | null }[];
  users: { id: string; full_name: string }[];
  defaultRepId: string;
}) {
  const step = batchId ? (rows.length > 0 ? 2 : 3) : 1;

  return (
    <div className="space-y-4">
      <Steps current={step} />
      {batchId ? (
        <PreviewStep batchId={batchId} rows={rows} users={users} defaultRepId={defaultRepId} />
      ) : (
        <UploadStep />
      )}
    </div>
  );
}

function Steps({ current }: { current: number }) {
  const steps = ["رفع الملف", "معاينة المشاكل", "تأكيد الاستيراد"];
  return (
    <ol className="flex gap-2">
      {steps.map((label, index) => (
        <li
          key={label}
          className={clsx(
            "flex-1 rounded-xl border px-3 py-2 text-sm text-center",
            index + 1 === current
              ? "bg-brand-50 border-brand-500 text-brand-700 font-medium"
              : "bg-white text-gray-500",
          )}
        >
          <span className="nums">{index + 1}</span>. {label}
        </li>
      ))}
    </ol>
  );
}

function UploadStep() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(previewImportAction, previewInitial);

  if (state.batchId) {
    router.push(`/admin/import?batch=${state.batchId}`);
  }

  return (
    <Card title="الخطوة 1: رفع ملف CSV">
      <form action={formAction} className="space-y-3">
        <input
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="text-sm file:ml-2 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5"
        />
        <div className="text-xs text-gray-500 space-y-1">
          <p>
            الأعمدة المتوقّعة في الملف (أسماؤها كما هي في صف الترويسة): رقم الصف
            الأصلي <code className="nums">src_row</code>، تاريخ التعميد{" "}
            <code className="nums">order_date</code>، اسم العميل{" "}
            <code className="nums">client_name</code>، تكلفة المصنع{" "}
            <code className="nums">factory_cost</code>، سعر العميل{" "}
            <code className="nums">client_price</code>، والربح{" "}
            <code className="nums">profit</code>.
          </p>
          <p>لن يُكتب أي صف في قاعدة البيانات قبل مراجعتك للمعاينة.</p>
        </div>
        {state.error ? <p className="text-sm text-danger-700">{state.error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-500 text-white px-5 py-2.5 font-medium hover:bg-brand-600 disabled:opacity-60"
        >
          {pending ? "جارٍ التحليل..." : "تحليل الملف"}
        </button>
      </form>
    </Card>
  );
}

function PreviewStep({
  batchId,
  rows,
  users,
  defaultRepId,
}: {
  batchId: string;
  rows: { id: string; raw: ParsedOrderRow; decision: string | null }[];
  users: { id: string; full_name: string }[];
  defaultRepId: string;
}) {
  const boundAction = confirmImportAction.bind(null, batchId);
  const [state, formAction, pending] = useActionState(boundAction, confirmInitial);

  if (state.imported !== undefined) {
    return (
      <Card title="اكتمل الاستيراد">
        <ul className="text-sm space-y-1">
          <li>
            طلبات مستوردة: <span className="nums font-medium">{state.imported}</span>
          </li>
          <li>
            بنود تسوية معلّقة: <span className="nums font-medium">{state.adjustments}</span>
          </li>
          <li>
            صفوف متجاوَزة: <span className="nums font-medium">{state.skipped}</span>
          </li>
        </ul>
      </Card>
    );
  }

  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.raw.classification] = (acc[row.raw.classification] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <form action={formAction} className="space-y-4">
      <Card title="الخطوة 2: معاينة المشاكل">
        <div className="flex flex-wrap gap-2 mb-4">
          {(Object.keys(CLASSIFICATION_LABELS) as RowClassification[]).map((key) =>
            counts[key] ? (
              <span
                key={key}
                className={clsx("rounded-lg px-3 py-1 text-sm", CLASSIFICATION_STYLES[key])}
              >
                {CLASSIFICATION_LABELS[key]}: <span className="nums">{counts[key]}</span>
              </span>
            ) : null,
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-right border-b">
                <th className="py-2 font-medium">صف</th>
                <th className="py-2 font-medium">العميل</th>
                <th className="py-2 font-medium">التاريخ</th>
                <th className="py-2 font-medium">التكلفة</th>
                <th className="py-2 font-medium">السعر</th>
                <th className="py-2 font-medium">الربح المحسوب</th>
                <th className="py-2 font-medium">الهامش</th>
                <th className="py-2 font-medium">التصنيف</th>
                <th className="py-2 font-medium">القرار</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ id, raw, decision }) => (
                <tr key={id} className="border-b last:border-0 align-top">
                  <td className="py-2 nums">{raw.srcRow}</td>
                  <td className="py-2">
                    {raw.clientName || "—"}
                    {raw.issueNote ? (
                      <p className="text-xs text-gray-500 mt-0.5 max-w-xs">{raw.issueNote}</p>
                    ) : null}
                  </td>
                  <td className="py-2 nums">{raw.orderDate ?? "—"}</td>
                  <td className="py-2 nums">
                    {raw.factoryCost !== null ? formatNumber(raw.factoryCost) : "—"}
                  </td>
                  <td className="py-2 nums">
                    {raw.clientPrice !== null ? formatNumber(raw.clientPrice) : "—"}
                  </td>
                  <td className="py-2 nums">
                    {raw.computed ? formatSAR(raw.computed.profit) : "—"}
                  </td>
                  <td className="py-2 nums">
                    {raw.computed ? formatPct(raw.computed.marginPct) : "—"}
                  </td>
                  <td className="py-2">
                    <span
                      className={clsx(
                        "rounded-md px-2 py-0.5 text-xs",
                        CLASSIFICATION_STYLES[raw.classification],
                      )}
                    >
                      {CLASSIFICATION_LABELS[raw.classification]}
                    </span>
                  </td>
                  <td className="py-2">
                    <select
                      name={`decision_${id}`}
                      defaultValue={decision ?? raw.suggestedDecision ?? "skip"}
                      className="rounded-lg border px-2 py-1 text-xs bg-white"
                    >
                      <option value="import">استيراد كطلب</option>
                      <option value="import_as_adjustment">استيراد كقيد تسوية</option>
                      <option value="skip">تجاوز</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="الخطوة 3: تأكيد">
        <div className="space-y-3">
          <div>
            <label htmlFor="repId" className="block text-sm font-medium mb-1">
              المندوب المسؤول عن الطلبات المستوردة
            </label>
            <select
              id="repId"
              name="repId"
              defaultValue={defaultRepId}
              className="w-full sm:w-72 rounded-lg border px-3 py-2 text-sm bg-white"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              بيانات الإكسل القديم لم تكن منسوبة لمندوب — اختر من تُنسب له.
            </p>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="legacyWithdrawals" value="1" className="mt-1" />
            <span>
              استيراد المسحوبات القديمة (<span className="nums">{formatSAR(LEGACY_WITHDRAWALS_TOTAL)}</span>)
              بتاريخ اليوم وملاحظة &quot;رصيد مرحّل من الإكسل&quot;
            </span>
          </label>

          <p className="text-xs text-gray-500">
            كل الحصص ستُحسب بنسبة 50% من الربح بعد الضريبة — لن تُنسخ حصص 60% من الملف القديم.
          </p>

          {state.error ? <p className="text-sm text-danger-700">{state.error}</p> : null}

          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-brand-500 text-white px-5 py-2.5 font-medium hover:bg-brand-600 disabled:opacity-60"
          >
            {pending ? "جارٍ الاستيراد..." : "تأكيد الاستيراد"}
          </button>
        </div>
      </Card>
    </form>
  );
}
