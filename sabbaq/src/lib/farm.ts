import { isTier, type Tier } from "./tiers";
import type { Plant } from "./types";

/**
 * يحوّل صفوف points_ledger إلى نبتات جاهزة للرسم.
 *
 * الصفوف المسحوبة (revoked) لا تُرسَل من الخادم أصلًا، لكن خانتها تبقى
 * محجوزة في الحلزون: لا نعيد ترقيم الخانات، وإلا انتقلت كل نبتة بعدها إلى
 * موضع آخر وتغيّر شكل المزرعة كلها بسبب سحب نقطة واحدة.
 */
export function toPlants(
  rows: { slot_index: number; grid_x: number; grid_y: number; tier: string; points: number; awarded_at: string }[],
): Plant[] {
  const plants: Plant[] = [];
  for (const row of rows) {
    if (!isTier(row.tier)) continue;
    plants.push({
      slot_index: row.slot_index,
      grid_x: row.grid_x,
      grid_y: row.grid_y,
      tier: row.tier,
      points: row.points,
      awarded_at: row.awarded_at,
    });
  }
  return plants.sort((a, b) => a.slot_index - b.slot_index);
}

export function countByTier(plants: Plant[]): Record<Tier, number> {
  const counts: Record<Tier, number> = { green: 0, yellow: 0, purple: 0, red: 0 };
  for (const p of plants) counts[p.tier] += 1;
  return counts;
}

export function totalPoints(plants: Plant[]): number {
  return plants.reduce((sum, p) => sum + p.points, 0);
}
