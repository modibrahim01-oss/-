import * as THREE from "three";
import { type Detail, plantGeometry, plantMaterial, variantFor } from "./plant-models";
import type { Tier } from "./tiers";

/**
 * المشهد ثلاثي الأبعاد بأسلوب Clash of Clans: كاميرا أيزومترية ثابتة لا تدور،
 * ألوان مشبعة، أوجه مسطّحة (flatShading) تعطي الحدّة المميزة لهذا الأسلوب.
 *
 * نماذج النبتات نفسها في `plant-models.ts`: أوراق وأغصان حقيقية مدموجة في
 * هندسة واحدة لكل نبتة. كل فئة نقاط كائن مختلف تمامًا لا مجرّد لون مختلف،
 * فالطالب يميّز قيمة كل نبتة من شكلها عن بعد على شاشة المدرسة.
 */

export const TILE = 1.4; // وحدة الشبكة العالمية

/**
 * نصف عرض الملعب بالبلاطات، محسوبًا من امتداد المزرعة نفسها.
 *
 * ملعب ثابت الحجم يجعل مزرعة صغيرة بقعة تائهة وسط عشب فارغ، ومزرعة كبيرة
 * محشورة في سياجها. الجدار هنا يتوسّع مع النمو: يبقى بهامش ثابت حول أبعد
 * نبتة، فتبقى النسبة بين المزروع والفارغ مقروءة في كل المراحل.
 */
export function playHalfFor(maxRing: number): number {
  return Math.max(6, maxRing + 3);
}

// هندسات وموادّ الزخارف وحدها. نماذج النبتات انتقلت إلى plant-models.ts
// حيث تُدمج أجزاؤها في هندسة واحدة لكل نبتة.
const geo = {
  rock: new THREE.IcosahedronGeometry(0.28, 0),
  tuft: new THREE.ConeGeometry(0.07, 0.22, 5),
  pebble: new THREE.SphereGeometry(0.1, 8, 6),
};

const mat = {
  rock: new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.9, flatShading: true }),
  pebble: new THREE.MeshStandardMaterial({ color: 0xbfbfb0, roughness: 0.9 }),
  tuft: new THREE.MeshStandardMaterial({ color: 0x4a9e28, roughness: 0.85, flatShading: true }),
};

function mesh(g: THREE.BufferGeometry, m: THREE.Material, shadow = true) {
  const o = new THREE.Mesh(g, m);
  o.castShadow = shadow;
  return o;
}

