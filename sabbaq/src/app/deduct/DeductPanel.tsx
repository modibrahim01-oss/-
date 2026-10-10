"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { PlantIcon } from "@/components/TierLegend";
import { Badge, Card, EmptyState, SectionLabel, buttonStyle, field } from "@/components/ui";
import { deductPlant, undoDeduction, type Deduction, type DeductReason } from "@/lib/actions/deduct";
import { normalizeArabic } from "@/lib/arabic";
import { fetchAll } from "@/lib/fetch-all";
import { formatNumber, t, type Locale } from "@/lib/i18n";
import { createRestClient } from "@/lib/supabase/rest";
import { TIER_LIST, isTier, type Tier } from "@/lib/tiers";
import type { StudentFarmSummary } from "@/lib/types";
import { undoSecondsLeft } from "@/lib/undo";

const NO_COUNTS: Record<Tier, number> = { green: 0, yellow: 0, purple: 0, red: 0 };

const REASON_KEY: Record<DeductReason, Parameters<typeof t>[1]> = {
  forbidden: "sessionExpired",
  invalid: "deductFailed",
  reason: "deductReasonRequired",
  none_of_tier: "deductNoneOfTier",
  expired: "deductUndoExpired",
  not_yours: "deductFailed",
  already: "deductFailed",
  cell_taken: "deductCellTaken",
  unavailable: "needsMigration8",
  unknown: "deductFailed",
};

/**
 * لوحة «الليدر»: يختار الطالب، يكتب السبب، ويضغط نوع النبتة التي تُزال.
 * كل زرّ معطّل إن لم يكن عند الطالب نبتة من نوعه، فلا يُرسَل خصمٌ سيُرفض.
 */
