import { quadrantCoord, type GridPoint } from "./layout";
import { type FieldBounds, fieldBoundsFor } from "./plants";
import type { Plant } from "./types";

/**
 * خانة كل نبتة في التخطيط الافتراضي: ترتيبها داخل فئتها بترتيب منحها
 * (slot_index) ← quadrantCoord.
 *
 * مرآة الحساب في farm_default_bounds و reset_farm (0007): الترتيب الأصلي الذي
 * يعود إليه الطالب، والسور الذي يُسمح له بالترتيب داخله.
 */
export function defaultCells(plants: readonly Plant[]): Map<number, GridPoint> {
  const byTier = new Map<string, Plant[]>();
  for (const p of plants) {
    const list = byTier.get(p.tier) ?? [];
    list.push(p);
    byTier.set(p.tier, list);
  }
  const out = new Map<number, GridPoint>();
  for (const list of byTier.values()) {
    list.sort((a, b) => a.slot_index - b.slot_index);
    list.forEach((p, rank) => out.set(p.slot_index, quadrantCoord(p.tier, rank)));
  }
  return out;
}

/**
 * السور الذي يُرتَّب داخله: حدود التخطيط الافتراضي بهامشها.
 *
 * ثابت مهما رتّب الطالب — لو حُسب من الخانات الفعلية لاتّسع خانتين مع كل
 * نبتة تُوضع على حافته. وقاعدة البيانات تفرض الحدود نفسها عند الحفظ.
 */
export function arrangeBounds(plants: readonly Plant[]): FieldBounds {
  return fieldBoundsFor([...defaultCells(plants).values()]);
}

/**
 * السور المرسوم: حدود الترتيب، ممدودة لتشمل أي نبتة تقع خارجها فعلًا (بيانات
 * قديمة) — فلا تُرسم نبتة خارج سورها أبدًا.
 */
export function farmBounds(plants: readonly Plant[]): FieldBounds {
  const b = { ...arrangeBounds(plants) };
  for (const p of plants) {
    b.minX = Math.min(b.minX, p.grid_x);
    b.maxX = Math.max(b.maxX, p.grid_x);
    b.minZ = Math.min(b.minZ, p.grid_y);
    b.maxZ = Math.max(b.maxZ, p.grid_y);
  }
  return b;
}

export function insideBounds(b: FieldBounds, x: number, y: number): boolean {
  return x >= b.minX && x <= b.maxX && y >= b.minZ && y <= b.maxZ;
}
