/**
 * الخوارزمية الحلزونية: خانة → إحداثيات على شبكة صحيحة.
 *
 * حلزون مربعي (Ulam) يبدأ من المركز (0,0) ويتوسّع للخارج طبقة طبقة، فيملأ
 * الشبكة بلا فراغات ولا تكرار. الطالب لا يضع نبتته: الخانة تُحجَز في
 * قاعدة البيانات وقت المنح، وهذه الدالة تترجمها لموضع على الرسم.
 *
 * مُطابِقة حرفيًا لـ spiral_coord في supabase/migrations/0002_functions.sql.
 * أي تعديل هنا يجب أن يُنسخ هناك، وإلا اختلف رسم العميل عن حساب الخادم.
 */

export type GridPoint = { x: number; y: number };

export function spiralCoord(n: number): GridPoint {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`spiralCoord: slot index must be a non-negative integer, got ${n}`);
  }
  if (n === 0) return { x: 0, y: 0 };

  // تقدير الطبقة ثم تصحيحه. التصحيح يحمي من خطأ الفاصلة العائمة عند
  // المربعات الكاملة (n = (2k+1)² − 1) حيث Math.ceil قد يزيد طبقة زائدة.
  let k = Math.ceil((Math.sqrt(n + 1) - 1) / 2);
  while (k > 0 && n < (2 * k - 1) ** 2) k -= 1;
  while (n >= (2 * k + 1) ** 2) k += 1;

  const leg = 2 * k;
  const ringLo = (2 * k - 1) ** 2;
  const off = n - ringLo;
  const side = Math.floor(off / leg);
  const p = off % leg;

  switch (side) {
    case 0:
      return { x: k, y: -k + p + 1 }; // يمين، صعودًا
    case 1:
      return { x: k - p - 1, y: k }; // أعلى، يسارًا
    case 2:
      return { x: -k, y: k - p - 1 }; // يسار، نزولًا
    default:
      return { x: -k + p + 1, y: -k }; // أسفل، يمينًا
  }
}

/** أصغر طبقة تحتوي الخانة `n` — تُستخدم لحساب حدود الكاميرا. */
export function ringOf(n: number): number {
  if (n === 0) return 0;
  let k = Math.ceil((Math.sqrt(n + 1) - 1) / 2);
  while (k > 0 && n < (2 * k - 1) ** 2) k -= 1;
  while (n >= (2 * k + 1) ** 2) k += 1;
  return k;
}

/** سعة الشبكة حتى الطبقة k تراكميًا. */
export function capacityUpToRing(k: number): number {
  return (2 * k + 1) ** 2;
}
