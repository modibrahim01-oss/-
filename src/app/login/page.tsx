"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-brand-50 to-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-brand-700">إتقان المقاس</h1>
          <p className="text-sm text-gray-500 mt-1">إدارة طلبات الكراتين</p>
        </div>

        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              البريد الإلكتروني
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              dir="ltr"
              className="w-full rounded-lg border px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
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
              autoComplete="current-password"
              required
              dir="ltr"
              className="w-full rounded-lg border px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {state.error ? (
            <p className="text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2">{state.error}</p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-brand-500 text-white py-2.5 font-medium hover:bg-brand-600 disabled:opacity-60"
          >
            {pending ? "جارٍ التحقق..." : "دخول"}
          </button>
        </form>
      </div>
    </main>
  );
}
