import TvCarousel from "@/components/TvCarousel";
import { createPublicClient } from "@/lib/supabase/public";
import { loadTvData } from "@/lib/tv-data";

/**
 * وضع العرض للشاشات الكبيرة. يجلب الأوائل وبساتينهم دفعة واحدة، ثم يدوّر
 * بينهم في المتصفح — شاشة معلّقة في ممر لا تعيد الاتصال كل ٦ ثوان.
 *
 * ولا يقرأ لغةً من كوكي: الشاشة تُعاد تحميلها بلا توقّف، وجعلها ديناميكية
 * يعني رحلةً كاملة إلى دالة الخادم مع كل إعادة تحميل بلا مقابل.
 */
export const revalidate = 60;

export default async function TvPage() {
  const data = await loadTvData(createPublicClient(), null);
  return <TvCarousel {...data} />;
}
