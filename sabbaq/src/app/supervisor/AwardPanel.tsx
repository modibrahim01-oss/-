"use client";

import { useMemo, useState, useTransition } from "react";
import { PlantIcon } from "@/components/TierLegend";
import { Badge, Card, EmptyState, SectionLabel } from "@/components/ui";
import { awardPoints } from "@/lib/actions/award";
import { formatNumber, localizeDigits, t } from "@/lib/i18n";
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
  // «+٥٠» يطفو من الزرّ الذي ضُغط: تأكيد يُرى حيث تنظر العين، لا في زاوية
  const [burst, setBurst] = useState<{ tier: Tier; key: number } | null>(null);
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
      setBurst({ tier, key: Date.now() });
    });
  }

  const pct = unlimited || status.limit === 0 ? 0 : Math.min(100, (status.used / status.limit) * 100);
  // المتبقّي يُقرأ لونًا قبل أن يُقرأ رقمًا: ليمونيّ ثم شمسيّ ثم مرجانيّ
  const meterFill = pct >= 90 ? "var(--coral-fill)" : pct >= 70 ? "var(--sun)" : "var(--lime)";

  return (
    <main
      style={{
        maxWidth: 1240,
        margin: "0 auto",
        padding: "22px 20px 64px",
        display: "grid",
        gridTemplateColumns: "330px minmax(0, 1fr)",
        gap: 22,
        alignItems: "start",
      }}
      className="sup-grid"
    >
      <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar name={supervisorName} fill="var(--grape-fill)" size={52} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>
              {supervisorName}
            </div>
            <div style={{ marginTop: 5, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <Badge tone="grape">{roleName}</Badge>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)" }}>
                {t(locale, "myGroups")}: {scopeLabel || "—"}
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <SectionLabel>{t(locale, "yourDailyLimit")}</SectionLabel>
          {unlimited ? (
            // «بلا حد» شارة، والمنح اليوم رقم مستقلّ: جمعهما بنقطة وسطى في الخطّ
            // العرضي كان يُقرأ كلمةً واحدة متّصلة
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Badge tone="brand">{t(locale, "noLimit")}</Badge>
              <span className="tabular" style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-soft)" }}>
                <strong style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink)" }}>
                  {formatNumber(locale, status.used)}
                </strong>{" "}
                {t(locale, "points")}
              </span>
            </div>
          ) : (
            <>
              <div
                style={{
                  height: 22,
                  background: "var(--surface-alt)",
                  border: "2.5px solid var(--outline)",
                  borderRadius: 999,
                  overflow: "hidden",
                  marginBottom: 10,
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
                    background: meterFill,
                    borderInlineEnd: pct > 0 && pct < 100 ? "2.5px solid var(--outline)" : "none",
                    transition: "width 0.35s, background 0.35s",
                  }}
                />
              </div>
              <div className="tabular" style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-soft)" }}>
                <strong style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink)" }}>
                  {formatNumber(locale, status.used)}
                </strong>{" "}
                {t(locale, "of")} {formatNumber(locale, status.limit)} {t(locale, "points")}
              </div>
              {status.remaining === 0 && (
                <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--coral)", fontWeight: 700 }}>
                  {t(locale, "limitReached")}
                </p>
              )}
            </>
          )}
        </Card>

        <Card style={{ padding: 14 }}>
          <label
            htmlFor="supervisor-student-search"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              background: "var(--surface)",
              border: "2.5px solid var(--outline)",
              borderRadius: 999,
              marginBottom: 12,
            }}
          >
            <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round">
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16 16l4.5 4.5" />
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
                fontWeight: 500,
                color: "var(--ink)",
                flex: 1,
                outline: 0,
                minWidth: 0,
              }}
            />
          </label>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto", padding: 2 }}>
            {filtered.length === 0 && (
              <p style={{ fontSize: 14, color: "var(--ink-mute)", padding: "8px 4px" }}>{t(locale, "noResults")}</p>
            )}
            {filtered.map((s) => {
              const active = selected?.student_id === s.student_id;
              const bal = balanceOf(s);
              return (
                <button
                  key={s.student_id}
                  type="button"
                  onClick={() => setSelected(s)}
                  aria-pressed={active}
                  className="pick"
                  style={{
                    font: "inherit",
                    textAlign: "start",
                    padding: "9px 12px",
                    borderRadius: 14,
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 15,
                    border: `2.5px solid ${active ? "var(--outline)" : "transparent"}`,
                    boxShadow: active ? "0 3px 0 var(--outline)" : "none",
                    background: active ? "var(--sun)" : "transparent",
                    color: active ? "var(--on-fill)" : "var(--ink)",
                    fontWeight: 700,
                  }}
                >
                  <span>{s.full_name}</span>
                  <span className="tabular" style={{ fontFamily: "var(--font-display)", color: active ? "inherit" : "var(--brand-deep)" }}>
                    {formatNumber(locale, bal.points)}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      </aside>

      <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {selected ? (
          <div
            className="pop pop-in"
            key={selected.student_id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
              padding: "16px 20px",
              borderRadius: 24,
              background:
                "linear-gradient(100deg, color-mix(in oklab, var(--sun) 42%, var(--surface)) 0%, var(--surface) 60%, color-mix(in oklab, var(--sky) 28%, var(--surface)) 100%)",
            }}
          >
            <Avatar name={selected.full_name} fill="var(--lime)" size={58} />
            <div style={{ minWidth: 0, flex: "1 1 200px" }}>
              <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.15 }}>{selected.full_name}</h1>
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                <Badge tone="sky">{locale === "ar" ? selected.group_name_ar : selected.group_name_en}</Badge>
                {selected.grade && <Badge tone="grape">{localizeDigits(locale, selected.grade)}</Badge>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {(() => {
                const bal = balanceOf(selected);
                return (
                  <>
                    <MiniStat n={formatNumber(locale, bal.points)} label={t(locale, "totalPoints")} fill="var(--sun)" />
                    <MiniStat n={formatNumber(locale, bal.plants)} label={t(locale, "plants")} fill="var(--lime)" />
                  </>
                );
              })()}
            </div>
          </div>
        ) : (
          <EmptyState title={t(locale, "selectStudentFirst")} hint={t(locale, "pickStudent")} />
        )}

        <div>
          <SectionLabel>{t(locale, "awardPoints")}</SectionLabel>
          <div className="award-grid">
            {TIER_LIST.map((spec) => {
              const blocked = !selected || spec.points > remaining || pending;
              return (
                <button
                  key={spec.tier}
                  type="button"
                  onClick={() => award(spec.tier)}
                  disabled={blocked}
                  className="press"
                  title={
                    !selected
                      ? t(locale, "selectStudentFirst")
                      : spec.points > remaining
                        ? t(locale, "limitReached")
                        : undefined
                  }
                  style={{
                    position: "relative",
                    font: "inherit",
                    padding: "16px 12px 14px",
                    borderRadius: 24,
                    border: "3px solid var(--outline)",
                    boxShadow: "var(--pop-lg)",
                    // الحشو بلون الفئة نفسها، والنصّ داكن فوقه — لا نصّ ملوّن على أبيض
                    background: `linear-gradient(180deg, color-mix(in oklab, ${spec.color} 55%, #fff) 0%, ${spec.color} 100%)`,
                    color: "var(--on-fill)",
                    cursor: blocked ? "not-allowed" : "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      width: 78,
                      height: 78,
                      borderRadius: "50%",
                      background: "#fff",
                      border: "3px solid var(--outline)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <PlantIcon tier={spec.tier} size={58} />
                  </span>
                  <span
                    className="tabular"
                    style={{ fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 700, lineHeight: 1.05 }}
                  >
                    +{formatNumber(locale, spec.points)}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>
                    {locale === "ar" ? spec.labelAr : spec.labelEn}
                  </span>
                  {burst?.tier === spec.tier && (
                    <span
                      key={burst.key}
                      aria-hidden
                      className="tabular float-up"
                      style={{
                        position: "absolute",
                        top: -6,
                        insetInline: 0,
                        marginInline: "auto",
                        width: "fit-content",
                        padding: "2px 12px",
                        borderRadius: 999,
                        background: "#fff",
                        border: "2.5px solid var(--outline)",
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        fontSize: 22,
                        pointerEvents: "none",
                      }}
                    >
                      +{formatNumber(locale, spec.points)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-mute)", marginTop: 12 }}>{t(locale, "noManualEntry")}</p>
        </div>

        {toast && (
          <div
            role="status"
            className="pop pop-in"
            key={toast.text}
            style={{
              padding: "12px 18px",
              borderRadius: 18,
              fontWeight: 700,
              fontSize: 16,
              background: toast.tone === "ok" ? "var(--lime)" : "var(--coral-fill)",
              color: "var(--on-fill)",
            }}
          >
            {toast.text}
          </div>
        )}

        <Card>
          <SectionLabel>{t(locale, "recentToday")}</SectionLabel>
          {recent.length === 0 ? (
            <p style={{ fontSize: 14, color: "var(--ink-mute)", margin: 0 }}>{t(locale, "noAwardsToday")}</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {recent.map((r) => {
                const tier = isTier(r.tier) ? r.tier : "green";
                const spec = TIER_LIST.find((s) => s.tier === tier);
                return (
                  <div
                    key={r.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "36px 1fr auto auto",
                      gap: 12,
                      alignItems: "center",
                      padding: "6px 10px",
                      fontSize: 15,
                      borderRadius: 14,
                      background: `color-mix(in oklab, ${spec?.color ?? "var(--lime)"} 18%, var(--surface))`,
                      border: "2px solid var(--border)",
                    }}
                  >
                    <PlantIcon tier={tier} size={32} />
                    <span style={{ fontWeight: 700 }}>{r.studentName}</span>
                    <span
                      className="tabular"
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        padding: "0 10px",
                        borderRadius: 999,
                        background: spec?.color,
                        color: "var(--on-fill)",
                        border: "2px solid var(--outline)",
                      }}
                    >
                      +{formatNumber(locale, r.points)}
                    </span>
                    <time className="tabular" dateTime={r.awardedAt} style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-mute)" }}>
                      {new Date(r.awardedAt).toLocaleTimeString(locale === "ar" ? "ar-SA-u-nu-arab" : "en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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
          __html: `
            .award-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
            .pick:hover:not([aria-pressed="true"]) { background: var(--surface-alt) !important; }
            @keyframes float-up { 0% { transform: translateY(0) scale(.7); opacity: 0 } 25% { opacity: 1; transform: translateY(-18px) scale(1.1) } 100% { transform: translateY(-64px) scale(1); opacity: 0 } }
            .float-up { animation: float-up 1100ms ease-out forwards; }
            @media (max-width: 1000px) { .award-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
            @media (max-width: 800px) { .sup-grid { grid-template-columns: minmax(0, 1fr) !important; } }
          `,
        }}
      />
    </main>
  );
}

/** قرص الحرف الأول بحدّ غليظ. */
function Avatar({ name, fill, size }: { name: string; fill: string; size: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        display: "grid",
        placeItems: "center",
        background: fill,
        border: "3px solid var(--outline)",
        boxShadow: "var(--pop)",
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: size * 0.46,
        color: "var(--on-fill)",
        transform: "rotate(-5deg)",
        flexShrink: 0,
      }}
    >
      {name.trim().charAt(0)}
    </span>
  );
}

function MiniStat({ n, label, fill }: { n: string; label: string; fill: string }) {
  return (
    <div
      className="pop"
      style={{ textAlign: "center", padding: "6px 14px", borderRadius: 16, background: fill, color: "var(--on-fill)" }}
    >
      <span
        className="tabular"
        style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, display: "block", lineHeight: 1.15 }}
      >
        {n}
      </span>
      <span style={{ fontSize: 12, fontWeight: 700 }}>{label}</span>
    </div>
  );
}
