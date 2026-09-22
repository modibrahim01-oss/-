"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeArabic } from "@/lib/arabic";
import type { Locale } from "@/lib/i18n";
import { formatNumber, t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import type { Group, StudentFarmSummary } from "@/lib/types";

/**
 * بحث الطلاب للصفحة العامة: اختيار المجموعة ثم إكمال تلقائي بالاسم.
 * يستعلم مباشرة بمفتاح anon — لا حاجة لجلسة، وهذا مقصود.
 */
export default function StudentSearch({
  locale,
  groups,
  initialGroupId,
}: {
  locale: Locale;
  groups: Group[];
  initialGroupId?: number;
}) {
  const [groupId, setGroupId] = useState<number | "all">(initialGroupId ?? "all");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<StudentFarmSummary[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const supabase = useMemo(() => createClient(), []);
  const requestSeq = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    // البحث بحرف واحد يُرجع نصف المدرسة؛ ننتظر حرفين إلا إذا حُدّدت مجموعة
    if (trimmed.length < 2 && groupId === "all") {
      setRows([]);
      setState("idle");
      return;
    }

    const seq = ++requestSeq.current;
    setState("loading");
    const timer = setTimeout(async () => {
      let q = supabase
        .from("student_farms")
        .select("*")
        .order("total_points", { ascending: false })
        .limit(40);

      if (groupId !== "all") q = q.eq("group_id", groupId);
      // البحث على search_name لا على full_name: العمود مطبَّع في القاعدة
      // (بلا تشكيل وبهمزات موحّدة) وعليه فهرس trigram، فـ "احمد" تجد "أحمد".
      // `%` و `_` تُهرَّب وإلا صارت محارف بدل أن تكون نصًّا يبحث عنه المستخدم.
      if (trimmed.length >= 2) {
        const needle = normalizeArabic(trimmed).replace(/[\\%_]/g, "\\$&");
        q = q.ilike("search_name", `%${needle}%`);
      }

      const { data, error } = await q;
      // نتيجة قديمة وصلت بعد أحدث منها — نتجاهلها وإلا ارتدّت القائمة للخلف
      if (seq !== requestSeq.current) return;

      if (error) {
        setState("error");
        return;
      }
      setRows((data ?? []) as StudentFarmSummary[]);
      setState("ready");
    }, 220);

    return () => clearTimeout(timer);
  }, [query, groupId, supabase]);

  const showHint = state === "idle";

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 8,
          background: "var(--surface)",
          padding: 6,
          borderRadius: 999,
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-sm)",
          maxWidth: 520,
          margin: "0 auto",
          flexWrap: "wrap",
        }}
      >
        <select
          id="group-filter"
          value={groupId}
          onChange={(e) => setGroupId(e.target.value === "all" ? "all" : Number(e.target.value))}
          aria-label={t(locale, "group")}
          style={{
            font: "inherit",
            border: 0,
            background: "transparent",
            color: "var(--ink)",
            padding: "10px 14px",
            outline: 0,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <option value="all">{t(locale, "allGroups")}</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {locale === "ar" ? g.name_ar : g.name_en}
            </option>
          ))}
        </select>
        <input
          id="student-query"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(locale, "searchByName")}
          aria-label={t(locale, "searchByName")}
          style={{
            font: "inherit",
            border: 0,
            background: "transparent",
            color: "var(--ink)",
            padding: "10px 14px",
            outline: 0,
            flex: 1,
            minWidth: 140,
          }}
        />
      </div>

      <div style={{ marginTop: 20, maxWidth: 620, marginInline: "auto" }}>
        {showHint && (
          <p style={{ textAlign: "center", color: "var(--ink-mute)", fontSize: 14 }}>
            {t(locale, "startTyping")}
          </p>
        )}
        {state === "error" && (
          <p style={{ textAlign: "center", color: "var(--coral)", fontSize: 14 }}>
            {t(locale, "error")}
          </p>
        )}
        {state === "ready" && rows.length === 0 && (
          <p style={{ textAlign: "center", color: "var(--ink-mute)", fontSize: 14 }}>
            {t(locale, "noResults")}
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((r) => (
            <Link
              key={r.student_id}
              href={`/farm/${r.student_id}`}
              style={{
                display: "grid",
                gridTemplateColumns: "40px 1fr auto auto",
                gap: 12,
                alignItems: "center",
                padding: "11px 14px",
                borderRadius: 10,
                border: "1px solid var(--border-soft)",
                background: "var(--surface)",
                textDecoration: "none",
                color: "var(--ink)",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--brand-soft), var(--gold-soft))",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 700,
                  color: "var(--brand-deep)",
                  fontFamily: "var(--font-display)",
                }}
              >
                {r.full_name.trim().charAt(0)}
              </span>
              <span>
                <span style={{ fontWeight: 600, display: "block" }}>{r.full_name}</span>
                <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                  {locale === "ar" ? r.group_name_ar : r.group_name_en}
                  {r.grade ? ` · ${r.grade}` : ""}
                </span>
              </span>
              <span className="tabular" style={{ fontWeight: 700, color: "var(--brand-deep)" }}>
                {formatNumber(locale, r.total_points)}
                <span
                  style={{ fontWeight: 500, color: "var(--ink-mute)", marginInlineStart: 4, fontSize: 12 }}
                >
                  {t(locale, "points")}
                </span>
              </span>
              <svg
                aria-hidden
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--ink-mute)"
                strokeWidth="2"
                style={{ transform: locale === "ar" ? "scaleX(-1)" : undefined }}
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
