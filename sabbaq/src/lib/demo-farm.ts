import { quadrantCoord } from "./layout";
import { TIER_LIST } from "./tiers";
import type { Tier } from "./tiers";
import type { Plant } from "./types";

/**
 * بساتين مولَّدة لصفحات المعاينة في /dev: تُفحَص بها الشاشات بلا قاعدة
 * بيانات، وبنفس دالة التخطيط التي يستعملها award_points.
 */

export function seeded(seed: number) {
  let s = (seed * 2654435761) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const LETTER: Record<string, Tier> = { g: "green", y: "yellow", p: "purple", r: "red" };

/**
 * فئات النبتات بترتيب منحها: من `seq` إن وُجد، وإلا توزيع واقعي مولَّد.
 *
 * `seq` يعيد إنتاج بستان طالب حقيقي حرفًا بحرف — هكذا تُفحَص مشكلة يراها
 * المالك على الموقع الحيّ دون الوصول إلى قاعدة بياناته.
 */
export function tierSequence(count: number, seq: string | undefined, seed = 42): Tier[] {
  if (seq) return [...seq].map((c) => LETTER[c]).filter((t): t is Tier => Boolean(t));
  const rng = seeded(seed);
  return Array.from({ length: count }, () => {
    const r = rng();
    // توزيع واقعي: الأخضر هو الغالب والأحمر نادر
    return r < 0.5 ? "green" : r < 0.8 ? "yellow" : r < 0.95 ? "purple" : "red";
  });
}

export function demoPlants(tiers: Tier[]): Plant[] {
  const plants: Plant[] = [];
  // ترتيب كل نبتة داخل فئتها هو ما يحدّد موضعها، كما في award_points
  const rank: Record<Tier, number> = { green: 0, yellow: 0, purple: 0, red: 0 };
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    const { x, y } = quadrantCoord(tier, rank[tier]++);
    plants.push({
      slot_index: i,
      grid_x: x,
      grid_y: y,
      tier,
      points: TIER_LIST.find((t) => t.tier === tier)!.points,
      awarded_at: new Date().toISOString(),
    });
  }
  return plants;
}
