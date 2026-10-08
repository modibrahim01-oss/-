"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/Brand";
import FarmScene from "@/components/FarmScene";
import RankBadge from "@/components/RankBadge";
import StarBadge from "@/components/StarBadge";
import { RAINBOW } from "@/components/ui";
import { loadFarm } from "@/lib/farm-data";
import { formatNumber, t } from "@/lib/i18n";
import { createRestClient } from "@/lib/supabase/rest";
import type { BoardRow } from "@/lib/tv-data";
import type { Plant, StudentFarmSummary } from "@/lib/types";
import { useLocale } from "@/lib/useLocale";
import type { WeeklyStar } from "@/lib/weekly";

const SLIDE_MS = 9000;
// إعادة جلب البيانات كل خمس دقائق: الشاشة تبقى معلّقة أسابيع، ولا بد أن
// تلتقط نقاط اليوم الجديدة دون أن يلمسها أحد.
const REFRESH_MS = 5 * 60 * 1000;
// لمس اللوحة أو أزرارها يوقف حركتها التلقائية هذه المدة ثم تستأنف
const BOARD_HOLD_MS = 15000;
// اسم يُضغط في اللوحة يبقى بستانه على الشاشة هذه المدة قبل عودة الدورة
const PICK_HOLD_MS = 30000;
// سرعة التمرير التلقائي: نحو صفّ كل ثانيتين، يُقرأ كل اسم وهو يمرّ
const BOARD_SPEED = 24;
const ROW_STEP = 5;

/**
 * بطاقة الشاشة: بيضاء بحدّ غليظ وظلّ صلب، كبقية الهوية.
 *
 * الشاشة كانت بالوضع الليلي وأشرطة سوداء متدرّجة — عكس ما يطلبه برنامج
 * تحفيزي فيه فرح. البطاقات الصلبة تُقرأ من آخر الممرّ فوق السماء والعشب معًا.
 */
const glass: React.CSSProperties = {
  background: "var(--surface)",
  border: "3px solid var(--outline)",
  borderRadius: 24,
  boxShadow: "var(--pop-lg)",
  color: "var(--ink)",
};

/**
 * تمرير ذاتي للوحة الصدارة: تبدأ من القمة، تنزل ببطء حتى آخر اسم، تتوقف
 * لحظة، ثم تعود للقمة. أي تحكّم من المشاهد (أزرار، أسهم، عجلة، لمس) يوقفها
 * BOARD_HOLD_MS ثم تستأنف من حيث تركها.
 *
 * يُحرَّك scrollTop مباشرة لا حالة React: لا إعادة رسم للصفحة مع كل إطار.
 */