/** مولّد عشوائي مُبذَّر — نفس الخانة تعطي نفس الدوران دائمًا. */
function seeded(seed: number) {
  let s = (seed * 2654435761) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * حدّ التفصيل: فوقه تُستعمل الصيغة المخفّفة.
 *
 * التخفيف يتبع عدد النبتات لا المسافة، لأن الكلفة هنا كلفة رسم لا كلفة عرض:
 * مزرعة نهاية الفصل تضع ستمئة نبتة في الإطار كلها دفعةً واحدة.
 */
const HI_DETAIL_MAX = 150;

export function detailFor(plantCount: number): Detail {
  return plantCount > HI_DETAIL_MAX ? "lo" : "hi";
}

/**
 * تبني نبتة واحدة: شبكة واحدة بهندسة مدموجة.
 *
 * كانت مجموعةً من ٦–١١ شبكة، فستمئة نبتة تعني آلاف نداءات الرسم. `slotIndex`
 * يحدّد الصيغة والدوران فتبدو المزرعة طبيعية بدل صفوف متطابقة، ويبقى ثابتًا
 * بين التحميلات لأن نفس الخانة تعطي نفس البذرة.
 */
export function buildPlant(tier: Tier, slotIndex: number, detail: Detail = "hi"): THREE.Mesh {
  const m = new THREE.Mesh(plantGeometry(tier, variantFor(slotIndex), detail), plantMaterial);
  m.castShadow = true;
  m.receiveShadow = true;

  const rng = seeded(slotIndex + 1);
  m.rotation.y = rng() * Math.PI * 2;
  // تفاوت طفيف في الحجم: نبتات متطابقة الحجم تفضح أنها منسوخة
  m.scale.setScalar(0.92 + rng() * 0.16);
  return m;
}

export function buildDecor(kind: "rock" | "tuft" | "pebble"): THREE.Group {
  const g = new THREE.Group();
  if (kind === "rock") {
    const r = mesh(geo.rock, mat.rock);
    r.scale.set(1, 0.55, 1);
    r.position.y = 0.14;
    g.add(r);
  } else if (kind === "tuft") {
    for (let i = 0; i < 3; i++) {
      const b = mesh(geo.tuft, mat.tuft);
      b.position.set((i - 1) * 0.08, 0.11, 0);
      g.add(b);
    }
  } else {
    const p = mesh(geo.pebble, mat.pebble);
    p.scale.set(1, 0.45, 1);
    p.position.y = 0.05;
    g.add(p);
  }
  return g;
}

export type ScenePalette = {
  sky: number;
  grassA: number;
  grassB: number;
  wall: number;
  wallCap: number;
};

export const PALETTES: Record<"day" | "dusk", ScenePalette> = {
  day: { sky: 0x5cb8e4, grassA: 0x7ed26a, grassB: 0x6bc55b, wall: 0x8b6f47, wallCap: 0xc79b65 },
  dusk: { sky: 0x2a5b7a, grassA: 0x3f8250, grassB: 0x357045, wall: 0x4a3c28, wallCap: 0x6b573c },
};

/**
 * يبني الأرضية والجدار الحجري والزخارف — كل ما ليس نبتة.
 *
 * الهندسات والموادّ هنا خاصّة بهذا المشهد (لونها من اللوحة وحجمها من امتداد
 * المزرعة) لا مشتركة كتلك في `geo`/`mat`، فتُعاد الدالة بمُتلِفها: وضع العرض
 * يعيد بناء المشهد لكل طالب كل تسع ثوان، وبلا إتلاف تتكدّس مواردها في ذاكرة
 * كرت الرسم حتى تتوقّف الشاشة المعلّقة عن العرض بعد ساعات.
 */
export function buildTerrain(
  scene: THREE.Scene,
  palette: ScenePalette,
  playHalf: number,
): () => void {
  scene.background = new THREE.Color(palette.sky);

  const owned: { dispose: () => void }[] = [];
  function own<T extends { dispose: () => void }>(resource: T): T {
    owned.push(resource);
    return resource;
  }

  const grassA = own(new THREE.MeshStandardMaterial({ color: palette.grassA, roughness: 0.9 }));
  const grassB = own(new THREE.MeshStandardMaterial({ color: palette.grassB, roughness: 0.9 }));
  const tileGeo = own(new THREE.BoxGeometry(TILE, 0.1, TILE));

  /**
   * الأرضية والسور شبكات مُنسَخة (instanced) لا شبكة لكل بلاطة.
   *
   * قياسٌ بعد تفصيل النبتات أظهر أن الأرضية صارت هي العبء: ٩٠٠ بلاطة عشب
   * منفصلة عند مزرعة كبيرة، أي ١٬٢٤٤ من أصل ١٬٨٤٤ نداء رسم — أكثر مما تكلّفه
   * النبتات نفسها. كلها هندسة واحدة بمادة واحدة، فالنسخ يجعلها نداءً واحدًا.
   */
  const dummy = new THREE.Object3D();
  function grid(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    spots: [number, number, number][],
    opts: { cast?: boolean; receive?: boolean } = {},
  ) {
    if (spots.length === 0) return;
    const inst = new THREE.InstancedMesh(geometry, material, spots.length);
    inst.castShadow = opts.cast ?? false;
    inst.receiveShadow = opts.receive ?? false;
    spots.forEach(([x, y, z], i) => {
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    scene.add(inst);
    owned.push(inst);
  }

  const tilesA: [number, number, number][] = [];
  const tilesB: [number, number, number][] = [];
  for (let ix = -playHalf; ix < playHalf; ix++) {
    for (let iz = -playHalf; iz < playHalf; iz++) {
      const spot: [number, number, number] = [ix * TILE + TILE / 2, -0.05, iz * TILE + TILE / 2];
      (((ix + iz) & 1) === 0 ? tilesA : tilesB).push(spot);
    }
  }
  grid(tileGeo, grassA, tilesA, { receive: true });
  grid(tileGeo, grassB, tilesB, { receive: true });

  const wallMat = own(
    new THREE.MeshStandardMaterial({
      color: palette.wall,
      roughness: 0.85,
      flatShading: true,
    }),
  );
  const capMat = own(
    new THREE.MeshStandardMaterial({ color: palette.wallCap, roughness: 0.85 }),
  );
  const wallH = 0.55;
  const wallGeo = own(new THREE.BoxGeometry(TILE * 0.95, wallH, TILE * 0.95));
  const capGeo = own(new THREE.BoxGeometry(TILE * 0.75, 0.12, TILE * 0.75));
  const edge = playHalf * TILE;

  const blocks: [number, number, number][] = [];
  const caps: [number, number, number][] = [];
  for (let i = -playHalf; i < playHalf; i++) {
    const along = i * TILE + TILE / 2;
    for (const [x, z] of [
      [along, -edge],
      [along, edge],
      [-edge, along],
      [edge, along],
    ] as const) {
      blocks.push([x, wallH / 2 - 0.05, z]);
      caps.push([x, wallH + 0.01, z]);
    }
  }
  grid(wallGeo, wallMat, blocks, { cast: true, receive: true });
  grid(capGeo, capMat, caps, { cast: true });

  for (const [x, z] of [
    [-edge, -edge],
    [edge, -edge],
    [-edge, edge],
    [edge, edge],
  ] as const) {
    const r = buildDecor("rock");
    r.position.set(x, 0.05, z);
    r.scale.setScalar(1.5);
    scene.add(r);
  }

  const rng = seeded(11);
  const kinds = ["tuft", "tuft", "tuft", "pebble", "rock"] as const;
  for (let i = 0; i < 44; i++) {
    const d = buildDecor(kinds[Math.floor(rng() * kinds.length)]);
    const angle = rng() * Math.PI * 2;
    const radius = edge * (0.62 + rng() * 0.32);
    d.position.set(Math.cos(angle) * radius, 0.02, Math.sin(angle) * radius);
    scene.add(d);
  }

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  scene.add(new THREE.HemisphereLight(0xc7e9ff, 0x6b5a3a, 0.35));

  // الضوء الموجَّه يملك خريطة ظلّ على كرت الرسم — dispose يحرّرها
  const sun = own(new THREE.DirectionalLight(0xfff2c8, 0.95));
  sun.position.set(-14, 26, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = 22;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 70;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  return () => {
    for (const resource of owned) resource.dispose();
    owned.length = 0;
  };
}

/** إحداثيات الشبكة → موضع عالمي في مركز البلاطة. */
export function gridToWorld(gx: number, gy: number): [number, number, number] {
  return [gx * TILE + TILE / 2, 0, gy * TILE + TILE / 2];
}
