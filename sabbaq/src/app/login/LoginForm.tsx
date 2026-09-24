"use client";

import { useActionState } from "react";
import { buttonStyle, field } from "@/components/ui";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { signIn } from "./actions";

const loginField: React.CSSProperties = { ...field, width: "100%", padding: "12px 14px" };

const label: React.CSSProperties = {
  display: "block",
  fontSize: 14,
  fontWeight: 700,
  marginBottom: 6,
  color: "var(--ink)",
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
          style={loginField}
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
          style={loginField}
        />
      </div>

      {state?.error && (
        <p
          role="alert"
          style={{
            color: "var(--coral)",
            background: "var(--coral-soft)",
            border: "2px solid var(--coral)",
            borderRadius: 12,
            padding: "8px 12px",
            fontSize: 14,
            fontWeight: 700,
            margin: 0,
          }}
        >
          {t(locale, state.error === "unavailable" ? "loginUnavailable" : "loginFailed")}
        </p>
      )}

      <button className="press"
        type="submit"
        disabled={pending}
        style={{
          ...buttonStyle("primary"),
          justifyContent: "center",
          fontSize: 17,
          padding: "12px 18px",
          opacity: pending ? 0.6 : 1,
        }}
      >
        {pending ? t(locale, "loading") : t(locale, "login")}
      </button>
    </form>
  );
}
