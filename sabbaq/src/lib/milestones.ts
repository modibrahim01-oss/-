/**
 * إنجازات المزرعة: عتبات نقاط، وجمع الأنواع الأربعة.
 *
 * العتبات متباعدة تصاعديًا: الأولى قريبة يبلغها الطالب في أيامه الأولى
 * فيذوق طعم الإنجاز مبكرًا، والأخيرة بعيدة تبقى هدفًا طوال الفصل.
 */
export const POINT_MILESTONES = [100, 250, 500, 1000, 2000] as const;

export type MilestoneId = `points-${(typeof POINT_MILESTONES)[number]}` | "all-types";

export type Milestone = {
  id: MilestoneId;
  kind: "points" | "types";
  /** للنقاط: العتبة؛ للأنواع: عدد الأنواع المطلوب */
  target: number;
  reached: boolean;
};

export function milestonesFor(totalPoints: number, typesCollected: number, typesTotal = 4): Milestone[] {
  return [
    ...POINT_MILESTONES.map((target) => ({
      id: `points-${target}` as MilestoneId,
      kind: "points" as const,
      target,
      reached: totalPoints >= target,
    })),
    { id: "all-types", kind: "types", target: typesTotal, reached: typesCollected >= typesTotal },
  ];
}

/** العتبة التالية وما بقي لها، أو null لمن تجاوز آخرها. */
export function nextPointMilestone(totalPoints: number): { target: number; toGo: number; progress: number } | null {
  const target = POINT_MILESTONES.find((m) => totalPoints < m);
  if (target === undefined) return null;
  const idx = POINT_MILESTONES.indexOf(target);
  const from = idx === 0 ? 0 : POINT_MILESTONES[idx - 1];
  return { target, toGo: target - totalPoints, progress: (totalPoints - from) / (target - from) };
}

/**
 * الإنجاز الذي يُحتفل به عند الفتح: أعلى ما بُلغ ولم يُحتفل به على هذا
 * الجهاز. واحدٌ لا سلسلة: طالب يفتح مزرعته أول مرة بخمسمئة نقطة يرى
 * احتفالًا واحدًا بأكبر إنجازاته، لا ثلاثة متتالية.
 */
export function milestoneToCelebrate(all: readonly Milestone[], seen: ReadonlySet<string>): Milestone | null {
  const fresh = all.filter((m) => m.reached && !seen.has(m.id));
  if (fresh.length === 0) return null;
  // جمع الأنواع الأربعة أندر من عتبة نقاط، فيتقدّم إن كان بين الجديد
  return fresh.find((m) => m.kind === "types") ?? fresh[fresh.length - 1];
}
