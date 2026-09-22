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

/** حدود الساحة بالخانات، شاملةً طرفيها. */
export type FieldBounds = { minX: number; maxX: number; minZ: number; maxZ: number };

/**
 * هامش العشب بين أبعد نبتة والسور، بالخانات.
 *
 * ساحة ثابتة الحجم كانت تجعل مزرعة صغيرة بقعةً تائهة وسط عشب فارغ: ١٨ نبتة
 * في ساحة ١٤×١٤ على الموقع الحيّ، فبدت النبتات حبّات لا تُميَّز. السور الآن
 * يحيط بالنبتات بهامش ثابت من كل جهة على حدة، فتبقى النبتات هي المشهد.
 */
const FIELD_MARGIN = 2;

/**
 * أصغر ساحة: ثلاث خانات حول المركز في كل اتجاه.
 *
 * حتى المزرعة ذات النبتة الواحدة تُظهر الأرباع الأربعة كلها، فيرى الطالب
 * أين ستنمو بقية بساتينه — والمركز يبقى في منتصف السور.
 */
const FIELD_MIN = 3;

/**
 * حدود الساحة من خانات النبتات.
 *
 * الحدود تتبع كل جهة منفردة لا أبعد نبتة في أي اتجاه: البساتين تنمو بأحجام
 * مختلفة، فمزرعة بستانها الأحمر كبير تمتدّ ساحتها نحوه وحده بدل أن تتّسع في
 * الجهات الأربع وتترك ثلاثة أرباعها عشبًا فارغًا.
 */
export function fieldBoundsFor(cells: readonly { x: number; y: number }[]): FieldBounds {
  let minX = -FIELD_MIN;
  let maxX = FIELD_MIN;
  let minZ = -FIELD_MIN;
  let maxZ = FIELD_MIN;
  for (const c of cells) {
    minX = Math.min(minX, c.x - FIELD_MARGIN);
    maxX = Math.max(maxX, c.x + FIELD_MARGIN);
    minZ = Math.min(minZ, c.y - FIELD_MARGIN);
    maxZ = Math.max(maxZ, c.y + FIELD_MARGIN);
  }
  return { minX, maxX, minZ, maxZ };
}

/** ارتفاع السور، يحتاجه التأطير ليُدخل السور كاملًا في الإطار. */
export const WALL_HEIGHT = 0.67;

/**
 * الصندوق العالمي الذي يحيط بالساحة والسور، دون النبتات.
 *
 * السور يقوم على خطّ الحدّ نفسه فيبرز نصف كتلة خارج الساحة؛ الصندوق يشمل
 * ذلك البروز، وإلا قُصّت حافة السور الخارجية في التأطير.
 */
