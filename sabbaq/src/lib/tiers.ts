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
  /**
   * لون اللون نفسه حين يُكتَب نصًّا.
   *
   * `color` مشبع ليطابق النبتة على الشبكة، وهو لهذا لا يصلح نصًّا: الأصفر
   * عليه تباين ١٫٥٥:١ على أبيض — غير مقروء عمليًا. هذا الحقل نسخته الداكنة
   * التي تتجاوز ٤٫٥:١، وهو ما تستعمله الواجهة في كل موضع نصّ.
   */
  ink: string;
  labelAr: string;
  labelEn: string;
  /** شكل النبتة على البستان — كل فئة كائن مختلف تمامًا */
  plant: "wheat" | "sprout" | "flowers" | "fruitTree";
};

/**
 * أسماء الفئات (`green`، `yellow`…) معرّفات في قاعدة البيانات لا ألوان: هي
 * قيم النوع `point_tier`، وعليها يقوم السجل وزوايا البستان. حين تغيّرت
 * النبتات بقيت الأسماء، فالسنبلة الذهبية هي `green` والنبتة الخضراء `yellow`.
 * كل ما يُرى (الاسم، اللون، الشكل) يأتي من هنا لا من اسم الفئة.
 */
export const TIER_SPECS: Record<Tier, TierSpec> = {
  green: {
    tier: "green",
    points: 10,
    color: "#FFC93C",
    shade: "#E0A52E",
    ink: "#8A6410",
    labelAr: "سنبلة",
    labelEn: "Wheat",
    plant: "wheat",
  },
  yellow: {
    tier: "yellow",
    points: 20,
    color: "#7BD44E",
    shade: "#52A832",
    ink: "#38821F",
    labelAr: "نبتة",
    labelEn: "Sprout",
    plant: "sprout",
  },
  purple: {
    tier: "purple",
    points: 30,
    color: "#BB6EE0",
    shade: "#9A4FC4",
    ink: "#74408F",
    labelAr: "زهور",
    labelEn: "Flowers",
    plant: "flowers",
  },
  red: {
    tier: "red",
    points: 50,
    color: "#FF4436",
    shade: "#D12A1C",
    ink: "#A82418",
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
