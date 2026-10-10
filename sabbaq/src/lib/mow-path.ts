/**
 * مسار الجزّازة بين خانات النبتات المخصومة: تبدأ من أقرب خانة إلى ركن
 * البستان، ثم تذهب كل مرّة إلى أقرب خانة لم تمرّ عليها. مسار قصير بلا
 * رجوع، فيقرأ الطالب حركتها خانةً خانة.
 *
 * يُعيد ترتيب المؤشّرات لا الخانات نفسها: المشهد يربط كل خانة بنبتتها.
 */
export function mowRoute(cells: readonly { x: number; y: number }[]): number[] {
  if (cells.length === 0) return [];
  const left = new Set(cells.map((_, i) => i));
  let current = 0;
  for (const i of left) {
    const a = cells[i];
    const b = cells[current];
    if (a.x + a.y < b.x + b.y || (a.x + a.y === b.x + b.y && a.x < b.x)) current = i;
  }
  const order = [current];
  left.delete(current);
  while (left.size > 0) {
    const from = cells[current];
    let best = -1;
    let bestD = Infinity;
    for (const i of left) {
      const d = (cells[i].x - from.x) ** 2 + (cells[i].y - from.y) ** 2;
      if (d < bestD || (d === bestD && i < best)) {
        best = i;
        bestD = d;
      }
    }
    order.push(best);
    left.delete(best);
    current = best;
  }
  return order;
}

/** المسافة المقطوعة عند كل نقطة من نقاط المسار، بدءًا من الصفر. */
export function cumulative(points: readonly { x: number; z: number }[]): number[] {
  const out = [0];
  for (let i = 1; i < points.length; i++) {
    out.push(out[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z));
  }
  return out;
}

/** الموضع واتجاه الحركة بعد قطع مسافة `d` على المسار. */
export function pointAt(
  points: readonly { x: number; z: number }[],
  cum: readonly number[],
  d: number,
): { x: number; z: number; dx: number; dz: number } {
  const total = cum[cum.length - 1];
  const at = Math.max(0, Math.min(total, d));
  let i = 1;
  while (i < cum.length - 1 && cum[i] < at) i++;
  const a = points[i - 1];
  const b = points[i];
  const span = cum[i] - cum[i - 1];
  const t = span > 0 ? (at - cum[i - 1]) / span : 1;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  return { x: a.x + dx * t, z: a.z + dz * t, dx, dz };
}
