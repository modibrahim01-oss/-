/**
 * ترتيب لوحة الصدارة الذي يضعه المشرف بالسحب على شاشة بعينها.
 *
 * يُحفظ في متصفح الشاشة نفسها (لكل شاشة مفتاحها: العامة وكل مجموعة)، فلا
 * يغيّر ما تعرضه شاشات أخرى ولا نقاط أحد. المحفوظ قائمة معرّفات فقط:
 *  - من غاب عن اللوحة (عُطّل أو خرج من الخمسين) يسقط منها بصمت؛
 *  - ومن دخلها بعد الحفظ يأخذ مكانه الطبيعي بالنقاط بين المرتَّبين.
 */

export const ORDER_PREFIX = "sabbaq-tv-order:";

export function applyOrder<T extends { student_id: string }>(rows: readonly T[], saved: readonly string[] | null): T[] {
  if (!saved || saved.length === 0) return [...rows];
  const byId = new Map(rows.map((r) => [r.student_id, r]));
  const result: T[] = [];
  const placed = new Set<string>();
  for (const id of saved) {
    const row = byId.get(id);
    if (row && !placed.has(id)) {
      result.push(row);
      placed.add(id);
    }
  }
  rows.forEach((row, natural) => {
    if (placed.has(row.student_id)) return;
    result.splice(Math.min(natural, result.length), 0, row);
  });
  return result;
}

/** ينقل عنصرًا من موضع إلى آخر ويعيد قائمة جديدة. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from < 0 || from >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
  return next;
}
