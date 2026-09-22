import { notFound } from "next/navigation";
import FarmView from "@/components/FarmView";
import { loadFarm } from "@/lib/farm-data";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * الصفحة تُخدَم مخزَّنةً من الحافة فتظهر فورًا، والمتصفح يُكمل الباقي:
 * FarmView يعيد قراءة المزرعة من Supabase بعد الفتح، فنبتة مُنحت قبل ثوانٍ
 * تنمو أمام الطالب ولو كانت النسخة المخزَّنة أقدم منها.
 *
 * هذا لا يُترك لإعادة التوليد وحدها: التخزين على Netlify يخدم النسخة القديمة
 * لأول زائر بعد انتهاء صلاحيتها ثم يولّد الجديدة في الخلفية — فالطالب الذي
 * يفتح مزرعته بعد المنح مباشرة كان يرى مزرعته بلا نبتته الجديدة.
 *
 * لا تُقرأ اللغة هنا: قراءة الكوكي تُسقِط هذا التخزين وتجعل كل فتح لمزرعة
 * رحلةً إلى دالة الخادم — وهي أكثر صفحة يفتحها الطلاب.
 */
export const revalidate = 30;

/**
 * لا مزرعة تُبنى وقت البناء — قائمة الطلاب تتغيّر ولا تُعرف حينها. وجود
 * الدالة فارغةً هو ما يجعل Next يعامل المسار كصفحة ساكنة تُولَّد عند أول
 * طلب ثم تُخزَّن، بدل أن يُعيد رسمها لكل زائر.
 */
export function generateStaticParams() {
  return [];
}

export default async function FarmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadFarm(createPublicClient(), id);
  if (!data) notFound();
  return <FarmView id={id} initial={data} />;
}
