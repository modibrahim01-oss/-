import { notFound } from "next/navigation";
import ArrangePreview from "./ArrangePreview";
import FarmScene from "@/components/FarmScene";
import { demoPlants, tierSequence } from "@/lib/demo-farm";
import { TIER_LIST } from "@/lib/tiers";
import type { Plant } from "@/lib/types";

/**
 * معاينة البستان ببيانات مولَّدة، بلا قاعدة بيانات.
 *
 * تجعل فحص المحرّك ثلاثي الأبعاد ممكنًا قبل وجود مشروع Supabase: الأشكال،
 * الإضاءة، الظلال، وكثافة الشبكة عند أعداد كبيرة. محجوبة في الإنتاج.
 *
 *   /dev/farm-preview?count=200&dusk=1
 *   /dev/farm-preview?seq=gyrpgpyyprrrrrrrrr   ← بستان حقيقي بترتيب منحها
 */
export const dynamic = "force-dynamic";

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
    arrange?: string;
  }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const params = await searchParams;
  const showcase = params.showcase === "1";
  const count = Math.max(1, Math.min(2000, Number(params.count) || 120));
  const plants = showcase ? showcasePlants() : demoPlants(tierSequence(count, params.seq));

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      {params.arrange === "1" ? (
        <ArrangePreview plants={plants} />
      ) : (
        <FarmScene
          plants={plants}
          dusk={params.dusk === "1"}
          cinematic={params.cinematic === "1"}
        />
      )}
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
