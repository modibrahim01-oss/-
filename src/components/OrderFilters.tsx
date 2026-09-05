"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { ClientRow, UserRow } from "@/lib/supabase/types";

export function OrderFilters({
  clients,
  reps,
}: {
  clients: Pick<ClientRow, "id" | "name">[];
  reps?: Pick<UserRow, "id" | "full_name">[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, setPending] = useState(false);

  function apply(formData: FormData) {
    setPending(true);
    const next = new URLSearchParams();
    for (const key of ["q", "clientId", "repId", "status", "from", "to"]) {
      const value = String(formData.get(key) ?? "").trim();
      if (value) next.set(key, value);
    }
    if (formData.get("review")) next.set("review", "1");
    router.push(`?${next.toString()}`);
    setPending(false);
  }

  return (
    <form action={apply} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div>
        <label htmlFor="q" className="block text-xs text-gray-500 mb-1">
          بحث
        </label>
        <input
          id="q"
          name="q"
          defaultValue={params.get("q") ?? ""}
          placeholder="اسم العميل أو رقم الطلب"
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="clientId" className="block text-xs text-gray-500 mb-1">
          العميل
        </label>
        <select
          id="clientId"
          name="clientId"
          defaultValue={params.get("clientId") ?? ""}
          className="w-full rounded-lg border px-3 py-2 text-sm bg-white"
        >
          <option value="">الكل</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {reps ? (
        <div>
          <label htmlFor="repId" className="block text-xs text-gray-500 mb-1">
            المندوب
          </label>
          <select
            id="repId"
            name="repId"
            defaultValue={params.get("repId") ?? ""}
            className="w-full rounded-lg border px-3 py-2 text-sm bg-white"
          >
            <option value="">الكل</option>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.full_name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label htmlFor="status" className="block text-xs text-gray-500 mb-1">
          الحالة
        </label>
        <select
          id="status"
          name="status"
          defaultValue={params.get("status") ?? ""}
          className="w-full rounded-lg border px-3 py-2 text-sm bg-white"
        >
          <option value="">الكل</option>
          <option value="draft">مسودة</option>
          <option value="active">جاري</option>
          <option value="completed">مكتمل</option>
          <option value="cancelled">ملغي</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="from" className="block text-xs text-gray-500 mb-1">
            من تاريخ
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={params.get("from") ?? ""}
            className="w-full rounded-lg border px-2 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="to" className="block text-xs text-gray-500 mb-1">
            إلى تاريخ
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={params.get("to") ?? ""}
            className="w-full rounded-lg border px-2 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex items-end gap-2">
        <label className="flex items-center gap-2 text-sm text-gray-600 grow">
          <input
            type="checkbox"
            name="review"
            defaultChecked={params.get("review") === "1"}
            className="rounded"
          />
          يحتاج مراجعة فقط
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm disabled:opacity-60"
        >
          فلترة
        </button>
      </div>
    </form>
  );
}
