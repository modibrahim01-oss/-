import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { leafBlade, leafMatrix, limbMatrix, petalBlade } from "./plant-parts";
import type { Tier } from "./tiers";

/**
 * نماذج النبتات الأربعة، كلٌّ مدموج في هندسة واحدة.
 *
 * لماذا الدمج شرط لا تحسين: كل نبتة كانت مجموعة من ٦–١١ شبكة منفصلة، فقياس
 * ستمئة نبتة أعطى ٦٬٦٥٨ نداء رسم. إضافة أوراق وأغصان حقيقية على تلك البنية
 * كانت ستضرب الرقم في أربعة وتوقف الشاشة المعلّقة والجوّال. بدمج أجزاء النبتة
 * في هندسة واحدة تصير النبتة شبكة واحدة، فيهبط العدد إلى عدد النبتات نفسه —
 * وهو ما يحرّر ميزانية المضلّعات للتفصيل الذي نريده.
 *
 * الألوان تُخبَز في رؤوس الهندسة (`color` attribute) لأن الدمج يستلزم مادة
 * واحدة: موادّ متعدّدة تعني شبكات متعدّدة، وهو ما نحاول التخلّص منه.
 */

export type Detail = "hi" | "lo";

const C = {
  // ── لوحة فاتحة مبهجة ──
  // الأصلية كانت زيتونية غامقة تسحب المشهد كلّه لأسفل. البرنامج تحفيزي، فالفرح
  // يبدأ من اللون: أخضر أوراق مشرق، وتربة دافئة لا بقعة قاتمة.
  soil: 0x9a6b3c,

  stem: 0x5cb63a,
  stemDark: 0x489628,

  // ثلاث درجات ورق متباعدة: التقارب كان يجعل الشجرة كتلة مسطّحة بلا عمق
  leaf: 0x7bd44e,
  leafDeep: 0x52a832,
  leafPale: 0xa8e874,

  // الزهرة بنفسجية بقلب ذهبي: القلب الفاتح يفصلها عن البتلات من أعلى
  petal: 0xb96ff0,
  petalHi: 0x9b4fdc,
  petalCore: 0xffc93c,
  stamen: 0xfff3c4,

  // السنبلة: ساق قشّية تتدرّج من خضرة عند الأرض إلى ذهب عند الحبّ
  straw: 0xf0c64e,
  strawLow: 0xa9cf4e,
  grain: 0xffd24a,
  grainDeep: 0xf0a92c,
  awn: 0xfff0a8,

  bark: 0x9c6434,
  barkDark: 0x7c4c24,
  fruit: 0xff4436,
  fruitHi: 0xff7a63,
} as const;

/** جزء واحد قبل الدمج: هندسة، ومكانها، ولونها. */
type Part = { g: THREE.BufferGeometry; m: THREE.Matrix4; c: number };

const src = {
  leaf: leafBlade(),
  petal: petalBlade(),
  berry: new THREE.IcosahedronGeometry(1, 0),
  fruit: new THREE.IcosahedronGeometry(1, 1),
  disc: new THREE.CylinderGeometry(1, 1, 1, 8),
  patch: new THREE.CylinderGeometry(0.5, 0.56, 0.09, 16),
};

/**
 * أسطوانات مستدقّة مخزَّنة بنصفَي قطرها.
 *
 * الأغصان تختلف سماكةً من الأصل إلى الطرف، فلكلّ سماكتين هندسة. بناؤها عند كل
 * نداء كان يخلّف عشرات الهندسات غير المُتلَفة في ذاكرة كرت الرسم؛ والخزن هنا
 * يجعلها بضع عشرات لا أكثر مهما بلغ عدد النبتات.
 */
