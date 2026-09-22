import { notFound } from "next/navigation";
import FarmScene from "@/components/FarmScene";
import { quadrantCoord } from "@/lib/layout";
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
 *   /dev/farm-preview?seq=gyrpgpyyprrrrrrrrr   ← مزرعة حقيقية بترتيب منحها
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

const LETTER: Record<string, Tier> = { g: "green", y: "yellow", p: "purple", r: "red" };

/**
 * فئات النبتات بترتيب منحها: من `seq` إن وُجد، وإلا توزيع واقعي مولَّد.
 *
 * `seq` يعيد إنتاج مزرعة طالب حقيقي حرفًا بحرف — هكذا تُفحَص مشكلة يراها
 * المالك على الموقع الحيّ دون الوصول إلى قاعدة بياناته.
 */
function tierSequence(count: number, seq: string | undefined, seed = 42): Tier[] {
  if (seq) return [...seq].map((c) => LETTER[c]).filter((t): t is Tier => Boolean(t));
  const rng = seeded(seed);
  return Array.from({ length: count }, () => {
    const r = rng();
    // توزيع واقعي: الأخضر هو الغالب والأحمر نادر
    return r < 0.5 ? "green" : r < 0.8 ? "yellow" : r < 0.95 ? "purple" : "red";
  });
}

function demoPlants(tiers: Tier[]): Plant[] {
  const plants: Plant[] = [];
  // ترتيب كل نبتة داخل فئتها هو ما يحدّد موضعها، كما في award_points
  const rank: Record<Tier, number> = { green: 0, yellow: 0, purple: 0, red: 0 };
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    const { x, y } = quadrantCoord(tier, rank[tier]++);
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

/** نبتة واحدة من كل فئة، متباعدة — الكاميرا تملأ بها الإطار فتُرى التفاصيل. */
function showcasePlants(): Plant[] {
  return TIER_LIST.map((spec, i) => ({
    slot_index: i,
    grid_x: (i % 2) * 3 - 1,
    grid_y: Math.floor(i / 2) * 3 - 1,
    tier: spec.tier,
    points: spec.points,
    awarded_at: new Date().toISOString(),
  }));
}

export default async function FarmPreview({
  searchParams,
}: {
  searchParams: Promise<{
    count?: string;
    dusk?: string;
    cinematic?: string;
    showcase?: string;
    seq?: string;
  }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const params = await searchParams;
  const showcase = params.showcase === "1";
  const count = Math.max(1, Math.min(2000, Number(params.count) || 120));
  const plants = showcase ? showcasePlants() : demoPlants(tierSequence(count, params.seq));

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
        {showcase ? "showcase · واحدة من كل فئة" : `${plants.length} plants · dev preview`}
      </div>
    </div>
  );
}
