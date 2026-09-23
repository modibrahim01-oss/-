"use client";

import { useEffect, useState } from "react";
import { formatNumber, t, type Locale } from "@/lib/i18n";
import {
  type Milestone,
  POINT_MILESTONES,
  milestonesFor,
  milestoneToCelebrate,
  nextPointMilestone,
} from "@/lib/milestones";
import { TIER_LIST } from "@/lib/tiers";

/**
 * إنجازات المزرعة: أوسمة تُضاء حين تُبلغ، وشريط نحو الوسام التالي، واحتفال
 * بقصاصات ملوّنة عند فتح المزرعة بعد إنجاز جديد.
 */

function milestoneLabel(locale: Locale, m: Milestone): string {
  return m.kind === "types" ? t(locale, "milestoneAllTypes") : `${formatNumber(locale, m.target)} ${t(locale, "milestonePoints")}`;
}

/** لون كل وسام بترتيبه: يتصاعد من ليموني إلى ذهبي، كقيمة النبتات. */
const MEDAL_FILLS = ["var(--lime)", "var(--sky)", "var(--grape-fill)", "var(--tangerine)", "#ffc21a"];

function MedalFace({ locale, m, index, size }: { locale: Locale; m: Milestone; index: number; size: number }) {
  if (m.kind === "types") {
    // الأنواع الأربعة: أربع نقاط بألوانها في قرص واحد
    return (
      <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden>
        <circle cx="20" cy="20" r="17" fill={m.reached ? "#fff" : "var(--surface-alt)"} stroke="var(--outline)" strokeWidth="2.5" />
        {TIER_LIST.map((spec, i) => (
          <circle
            key={spec.tier}
            cx={i % 2 === 0 ? 14 : 26}
            cy={i < 2 ? 14 : 26}
            r="5.2"
            fill={m.reached ? spec.color : "var(--border)"}
            stroke="var(--outline)"
            strokeWidth="1.8"
          />
        ))}
      </svg>
    );
  }
  return (
    <span
      className="tabular"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: size * (m.target >= 1000 ? 0.28 : 0.34),
        background: m.reached ? MEDAL_FILLS[index] : "var(--surface-alt)",
        color: m.reached ? "var(--on-fill)" : "var(--ink-mute)",
        border: m.reached ? "2.5px solid var(--outline)" : "2.5px dashed var(--border)",
        boxShadow: m.reached ? "0 3px 0 var(--outline)" : "none",
      }}
    >
      {formatNumber(locale, m.target)}
    </span>
  );
}