const limbCache = new Map<string, THREE.CylinderGeometry>();
function limbGeo(r0: number, r1: number): THREE.CylinderGeometry {
  const key = `${r0.toFixed(3)}|${r1.toFixed(3)}`;
  let g = limbCache.get(key);
  if (!g) {
    // الأسطوانة بطول ١ على المحور Y؛ الطول الفعلي يأتي من مصفوفة الوضع
    g = new THREE.CylinderGeometry(r1, r0, 1, 5, 1);
    limbCache.set(key, g);
  }
  return g;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function limb(
  parts: Part[],
  from: THREE.Vector3,
  to: THREE.Vector3,
  r0: number,
  r1: number,
  c: number,
) {
  parts.push({ g: limbGeo(r0, r1), m: limbMatrix(from, to), c });
}

function leaf(
  parts: Part[],
  at: THREE.Vector3,
  yaw: number,
  pitch: number,
  len: number,
  c: number,
  roll = 0,
) {
  parts.push({ g: src.leaf, m: leafMatrix(at, yaw, pitch, len, roll), c });
}

function blob(
  parts: Part[],
  g: THREE.BufferGeometry,
  at: THREE.Vector3,
  r: number,
  c: number,
  squashY = 1,
) {
  parts.push({
    g,
    m: new THREE.Matrix4().compose(at, new THREE.Quaternion(), V(r, r * squashY, r)),
    c,
  });
}

function rng(seed: number) {
  let s = (seed * 2654435761) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── ٢٠ · نبتة خضراء مورقة ─────────────────────────────────────────────────
// طبقتان في الارتفاع لا طبقة واحدة: الأغصان المتساوية الطول كانت تضع كل
// الأوراق على مستوى واحد، فتُرى الشجيرة قرصًا مسطّحًا من الكاميرا العلوية.
// الطبقة السفلى أعرض وأخفض، والعليا أضيق وأعلى — فتظهر كتلة لها عمق.
function bush(parts: Part[], detail: Detail, seed: number) {
  const r = rng(seed);

  limb(parts, V(0, 0, 0), V(0, 0.14, 0), 0.062, 0.05, C.stemDark);

  const hi = detail === "hi";
  const layers = [
    { count: hi ? 6 : 4, reach: 0.27, top: 0.3, leaves: hi ? 8 : 4, size: 0.38, phase: 0 },
    { count: hi ? 5 : 3, reach: 0.16, top: 0.47, leaves: hi ? 7 : 4, size: 0.32, phase: 0.7 },
  ];

  for (const L of layers) {
    for (let b = 0; b < L.count; b++) {
      const yaw = (b / L.count) * Math.PI * 2 + L.phase + r() * 0.35;
      const reach = L.reach + r() * 0.05;
      const tip = V(Math.cos(yaw) * reach, L.top + r() * 0.05, Math.sin(yaw) * reach);
      const mid = V(tip.x * 0.5, (L.top + 0.14) / 2, tip.z * 0.5);
      limb(parts, V(0, 0.14, 0), mid, 0.04, 0.03, C.stem);
      limb(parts, mid, tip, 0.03, 0.018, C.stem);

      for (let i = 0; i < L.leaves; i++) {
        const t = (i + 1) / (L.leaves + 1);
        const at = new THREE.Vector3().lerpVectors(mid, tip, t);
        const side = i % 2 === 0 ? 1 : -1;
        leaf(
          parts,
          at,
          yaw + side * (0.55 + r() * 0.6),
          -0.2 - r() * 0.5,
          L.size + r() * 0.12,
          i % 3 === 0 ? C.leafDeep : i % 3 === 1 ? C.leaf : C.leafPale,
          side * 0.45,
        );
      }
    }
  }
}

// ── ٣٠ · زهور بنفسجية ببتلات مفردة ──────────────────────────────────────────
function flowers(parts: Part[], detail: Detail, seed: number) {
  const r = rng(seed);
  const petalCount = detail === "hi" ? 7 : 5;

  // ثلاث زهرات بمواضع وارتفاعات مختلفة
  const spots: [number, number, number][] = [
    [-0.15, 0.06, 0.58],
    [0.16, -0.1, 0.68],
    [0.03, 0.15, 0.5],
  ];

  spots.forEach(([x, z, h], i) => {
    const base = V(x, 0.04, z);
    const head = V(x + (r() - 0.5) * 0.08, h, z + (r() - 0.5) * 0.08);
    const mid = V((base.x + head.x) / 2 + (r() - 0.5) * 0.06, h * 0.55, (base.z + head.z) / 2);
    limb(parts, base, mid, 0.026, 0.022, C.stem);
    limb(parts, mid, head, 0.022, 0.018, C.stem);

    const col = i === 1 ? C.petalHi : C.petal;
    for (let p = 0; p < petalCount; p++) {
      const yaw = (p / petalCount) * Math.PI * 2 + i;
      // البتلة تنبسط أفقيًا تقريبًا: الزهرة تُرى من أعلى، فالبتلة القائمة تختفي
      // ولا يبقى منها إلا حرفها
      parts.push({ g: src.petal, m: leafMatrix(head, yaw, -0.18 - r() * 0.2, 0.3), c: col });
    }
    // قلب الزهرة: قرص داكن تعلوه سَداة فاتحة — بدونها تبقى الزهرة حلقة
    // بتلات حول فراغ، وهي أول ما تلتقطه العين من أعلى
    blob(parts, src.disc, V(head.x, head.y + 0.02, head.z), 0.062, C.petalCore, 0.55);
    blob(parts, src.berry, V(head.x, head.y + 0.05, head.z), 0.032, C.stamen);

    // ورقة على منتصف الساق
    leaf(parts, mid, i * 2.1 + 0.8, -0.35, 0.2, C.leafDeep, 0.3);
  });

  // أوراق قاعدية عريضة
  const basal = detail === "hi" ? 6 : 3;
  for (let i = 0; i < basal; i++) {
    const yaw = (i / basal) * Math.PI * 2 + 0.6;
    leaf(parts, V(0, 0.05, 0), yaw, -0.12, 0.34, i % 2 === 0 ? C.leaf : C.leafDeep, 0.15);
  }
}

// ── ١٠ · سنبلة قمح ────────────────────────────────────────────────────────
// حزمة سيقان نحيلة، على رأس كلٍّ سنبلة من حبّات متناوبة تعلوها سُفا دقيقة.
// الشكل يُقرأ من الكاميرا العلوية بالسنابل الذهبية المائلة لا بالسيقان: لذلك
// تميل كل سنبلة قليلًا للخارج، فتنفرج الحزمة كمروحة بدل عمود واحد.
function wheat(parts: Part[], detail: Detail, seed: number) {
  const r = rng(seed);
  const stalks = detail === "hi" ? 9 : 5;
  const grains = detail === "hi" ? 7 : 5;

  for (let s = 0; s < stalks; s++) {
    const yaw = (s / stalks) * Math.PI * 2 + r() * 0.5;
    const lean = 0.14 + r() * 0.1;
    const h = 0.5 + r() * 0.14;
    const base = V(Math.cos(yaw) * 0.08, 0.03, Math.sin(yaw) * 0.08);
    const mid = V(Math.cos(yaw) * lean * 0.6, h * 0.5, Math.sin(yaw) * lean * 0.6);
    const top = V(Math.cos(yaw) * lean * 1.4, h, Math.sin(yaw) * lean * 1.4);
    limb(parts, base, mid, 0.024, 0.02, C.strawLow);
    limb(parts, mid, top, 0.02, 0.016, C.straw);

    // السنبلة تكمل خطّ الساق مائلةً قليلًا، والحبّ يتناوب على جانبيها
    const dir = new THREE.Vector3().subVectors(top, mid).normalize();
    const side = new THREE.Vector3(-Math.sin(yaw), 0, Math.cos(yaw));
    const earLen = 0.28 + r() * 0.05;
    for (let g = 0; g < grains; g++) {
      const t = (g + 0.5) / grains;
      const at = top.clone().addScaledVector(dir, t * earLen);
      const off = (g % 2 === 0 ? 1 : -1) * 0.03;
      at.addScaledVector(side, off);
      const size = 0.048 * (1 - t * 0.3);
      blob(parts, src.berry, at, size, g % 2 === 0 ? C.grain : C.grainDeep, 1.7);
    }
    // السُّفا: شعيرات قصيرة فوق السنبلة
    if (detail === "hi") {
      const tip = top.clone().addScaledVector(dir, earLen);
      for (let a = -1; a <= 1; a++) {
        const end = tip.clone().addScaledVector(dir, 0.14).addScaledVector(side, a * 0.05);
        limb(parts, tip, end, 0.007, 0.003, C.awn);
      }
    }
  }

  // أوراق قاعدية طويلة رفيعة كأوراق النجيل
  const blades = detail === "hi" ? 5 : 3;
  for (let i = 0; i < blades; i++) {
    const yaw = (i / blades) * Math.PI * 2 + 0.3;
    leaf(parts, V(0, 0.04, 0), yaw, 0.35 + r() * 0.25, 0.26, i % 2 ? C.strawLow : C.leaf, 0.2);
  }
}

// ── ٥٠ · شجرة مثمرة بأوراق مفردة ──────────────────────────────────────────
// الغصن يتفرّع مرّتين لا مرّة: التفريع المفرد كان يعطي أربعة أطراف فقط، فالورق
// يتجمّع في أربع كتل منفصلة. التفريع الثاني يوزّعه على تسعة أطراف فيُقرأ
// تاجًا متّصلًا — وهو ما يميّز الشجرة عن الشجيرة من أعلى.
function fruitTree(parts: Part[], detail: Detail, seed: number) {
  const r = rng(seed);

  // جذع مستدقّ بتوسّع جذري عند القاعدة
  limb(parts, V(0, 0, 0), V(0, 0.12, 0), 0.155, 0.11, C.barkDark);
  limb(parts, V(0, 0.12, 0), V(0.02, 0.5, 0), 0.11, 0.072, C.bark);

  const tips: THREE.Vector3[] = [];
  const forks = 4;
  const hub = V(0.02, 0.48, 0);

  for (let b = 0; b < forks; b++) {
    const yaw = (b / forks) * Math.PI * 2 + 0.4 + r() * 0.3;
    const reach = 0.34 + r() * 0.08;
    const mid = V(Math.cos(yaw) * reach * 0.6, 0.76 + r() * 0.05, Math.sin(yaw) * reach * 0.6);
    limb(parts, hub, mid, 0.062, 0.042, C.bark);

    // التفريع الثاني للصيغة العالية وحدها: عند مئات النبتات تصغر الشجرة على
    // الشاشة حتى يختفي أثره، فيبقى ثمنه من المثلثات بلا مقابل
    const subs = detail === "hi" ? ([-1, 1] as const) : ([0] as const);
    for (const side of subs) {
      const sub = yaw + side * (0.36 + r() * 0.16);
      const out = reach * (0.95 + r() * 0.2);
      const tip = V(Math.cos(sub) * out, 0.98 + r() * 0.12, Math.sin(sub) * out);
      limb(parts, mid, tip, 0.04, 0.022, C.bark);
      tips.push(tip);
    }
  }

  const crown = V(0.02, 1.16, 0);
  limb(parts, hub, crown, 0.055, 0.028, C.bark);
  tips.push(crown);

  // الورق: أوراق مفردة متجمّعة حول أطراف الأغصان، لا كرات
  const perTip = detail === "hi" ? 10 : 5;
  tips.forEach((tip, ti) => {
    for (let i = 0; i < perTip; i++) {
      const yaw = (i / perTip) * Math.PI * 2 + ti * 0.9;
      const at = V(
        tip.x + Math.cos(yaw) * 0.055,
        tip.y + (r() - 0.4) * 0.13,
        tip.z + Math.sin(yaw) * 0.055,
      );
      const shade = i % 3 === 0 ? C.leafDeep : i % 3 === 1 ? C.leaf : C.leafPale;
      leaf(parts, at, yaw, -0.1 - r() * 0.75, 0.25 + r() * 0.1, shade, (i % 2 ? 1 : -1) * 0.5);
    }
  });

  // كل ثمرة بعنق قصير
  const fruits = detail === "hi" ? 9 : 4;
  for (let i = 0; i < fruits; i++) {
    const tip = tips[(i * 3) % tips.length];
    const a = i * 2.4;
    const at = V(tip.x + Math.cos(a) * 0.1, tip.y - 0.11 - r() * 0.05, tip.z + Math.sin(a) * 0.1);
    limb(parts, V(at.x, at.y + 0.09, at.z), V(at.x, at.y + 0.03, at.z), 0.012, 0.012, C.stemDark);
    blob(parts, src.fruit, at, 0.082, i % 2 === 0 ? C.fruit : C.fruitHi);
  }
}

/**
 * الفئة → النبتة. أسماء الفئات (`green`…) معرّفات تاريخية في قاعدة البيانات
 * لا ألوان: السنبلة الذهبية هي `green`، والنبتة الخضراء هي `yellow`. انظر
 * TIER_SPECS في tiers.ts.
 */
const BUILDERS: Record<Tier, (p: Part[], d: Detail, seed: number) => void> = {
  green: wheat,
  yellow: bush,
  purple: flowers,
  red: fruitTree,
};

/**
 * يدمج الأجزاء في هندسة واحدة بألوان مخبوزة في الرؤوس.
 *
 * `toNonIndexed` إلزامي: `mergeGeometries` ترفض خلط هندسات مفهرسة بغير
 * مفهرسة، والمصادر هنا من النوعين. وتُحذف `uv` لأن لا كساء في المشهد، ووجودها
 * في بعض الأجزاء دون بعض يُفشل الدمج أيضًا.
 */
function bake(parts: Part[]): THREE.BufferGeometry {
  const prepared = parts.map(({ g, m, c }) => {
    const geo = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(m);
    geo.deleteAttribute("uv");
    const count = geo.getAttribute("position").count;
    const col = new Float32Array(count * 3);
    const color = new THREE.Color(c);
    for (let i = 0; i < count; i++) {
      col[i * 3] = color.r;
      col[i * 3 + 1] = color.g;
      col[i * 3 + 2] = color.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return geo;
  });

  const merged = mergeGeometries(prepared, false);
  for (const g of prepared) g.dispose();
  if (!merged) throw new Error("تعذّر دمج هندسة النبتة");
  merged.computeBoundingSphere();
  return merged;
}

/**
 * مقياس كل فئة على الشبكة.
 *
 * كل نبتة تملأ خانتها ولا تتجاوزها: البلاطة ١٫٨ وحدة، وأعرض النبتات (الشجرة
 * ~١٫٩ بعد التحجيم) تكاد تلامس جارتها ولا تتداخل معها. كانت الشجرة ضعف عرض
 * خانتها والشجيرة مرّة ونصفًا، فصار البستان كتلة خضراء واحدة لا تُعدّ فيها
 * نبتة — والمالك نبّه إلى ذلك: «النبتات متلاصقة بزيادة». عدد النبتات هو
 * الإنجاز، فلا بد أن يُرى كل واحد منها.
 *
 * والترتيب يتبع قيمة النقطة: الشجرة (٥٠) أطول الأربع بفارق واضح، والشجيرة
 * (١٠) أقصرها. الارتفاع هو ما يميّز القيمة من بعيد، لا العرض.
 */
const TIER_SCALE: Record<Tier, number> = {
  green: 1.05,
  yellow: 1.25,
  purple: 1.5,
  red: 1.3,
};

export const VARIANTS = 3;
const cache = new Map<string, THREE.BufferGeometry>();

/** هندسة نبتة مدموجة لفئة وصيغة ومستوى تفصيل. تُبنى عند أول طلب وتُخزَّن. */
export function plantGeometry(tier: Tier, variant: number, detail: Detail): THREE.BufferGeometry {
  const key = `${tier}:${variant}:${detail}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const parts: Part[] = [];
  BUILDERS[tier](parts, detail, variant * 977 + 13);

  const geo = bake(parts);
  // القاعدة الترابية تُضاف بعد التحجيم لا قبله: لو حُجِّمت مع النبتة لابتلعت
  // البلاطة كلها وطمست شبكة العشب تحتها
  geo.applyMatrix4(new THREE.Matrix4().makeScale(TIER_SCALE[tier], TIER_SCALE[tier], TIER_SCALE[tier]));
  const patch = bake([
    { g: src.patch, m: new THREE.Matrix4().makeTranslation(0, 0.045, 0), c: C.soil },
  ]);
  const merged = mergeGeometries([geo, patch], false);
  geo.dispose();
  patch.dispose();
  if (!merged) throw new Error("تعذّر دمج النبتة مع قاعدتها");
  merged.computeBoundingSphere();
  cache.set(key, merged);
  return merged;
}

/** الصيغة تتبع الخانة، فنفس النبتة تبدو كما هي دائمًا بعد إعادة التحميل. */
export function variantFor(slotIndex: number): number {
  return Math.abs(Math.imul(slotIndex, 2654435761)) % VARIANTS;
}

/** المادة المشتركة: لون من الرؤوس، وأوجه مسطّحة تعطي الحدّة الكرتونية. */
export const plantMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.78,
  side: THREE.DoubleSide,
});

/** يُفرِغ ما خُزِّن — للاختبارات وحدها. */
export function disposePlantCache() {
  for (const g of cache.values()) g.dispose();
  cache.clear();
  for (const g of limbCache.values()) g.dispose();
  limbCache.clear();
}
