"use client";

import { useActionState } from "react";
import { buttonStyle } from "@/components/ui";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { signIn } from "./actions";

const field: React.CSSProperties = {
  font: "inherit",
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  outline: 0,
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 6,
  color: "var(--ink-soft)",
};

export default function LoginForm({ locale, next }: { locale: Locale; next?: string }) {
  const [state, action, pending] = useActionState(signIn, null);

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {next && <input type="hidden" name="next" value={next} />}

      <div>
        <label htmlFor="email" style={label}>
          {t(locale, "email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          dir="ltr"
          style={field}
        />
      </div>

      <div>
        <label htmlFor="password" style={label}>
          {t(locale, "password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          dir="ltr"
          style={field}
        />
      </div>

      {state?.error && (
        <p role="alert" style={{ color: "var(--coral)", fontSize: 13, margin: 0 }}>
          {t(locale, state.error === "unavailable" ? "loginUnavailable" : "loginFailed")}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        style={{
          ...buttonStyle("primary"),
          justifyContent: "center",
          opacity: pending ? 0.6 : 1,
        }}
      >
        {pending ? t(locale, "loading") : t(locale, "login")}
      </button>
    </form>
  );
}
