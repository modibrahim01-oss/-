"use client";

import { useActionState } from "react";
import { addPaymentAction, type ActionState } from "@/lib/actions/orders";
import { formatDate, formatSAR } from "@/lib/format";
import type { PaymentRow } from "@/lib/supabase/types";

const initialState: ActionState = { error: null };

export function PaymentsPanel({
  orderId,
  payments,
  clientPrice,
  paidTotal,
  remaining,
}: {
  orderId: string;
  payments: PaymentRow[];
  clientPrice: number;
  paidTotal: number;
  remaining: number;
}) {
  const boundAction = addPaymentAction.bind(null, orderId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-gray-500">سعر العميل</dt>
          <dd className="font-medium nums">{formatSAR(clientPrice)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">المحصَّل</dt>
          <dd className="font-medium text-brand-600 nums">{formatSAR(paidTotal)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">المتبقي</dt>
          <dd className={`font-medium nums ${remaining > 0 ? "text-danger-700" : "text-brand-600"}`}>
            {formatSAR(remaining)}
          </dd>
        </div>
      </dl>

      {payments.length > 0 ? (
        <ul className="space-y-1 text-sm border-t pt-3">
          {payments.map((p) => (
            <li key={p.id} className="flex justify-between gap-2">
              <span className="nums">{formatSAR(Number(p.amount))}</span>
              <span className="text-gray-500">{p.method ?? "—"}</span>
              <span className="text-gray-400 nums">{formatDate(p.paid_at)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 border-t pt-3">لا توجد دفعات مسجّلة</p>
      )}

      <form action={formAction} className="grid grid-cols-2 gap-2 border-t pt-3">
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0"
          required
          placeholder="المبلغ"
          className="rounded-lg border px-3 py-2 text-sm nums"
        />
        <input name="paidAt" type="date" required className="rounded-lg border px-3 py-2 text-sm" />
        <input
          name="method"
          placeholder="طريقة الدفع"
          className="rounded-lg border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-gray-900 text-white px-3 py-2 text-sm disabled:opacity-60"
        >
          {pending ? "جارٍ التسجيل..." : "تسجيل دفعة"}
        </button>
        {state.error ? (
          <p className="col-span-2 text-sm text-danger-700">{state.error}</p>
        ) : null}
      </form>
    </div>
  );
}
