"use client";

import { useActionState } from "react";
import { createWithdrawalAction, type WithdrawalState } from "@/lib/actions/withdrawals";

const initialState: WithdrawalState = { error: null };

export function WithdrawalForm({
  users,
}: {
  users: { id: string; full_name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createWithdrawalAction, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div>
        <label htmlFor="repId" className="block text-sm font-medium mb-1">
          المندوب
        </label>
        <select id="repId" name="repId" required className="w-full rounded-lg border px-3 py-2 bg-white">
          <option value="">اختر المندوب</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="amount" className="block text-sm font-medium mb-1">
          المبلغ
        </label>
        <input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          min="0"
          required
          className="w-full rounded-lg border px-3 py-2 nums"
        />
      </div>

      <div>
        <label htmlFor="withdrawnAt" className="block text-sm font-medium mb-1">
          التاريخ
        </label>
        <input
          id="withdrawnAt"
          name="withdrawnAt"
          type="date"
          required
          className="w-full rounded-lg border px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="note" className="block text-sm font-medium mb-1">
          ملاحظة
        </label>
        <input id="note" name="note" className="w-full rounded-lg border px-3 py-2" />
      </div>

      {state.error ? (
        <p className="sm:col-span-2 lg:col-span-4 text-sm text-danger-700">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="sm:col-span-2 lg:col-span-4 text-sm text-brand-700">{state.success}</p>
      ) : null}

      <div className="sm:col-span-2 lg:col-span-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-500 text-white px-5 py-2.5 font-medium hover:bg-brand-600 disabled:opacity-60"
        >
          {pending ? "جارٍ التسجيل..." : "تسجيل"}
        </button>
      </div>
    </form>
  );
}
