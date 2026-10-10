import { notFound } from "next/navigation";
import FarmView from "@/components/FarmView";
import { demoPlants, tierSequence } from "@/lib/demo-farm";
import { totalPoints } from "@/lib/farm";

/**
 * صفحة بستان كاملة ببيانات مولَّدة: تُفحص بها الجزّازة دون خصم حقيقي.
 * محجوبة في الإنتاج.
 *
 *   /dev/garden-preview?mow=3     ← تُخصم آخر ثلاث نبتات متنوّعة وتمرّ الجزّازة
 */
export const dynamic = "force-dynamic";

export default async function GardenPreview({ searchParams }: { searchParams: Promise<{ mow?: string; count?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  const all = demoPlants(tierSequence(Math.max(4, Math.min(400, Number(params.count) || 60)), undefined, 11));
  const n = Math.max(0, Math.min(12, Number(params.mow) || 0));

  // المخصوم: نبتة من كل نوع بالتناوب من آخر البستان، كما يختار deduct_plant الأحدث
  const removed = new Set<number>();
  const tiers = ["red", "purple", "yellow", "green"];
  for (let i = 0; removed.size < n && i < n * 8; i++) {
    const tier = tiers[i % tiers.length];
    const pick = [...all].reverse().find((p) => p.tier === tier && !removed.has(p.slot_index));
    if (pick) removed.add(pick.slot_index);
  }
  const plants = all.filter((p) => !removed.has(p.slot_index));
  const deductions = all
    .filter((p) => removed.has(p.slot_index))
    .map((p, i) => ({ id: 1000 + i, tier: p.tier, points: p.points, grid_x: p.grid_x, grid_y: p.grid_y }));

  // معرّف عشوائي لكل فتح: الجزّازة تُعرض في كل مرّة لا مرّة واحدة على الجهاز
  const id = `00000000-0000-4000-8000-${String(Date.now()).slice(-12).padStart(12, "0")}`;
  return (
    <FarmView
      id={id}
      demoDeductions={deductions}
      initial={{
        farm: {
          student_id: id,
          full_name: "طالب تجريبي",
          search_name: "",
          group_id: 1,
          group_code: "qabas",
          group_name_ar: "قبس",
          group_name_en: "Qabas",
          grade: null,
          semester_id: "demo",
          total_points: totalPoints(plants),
          plant_count: plants.length,
        },
        plants,
        rank: 3,
      }}
    />
  );
}
