import { notFound } from "next/navigation";
import TvCarousel from "@/components/TvCarousel";
import { createPublicClient } from "@/lib/supabase/public";
import { loadTvData, parseGroupSegment } from "@/lib/tv-data";

/**
 * شاشة عرض لمجموعات مشرف: /tv/2 أو /tv/2-3. نفس الشاشة العامة مُصفّاةً
 * بالمجموعة، يفتحها المشرف من لوحته ليعرض سباق طلابه وحدهم.
 *
 * تُخزَّن كل مجموعة وحدها كالشاشة العامة: الدالة الفارغة تجعل Next يولّد
 * المسار عند أول طلب ثم يخزّنه (انظر farm/[id]/page.tsx).
 */
export const revalidate = 60;

export function generateStaticParams() {
  return [];
}

export default async function GroupTvPage({ params }: { params: Promise<{ groups: string }> }) {
  const { groups } = await params;
  const ids = parseGroupSegment(groups);
  if (!ids) notFound();

  const supabase = createPublicClient();
  const [data, { data: groupRows }] = await Promise.all([
    loadTvData(supabase, ids),
    supabase.from("groups").select("id, name_ar, name_en").in("id", ids).order("sort_order"),
  ]);
  if (!groupRows || groupRows.length === 0) notFound();

  return (
    <TvCarousel
      {...data}
      scopeName={{
        ar: groupRows.map((g) => g.name_ar as string).join("، "),
        en: groupRows.map((g) => g.name_en as string).join(", "),
      }}
    />
  );
}
