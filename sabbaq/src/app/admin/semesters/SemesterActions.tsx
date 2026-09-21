"use client";

import { useState, useTransition } from "react";
import { Card, buttonStyle } from "@/components/ui";
import { closeSemester } from "@/lib/actions/admin";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import type { Semester } from "@/lib/types";

const field: React.CSSProperties = {
  font: "inherit",
  padding: "9px 12px",
  borderRadius: 9,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  outline: 0,
  minWidth: 0,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 5,
  color: "var(--ink-soft)",
};

/**
 * نهاية الفصل بخيارين مستقلّين — الإدارة تقرر:
 *  • أرشفة وحدها: لقطة محفوظة والمزارع تبقى كما هي
 *  • تصفير وحده: بداية جديدة بلا لقطة (نُحذّر منه)
 *  • الاثنان: الاستخدام المعتاد
 */
export default function SemesterActions({
  locale,
  active,
}: {
  locale: Locale;
  active: Semester | null;
}) {
  const [archive, setArchive] = useState(true);
  const [reset, setReset] = useState(true);
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const today = new Date();
  const defaultStart = today.toISOString().slice(0, 10);
  const defaultEnd = new Date(today.getTime() + 90 * 86400000).toISOString().slice(0, 10);

  const confirmWord = t(locale, "confirmWord");
  const confirmed = confirm.trim().toUpperCase() === confirmWord.toUpperCase();
  const canSubmit = !!active && (archive || reset) && confirmed && !pending;

  function submit(formData: FormData) {
    formData.set("archive", archive ? "true" : "false");
    formData.set("reset", reset ? "true" : "false");
    startTransition(async () => {
      const res = await closeSemester(formData);
      if (res.ok) {
        setResult({ tone: "ok", text: t(locale, "saved") });
        setConfirm("");
      } else {
        setResult({ tone: "err", text: res.error });
      }
    });
  }

  return (
    <Card>
      <h2 style={{ fontSize: 16, margin: "0 0 6px" }}>{t(locale, "semesterActions")}</h2>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 16px" }}>
        {t(locale, "archiveHint")}
      </p>

      <form action={submit} style={{ display: "grid", gap: 14 }}>
        <label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 14 }}>
          <input
            type="checkbox"
            checked={archive}
            onChange={(e) => setArchive(e.target.checked)}
            style={{ marginTop: 4 }}
          />
          <span>
            <strong>{t(locale, "archiveSemester")}</strong>
            <span style={{ display: "block", fontSize: 12, color: "var(--ink-mute)" }}>
              {t(locale, "archiveHint")}
            </span>
          </span>
        </label>

        <label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 14 }}>
          <input
            type="checkbox"
            checked={reset}
            onChange={(e) => setReset(e.target.checked)}
            style={{ marginTop: 4 }}
          />
          <span>
            <strong>{t(locale, "resetFarms")}</strong>
            <span style={{ display: "block", fontSize: 12, color: "var(--ink-mute)" }}>
              {t(locale, "resetHint")}
            </span>
          </span>
        </label>

        {reset && !archive && (
          <p
            role="alert"
            style={{
              margin: 0,
              padding: "10px 14px",
              borderRadius: 9,
              background: "var(--coral-soft)",
              color: "var(--coral)",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {locale === "ar"
              ? "تصفير بدون أرشفة: لن تبقى لقطة بأسماء الطلاب ونقاطهم لهذا الفصل. سجل النقاط التفصيلي يبقى، لكن لا تقرير جاهز."
              : "Resetting without archiving leaves no snapshot of this semester's standings. The raw ledger is kept, but no ready report."}
          </p>
        )}

        {/* تفاصيل الفصل الجديد مطلوبة للتصفير فقط: بدون فصل نشط تُرفض النقاط */}
        {reset && (
          <fieldset
            style={{
              border: "1px solid var(--border-soft)",
              borderRadius: 10,
              padding: "12px 14px",
              display: "grid",
              gap: 10,
            }}
          >
            <legend style={{ ...labelStyle, marginBottom: 0, padding: "0 6px" }}>
              {locale === "ar" ? "الفصل الجديد" : "New semester"}
            </legend>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <label style={{ flex: "1 1 180px" }}>
                <span style={labelStyle}>{t(locale, "name")}</span>
                <input
                  name="nextNameAr"
                  required={reset}
                  defaultValue={locale === "ar" ? "الفصل الثاني" : "الفصل الثاني"}
                  style={{ ...field, width: "100%" }}
                />
              </label>
              <label style={{ flex: "1 1 180px" }}>
                <span style={labelStyle}>{t(locale, "name")} (EN)</span>
                <input
                  name="nextNameEn"
                  dir="ltr"
                  defaultValue="Semester 2"
                  style={{ ...field, width: "100%" }}
                />
              </label>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <label style={{ flex: "1 1 150px" }}>
                <span style={labelStyle}>{locale === "ar" ? "من" : "From"}</span>
                <input
                  name="nextStart"
                  type="date"
                  required={reset}
                  defaultValue={defaultStart}
                  style={{ ...field, width: "100%" }}
                />
              </label>
              <label style={{ flex: "1 1 150px" }}>
                <span style={labelStyle}>{locale === "ar" ? "إلى" : "To"}</span>
                <input
                  name="nextEnd"
                  type="date"
                  required={reset}
                  defaultValue={defaultEnd}
                  style={{ ...field, width: "100%" }}
                />
              </label>
            </div>
          </fieldset>
        )}

        <label>
          <span style={labelStyle}>{t(locale, "confirmDestructive")}</span>
          <input
            name="confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={confirmWord}
            autoComplete="off"
            style={{ ...field, maxWidth: 220 }}
          />
        </label>

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            ...buttonStyle(reset ? "danger" : "primary"),
            justifySelf: "start",
            opacity: canSubmit ? 1 : 0.45,
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
        >
          {archive && reset
            ? t(locale, "archiveAndReset")
            : reset
              ? t(locale, "resetFarms")
              : t(locale, "archiveSemester")}
        </button>

        {result && (
          <p
            role="status"
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 600,
              color: result.tone === "ok" ? "var(--brand-deep)" : "var(--coral)",
            }}
          >
            {result.text}
          </p>
        )}
      </form>
    </Card>
  );
}
