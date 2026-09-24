/**
 * يجلب كل صفوف استعلام صفحةً صفحة.
 *
 * Supabase يقصّ كل رد عند ١٠٠٠ صف افتراضيًا (max-rows) مهما طلبنا بـ limit،
 * وبلا خطأ: الاستعلام «ينجح» بجزء من البيانات. سجلّ النقاط يتجاوز الألف
 * سريعًا، فأي مجموع يُحسب منه في التطبيق يمرّ من هنا وإلا نقص بصمت.
 *
 * `page(from, to)` يبني الاستعلام نفسه لكل صفحة مع ترتيب ثابت — بلا ترتيب
 * قد تتكرّر صفوف بين صفحتين أو تسقط.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
  maxRows = 200_000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}
