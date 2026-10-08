"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Brand } from "@/components/Brand";
import FarmScene, { type MowCell } from "@/components/FarmScene";
import RankBadge from "@/components/RankBadge";
import TierLegend from "@/components/TierLegend";
import { LangToggle, ThemeToggle } from "@/components/Toggles";
import { EmptyState, Stat, buttonStyle, topbar, topbarInner } from "@/components/ui";
import { countByTier } from "@/lib/farm";
import { type FarmData, farmChanged, loadFarm } from "@/lib/farm-data";
import { MilestoneCelebration, MilestonesCard, useMilestoneCelebration } from "@/components/Milestones";
import { createRestClient } from "@/lib/supabase/rest";
import { resetArrangement, saveArrangement } from "@/lib/actions/farm";
import { formatNumber, localizeDigits, t } from "@/lib/i18n";
import { TIER_LIST, isTier } from "@/lib/tiers";
import { useLocale } from "@/lib/useLocale";

/**
 * واجهة صفحة البستان. النبتات والإحصاءات تصل من الخادم جاهزة فتُرسم فورًا،
 * ثم تُعاد قراءتها من المتصفح لتلحق بما فات النسخةَ المخزَّنة.
 */
export default function FarmView({
  id,
  initial,
  demoDeductions,
}: {
  id: string;
  initial: FarmData;
  /** معاينة /dev فقط: خصومات ثابتة بدل القراءة من القاعدة */
  demoDeductions?: GardenDeduction[];
}) {
  const locale = useLocale();
  const [data, setData] = useState(initial);
  const { farm, plants, rank } = data;
  // عدد النبتات التي لحقت بها القراءة من المتصفح — يُحتفل بها لحظةً ثم تختفي
  const [grown, setGrown] = useState(0);
  const shown = useRef(initial.plants.length);

  // ── مفتاح البستان ──
  // يصل في الـ hash (#k=…) من بطاقة الطالب: لا يبلغ الخادم ولا يكسر تخزين
  // الصفحة. يُحفظ في المتصفح ويُمحى من الشريط فلا يُنسخ مع الرابط صدفةً.
  const [farmKey, setFarmKey] = useState<string | null>(null);
  const [arranging, setArranging] = useState(false);
  const arrangingRef = useRef(false);
  arrangingRef.current = arranging;
  const [moves, setMoves] = useState<Record<number, { x: number; y: number }>>({});
  const [sceneKey, setSceneKey] = useState(0);
  const [arrangeNote, setArrangeNote] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const storageKey = `sabbaq-farm-key:${id}`;
    let key: string | null = null;
    const m = window.location.hash.match(/(?:^#|&)k=([A-Za-z0-9_-]{32,128})/);
    if (m) {
      key = m[1];
      try {
        localStorage.setItem(storageKey, key);
      } catch {
        // تخزين محجوب: يبقى المفتاح لهذه الزيارة وحدها
      }
      history.replaceState(null, "", window.location.pathname + window.location.search);
    } else {
      try {
        key = localStorage.getItem(storageKey);
      } catch {
        key = null;
      }
    }
    if (!key) return;

    let cancelled = false;
    const candidate = key;
    // تحقّق خفيف من المتصفح؛ الحفظ نفسه يتحقق من جديد في قاعدة البيانات
    void (async () => {
      const { data, error } = await createRestClient().rpc("farm_key_ok", { p_student: id, p_key: candidate });
      if (cancelled) return;
      if (!error && data === true) setFarmKey(candidate);
      else if (!error) {
        try {
          localStorage.removeItem(storageKey);
        } catch {
          // انظر أعلاه
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const movedCount = Object.keys(moves).length;

  function endArranging(note: { tone: "ok" | "err"; text: string } | null) {
    setArranging(false);
    setMoves({});
    setArrangeNote(note);
  }

  async function save() {
    if (!farmKey || movedCount === 0) return;
    setSaving(true);
    const list = Object.entries(moves).map(([slot, c]) => ({ slot: Number(slot), x: c.x, y: c.y }));
    const res = await saveArrangement(id, farmKey, list);
    setSaving(false);
    if (res.ok) {
      // المشهد في مكانه أصلًا؛ تُحدَّث البيانات بالخانات الجديدة فلا يُعاد رسمه
      setData((prev) => ({
        ...prev,
        plants: prev.plants.map((p) => (moves[p.slot_index] ? { ...p, grid_x: moves[p.slot_index].x, grid_y: moves[p.slot_index].y } : p)),
      }));
      endArranging({ tone: "ok", text: t(locale, "arrangeSaved") });
    } else if (res.reason === "key") {
      setFarmKey(null);
      setSceneKey((k) => k + 1);
      endArranging({ tone: "err", text: t(locale, "arrangeKeyInvalid") });
    } else {
      setArrangeNote({ tone: "err", text: t(locale, "arrangeFailed") });
    }
  }

  function cancel() {
    // المشهد حرّك الشبكات بنفسه؛ إعادة تركيبه تعيد كل نبتة إلى خانتها المحفوظة
    setSceneKey((k) => k + 1);
    endArranging(null);
  }

  async function resetLayout() {
    if (!farmKey || !window.confirm(t(locale, "resetArrangementConfirm"))) return;
    setSaving(true);
    const res = await resetArrangement(id, farmKey);
    if (res.ok) {
      const next = await loadFarm(createRestClient(), id).catch(() => null);
      if (next) setData(next);
      setSceneKey((k) => k + 1);
      endArranging({ tone: "ok", text: t(locale, "arrangeSaved") });
    } else {
      setArrangeNote({ tone: "err", text: t(locale, res.reason === "key" ? "arrangeKeyInvalid" : "arrangeFailed") });
    }
    setSaving(false);
  }

  useEffect(() => {
    if (!arrangeNote || arrangeNote.tone === "err") return;
    const timer = setTimeout(() => setArrangeNote(null), 3500);
    return () => clearTimeout(timer);
  }, [arrangeNote]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createRestClient();

    async function refresh() {
      try {
        const next = await loadFarm(supabase, id);
        // نستبدل فقط إن تغيّر ما يُرى: مصفوفة نبتات جديدة بنفس المحتوى
        // تجعل المشهد يعيد المقارنة بلا داعٍ
        // أثناء الترتيب لا تُستبدل البيانات: المشهد يحمل نقلات لم تُحفظ بعد
        if (!cancelled && next && !arrangingRef.current) setData((prev) => (farmChanged(prev, next) ? next : prev));
        if (!cancelled && next && next.plants.length > shown.current) {
          setGrown(next.plants.length - shown.current);
          shown.current = next.plants.length;
        }
      } catch {
        // تعذّر الاتصال: النسخة المعروضة صحيحة حتى لحظة تخزينها، فلا نستبدلها
        // برسالة خطأ — الطالب يرى بستانه ولو متأخرًا دقائق
      }
    }

    // عند الفتح، وكلما عاد الطالب إلى التبويب بعد أن تركه مفتوحًا
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [id]);

  useEffect(() => {
    if (grown === 0) return;
    const timer = setTimeout(() => setGrown(0), 4200);
    return () => clearTimeout(timer);
  }, [grown]);

  // ── الجزّازة: خصومات لم يرها هذا الجهاز بعد ──
  const mower = useMower(id, initial.farm.semester_id, demoDeductions);

  const counts = countByTier(plants);
  const typesCollected = TIER_LIST.filter((s) => counts[s.tier] > 0).length;
  const { celebrating, dismiss } = useMilestoneCelebration(id, farm.total_points, typesCollected);
  const groupName = locale === "ar" ? farm.group_name_ar : farm.group_name_en;

  return (
    <>
      <header style={topbar}>
        <div style={topbarInner}>
          <Brand locale={locale} />
          <div style={{ marginInlineStart: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <Link
              href="/"
              className="press"
              style={{ ...buttonStyle(), padding: "6px 14px", fontSize: 14, textDecoration: "none" }}
            >
              {locale === "ar" ? "→" : "←"} {t(locale, "backToSearch")}
            </Link>
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "24px 20px 64px" }}>
        {/* شريط الاسم: صاحب البستان ونقاطه وترتيبه قبل أي شيء */}
        <section
          className="pop farm-banner"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            padding: "16px 20px",
            borderRadius: 26,
            marginBottom: 18,
            background:
              "linear-gradient(100deg, color-mix(in oklab, var(--sun) 42%, var(--surface)) 0%, var(--surface) 55%, color-mix(in oklab, var(--sky) 30%, var(--surface)) 100%)",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              display: "grid",
              placeItems: "center",
              background: "var(--lime)",
              border: "3px solid var(--outline)",
              boxShadow: "var(--pop)",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 30,
              color: "var(--on-fill)",
              transform: "rotate(-5deg)",
              flexShrink: 0,
            }}
          >
            {farm.full_name.trim().charAt(0)}
          </span>
          <div style={{ minWidth: 0, flex: "1 1 220px" }}>
            <h1 style={{ margin: 0, fontSize: "clamp(26px, 4vw, 38px)", lineHeight: 1.15 }}>{farm.full_name}</h1>
            <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              <Chip fill="var(--sky)">{groupName}</Chip>
              {farm.grade && <Chip fill="var(--grape-fill)">{localizeDigits(locale, farm.grade)}</Chip>}
            </div>
          </div>
          {rank > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <RankBadge rank={rank} label={formatNumber(locale, rank)} size={58} />
              <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink-soft)", maxWidth: 90, lineHeight: 1.25 }}>
                {t(locale, "rankInGroup")}
              </span>
            </div>
          )}
          <div
            className="tabular"
            style={{
              padding: "8px 18px",
              borderRadius: 20,
              background: "var(--sun)",
              border: "3px solid var(--outline)",
              boxShadow: "var(--pop)",
              color: "var(--on-fill)",
              textAlign: "center",
              lineHeight: 1.1,
            }}
          >
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 34 }}>
              {formatNumber(locale, farm.total_points)}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{t(locale, "totalPoints")}</div>
          </div>
        </section>

        <div className="farm-grid">
          {/* لون السماء نفسه الذي يرسمه المشهد، فلا يومض إطار بلون آخر قبل أول رسم */}
          <div
            className="pop farm-stage"
            style={{ position: "relative", background: "var(--scene-sky)", borderRadius: 26, overflow: "hidden" }}
          >
            {plants.length === 0 && !mower.active ? (
              <div style={{ padding: 32, display: "grid", placeItems: "center", height: "100%" }}>
                <EmptyState title={t(locale, "emptyFarm")} hint={t(locale, "emptyFarmHint")} />
              </div>
            ) : (
              <FarmScene
                key={sceneKey}
                plants={plants}
                mow={mower.mow}
                skipMow={mower.skipCount}
                arrange={
                  arranging
                    ? {
                        onMove: (list) =>
                          setMoves((prev) => {
                            const next = { ...prev };
                            for (const m of list) next[m.slot] = { x: m.x, y: m.y };
                            return next;
                          }),
                      }
                    : undefined
                }
              />
            )}
            {plants.length > 0 && farmKey && (
              <ArrangeBar
                locale={locale}
                arranging={arranging}
                movedCount={movedCount}
                saving={saving}
                onStart={() => {
                  setArrangeNote(null);
                  setArranging(true);
                }}
                onSave={save}
                onCancel={cancel}
                onReset={resetLayout}
              />
            )}
            {arrangeNote && (
              <div
                role="status"
                className="pop pop-in"
                style={{
                  position: "absolute",
                  top: 14,
                  insetInlineEnd: 64,
                  padding: "8px 14px",
                  borderRadius: 999,
                  fontWeight: 700,
                  background: arrangeNote.tone === "ok" ? "var(--lime)" : "var(--coral-fill)",
                  color: "var(--on-fill)",
                  zIndex: 4,
                }}
              >
                {arrangeNote.text}
              </div>
            )}
            {plants.length > 0 && !arranging && (
              <div
                className="farm-hint"
                style={{
                  position: "absolute",
                  bottom: 14,
                  insetInlineStart: 14,
                  background: "var(--surface)",
                  padding: "6px 12px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--ink)",
                  border: "2.5px solid var(--outline)",
                  boxShadow: "0 3px 0 var(--outline)",
                }}
              >
                <span className="hint-mouse">{t(locale, "dragToPan")}</span>
                <span className="hint-touch">{t(locale, "dragToPanTouch")}</span>
              </div>
            )}
            {celebrating && !mower.active && !mower.summary && (
              <MilestoneCelebration locale={locale} milestone={celebrating} onDone={dismiss} />
            )}
            {mower.active && <MowingBanner locale={locale} onSkip={mower.skip} />}
            {mower.summary && <MowedCard locale={locale} items={mower.summary} onClose={mower.close} />}
            {grown > 0 && (
              <div
                role="status"
                className="pop-in"
                style={{
                  position: "absolute",
                  top: 14,
                  insetInlineEnd: 64,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: "var(--lime)",
                  color: "var(--on-fill)",
                  border: "2.5px solid var(--outline)",
                  boxShadow: "var(--pop)",
                  fontWeight: 700,
                }}
              >
                <span
                  className="tabular"
                  style={{
                    fontFamily: "var(--font-display)",
                    background: "#fff",
                    borderRadius: 999,
                    padding: "0 8px",
                    border: "2px solid var(--outline)",
                  }}
                >
                  +{formatNumber(locale, grown)}
                </span>
                {t(locale, "newPlants")}
              </div>
            )}
          </div>

          <aside className="pop" style={{ padding: 18, borderRadius: 26, background: "var(--surface)", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Stat label={t(locale, "plants")} value={formatNumber(locale, farm.plant_count)} accent="brand" />
              {/* الترتيب في شريط الاسم أعلاه؛ هنا هدف صغير بدلًا منه: جمع الأنواع الأربعة */}
              <Stat
                label={t(locale, "typesCollected")}
                value={`${formatNumber(locale, typesCollected)}/${formatNumber(locale, TIER_LIST.length)}`}
                accent="gold"
              />
            </div>
            <TierLegend locale={locale} counts={counts} />
            <MilestonesCard locale={locale} totalPoints={farm.total_points} typesCollected={typesCollected} />
          </aside>
        </div>
      </main>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .farm-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 18px; align-items: start; }
            .farm-stage { min-height: 540px; }
            .hint-touch { display: none; }
            @media (hover: none) and (pointer: coarse) {
              .hint-mouse { display: none; }
              .hint-touch { display: inline; }
            }
            @media (max-width: 480px) { .hide-narrow { display: none; } }
            @media (max-width: 820px) {
              .farm-grid { grid-template-columns: minmax(0, 1fr) !important; }
              /* البستان معيّنٌ عرضه ضعف ارتفاعه، والعرض هو ما يحدّ حجمه على
                 الجوّال: إطار طوليّ كان يضيف سماءً فارغة لا أكثر */
              .farm-stage { min-height: 0; aspect-ratio: 6 / 5; }
              /* على الشاشة الضيّقة يغطّي التلميح طرف السور، والإيماءات هناك
                 مألوفة بلا شرح */
              .farm-hint { display: none; }
              .farm-banner > div:last-child { margin-inline-start: auto; }
            }
          `,
        }}
      />
    </>
  );
}

/** رقاقة ملوّنة بحدّ غليظ: المجموعة والصف في شريط الاسم. */
function Chip({ fill, children }: { fill: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 14,
        fontWeight: 700,
        padding: "2px 12px",
        borderRadius: 999,
        background: fill,
        color: "var(--on-fill)",
        border: "2.5px solid var(--outline)",
      }}
    >
      {children}
    </span>
  );
}

/**
 * شريط الترتيب أسفل البستان: زرّ «رتّب بستاني» لمن يملك المفتاح، ثم أثناء
 * الترتيب تلميح وعدّاد النقلات و«حفظ» و«إلغاء» و«الترتيب الأصلي».
 */
function ArrangeBar({
  locale,
  arranging,
  movedCount,
  saving,
  onStart,
  onSave,
  onCancel,
  onReset,
}: {
  locale: "ar" | "en";
  arranging: boolean;
  movedCount: number;
  saving: boolean;
  onStart: () => void;
  onSave: () => void;
  onCancel: () => void;
  onReset: () => void;
}) {
  if (!arranging) {
    return (
      <button
        type="button"
        className="press"
        onClick={onStart}
        style={{
          ...buttonStyle("primary"),
          position: "absolute",
          bottom: 14,
          insetInlineEnd: 14,
          zIndex: 3,
          background: "var(--sun)",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
        </svg>
        {t(locale, "arrangeFarm")}
      </button>
    );
  }
  return (
    <div
      className="pop"
      style={{
        position: "absolute",
        insetInline: 12,
        bottom: 12,
        zIndex: 3,
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        padding: "10px 12px",
        borderRadius: 18,
        background: "var(--surface)",
      }}
    >
      <span style={{ flex: "1 1 220px", fontSize: 13, fontWeight: 700, color: "var(--ink-soft)" }}>
        {movedCount > 0 ? `${formatNumber(locale, movedCount)} ${t(locale, "movedCount")}` : t(locale, "arrangeHint")}
      </span>
      <button type="button" className="press" disabled={saving} onClick={onReset} style={{ ...buttonStyle(), padding: "7px 12px", fontSize: 13 }}>
        {t(locale, "resetArrangement")}
      </button>
      <button type="button" className="press" disabled={saving} onClick={onCancel} style={{ ...buttonStyle(), padding: "7px 12px", fontSize: 13 }}>
        {t(locale, "cancel")}
      </button>
      <button
        type="button"
        className="press"
        disabled={saving || movedCount === 0}
        onClick={onSave}
        style={{ ...buttonStyle("primary"), padding: "7px 16px", fontSize: 14 }}
      >
        {t(locale, "saveArrangement")}
      </button>
    </div>
  );
}

export type GardenDeduction = { id: number; tier: string; points: number; grid_x: number; grid_y: number };

const MOWED_PREFIX = "sabbaq-mowed:";

/**
 * الخصومات التي لم يرها هذا الجهاز: تُقرأ من garden_deductions (بلا السبب
 * ولا الفاعل)، فتمرّ الجزّازة عليها مرّة واحدة، ثم تبقى بطاقة تشرح ما حدث
 * حتى يغلقها الطالب.
 *
 * ما رُئي يُحفظ في المتصفح كإنجازات البستان: الطالب لا يسجّل دخولًا. على جهاز
 * آخر (ولي الأمر) تمرّ الجزّازة مرّة أيضًا — وهذا مقصود.
 */
function useMower(id: string, semesterId: string, demo?: GardenDeduction[]) {
  const [pending, setPending] = useState<GardenDeduction[] | null>(null);
  const [summary, setSummary] = useState<GardenDeduction[] | null>(null);
  const [skipCount, setSkipCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (demo) {
      setPending(demo);
      return;
    }
    void (async () => {
      const { data, error } = await createRestClient()
        .from("garden_deductions")
        .select("id, tier, points, grid_x, grid_y")
        .eq("student_id", id)
        .eq("semester_id", semesterId)
        .order("created_at");
      // قبل تشغيل 0008 لا يوجد العرض: لا جزّازة ولا خطأ
      if (cancelled || error || !data) return;
      let seen = new Set<number>();
      try {
        seen = new Set(JSON.parse(localStorage.getItem(MOWED_PREFIX + id) ?? "[]") as number[]);
      } catch {
        // تخزين محجوب: تمرّ الجزّازة ولا نتذكّر
      }
      const fresh = (data as GardenDeduction[]).filter((d) => !seen.has(d.id) && isTier(d.tier));
      if (fresh.length > 0) setPending(fresh);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, semesterId, demo]);

  const done = () => {
    if (!pending) return;
    try {
      const seen = new Set(JSON.parse(localStorage.getItem(MOWED_PREFIX + id) ?? "[]") as number[]);
      for (const d of pending) seen.add(d.id);
      localStorage.setItem(MOWED_PREFIX + id, JSON.stringify([...seen]));
    } catch {
      // انظر أعلاه
    }
    setSummary(pending);
    setPending(null);
  };

  const mow = pending
    ? {
        key: pending.map((d) => d.id).join(","),
        cells: pending.map((d): MowCell => ({ x: d.grid_x, y: d.grid_y, tier: d.tier as MowCell["tier"] })),
        onDone: done,
      }
    : null;

  return {
    mow,
    active: pending !== null,
    summary,
    skipCount,
    skip: () => setSkipCount((n) => n + 1),
    close: () => setSummary(null),
  };
}

function MowingBanner({ locale, onSkip }: { locale: ReturnType<typeof useLocale>; onSkip: () => void }) {
  return (
    <div
      role="status"
      className="pop pop-in"
      style={{
        position: "absolute",
        top: 14,
        insetInline: 14,
        marginInline: "auto",
        width: "fit-content",
        maxWidth: "calc(100% - 28px)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 10px 8px 16px",
        borderRadius: 999,
        fontWeight: 700,
        background: "var(--coral-fill)",
        color: "var(--on-fill)",
        zIndex: 6,
      }}
    >
      <MowerIcon size={26} />
      <span>{t(locale, "mowerPassing")}</span>
      <button
        type="button"
        onClick={onSkip}
        className="press"
        style={{ ...buttonStyle(), padding: "4px 12px", fontSize: 13 }}
      >
        {t(locale, "mowerSkip")}
      </button>
    </div>
  );
}

/** ما أزالته الجزّازة، مجمّعًا بنوع النبتة. يبقى حتى يُغلق: الخصم لا يُخفى. */
function MowedCard({
  locale,
  items,
  onClose,
}: {
  locale: ReturnType<typeof useLocale>;
  items: GardenDeduction[];
  onClose: () => void;
}) {
  const byTier = TIER_LIST.map((spec) => ({
    spec,
    n: items.filter((d) => d.tier === spec.tier).length,
  })).filter((r) => r.n > 0);
  const total = items.reduce((sum, d) => sum + d.points, 0);
  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 16, zIndex: 6, background: "rgba(20, 18, 40, 0.25)" }}>
      <div
        role="alertdialog"
        aria-label={t(locale, "mowerPassed")}
        className="pop pop-in"
        style={{
          padding: "20px 24px",
          borderRadius: 24,
          background: "var(--surface)",
          display: "grid",
          justifyItems: "center",
          gap: 10,
          minWidth: 240,
          textAlign: "center",
          borderColor: "var(--coral-fill)",
        }}
      >
        <MowerIcon size={64} />
        <strong style={{ fontFamily: "var(--font-display)", fontSize: 24 }}>{t(locale, "mowerPassed")}</strong>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
          {byTier.map(({ spec, n }) => (
            <li key={spec.tier} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", fontWeight: 700 }}>
              <span>{locale === "ar" ? spec.labelAr : spec.labelEn}</span>
              {n > 1 && <span className="tabular">×{formatNumber(locale, n)}</span>}
              <span className="tabular" style={{ color: "var(--coral)" }}>
                −{formatNumber(locale, spec.points * n)}
              </span>
            </li>
          ))}
        </ul>
        <span className="tabular" style={{ fontSize: 15, fontWeight: 700, color: "var(--coral)" }}>
          −{formatNumber(locale, total)} {t(locale, "points")}
        </span>
        <button type="button" onClick={onClose} className="press" style={{ ...buttonStyle("primary"), marginTop: 4 }}>
          {t(locale, "ok")}
        </button>
      </div>
    </div>
  );
}

/** جزّازة مرسومة: جسم أحمر وعجلتان ومقبض. */
function MowerIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 48 40" width={size} height={(size * 40) / 48} aria-hidden>
      <path d="M30 22 L44 4" stroke="#24222e" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M40 4 h7" stroke="#24222e" strokeWidth="4" strokeLinecap="round" />
      <rect x="4" y="18" width="30" height="12" rx="4" fill="#e8452c" stroke="#24222e" strokeWidth="2.5" />
      <rect x="10" y="12" width="16" height="8" rx="3" fill="#b3301c" stroke="#24222e" strokeWidth="2.5" />
      <circle cx="11" cy="32" r="5" fill="#24222e" />
      <circle cx="28" cy="32" r="5" fill="#24222e" />
      <circle cx="11" cy="32" r="2" fill="#b9bfc6" />
      <circle cx="28" cy="32" r="2" fill="#b9bfc6" />
    </svg>
  );
}
