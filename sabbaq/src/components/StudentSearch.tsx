"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeArabic } from "@/lib/arabic";
import { formatNumber, localizeDigits, t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import type { Group, StudentFarmSummary } from "@/lib/types";
import { useLocale } from "@/lib/useLocale";

/**
 * بحث الطلاب للصفحة العامة: اختيار المجموعة ثم إكمال تلقائي بالاسم.
 * يستعلم مباشرة بمفتاح anon — لا حاجة لجلسة، وهذا مقصود.
 */
/** قرص الحرف الأول لكل نتيجة: ألوان الهوية بالتناوب، فتتمايز النتائج بنظرة. */
const AVATAR_FILLS = ["var(--sun)", "var(--sky)", "var(--lime)", "var(--berry)", "var(--grape-fill)", "var(--tangerine)", "var(--mint)"];

export default function StudentSearch({ groups }: { groups: Group[] }) {
  const locale = useLocale();
  const [groupId, setGroupId] = useState<number | "all">("all");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<StudentFarmSummary[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const supabase = useMemo(() => createClient(), []);
  const requestSeq = useRef(0);

  // بطاقات المجموعات تربط إلى ‎/?group=N‎. يُقرأ المعامل هنا لا على الخادم:
  // قراءة searchParams في الصفحة تجعلها ديناميكية فتفقد التخزين، والمرشّح
  // عنصر متصفّح أصلًا فلا شيء يُكسب من حسمه على الخادم.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("group");
    const id = Number(raw);
    if (Number.isInteger(id) && id > 0) setGroupId(id);
  }, []);

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
      <style
        dangerouslySetInnerHTML={{
          __html: `.search-bar { border-radius: 999px; }
            .search-bar:focus-within { outline: 3px solid var(--sky); outline-offset: 3px; }
            @media (max-width: 520px) { .search-bar { border-radius: 22px; } }`,
        }}
      />
      {/* حبّة دائرية في سطر واحد؛ حين تنكسر إلى سطرين على الجوّال يصير نصف
          القطر الكامل شكلًا بيضويًا، فيُقلَّص هناك إلى زوايا مستديرة */}
      <div
        className="search-bar"
        style={{
          display: "flex",
          gap: 8,
          background: "var(--surface)",
          padding: 6,
          border: "3px solid var(--outline)",
          boxShadow: "var(--pop-lg)",
          maxWidth: 560,
          alignItems: "center",
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
            border: "2.5px solid var(--outline)",
            borderRadius: 999,
            background: "var(--sun)",
            color: "var(--on-fill)",
            padding: "8px 14px",
            fontWeight: 700,
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
        {/* العدسة والحقل معًا: حين ينكسر الشريط على الجوّال ينتقلان سطرًا واحدًا */}
        <span style={{ display: "flex", alignItems: "center", flex: "1 1 200px", minWidth: 0 }}>
          <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" style={{ marginInlineStart: 8, flexShrink: 0 }}>
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4.5 4.5" />
          </svg>
          <input
            id="student-query"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(locale, "searchByName")}
            aria-label={t(locale, "searchByName")}
            style={{
              font: "inherit",
              fontSize: 17,
              fontWeight: 500,
              border: 0,
              background: "transparent",
              color: "var(--ink)",
              padding: "10px 8px",
              // الحلقة على الشريط كلّه (focus-within) لا على الحقل وحده
              outline: 0,
              flex: 1,
              minWidth: 0,
            }}
          />
        </span>
      </div>

      <div style={{ marginTop: 20, maxWidth: 620, marginInline: "auto" }}>
        {showHint && (
          <p style={{ textAlign: "center", color: "var(--on-fill)", fontWeight: 700, fontSize: 14, opacity: 0.75 }}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((r, i) => (
            <Link
              key={r.student_id}
              href={`/farm/${r.student_id}`}
              className="pop lift pop-in"
              style={{
                display: "grid",
                gridTemplateColumns: "44px 1fr auto auto",
                gap: 12,
                alignItems: "center",
                padding: "10px 14px",
                borderRadius: 18,
                background: "var(--surface)",
                textDecoration: "none",
                color: "var(--ink)",
                textAlign: "start",
                animationDelay: `${Math.min(i, 6) * 40}ms`,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: AVATAR_FILLS[i % AVATAR_FILLS.length],
                  border: "2.5px solid var(--outline)",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 700,
                  fontSize: 19,
                  color: "var(--on-fill)",
                  fontFamily: "var(--font-display)",
                }}
              >
                {r.full_name.trim().charAt(0)}
              </span>
              <span>
                <span style={{ fontWeight: 700, fontSize: 16, display: "block" }}>{r.full_name}</span>
                <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                  {locale === "ar" ? r.group_name_ar : r.group_name_en}
                  {r.grade ? ` · ${localizeDigits(locale, r.grade)}` : ""}
                </span>
              </span>
              <span className="tabular" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--brand-deep)" }}>
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
                stroke="var(--ink)"
                strokeWidth="2.6"
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