export function fieldBox(b: FieldBounds): THREE.Box3 {
  const overhang = TILE * 0.5;
  return new THREE.Box3(
    new THREE.Vector3(b.minX * TILE - overhang, -0.1, b.minZ * TILE - overhang),
    new THREE.Vector3((b.maxX + 1) * TILE + overhang, WALL_HEIGHT, (b.maxZ + 1) * TILE + overhang),
  );
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
 * أقصى إزاحة للنبتة عن مركز خانتها، كنسبة من البلاطة.
 *
 * تخطيط الأرباع يُبقي النبتة في مكانها طول الفصل ويجعل حجم كل بستان مقياسًا
 * مرئيًّا للإنجاز — وهذا ما نحتفظ به. لكنه يضع كل نبتة في مركز خانتها
 * بالضبط، فتصطفّ صفوفًا مستوية كأنها مطبوعة بآلة.
 *
 * ٠٫١٨ من البلاطة يكسر الاصطفاف ولا يُخرج النبتة من خانتها: أكبر منه يجعل
 * الجارتين تتداخلان فيضيع تمييز كل نبتة على حدة.
 */
const JITTER = 0.18;

/**
 * تبني نبتة واحدة: شبكة واحدة بهندسة مدموجة.
 *
 * كانت مجموعةً من ٦–١١ شبكة، فستمئة نبتة تعني آلاف نداءات الرسم.
 *
 * كل ما يميّز النبتة — صيغتها ودورانها وحجمها وإزاحتها — مشتقّ من `slotIndex`
 * وحده، فنفس الخانة تعطي نفس النبتة في كل تحميل. لو كان أيٌّ منها عشوائيًّا
 * وقت التشغيل لقفزت مزرعة الطالب في كل مرة يفتحها، ولانتقلت النبتات على شاشة
 * الممرّ مع كل دورة عرض.
 */
export function buildPlant(tier: Tier, slotIndex: number, detail: Detail = "hi"): THREE.Mesh {
  const m = new THREE.Mesh(plantGeometry(tier, variantFor(slotIndex), detail), plantMaterial);
  m.castShadow = true;
  m.receiveShadow = true;

  const rng = seeded(slotIndex + 1);
  m.rotation.y = rng() * Math.PI * 2;
  // تفاوت طفيف في الحجم: نبتات متطابقة الحجم تفضح أنها منسوخة
  m.scale.setScalar(0.92 + rng() * 0.16);
  m.position.x = (rng() - 0.5) * 2 * JITTER * TILE;
  m.position.z = (rng() - 0.5) * 2 * JITTER * TILE;
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

/**
 * لوحة فاتحة مبهجة: البرنامج تحفيزي فيه فرح ومنافسة، والعشب الزيتوني الغامق
 * والسور البنّي القاتم كانا ينقلان عكس ذلك. والفرق بين مربّعي العشب خُفِّف —
 * التبادل الحادّ كان يشتّت النظر عن النبتات نفسها.
 */
export const PALETTES: Record<"day" | "dusk", ScenePalette> = {
  // سماء فاقعة تطابق --scene-sky، وعشب ليمونيّ، وسور خشبيّ برتقاليّ دافئ
  day: { sky: 0x6fd3fb, grassA: 0x9ef25c, grassB: 0x8fea4c, wall: 0xf7a24f, wallCap: 0xffd27f },
  dusk: { sky: 0x3d7ea3, grassA: 0x5aa86a, grassB: 0x519f62, wall: 0x7a5a38, wallCap: 0x99764c },
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
  bounds: FieldBounds,
  occupied: ReadonlySet<string> = new Set(),
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
  for (let ix = bounds.minX; ix <= bounds.maxX; ix++) {
    for (let iz = bounds.minZ; iz <= bounds.maxZ; iz++) {
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
  const wallH = WALL_HEIGHT - 0.12;
  const wallGeo = own(new THREE.BoxGeometry(TILE * 0.95, wallH, TILE * 0.95));
  const capGeo = own(new THREE.BoxGeometry(TILE * 0.75, 0.12, TILE * 0.75));
  const x0 = bounds.minX * TILE;
  const x1 = (bounds.maxX + 1) * TILE;
  const z0 = bounds.minZ * TILE;
  const z1 = (bounds.maxZ + 1) * TILE;

  const blocks: [number, number, number][] = [];
  const caps: [number, number, number][] = [];
  const addWall = (x: number, z: number) => {
    blocks.push([x, wallH / 2 - 0.05, z]);
    caps.push([x, wallH + 0.01, z]);
  };
  for (let ix = bounds.minX; ix <= bounds.maxX; ix++) {
    const along = ix * TILE + TILE / 2;
    addWall(along, z0);
    addWall(along, z1);
  }
  for (let iz = bounds.minZ; iz <= bounds.maxZ; iz++) {
    const along = iz * TILE + TILE / 2;
    addWall(x0, along);
    addWall(x1, along);
  }
  grid(wallGeo, wallMat, blocks, { cast: true, receive: true });
  grid(capGeo, capMat, caps, { cast: true });

  for (const [x, z] of [
    [x0, z0],
    [x1, z0],
    [x0, z1],
    [x1, z1],
  ] as const) {
    const r = buildDecor("rock");
    r.position.set(x, 0.05, z);
    r.scale.setScalar(1.5);
    scene.add(r);
  }

  /**
   * الزخارف على الشريط الملاصق للسور وحده، وفي الخانات الخالية منه فقط.
   *
   * كانت تُنثر في حلقة حول المركز فتقع أحيانًا تحت نبتة، وحشيشة تخترق شجرة
   * تفضح أن المشهد مركّب. والشريط الملاصق للسور هو أبعد ما يبلغه نموّ
   * البساتين قبل أن يتّسع السور نفسه.
   */
  const rng = seeded(11);
  const kinds = ["tuft", "tuft", "tuft", "pebble", "rock"] as const;
  for (let ix = bounds.minX; ix <= bounds.maxX; ix++) {
    for (let iz = bounds.minZ; iz <= bounds.maxZ; iz++) {
      const onBand =
        ix === bounds.minX || ix === bounds.maxX || iz === bounds.minZ || iz === bounds.maxZ;
      // الرقم العشوائي يُسحب لكل خانة ولو تُخطّيت، فلا يتغيّر نثر الزخارف
      // كلّه لأن نبتة جديدة شغلت خانة واحدة
      const roll = rng();
      const pick = rng();
      const jx = rng();
      const jz = rng();
      if (!onBand || occupied.has(`${ix},${iz}`) || roll > 0.38) continue;
      const d = buildDecor(kinds[Math.floor(pick * kinds.length)]);
      d.position.set(
        ix * TILE + TILE / 2 + (jx - 0.5) * TILE * 0.5,
        0.02,
        iz * TILE + TILE / 2 + (jz - 0.5) * TILE * 0.5,
      );
      scene.add(d);
    }
  }

  // إضاءة محيطة أقلّ وشمس أقوى: الإضاءة المسطّحة السابقة كانت تغسل الأوراق
  // فتبدو النبتة قصاصةً ملصقة. الفارق بين المضيء والمظلّل هو ما يعطي العمق.
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  // الأرض المرتدّة خضراء فاتحة لا بنّية: الظلال تبقى ملوّنة مشرقة لا طينية
  scene.add(new THREE.HemisphereLight(0xe3f6ff, 0x9fd67a, 0.45));

  // الضوء الموجَّه يملك خريطة ظلّ على كرت الرسم — dispose يحرّرها
  const sun = own(new THREE.DirectionalLight(0xfff4d2, 1.35));
  // الشمس وخريطة ظلّها تتبعان مركز الساحة لا الأصل: الساحة لم تعد متناظرة
  // حوله، وخريطة ظلّ ثابتة حول الأصل كانت تُسقط ظلال البستان الأبعد
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  sun.position.set(cx - 14, 26, cz + 10);
  sun.target.position.set(cx, 0, cz);
  scene.add(sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  // نصف قطر الساحة بهامش لميل الشمس؛ ساحة صغيرة تنال بذلك ظلالًا أحدّ
  // لأن الخريطة نفسها تُفرَد على مساحة أصغر
  const s = Math.hypot(x1 - x0, z1 - z0) / 2 + 3;
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
