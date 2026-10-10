import { notFound } from "next/navigation";
import TvCarousel from "@/components/TvCarousel";
import { demoPlants, seeded, tierSequence } from "@/lib/demo-farm";
import { totalPoints } from "@/lib/farm";
import type { BoardRow } from "@/lib/tv-data";
import type { Plant, StudentFarmSummary } from "@/lib/types";

/**
 * معاينة شاشة العرض بخمسين طالبًا مولَّدين، بلا قاعدة بيانات: حركة اللوحة
 * وأزرارها وضغط الأسماء. محجوبة في الإنتاج.
 *
 *   /dev/tv-preview            الشاشة العامة
 *   /dev/tv-preview?group=1    شاشة مجموعة
 */
export const dynamic = "force-dynamic";

const NAMES = ["محمد", "عبدالله", "أحمد", "فيصل", "سعد", "خالد", "يوسف", "عمر", "سلمان", "تركي"];
const FAMILIES = ["الحيمي", "الفريح", "البكري", "العبدالجبار", "القحطاني", "الدوسري", "الشهري", "العتيبي"];
const GROUPS = [
  { id: 1, ar: "قبس", en: "Qabas" },
  { id: 2, ar: "مجد ١", en: "Majd 1" },
  { id: 4, ar: "باسل ١", en: "Basil 1" },
];

export default async function TvPreview({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { group } = await searchParams;
  const only = group ? GROUPS.find((g) => g.id === Number(group)) : undefined;

  const rng = seeded(7);
  const students: (StudentFarmSummary & { plants: Plant[] })[] = Array.from({ length: 60 }, (_, i) => {
    const g = only ?? GROUPS[i % GROUPS.length];
    const plants = demoPlants(tierSequence(10 + Math.floor(rng() * 160), undefined, i + 1));
    return {
      student_id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
      full_name: `${NAMES[i % NAMES.length]} ${FAMILIES[(i * 3) % FAMILIES.length]}`,
      search_name: "",
      group_id: g.id,
      group_code: String(g.id),
      group_name_ar: g.ar,
      group_name_en: g.en,
      grade: null,
      semester_id: "demo",
      total_points: totalPoints(plants),
      plant_count: plants.length,
      plants,
    };
  }).sort((a, b) => b.total_points - a.total_points);

  const roster = students.slice(0, 12);
  const farms = Object.fromEntries(roster.map((s) => [s.student_id, s.plants]));
  const board: BoardRow[] = students.slice(0, 50);

  return (
    <TvCarousel
      roster={roster}
      leaderCount={roster.length}
      farms={farms}
      board={board}
      weekly={roster.slice(3, 6).map((s, i) => ({ ...s, week_points: 120 - i * 30 }))}
      scopeName={only ? { ar: only.ar, en: only.en } : undefined}
    />
  );
}
