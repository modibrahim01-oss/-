"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { transferClientAction, type ClientActionState } from "@/lib/actions/clients";
import type { UserRow } from "@/lib/supabase/types";

const initialState: ClientActionState = { error: null };

export function ClientTransferForm({
  clientId,
  clientName,
  currentOwnerId,
  ordersCount,
  reps,
}: {
  clientId: string;
  clientName: string;
  currentOwnerId: string | null;
  ordersCount: number;
  reps: Pick<UserRow, "id" | "full_name" | "is_active">[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(transferClientAction, initialState);
  const [selected, setSelected] = useState(currentOwnerId ?? "");

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  const changed = selected !== (currentOwnerId ?? "");

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="clientId" value={clientId} />
      <label htmlFor={`owner-${clientId}`} className="sr-only">
        المندوب المسؤول عن {clientName}
      </label>
      <select
        id={`owner-${clientId}`}
        name="ownerId"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="rounded-lg border px-3 py-2 text-sm bg-white min-w-[10rem]"
      >
        <option value="">بدون مندوب (المشرف)</option>
        {reps.map((rep) => (
          <option key={rep.id} value={rep.id} disabled={!rep.is_active}>
            {rep.full_name}
            {rep.is_active ? "" : " (معطّل)"}
          </option>
        ))}
      </select>

      <button
        type="submit"
        disabled={pending || !changed}
        className="rounded-lg bg-brand-500 text-white px-4 py-2 text-sm font-medium hover:bg-brand-600 disabled:opacity-40"
      >
        {pending ? "جارٍ التحويل..." : "تحويل"}
      </button>

      {changed && ordersCount > 0 ? (
        <span className="text-xs text-gray-500">
          <span className="nums">{ordersCount}</span> طلبًا سابقًا يبقى للمندوب الحالي
        </span>
      ) : null}

      {state.error ? <span className="text-xs text-danger-700">{state.error}</span> : null}
      {state.success ? <span className="text-xs text-brand-700">{state.success}</span> : null}
    </form>
  );
}