export function MilestonesCard({
  locale,
  totalPoints,
  typesCollected,
}: {
  locale: Locale;
  totalPoints: number;
  typesCollected: number;
}) {
  const all = milestonesFor(totalPoints, typesCollected, TIER_LIST.length);
  const next = nextPointMilestone(totalPoints);

  return (
    <div>
      <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>{t(locale, "milestones")}</h2>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: 6,
          justifyItems: "center",
        }}
      >
        {all.map((m, i) => (
          <li key={m.id} title={milestoneLabel(locale, m)} aria-label={`${milestoneLabel(locale, m)}${m.reached ? " ✓" : ""}`}>
            <MedalFace locale={locale} m={m} index={i} size={38} />
          </li>
        ))}
      </ul>

      {next && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--ink-soft)" }}>
            <span>
              {t(locale, "milestoneNext")}: {formatNumber(locale, next.target)}
            </span>
            <span className="tabular">
              {t(locale, "milestoneToGo")} {formatNumber(locale, next.toGo)}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={next.target}
            aria-valuenow={totalPoints}
            style={{
              marginTop: 6,
              height: 14,
              borderRadius: 999,
              background: "var(--surface-alt)",
              border: "2.5px solid var(--outline)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.max(4, Math.round(next.progress * 100))}%`,
                height: "100%",
                background: "linear-gradient(90deg, var(--lime), var(--sun))",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const SEEN_PREFIX = "sabbaq-milestones:";

/**
 * الإنجاز الذي يُحتفل به الآن على هذا الجهاز، مرّة واحدة لكل إنجاز.
 *
 * ما احتُفل به يُحفظ في المتصفح لا في قاعدة البيانات: الطالب لا يسجّل دخولًا،
 * والاحتفال متعة مشاهدة لا سجلّ. قد يُحتفل بالإنجاز نفسه على جهازين —
 * وهذا مقبول، بل مرغوب على جهاز ولي الأمر.
 */
export function useMilestoneCelebration(studentId: string, totalPoints: number, typesCollected: number) {
  const [celebrating, setCelebrating] = useState<Milestone | null>(null);

  useEffect(() => {
    const all = milestonesFor(totalPoints, typesCollected, TIER_LIST.length);
    let seen = new Set<string>();
    try {
      seen = new Set(JSON.parse(localStorage.getItem(SEEN_PREFIX + studentId) ?? "[]") as string[]);
    } catch {
      // تخزين محجوب (تصفّح خاص): نحتفل ولا نتذكّر، أفضل من ألّا نحتفل أبدًا
    }
    const pick = milestoneToCelebrate(all, seen);
    if (!pick) return;
    setCelebrating(pick);
    try {
      const reached = all.filter((m) => m.reached).map((m) => m.id);
      localStorage.setItem(SEEN_PREFIX + studentId, JSON.stringify([...new Set([...seen, ...reached])]));
    } catch {
      // انظر أعلاه
    }
  }, [studentId, totalPoints, typesCollected]);

  useEffect(() => {
    if (!celebrating) return;
    const timer = setTimeout(() => setCelebrating(null), 5200);
    return () => clearTimeout(timer);
  }, [celebrating]);

  return { celebrating, dismiss: () => setCelebrating(null) };
}

const CONFETTI_COLORS = ["var(--lime)", "var(--sun)", "var(--berry)", "var(--sky)", "var(--grape-fill)", "var(--tangerine)"];

/** احتفال فوق المشهد: قصاصات تتساقط ولافتة الإنجاز. تُغلق بلمسة أو وحدها. */
export function MilestoneCelebration({
  locale,
  milestone,
  onDone,
}: {
  locale: Locale;
  milestone: Milestone;
  onDone: () => void;
}) {
  return (
    <div
      role="status"
      onClick={onDone}
      style={{ position: "absolute", inset: 0, zIndex: 5, overflow: "hidden", cursor: "pointer" }}
    >
      {Array.from({ length: 46 }, (_, i) => {
        // مواضع ثابتة بالترتيب لا عشوائية: نفس الاحتفال في كل مرة، بلا Math.random
        const left = (i * 37) % 100;
        const delay = ((i * 53) % 900) / 1000;
        const dur = 2.2 + ((i * 29) % 12) / 10;
        const size = 8 + ((i * 7) % 7);
        return (
          <span
            key={i}
            aria-hidden
            style={{
              position: "absolute",
              top: -20,
              left: `${left}%`,
              width: size,
              height: size * 0.55,
              borderRadius: 2,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              border: "1.5px solid var(--outline)",
              animation: `confetti-fall ${dur}s ${delay}s cubic-bezier(.25,.6,.4,1) forwards`,
              ["--spin" as string]: `${(i % 2 ? 1 : -1) * (360 + ((i * 41) % 360))}deg`,
            }}
          />
        );
      })}
      {/* التوسيط بالشبكة لا بـ transform: حركة pop-in تكتب على transform فتمحو الإزاحة */}
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 16 }}>
      <div
        className="pop pop-in"
        style={{
          padding: "18px 26px",
          borderRadius: 24,
          background: "var(--surface)",
          textAlign: "center",
          display: "grid",
          justifyItems: "center",
          gap: 8,
          minWidth: 220,
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            padding: "2px 12px",
            borderRadius: 999,
            background: "var(--berry)",
            color: "var(--on-fill)",
            border: "2px solid var(--outline)",
          }}
        >
          {t(locale, "milestoneNew")}
        </span>
        <MedalFace
          locale={locale}
          m={milestone}
          index={Math.max(0, (POINT_MILESTONES as readonly number[]).indexOf(milestone.target))}
          size={76}
        />
        <strong style={{ fontFamily: "var(--font-display)", fontSize: 24 }}>{milestoneLabel(locale, milestone)}</strong>
      </div>
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes confetti-fall { 0% { transform: translateY(0) rotate(0) } 100% { transform: translateY(620px) rotate(var(--spin)); opacity: .9 } }`,
        }}
      />
    </div>
  );
}