export default function DeductPanel({
  locale,
  students,
  initialRecent,
  isAdmin,
  demoCounts,
}: {
  locale: Locale;
  students: StudentFarmSummary[];
  initialRecent: Deduction[];
  isAdmin: boolean;
  /** معاينة /dev فقط: أعداد ثابتة بدل القراءة من السجل */
  demoCounts?: Record<Tier, number>;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<StudentFarmSummary | null>(null);
  const [counts, setCounts] = useState<Record<Tier, number> | null>(null);
  const [reason, setReason] = useState("");
  const [recent, setRecent] = useState(initialRecent);
  const [toast, setToast] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  // تعديلات محلية على نقاط الطالب بعد الخصم، حتى لا تحتاج إعادة تحميل
  const [bumps, setBumps] = useState<Record<string, number>>({});
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const filtered = useMemo(() => {
    const q = normalizeArabic(query);
    if (!q) return students.slice(0, 40);
    return students.filter((s) => normalizeArabic(s.full_name).includes(q)).slice(0, 40);
  }, [query, students]);

  // عدد نبتات كل نوع عند الطالب المختار: يُقرأ من السجل العام عند الاختيار
  useEffect(() => {
    if (!selected) return;
    if (demoCounts) {
      setCounts(demoCounts);
      return;
    }
    let cancelled = false;
    setCounts(null);
    const db = createRestClient();
    fetchAll<{ tier: string }>((from, to) =>
      db
        .from("points_ledger")
        .select("tier")
        .eq("student_id", selected.student_id)
        .eq("semester_id", selected.semester_id)
        .is("revoked_at", null)
        .order("id")
        .range(from, to),
    )
      .then((rows) => {
        if (cancelled) return;
        const next = { ...NO_COUNTS };
        for (const r of rows) if (isTier(r.tier)) next[r.tier] += 1;
        setCounts(next);
      })
      .catch(() => !cancelled && setCounts({ ...NO_COUNTS }));
    return () => {
      cancelled = true;
    };
  }, [selected, demoCounts]);

  function deduct(tier: Tier) {
    if (!selected || pending) return;
    const spec = TIER_LIST.find((s) => s.tier === tier)!;
    const plant = locale === "ar" ? spec.labelAr : spec.labelEn;
    if (reason.trim().length < 2) {
      setToast({ tone: "err", text: t(locale, "deductReasonRequired") });
      return;
    }
    const ask = t(locale, "deductConfirm")
      .replace("{plant}", plant)
      .replace("{points}", formatNumber(locale, spec.points))
      .replace("{name}", selected.full_name);
    if (!window.confirm(ask)) return;

    const student = selected;
    startTransition(async () => {
      const res = await deductPlant(student.student_id, tier, reason);
      if (!res.ok) {
        setToast({ tone: "err", text: t(locale, REASON_KEY[res.reason]) });
        return;
      }
      setCounts((c) => (c ? { ...c, [tier]: Math.max(0, c[tier] - 1) } : c));
      setBumps((b) => ({ ...b, [student.student_id]: (b[student.student_id] ?? 0) - res.points }));
      setRecent((r) => [
        {
          id: res.id,
          student_id: student.student_id,
          full_name: student.full_name,
          tier,
          points: res.points,
          reason: reason.trim(),
          created_at: new Date().toISOString(),
          undone_at: null,
        },
        ...r,
      ]);
      setReason("");
      setToast({
        tone: "ok",
        text: t(locale, "deductDone").replace("{points}", formatNumber(locale, res.points)).replace("{name}", student.full_name),
      });
    });
  }

  function undo(d: Deduction) {
    startTransition(async () => {
      const res = await undoDeduction(d.id, d.student_id);
      if (!res.ok) {
        setToast({ tone: "err", text: t(locale, REASON_KEY[res.reason]) });
        return;
      }
      setRecent((r) => r.map((x) => (x.id === d.id ? { ...x, undone_at: new Date().toISOString() } : x)));
      setBumps((b) => ({ ...b, [d.student_id]: (b[d.student_id] ?? 0) + d.points }));
      if (selected?.student_id === d.student_id && isTier(d.tier)) {
        setCounts((c) => (c ? { ...c, [d.tier]: c[d.tier] + 1 } : c));
      }
      setToast({ tone: "ok", text: t(locale, "deductUndone") });
    });
  }

  const points = (s: StudentFarmSummary) => s.total_points + (bumps[s.student_id] ?? 0);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 28, margin: 0 }}>{t(locale, "deductTitle")}</h1>
        <p style={{ margin: "6px 0 0", color: "var(--ink-soft)" }}>{t(locale, "deductIntro")}</p>
      </div>

      <div className="deduct-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr)", gap: 18, alignItems: "start" }}>
        <Card>
          <SectionLabel>{t(locale, "pickStudent")}</SectionLabel>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(locale, "searchByName")}
            aria-label={t(locale, "searchByName")}
            style={{ ...field, marginTop: 8 }}
          />
          <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, maxHeight: 420, overflowY: "auto", display: "grid", gap: 4 }}>
            {filtered.map((s) => {
              const active = selected?.student_id === s.student_id;
              return (
                <li key={s.student_id}>
                  <button
                    type="button"
                    onClick={() => setSelected(s)}
                    style={{
                      width: "100%",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "8px 10px",
                      borderRadius: 12,
                      font: "inherit",
                      textAlign: "start",
                      cursor: "pointer",
                      background: active ? "var(--sun)" : "transparent",
                      color: active ? "var(--on-fill)" : "var(--ink)",
                      border: active ? "2.5px solid var(--outline)" : "2.5px solid transparent",
                    }}
                  >
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>
                      {s.full_name}
                      <span style={{ fontWeight: 500, fontSize: 12, marginInlineStart: 8, color: active ? "var(--on-fill)" : "var(--ink-soft)" }}>
                        {locale === "ar" ? s.group_name_ar : s.group_name_en}
                      </span>
                    </span>
                    <span className="tabular" style={{ fontWeight: 700 }}>{formatNumber(locale, points(s))}</span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li style={{ color: "var(--ink-mute)", fontSize: 14, padding: 8 }}>{t(locale, "noResults")}</li>
            )}
          </ul>
        </Card>

        <Card>
          {!selected ? (
            <EmptyState title={t(locale, "selectStudentFirst")} hint={t(locale, "deductPickHint")} />
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: 24 }}>{selected.full_name}</h2>
                <Badge tone="sky">{locale === "ar" ? selected.group_name_ar : selected.group_name_en}</Badge>
                <span className="tabular" style={{ marginInlineStart: "auto", fontWeight: 700, color: "var(--brand-deep)" }}>
                  {formatNumber(locale, points(selected))} {t(locale, "points")}
                </span>
              </div>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-soft)" }}>{t(locale, "deductReason")}</span>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={200}
                  placeholder={t(locale, "deductReasonPlaceholder")}
                  style={field}
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
                {TIER_LIST.map((spec) => {
                  const have = counts?.[spec.tier] ?? 0;
                  const disabled = pending || counts === null || have === 0;
                  return (
                    <button
                      key={spec.tier}
                      type="button"
                      className="press"
                      disabled={disabled}
                      onClick={() => deduct(spec.tier)}
                      style={{
                        display: "grid",
                        justifyItems: "center",
                        gap: 4,
                        padding: "12px 8px",
                        borderRadius: 18,
                        font: "inherit",
                        cursor: disabled ? "not-allowed" : "pointer",
                        opacity: disabled ? 0.5 : 1,
                        background: "var(--coral-soft)",
                        color: "var(--ink)",
                        border: "3px solid var(--coral-fill)",
                        boxShadow: "0 3px 0 var(--outline)",
                      }}
                    >
                      <PlantIcon tier={spec.tier} size={40} />
                      <strong className="tabular" style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--coral)" }}>
                        −{formatNumber(locale, spec.points)}
                      </strong>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{locale === "ar" ? spec.labelAr : spec.labelEn}</span>
                      <span className="tabular" style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                        {counts === null ? "…" : `${t(locale, "deductHave")} ${formatNumber(locale, have)}`}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)" }}>{t(locale, "deductHint")}</p>
            </div>
          )}
        </Card>
      </div>

      {toast && (
        <p
          role="status"
          style={{
            margin: 0,
            padding: "10px 14px",
            borderRadius: 14,
            fontWeight: 700,
            border: "2.5px solid var(--outline)",
            background: toast.tone === "ok" ? "var(--lime)" : "var(--coral-soft)",
            color: toast.tone === "ok" ? "var(--on-fill)" : "var(--coral)",
          }}
        >
          {toast.text}
        </p>
      )}

      <Card>
        <h2 style={{ fontSize: 17, margin: "0 0 12px" }}>{t(locale, isAdmin ? "recentDeductionsAll" : "recentDeductions")}</h2>
        {recent.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, color: "var(--ink-mute)" }}>{t(locale, "noDeductions")}</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {recent.map((d) => {
              const left = d.undone_at ? 0 : undoSecondsLeft(d.created_at, now);
              return (
                <li
                  key={d.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                    padding: "8px 10px",
                    borderRadius: 12,
                    background: "var(--surface-alt)",
                    opacity: d.undone_at ? 0.6 : 1,
                  }}
                >
                  {isTier(d.tier) && <PlantIcon tier={d.tier} size={28} />}
                  <strong>{d.full_name}</strong>
                  <span className="tabular" style={{ fontWeight: 700, color: "var(--coral)" }}>
                    −{formatNumber(locale, d.points)}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--ink-soft)", flex: "1 1 160px" }}>
                    {d.reason}
                    {isAdmin && d.actor_name ? ` · ${d.actor_name}` : ""}
                  </span>
                  {/* الوقت بتوقيت الجهاز بعد التركيب: الخادم بمنطقة زمنية أخرى */}
                  <span className="tabular" style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                    {now > 0 &&
                      new Date(d.created_at).toLocaleString(locale === "ar" ? "ar-SA-u-nu-arab" : "en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                  </span>
                  {d.undone_at ? (
                    <Badge tone="grape">{t(locale, "deductCancelled")}</Badge>
                  ) : (
                    left > 0 && (
                      <button
                        type="button"
                        className="press"
                        disabled={pending}
                        onClick={() => undo(d)}
                        style={{ ...buttonStyle(), padding: "4px 10px", fontSize: 12 }}
                      >
                        {t(locale, "undo")} ({formatNumber(locale, left)})
                      </button>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <style
        dangerouslySetInnerHTML={{
          __html: `@media (max-width: 760px) { .deduct-grid { grid-template-columns: minmax(0, 1fr) !important; } }`,
        }}
      />
    </div>
  );
}
