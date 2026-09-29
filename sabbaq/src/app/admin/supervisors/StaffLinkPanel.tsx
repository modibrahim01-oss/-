"use client";

import { useEffect, useState, useTransition } from "react";
import { buttonStyle } from "@/components/ui";
import { getStaffLink, revokeStaffLink, rotateStaffLink, type StaffLinkResult } from "@/lib/actions/admin";
import { actionErrorText, t, type Locale } from "@/lib/i18n";

/**
 * لوحة رابط دخول المشرف: رمز QR يُمسح، والرابط نفسه للنسخ، وإصدار رابط جديد،
 * وإلغاء الدخول. الرابط يُجلب (أو يُنشأ) عند فتح اللوحة لا عند تحميل الصفحة.
 */
export default function StaffLinkPanel({ locale, userId }: { locale: Locale; userId: string }) {
  const [link, setLink] = useState<StaffLinkResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => setLink(await getStaffLink(userId)));
  }, [userId]);

  if (revoked) {
    return <p style={{ margin: 0, fontWeight: 700, color: "var(--coral)" }}>✓ {t(locale, "linkRevoked")}</p>;
  }
  if (!link) return <p style={{ margin: 0, color: "var(--ink-mute)" }}>…</p>;
  if (!link.ok) {
    return (
      <p role="alert" style={{ margin: 0, fontWeight: 700, color: "var(--coral)" }}>
        {actionErrorText(locale, link.error)}
      </p>
    );
  }

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <div
        style={{ width: 132, height: 132, padding: 6, background: "#fff", border: "2px solid var(--outline)", borderRadius: 12 }}
        // SVG من مكتبة qrcode على الخادم، مدخلها رابط نبنيه من رمز عشوائي
        dangerouslySetInnerHTML={{ __html: link.qr.replace("<svg", '<svg width="100%" height="100%"') }}
      />
      <div style={{ display: "grid", gap: 8, flex: "1 1 260px", minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)", fontWeight: 500 }}>{t(locale, "loginLinkHint")}</p>
        <code
          dir="ltr"
          style={{
            fontSize: 12,
            padding: "6px 10px",
            borderRadius: 10,
            background: "var(--surface-alt)",
            border: "1.5px solid var(--border)",
            overflowWrap: "anywhere",
          }}
        >
          {link.url}
        </code>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="press"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link.url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                // الحافظة محجوبة: الرابط ظاهر أعلاه للنسخ يدويًا
              }
            }}
            style={{ ...buttonStyle("primary"), padding: "6px 12px", fontSize: 13 }}
          >
            {copied ? `✓ ${t(locale, "copied")}` : t(locale, "copyLink")}
          </button>
          <button
            type="button"
            className="press"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(t(locale, "newLinkConfirm"))) return;
              startTransition(async () => setLink(await rotateStaffLink(userId)));
            }}
            style={{ ...buttonStyle(), padding: "6px 12px", fontSize: 13 }}
          >
            {t(locale, "newLink")}
          </button>
          <button
            type="button"
            className="press"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(t(locale, "revokeLinkConfirm"))) return;
              startTransition(async () => {
                const res = await revokeStaffLink(userId);
                if (res.ok) setRevoked(true);
              });
            }}
            style={{ ...buttonStyle("danger"), padding: "6px 12px", fontSize: 13 }}
          >
            {t(locale, "revokeLink")}
          </button>
        </div>
      </div>
    </div>
  );
}
