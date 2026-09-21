/**
 * فئات النقاط الأربعة. الأزرار الثابتة في واجهة المشرف تُبنى من هذا المصدر
 * وحده — لا يوجد إدخال يدوي للأرقام في أي مكان في النظام.
 */

export const TIERS = ["green", "yellow", "purple", "red"] as const;
export type Tier = (typeof TIERS)[number];

export type TierSpec = {
  tier: Tier;
  points: 10 | 20 | 30 | 50;
  /** اللون الأساسي للنبتة على الشبكة */
  color: string;
  /** لون داكن للتظليل والتفاصيل */
  shade: string;
  labelAr: string;
  labelEn: string;
  /** شكل النبتة على المزرعة — كل فئة كائن مختلف تمامًا */
  plant: "bush" | "tulips" | "mushroom" | "fruitTree";
};

export const TIER_SPECS: Record<Tier, TierSpec> = {
  green: {
    tier: "green",
    points: 10,
    color: "#66C13B",
    shade: "#4A9E28",
    labelAr: "شجيرة",
    labelEn: "Bush",
    plant: "bush",
  },
  yellow: {
    tier: "yellow",
    points: 20,
    color: "#FFC833",
    shade: "#FFA218",
    labelAr: "زهور",
    labelEn: "Tulips",
    plant: "tulips",
  },
  purple: {
    tier: "purple",
    points: 30,
    color: "#A65EBB",
    shade: "#7C4B8B",
    labelAr: "فطر",
    labelEn: "Mushroom",
    plant: "mushroom",
  },
  red: {
    tier: "red",
    points: 50,
    color: "#E73B2F",
    shade: "#A82418",
    labelAr: "شجرة مثمرة",
    labelEn: "Fruit tree",
    plant: "fruitTree",
  },
};

/** بترتيب تصاعدي — هذا هو ترتيب الأزرار في الواجهة. */
export const TIER_LIST: TierSpec[] = TIERS.map((t) => TIER_SPECS[t]);

export function tierPoints(tier: Tier): number {
  return TIER_SPECS[tier].points;
}

export function isTier(value: unknown): value is Tier {
  return typeof value === "string" && (TIERS as readonly string[]).includes(value);
}
