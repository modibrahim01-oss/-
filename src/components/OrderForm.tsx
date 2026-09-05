"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import type { ActionState } from "@/lib/actions/orders";
import { computeOrderFinancialsFromCosts, isCriticallyLowMargin, isLowMargin } from "@/lib/finance";
import { formatPct, formatSAR } from "@/lib/format";
import type { ClientRow } from "@/lib/supabase/types";

const initialState: ActionState = { error: null };

export interface OrderFormDefaults {
  clientId?: string;
  orderDate?: string | null;
  costCarton?: number;
  costMold?: number;
  costPlate?: number;
  costShipping?: number;
  clientPrice?: number;
  factoryName?: string | null;
  notes?: string | null;
}

export function OrderForm({
  clients,
  repSharePct,
  action,
  defaults,
  submitLabel = "حفظ الطلب",
  redirectOnSuccess = "/orders",
}: {
  clients: Pick<ClientRow, "id" | "name">[];
  repSharePct: number;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  defaults?: OrderFormDefaults;
  submitLabel?: string;
  redirectOnSuccess?: string | null;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialState);

  const [costs, setCosts] = useState({
    costCarton: defaults?.costCarton ?? 0,
    costMold: defaults?.costMold ?? 0,
    costPlate: defaults?.costPlate ?? 0,
    costShipping: defaults?.costShipping ?? 0,
  });
  const [clientPrice, setClientPrice] = useState(defaults?.clientPrice ?? 0);

  const live = useMemo(
    () => computeOrderFinancialsFromCosts(costs, clientPrice, repSharePct),
    [costs, clientPrice, repSharePct],
  );

  if (state.success && redirectOnSuccess) {
    router.push(redirectOnSuccess);
  }

  const numberField = (
    id: keyof typeof costs | "clientPrice",
    label: string,
    value: number,
    onChange: (v: number) => void,
  ) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="number"
        step="0.01"
        min="0"
        inputMode="decimal"
        value={value === 0 ? "" : value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full rounded-lg border px-3 py-2.5 text-base nums"
        placeholder="0.00"
      />
    </div>
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="clientId" className="block text-sm font-medium mb-1">
            العميل
          </label>
          <select
            id="clientId"
            name="clientId"
            required
            defaultValue={defaults?.clientId ?? ""}
            className="w-full rounded-lg border px-3 py-2.5 text-base bg-white"
          >
            <option value="">اختر العميل</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="orderDate" className="block text-sm font-medium mb-1">
            تاريخ التعميد
          </label>
          <input
            id="orderDate"
            name="orderDate"
            type="date"
            defaultValue={defaults?.orderDate ?? ""}
            className="w-full rounded-lg border px-3 py-2.5 text-base"
          />
          <p className="text-xs text-gray-400 mt-1">
            اتركه فارغًا إن لم يكن معروفًا — سيظهر الطلب في &quot;يحتاج مراجعة&quot;
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {numberField("costCarton", "تكلفة الكرتون", costs.costCarton, (v) =>
          setCosts((c) => ({ ...c, costCarton: v })),
        )}
        {numberField("costMold", "تكلفة القالب", costs.costMold, (v) =>
          setCosts((c) => ({ ...c, costMold: v })),
        )}
        {numberField("costPlate", "تكلفة الكليشة", costs.costPlate, (v) =>
          setCosts((c) => ({ ...c, costPlate: v })),
        )}
        {numberField("costShipping", "تكلفة الشحن", costs.costShipping, (v) =>
          setCosts((c) => ({ ...c, costShipping: v })),
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {numberField("clientPrice", "سعر العميل", clientPrice, setClientPrice)}
        <div>
          <label htmlFor="factoryName" className="block text-sm font-medium mb-1">
            اسم المصنع (اختياري)
          </label>
          <input
            id="factoryName"
            name="factoryName"
            defaultValue={defaults?.factoryName ?? ""}
            className="w-full rounded-lg border px-3 py-2.5 text-base"
          />
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium mb-1">
          ملاحظات
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={defaults?.notes ?? ""}
          className="w-full rounded-lg border px-3 py-2.5 text-base"
        />
      </div>

      {/* الحساب اللحظي أثناء الكتابة قبل الحفظ */}
      <div
        className={clsx(
          "rounded-2xl border p-4",
          isCriticallyLowMargin(live.marginPct) && clientPrice > 0
            ? "bg-danger-50 border-danger-500"
            : isLowMargin(live.marginPct) && clientPrice > 0
              ? "bg-warn-50 border-warn-500"
              : "bg-brand-50 border-brand-500",
        )}
      >
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <div>
            <dt className="text-gray-500">تكلفة المصنع</dt>
            <dd className="font-semibold nums">{formatSAR(live.factoryCost)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">الربح</dt>
            <dd className="font-semibold nums">{formatSAR(live.profit)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">هامش الربح</dt>
            <dd className="font-semibold nums">{formatPct(live.marginPct)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">عمولتي ({formatPct(repSharePct, 0)})</dt>
            <dd className="font-semibold nums">{formatSAR(live.repShare)}</dd>
          </div>
        </dl>
        <p className="text-xs text-gray-500 mt-3">
          الربح بدون ضريبة <span className="nums">{formatSAR(live.profitExVat)}</span> · ضريبة
          مستحقة <span className="nums">{formatSAR(live.vatDue)}</span>
        </p>
        {clientPrice > 0 && isCriticallyLowMargin(live.marginPct) ? (
          <p className="text-sm text-danger-700 font-medium mt-2">
            تنبيه: الهامش أقل من 10% — سيُشعَر المشرف قبل الاعتماد.
          </p>
        ) : null}
      </div>

      {state.error ? (
        <p className="text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2">{state.error}</p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-500 text-white px-5 py-2.5 font-medium hover:bg-brand-600 disabled:opacity-60"
        >
          {pending ? "جارٍ الحفظ..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
