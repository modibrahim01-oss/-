"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createClientAction, type ClientActionState } from "@/lib/actions/clients";

const initialState: ClientActionState = { error: null };

export function ClientForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createClientAction, initialState);
  const hasSimilarWarning = (state.similarNames?.length ?? 0) > 0;

  if (state.success) {
    router.push("/clients");
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label htmlFor="name" className="block text-sm font-medium mb-1">
            اسم العميل
          </label>
          <input
            id="name"
            name="name"
            required
            className="w-full rounded-lg border px-3 py-2.5 text-base"
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium mb-1">
            الجوال
          </label>
          <input
            id="phone"
            name="phone"
            dir="ltr"
            className="w-full rounded-lg border px-3 py-2.5 text-base"
          />
        </div>

        <div>
          <label htmlFor="city" className="block text-sm font-medium mb-1">
            المدينة
          </label>
          <input id="city" name="city" className="w-full rounded-lg border px-3 py-2.5 text-base" />
        </div>

        <div>
          <label htmlFor="vatNumber" className="block text-sm font-medium mb-1">
            الرقم الضريبي
          </label>
          <input
            id="vatNumber"
            name="vatNumber"
            dir="ltr"
            className="w-full rounded-lg border px-3 py-2.5 text-base nums"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="notes" className="block text-sm font-medium mb-1">
            ملاحظات
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            className="w-full rounded-lg border px-3 py-2.5 text-base"
          />
        </div>
      </div>

      {hasSimilarWarning ? (
        <div className="rounded-xl border border-warn-500 bg-warn-50 p-3 text-sm space-y-2">
          <p className="font-medium text-warn-700">يوجد عميل مشابه بالفعل:</p>
          <ul className="list-disc pr-5 text-gray-700">
            {state.similarNames!.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <label className="flex items-center gap-2 text-gray-700">
            <input type="checkbox" name="confirmSimilar" value="1" className="rounded" />
            هذا عميل مختلف فعلًا — تابع الحفظ
          </label>
        </div>
      ) : null}

      {state.error ? (
        <p className="text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand-500 text-white px-5 py-2.5 font-medium hover:bg-brand-600 disabled:opacity-60"
      >
        {pending ? "جارٍ الحفظ..." : hasSimilarWarning ? "تأكيد الحفظ" : "حفظ العميل"}
      </button>
    </form>
  );
}