function useAutoScroll(ref: React.RefObject<HTMLElement | null>) {
  const holdUntil = useRef(0);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let phase: "top" | "run" | "bottom" = "top";
    let phaseUntil = last + 5000;
    let carry = 0;
    const step = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      const el = ref.current;
      if (el && now >= holdUntil.current && el.scrollHeight > el.clientHeight + 2) {
        const max = el.scrollHeight - el.clientHeight;
        if (phase === "run") {
          carry += (BOARD_SPEED * dt) / 1000;
          if (carry >= 1) {
            const whole = Math.floor(carry);
            carry -= whole;
            el.scrollTop = Math.min(max, el.scrollTop + whole);
          }
          if (el.scrollTop >= max - 1) {
            phase = "bottom";
            phaseUntil = now + 4000;
          }
        } else if (now >= phaseUntil) {
          if (phase === "bottom") {
            el.scrollTo({ top: 0, behavior: "smooth" });
            phase = "top";
            phaseUntil = now + 5000;
          } else {
            phase = "run";
          }
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [ref]);
  return useCallback(() => {
    holdUntil.current = performance.now() + BOARD_HOLD_MS;
  }, []);
}

type Picked = { summary: StudentFarmSummary; plants: Plant[] };

export default function TvCarousel({
  roster,
  leaderCount = roster.length,
  farms,
  weekly = [],
  board = [],
  scopeName,
}: {
  roster: StudentFarmSummary[];
  /** أول leaderCount في الدورة هم الأوائل بترتيبهم؛ ما بعدهم أبطال أسبوع أُضيفوا */
  leaderCount?: number;
  farms: Record<string, Plant[]>;
  weekly?: WeeklyStar[];
  /** لوحة الصدارة: حتى خمسين اسمًا بترتيب النقاط */
  board?: BoardRow[];
  /** شاشة مجموعة: اسمها في الرأس */
  scopeName?: { ar: string; en: string };
}) {
  const locale = useLocale();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [clock, setClock] = useState("");
  // بستان اختاره المشاهد من اللوحة وليس في دورة العرض: يُجلب عند الطلب
  const [picked, setPicked] = useState<Picked | null>(null);
  const carouselHold = useRef(0);
  const boardRef = useRef<HTMLOListElement>(null);
  const holdBoard = useAutoScroll(boardRef);

  useEffect(() => {
    if (roster.length === 0) return;
    const timer = setInterval(() => {
      if (Date.now() < carouselHold.current) return;
      setPicked(null);
      setIndex((i) => (i + 1) % roster.length);
    }, SLIDE_MS);
    return () => clearInterval(timer);
  }, [roster.length]);

  const scrollBoard = useCallback(
    (dir: 1 | -1, page = false) => {
      const el = boardRef.current;
      if (!el) return;
      holdBoard();
      const row = el.firstElementChild instanceof HTMLElement ? el.firstElementChild.offsetHeight : 48;
      el.scrollBy({ top: dir * (page ? el.clientHeight * 0.9 : row * ROW_STEP), behavior: "smooth" });
    },
    [holdBoard],
  );

  const showStudent = useCallback(
    async (id: string) => {
      carouselHold.current = Date.now() + PICK_HOLD_MS;
      const at = roster.findIndex((r) => r.student_id === id);
      if (at >= 0) {
        setPicked(null);
        setIndex(at);
        return;
      }
      try {
        const data = await loadFarm(createRestClient(), id);
        if (data) setPicked({ summary: data.farm, plants: data.plants });
      } catch {
        // الشبكة متقطّعة: تبقى الدورة كما هي
      }
    },
    [roster],
  );

  // ريموت الشاشة أو لوحة المفاتيح: ↑↓ للوحة، ←→ للبستان السابق والتالي
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") scrollBoard(1);
      else if (e.key === "ArrowUp") scrollBoard(-1);
      else if (e.key === "PageDown") scrollBoard(1, true);
      else if (e.key === "PageUp") scrollBoard(-1, true);
      else if (e.key === "Home" || e.key === "End") {
        holdBoard();
        const el = boardRef.current;
        el?.scrollTo({ top: e.key === "Home" ? 0 : el.scrollHeight, behavior: "smooth" });
      } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && roster.length > 0) {
        // في العربية التالي إلى اليسار
        const forward = (e.key === "ArrowLeft") === (document.documentElement.dir === "rtl");
        carouselHold.current = Date.now() + PICK_HOLD_MS;
        setPicked(null);
        setIndex((i) => (i + (forward ? 1 : roster.length - 1)) % roster.length);
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scrollBoard, holdBoard, roster.length]);

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(
        now.toLocaleTimeString(locale === "ar" ? "ar-SA-u-nu-arab" : "en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    };
    tick();
    const timer = setInterval(tick, 10000);
    return () => clearInterval(timer);
  }, [locale]);

  if (roster.length === 0) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(180deg, var(--scene-sky) 0%, var(--ground) 100%)",
          color: "var(--ink)",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div>
          <BrandMark size={64} />
          <h1 style={{ fontSize: 34, marginTop: 20 }}>{t(locale, "emptyFarm")}</h1>
          <p style={{ color: "var(--ink-soft)", fontSize: 18 }}>{t(locale, "emptyFarmHint")}</p>
        </div>
      </div>
    );
  }

  // الدورة قد تقصر بين تحديثين (طالب عُطّل)، فيُحصر المؤشّر فيها
  const current = picked?.summary ?? roster[index % roster.length];
  const plants = picked?.plants ?? farms[current.student_id] ?? [];
  // الترتيب من اللوحة إن كان فيها؛ بطل أسبوع من خارج الخمسين يحمل نجمة
  const boardRank = board.findIndex((b) => b.student_id === current.student_id) + 1;
  const rosterRank = picked ? 0 : index % roster.length < leaderCount ? (index % roster.length) + 1 : 0;
  const rank = boardRank || rosterRank;
  const weekOf = new Map(weekly.map((w) => [w.student_id, w.week_points]));
  const currentWeek = weekOf.get(current.student_id);
  const groupName = locale === "ar" ? current.group_name_ar : current.group_name_en;
  const boardRows: BoardRow[] = board.length > 0 ? board : roster.slice(0, leaderCount);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scene-sky)",
        color: "var(--ink)",
        overflow: "hidden",
      }}
    >
      {/* المشهد يتأطّر في المساحة التي لا تغطيها لوحة الصدارة، فلا يختفي
          طرف البستان خلفها */}
      <FarmScene
        key={current.student_id}
        plants={plants}
        cinematic
        style={{ insetInlineEnd: "calc(min(400px, 30vw) + 40px)" }}
      />

      <header
        style={{
          position: "absolute",
          top: 20,
          insetInline: 28,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 2,
        }}
      >
        <div style={{ ...glass, display: "flex", alignItems: "center", gap: 12, padding: "10px 18px 10px 12px" }}>
          <BrandMark size={42} />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26 }}>
            {t(locale, "appName")}
          </span>
          {scopeName && (
            <span
              style={{
                fontSize: 20,
                fontWeight: 700,
                padding: "2px 14px",
                borderRadius: 999,
                background: "var(--sky)",
                color: "var(--on-fill)",
                border: "2.5px solid var(--outline)",
              }}
            >
              {locale === "ar" ? scopeName.ar : scopeName.en}
            </span>
          )}
        </div>
        <span
          className="tabular"
          style={{
            ...glass,
            background: "var(--sun)",
            color: "var(--on-fill)",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 24,
            padding: "8px 20px",
          }}
        >
          {clock}
        </span>
      </header>

      <aside
        style={{
          ...glass,
          position: "absolute",
          top: 104,
          bottom: 28,
          insetInlineEnd: 28,
          width: "min(400px, 30vw)",
          padding: "14px 12px 10px",
          display: "flex",
          flexDirection: "column",
          zIndex: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 6px 10px" }}>
          <h2 style={{ margin: 0, fontSize: 24, flex: 1 }}>{t(locale, "leaders")}</h2>
          <BoardButton label={t(locale, "scrollUp")} onClick={() => scrollBoard(-1)} up />
          <BoardButton label={t(locale, "scrollDown")} onClick={() => scrollBoard(1)} />
        </div>
        <ol
          ref={boardRef}
          className="tv-board"
          onWheel={holdBoard}
          onTouchStart={holdBoard}
          onPointerDown={holdBoard}
          style={{ listStyle: "none", margin: 0, padding: 0, flex: 1, minHeight: 0, overflowY: "auto" }}
        >
          {boardRows.map((s, i) => {
            const active = s.student_id === current.student_id;
            return (
              <li key={s.student_id}>
                <button
                  type="button"
                  onClick={() => void showStudent(s.student_id)}
                  style={{
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns: "auto minmax(0, 1fr) auto",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 8px",
                    borderRadius: 12,
                    font: "inherit",
                    textAlign: "start",
                    cursor: "pointer",
                    color: active ? "var(--on-fill)" : "var(--ink)",
                    // الطالب المعروض الآن يُضاء في اللوحة، فيربط المشاهد بين
                    // البستان واسم صاحبه وترتيبه
                    background: active ? "var(--sun)" : "transparent",
                    border: active ? "2.5px solid var(--outline)" : "2.5px solid transparent",
                    transition: "background 400ms ease",
                  }}
                >
                  <RankBadge rank={i + 1} label={formatNumber(locale, i + 1)} size={30} />
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 18,
                        fontWeight: active ? 700 : 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.full_name}
                    </span>
                    {!scopeName && (
                      <span style={{ display: "block", fontSize: 12, color: active ? "var(--on-fill)" : "var(--ink-soft)" }}>
                        {locale === "ar" ? s.group_name_ar : s.group_name_en}
                      </span>
                    )}
                  </span>
                  <span
                    className="tabular"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: 18,
                      color: active ? "var(--on-fill)" : "var(--brand-deep)",
                    }}
                  >
                    {formatNumber(locale, s.total_points)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </aside>

      {weekly.length > 0 && (
        <aside
          style={{
            ...glass,
            position: "absolute",
            top: 104,
            insetInlineStart: 28,
            width: "min(300px, 26vw)",
            padding: "14px 14px 10px",
            background: "color-mix(in oklab, var(--berry) 14%, var(--surface))",
            zIndex: 2,
          }}
        >
          <h2 style={{ margin: "0 6px 8px", fontSize: 22, display: "flex", alignItems: "center", gap: 8 }}>
            <StarBadge size={28} gold />
            {t(locale, "weeklyStars")}
          </h2>
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {weekly.map((w, i) => {
              const active = w.student_id === current.student_id;
              return (
                <li
                  key={w.student_id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto minmax(0, 1fr) auto",
                    alignItems: "center",
                    gap: 10,
                    padding: "6px 8px",
                    borderRadius: 12,
                    background: active ? "var(--sun)" : "transparent",
                    border: active ? "2.5px solid var(--outline)" : "2.5px solid transparent",
                    transition: "background 400ms ease",
                  }}
                >
                  <StarBadge label={formatNumber(locale, i + 1)} size={28} gold={i === 0} />
                  <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: active ? "var(--on-fill)" : undefined }}>
                    {w.full_name}
                  </span>
                  <span className="tabular" style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: active ? "var(--on-fill)" : "var(--brand-deep)" }}>
                    +{formatNumber(locale, w.week_points)}
                  </span>
                </li>
              );
            })}
          </ol>
        </aside>
      )}

      <footer
        style={{
          ...glass,
          position: "absolute",
          bottom: 28,
          insetInlineStart: 28,
          maxWidth: "min(760px, calc(100vw - min(400px, 30vw) - 100px))",
          padding: "18px 24px 20px",
          background:
            "linear-gradient(100deg, color-mix(in oklab, var(--sun) 45%, var(--surface)) 0%, var(--surface) 70%)",
          display: "flex",
          alignItems: "center",
          gap: 20,
          zIndex: 2,
        }}
      >
        {rank > 0 ? (
          <RankBadge rank={rank} label={formatNumber(locale, rank)} size={64} />
        ) : (
          <StarBadge size={64} gold />
        )}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 14,
              flexWrap: "wrap",
              fontFamily: "var(--font-display)",
            }}
          >
            <h1 style={{ margin: 0, fontSize: "clamp(28px, 3.6vw, 46px)", fontWeight: 700 }}>
              {current.full_name}
            </h1>
            <span
              style={{
                fontSize: "clamp(15px, 1.6vw, 20px)",
                fontWeight: 700,
                padding: "0 12px",
                borderRadius: 999,
                background: "var(--sky)",
                color: "var(--on-fill)",
                border: "2.5px solid var(--outline)",
              }}
            >
              {groupName}
            </span>
          </div>
          <div style={{ display: "flex", gap: 30, marginTop: 10, flexWrap: "wrap" }}>
            <TvMetric
              n={formatNumber(locale, current.total_points)}
              label={t(locale, "totalPoints")}
            />
            <TvMetric n={formatNumber(locale, current.plant_count)} label={t(locale, "plants")} />
            {currentWeek !== undefined && (
              <TvMetric n={`+${formatNumber(locale, currentWeek)}`} label={t(locale, "thisWeek")} />
            )}
          </div>
        </div>
      </footer>

      <div
        style={{
          position: "absolute",
          bottom: 0,
          insetInline: 0,
          height: 8,
          background: "color-mix(in oklab, var(--surface) 70%, transparent)",
          borderTop: "2.5px solid var(--outline)",
          zIndex: 3,
        }}
      >
        <div
          key={index}
          style={{
            height: "100%",
            // قوس قزح الهوية يمتدّ مع مرور وقت الشريحة
            background: RAINBOW,
            backgroundSize: "100vw 100%",
            animation: `tvSlide ${SLIDE_MS}ms linear forwards`,
          }}
        />
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes tvSlide { from { width: 0 } to { width: 100% } }
            .tv-board { scrollbar-width: none; }
            .tv-board::-webkit-scrollbar { display: none; }
          `,
        }}
      />
    </div>
  );
}

function BoardButton({ label, onClick, up = false }: { label: string; onClick: () => void; up?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="pop"
      style={{
        width: 44,
        height: 40,
        borderRadius: 12,
        display: "grid",
        placeItems: "center",
        background: "var(--sun)",
        color: "var(--on-fill)",
        cursor: "pointer",
      }}
    >
      <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden style={{ transform: up ? "rotate(180deg)" : undefined }}>
        <path d="M5 9l7 7 7-7" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function TvMetric({ n, label }: { n: string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span
        className="tabular"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(22px, 2.6vw, 32px)",
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {n}
      </span>
      <span
        style={{
          fontSize: 13,
          color: "var(--ink-soft)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginTop: 5,
        }}
      >
        {label}
      </span>
    </div>
  );
}
