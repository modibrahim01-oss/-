import { notFound } from "next/navigation";
import FarmScene from "@/components/FarmScene";
import { spiralCoord } from "@/lib/spiral";
import { TIER_LIST } from "@/lib/tiers";
import type { Tier } from "@/lib/tiers";
import type { Plant } from "@/lib/types";

/**
 * معاينة المزرعة ببيانات مولَّدة، بلا قاعدة بيانات.
 *
 * تجعل فحص المحرّك ثلاثي الأبعاد ممكنًا قبل وجود مشروع Supabase: الأشكال،
 * الإضاءة، الظلال، وكثافة الشبكة عند أعداد كبيرة. محجوبة في الإنتاج.
 *
 *   /dev/farm-preview?count=200&dusk=1
 */
export const dynamic = "force-dynamic";

function seeded(seed: number) {
  let s = (seed * 2654435761) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function demoPlants(count: number, seed = 42): Plant[] {
  const rng = seeded(seed);
  const plants: Plant[] = [];
  for (let i = 0; i < count; i++) {
    const r = rng();
    // توزيع واقعي: الأخضر هو الغالب والأحمر نادر
    const tier: Tier = r < 0.5 ? "green" : r < 0.8 ? "yellow" : r < 0.95 ? "purple" : "red";
    const { x, y } = spiralCoord(i);
    plants.push({
      slot_index: i,
      grid_x: x,
      grid_y: y,
      tier,
      points: TIER_LIST.find((t) => t.tier === tier)!.points,
      awarded_at: new Date().toISOString(),
    });
  }
  return plants;
}

export default async function FarmPreview({
  searchParams,
}: {
  searchParams: Promise<{ count?: string; dusk?: string; cinematic?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const params = await searchParams;
  const count = Math.max(1, Math.min(2000, Number(params.count) || 120));
  const plants = demoPlants(count);

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <FarmScene
        plants={plants}
        dusk={params.dusk === "1"}
        cinematic={params.cinematic === "1"}
      />
      <div
        style={{
          position: "absolute",
          top: 12,
          insetInlineEnd: 12,
          background: "rgba(0,0,0,0.6)",
          color: "#f0e4c2",
          padding: "8px 14px",
          borderRadius: 10,
          fontSize: 13,
          fontFamily: "ui-monospace, monospace",
          zIndex: 5,
        }}
      >
        {count} plants · dev preview
      </div>
    </div>
  );
}
