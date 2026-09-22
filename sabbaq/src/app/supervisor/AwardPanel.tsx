"use client";

import { useMemo, useState, useTransition } from "react";
import { PlantIcon } from "@/components/TierLegend";
import { Card, EmptyState } from "@/components/ui";
import { awardPoints } from "@/lib/actions/award";
import { formatNumber, t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { TIER_LIST, isTier } from "@/lib/tiers";
import type { Tier } from "@/lib/tiers";
import type { DailyStatus, StudentFarmSummary } from "@/lib/types";

type RecentAward = {
  id: number;
  studentName: string;
  points: number;
  tier: string;
  awardedAt: string;
};

export default function AwardPanel({
  locale,
  supervisorName,
  roleName,
  scopeLabel,
  students,
  initialStatus,
  initialRecent,
}: {
  locale: Locale;
  supervisorName: string;
  roleName: string;
  scopeLabel: string;
  students: StudentFarmSummary[];
  initialStatus: DailyStatus;
  initialRecent: RecentAward[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<StudentFarmSummary | null>(null);
  const [status, setStatus] = useState(initialStatus);
  const [recent, setRecent] = useState(initialRecent);
  // تعديلات محلية على أرصدة الطلاب بعد المنح، حتى لا تحتاج إعادة تحميل
  const [bumps, setBumps] = useState<Record<string, { points: number; plants: number }>>({});
  const [toast, setToast] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const unlimited = status.limit < 0;
  const remaining = unlimited ? Number.POSITIVE_INFINITY : status.remaining;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students.slice(0, 60);
    return students.filter((s) => s.full_name.toLowerCase().includes(q)).slice(0, 60);
  }, [query, students]);

  function balanceOf(s: StudentFarmSummary) {
    const bump = bumps[s.student_id];
    return {
      points: s.total_points + (bump?.points ?? 0),
      plants: s.plant_count + (bump?.plants ?? 0),
    };
  }

  function award(tier: Tier) {
    if (!selected || pending) return;
    const spec = TIER_LIST.find((s) => s.tier === tier);
    if (!spec || spec.points > remaining) return;

    const student = selected;
    startTransition(async () => {
      const outcome = await awardPoints(student.student_id, tier);

      if (!outcome.ok) {
        const text =
          outcome.reason === "limit"
            ? t(locale, "limitReached")
            : outcome.reason === "scope"
              ? t(locale, "awardFailed")
              : t(locale, "awardFailed");
        setToast({ tone: "err", text });
        // الحد قد يكون استُهلك من جهاز آخر لنفس المشرف — نصفّر المتبقّي
        if (outcome.reason === "limit") {
          setStatus((prev) => ({ ...prev, used: prev.limit, remaining: 0 }));
        }
        return;
      }

      const gained = outcome.result.points;
      setStatus((prev) =>
        prev.limit < 0
          ? { ...prev, used: prev.used + gained }
          : { ...prev, used: prev.used + gained, remaining: Math.max(0, prev.remaining - gained) },
      );
      setBumps((prev) => {
        const cur = prev[student.student_id] ?? { points: 0, plants: 0 };
        return {
          ...prev,
          [student.student_id]: { points: cur.points + gained, plants: cur.plants + 1 },
        };
      });
      setRecent((prev) =>
        [
          {
            id: outcome.result.ledger_id,
            studentName: student.full_name,
            points: gained,
            tier,
            awardedAt: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 12),
      );
      setToast({
        tone: "ok",
        text: `${t(locale, "awarded")} +${formatNumber(locale, gained)} · ${student.full_name}`,
      });
    });
  }

  const pct = unlimited || status.limit === 0 ? 0 : Math.min(100, (status.used / status.limit) * 100);
  const meterColor =
    pct >= 90
      ? "linear-gradient(90deg, var(--coral), #e88670)"
      : pct >= 70
        ? "linear-gradient(90deg, var(--gold), #f0d370)"
        : "linear-gradient(90deg, var(--brand), #7ec599)";

  return (
    <main
      style={{
        maxWidth: 1240,
        margin: "0 auto",
        padding: "22px 20px 64px",
        display: "grid",
        gridTemplateColumns: "320px minmax(0, 1fr)",
        gap: 20,
        alignItems: "start",
      }}
      className="sup-grid"
    >
      <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Card>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>
            {supervisorName}
          </div>
          <span
            style={{
              display: "inline-block",
              marginTop: 6,
              fontSize: 12,
              fontWeight: 600,
              color: "var(--brand-deep)",
              background: "var(--brand-soft)",
              padding: "3px 10px",
              borderRadius: 999,
            }}
          >
            {roleName}
          </span>
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-soft)" }}>
            {t(locale, "myGroups")}: {scopeLabel || "—"}
          </div>
        </Card>

        <Card>
          <h2
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--ink-mute)",
              fontWeight: 600,
              margin: "0 0 10px",
              fontFamily: "var(--font-body)",
            }}
          >
            {t(locale, "yourDailyLimit")}
          </h2>
          {unlimited ? (
            <div
              className="tabular"
              style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--brand-deep)" }}
            >
              {t(locale, "noLimit")} · {formatNumber(locale, status.used)} {t(locale, "points")}
            </div>
          ) : (
            <>
              <div
                style={{
                  height: 10,
                  background: "var(--ground-warm)",
                  borderRadius: 999,
                  overflow: "hidden",
                  marginBottom: 8,
                }}
                role="progressbar"
                aria-valuenow={status.used}
                aria-valuemin={0}
                aria-valuemax={status.limit}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: meterColor,
                    borderRadius: 999,
                    transition: "width 0.35s",
                  }}
                />
              </div>
              <div className="tabular" style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                <strong style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--ink)" }}>
                  {formatNumber(locale, status.used)}
                </strong>{" "}
                {t(locale, "of")} {formatNumber(locale, status.limit)} {t(locale, "points")}
              </div>
              {status.remaining === 0 && (
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--coral)", fontWeight: 600 }}>
                  {t(locale, "limitReached")}
                </p>
              )}
            </>
          )}
        </Card>

        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 999,
              marginBottom: 10,
            }}
          >
            <svg
              aria-hidden
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--ink-mute)"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              id="supervisor-student-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(locale, "searchByName")}
              aria-label={t(locale, "pickStudent")}
              style={{
                border: 0,
                background: "transparent",
                font: "inherit",
                color: "var(--ink)",
                flex: 1,
                outline: 0,
                minWidth: 0,
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 3,
              maxHeight: 340,
              overflowY: "auto",
            }}
          >
            {filtered.length === 0 && (
              <p style={{ fontSize: 13, color: "var(--ink-mute)", padding: "8px 4px" }}>
                {t(locale, "noResults")}
              </p>
            )}
            {filtered.map((s) => {
              const active = selected?.student_id === s.student_id;
              const bal = balanceOf(s);
              return (
                <button
                  key={s.student_id}
                  type="button"
                  onClick={() => setSelected(s)}
                  style={{
                    font: "inherit",
                    textAlign: "start",
                    padding: "10px 12px",
                    borderRadius: 8,
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    border: `1px solid ${active ? "var(--brand)" : "transparent"}`,
                    background: active ? "var(--brand-soft)" : "transparent",
                    color: active ? "var(--brand-deep)" : "var(--ink)",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  <span>{s.full_name}</span>
                  <span className="tabular" style={{ color: active ? "inherit" : "var(--ink-mute)" }}>
                    {formatNumber(locale, bal.points)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <section style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {selected ? (
          <Card
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: 22 }}>{selected.full_name}</h1>
              <p style={{ margin: "4px 0 0", color: "var(--ink-soft)", fontSize: 13 }}>
                {locale === "ar" ? selected.group_name_ar : selected.group_name_en}
                {selected.grade ? ` · ${selected.grade}` : ""}
              </p>
            </div>
            <div style={{ display: "flex", gap: 22 }}>
              {(() => {
                const bal = balanceOf(selected);
                return (
                  <>
                    <MiniStat
                      n={formatNumber(locale, bal.points)}
                      label={t(locale, "totalPoints")}
                    />
                    <MiniStat n={formatNumber(locale, bal.plants)} label={t(locale, "plants")} />
                  </>
                );
              })()}
            </div>
          </Card>
        ) : (
          <EmptyState title={t(locale, "selectStudentFirst")} hint={t(locale, "pickStudent")} />
        )}

        <div>
          <h2
            style={{
              fontSize: 13,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--ink-soft)",
              fontWeight: 700,
              margin: "0 0 10px",
              fontFamily: "var(--font-display)",
            }}
          >
            {t(locale, "awardPoints")}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 12,
            }}
          >
            {TIER_LIST.map((spec) => {
              const blocked = !selected || spec.points > remaining || pending;
              return (
                <button
                  key={spec.tier}
                  type="button"
                  onClick={() => award(spec.tier)}
                  disabled={blocked}
                  title={
                    !selected
                      ? t(locale, "selectStudentFirst")
                      : spec.points > remaining
                        ? t(locale, "limitReached")
                        : undefined
                  }
                  style={{
                    font: "inherit",
                    padding: "20px 16px",
                    borderRadius: 14,
                    border: `2px solid ${blocked ? "var(--border)" : spec.color}`,
                    background: "var(--surface)",
                    cursor: blocked ? "not-allowed" : "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    alignItems: "center",
                    opacity: blocked ? 0.42 : 1,
                    transition: "opacity 0.15s, border-color 0.15s",
                  }}
                >
                  <PlantIcon tier={spec.tier} size={44} />
                  <span
                    className="tabular"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 30,
                      fontWeight: 700,
                      lineHeight: 1,
                      // spec.ink لا spec.color: المشبع لا يُقرأ نصًّا (الأصفر ١٫٥٥:١ على أبيض)
                      color: spec.ink,
                    }}
                  >
                    +{formatNumber(locale, spec.points)}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                    {locale === "ar" ? spec.labelAr : spec.labelEn}
                  </span>
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 10 }}>
            {t(locale, "noManualEntry")}
          </p>
        </div>

        {toast && (
          <div
            role="status"
            style={{
              padding: "13px 18px",
              borderRadius: 12,
              fontWeight: 500,
              background: toast.tone === "ok" ? "var(--brand-deep)" : "var(--coral)",
              color: "#fbf7ec",
              boxShadow: "var(--shadow)",
            }}
          >
            {toast.text}
          </div>
        )}

        <Card>
          <h2
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--ink-mute)",
              fontWeight: 600,
              margin: "0 0 12px",
              fontFamily: "var(--font-body)",
            }}
          >
            {t(locale, "recentToday")}
          </h2>
          {recent.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ink-mute)", margin: 0 }}>
              {t(locale, "noAwardsToday")}
            </p>
          ) : (
            <div>
              {recent.map((r) => {
                const tier = isTier(r.tier) ? r.tier : "green";
                const spec = TIER_LIST.find((s) => s.tier === tier);
                return (
                  <div
                    key={r.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "24px 1fr auto auto",
                      gap: 12,
                      alignItems: "center",
                      padding: "8px 0",
                      fontSize: 13,
                      borderBottom: "1px solid var(--border-soft)",
                    }}
                  >
                    <PlantIcon tier={tier} size={20} />
                    <span style={{ fontWeight: 500 }}>{r.studentName}</span>
                    <span
                      className="tabular"
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        color: spec?.ink,
                      }}
                    >
                      +{formatNumber(locale, r.points)}
                    </span>
                    <time
                      className="tabular"
                      dateTime={r.awardedAt}
                      style={{ fontSize: 12, color: "var(--ink-mute)" }}
                    >
                      {new Date(r.awardedAt).toLocaleTimeString(
                        locale === "ar" ? "ar-SA-u-nu-arab" : "en-US",
                        { hour: "2-digit", minute: "2-digit" },
                      )}
                    </time>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </section>

      <style
        dangerouslySetInnerHTML={{
          __html: `@media (max-width: 800px) {
            .sup-grid { grid-template-columns: minmax(0, 1fr) !important; }
          }`,
        }}
      />
    </main>
  );
}

function MiniStat({ n, label }: { n: string; label: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <span
        className="tabular"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: 700,
          color: "var(--brand-deep)",
          display: "block",
          lineHeight: 1.2,
        }}
      >
        {n}
      </span>
      <span
        style={{
          fontSize: 11,
          color: "var(--ink-mute)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </span>
    </div>
  );
}
