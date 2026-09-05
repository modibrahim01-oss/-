"use client";

import { useActionState } from "react";
import {
  createUserAction,
  updateUserAction,
  type UserActionState,
} from "@/lib/actions/users";

const initialState: UserActionState = { error: null };

export function UserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div>
        <label htmlFor="fullName" className="block text-sm font-medium mb-1">
          الاسم الكامل
        </label>
        <input id="fullName" name="fullName" required className="w-full rounded-lg border px-3 py-2" />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          البريد الإلكتروني
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          dir="ltr"
          className="w-full rounded-lg border px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">
          كلمة المرور
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          dir="ltr"
          className="w-full rounded-lg border px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium mb-1">
          الجوال
        </label>
        <input id="phone" name="phone" dir="ltr" className="w-full rounded-lg border px-3 py-2" />
      </div>

      <div>
        <label htmlFor="role" className="block text-sm font-medium mb-1">
          الدور
        </label>
        <select id="role" name="role" defaultValue="rep" className="w-full rounded-lg border px-3 py-2 bg-white">
          <option value="rep">مندوب</option>
          <option value="admin">مشرف</option>
        </select>
      </div>

      <div>
        <label htmlFor="sharePct" className="block text-sm font-medium mb-1">
          النسبة %
        </label>
        <input
          id="sharePct"
          name="sharePct"
          type="number"
          step="0.5"
          min="0"
          max="100"
          defaultValue={50}
          className="w-full rounded-lg border px-3 py-2 nums"
        />
      </div>

      {state.error ? (
        <p className="sm:col-span-2 lg:col-span-3 text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="sm:col-span-2 lg:col-span-3 text-sm text-brand-700 bg-brand-50 rounded-lg px-3 py-2">
          {state.success}
        </p>
      ) : null}

      <div className="sm:col-span-2 lg:col-span-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-500 text-white px-5 py-2.5 font-medium hover:bg-brand-600 disabled:opacity-60"
        >
          {pending ? "جارٍ الإنشاء..." : "إنشاء الحساب"}
        </button>
      </div>
    </form>
  );
}

export function UserRowEditor({
  userId,
  sharePct,
  isActive,
}: {
  userId: string;
  sharePct: number;
  isActive: boolean;
}) {
  const boundAction = updateUserAction.bind(null, userId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input
        name="sharePct"
        type="number"
        step="0.5"
        min="0"
        max="100"
        defaultValue={sharePct}
        className="w-20 rounded-lg border px-2 py-1 text-sm nums"
      />
      <label className="flex items-center gap-1 text-xs text-gray-600">
        <input type="checkbox" name="isActive" value="1" defaultChecked={isActive} />
        نشط
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-60"
      >
        حفظ
      </button>
      {state.error ? <span className="text-xs text-danger-700">{state.error}</span> : null}
    </form>
  );
}
