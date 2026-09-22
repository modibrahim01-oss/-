import * as THREE from "three";
import type { Tier } from "./tiers";

/**
 * نماذج النبتات ثلاثية الأبعاد بأسلوب Clash of Clans: كرتونية سمينة، ألوان
 * مشبعة، أوجه مسطّحة (flatShading) تعطي الحدّة المميزة لهذا الأسلوب.
 *
 * كل فئة نقاط كائن مختلف تمامًا لا مجرّد لون مختلف، فالطالب يميّز قيمة كل
 * نبتة من شكلها عن بعد على شاشة المدرسة.
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

// الهندسات والموادّ تُنشأ مرة واحدة وتُشارَك بين كل النبتات. بدون هذا يصنع
// كل نبتة موادّ خاصة بها، فينهار الأداء عند بضع مئات من النبتات.
const geo = {
  patch: new THREE.CylinderGeometry(0.42, 0.42, 0.06, 20),
  bushBig: new THREE.IcosahedronGeometry(0.3, 0),
  bushMid: new THREE.IcosahedronGeometry(0.28, 0),
  bushSmall: new THREE.IcosahedronGeometry(0.26, 0),
  berry: new THREE.SphereGeometry(0.05, 8, 6),
  stemThin: new THREE.CylinderGeometry(0.04, 0.05, 1, 6),
  tulipCup: new THREE.ConeGeometry(0.15, 0.28, 8),
  tulipTop: new THREE.SphereGeometry(0.12, 10, 8),
  leaf: new THREE.SphereGeometry(0.18, 8, 6),
  leafSmall: new THREE.SphereGeometry(0.14, 8, 6),
  mushStemBig: new THREE.CylinderGeometry(0.14, 0.18, 0.42, 10),
  mushStemSmall: new THREE.CylinderGeometry(0.08, 0.1, 0.25, 8),
  mushCapBig: new THREE.SphereGeometry(0.34, 16, 10, 0, Math.PI * 2, 0, Math.PI / 1.8),
  mushCapSmall: new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.8),
  spot: new THREE.SphereGeometry(0.055, 8, 6),
  spotSmall: new THREE.SphereGeometry(0.035, 8, 6),
  trunk: new THREE.CylinderGeometry(0.11, 0.16, 0.55, 8),
  canopyBig: new THREE.IcosahedronGeometry(0.42, 0),
  canopyMid: new THREE.IcosahedronGeometry(0.32, 0),
  canopySmall: new THREE.IcosahedronGeometry(0.28, 0),
  fruit: new THREE.SphereGeometry(0.11, 10, 8),
  rock: new THREE.IcosahedronGeometry(0.28, 0),
  tuft: new THREE.ConeGeometry(0.07, 0.22, 5),
  pebble: new THREE.SphereGeometry(0.1, 8, 6),
};

const mat = {
  dirt: new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.95 }),
  bushLight: new THREE.MeshStandardMaterial({ color: 0x66c13b, roughness: 0.75, flatShading: true }),
  bushDark: new THREE.MeshStandardMaterial({ color: 0x4a9e28, roughness: 0.8, flatShading: true }),
  berry: new THREE.MeshStandardMaterial({ color: 0xe23b2f, roughness: 0.4 }),
  stem: new THREE.MeshStandardMaterial({ color: 0x3b8a28, roughness: 0.75 }),
  petal: new THREE.MeshStandardMaterial({ color: 0xffc833, roughness: 0.5, flatShading: true }),
  petalHi: new THREE.MeshStandardMaterial({ color: 0xffa218, roughness: 0.55, flatShading: true }),
  leafGreen: new THREE.MeshStandardMaterial({
    color: 0x4ea83a,
    roughness: 0.7,
    side: THREE.DoubleSide,
  }),
  leafDeep: new THREE.MeshStandardMaterial({
    color: 0x3f8442,
    roughness: 0.7,
    side: THREE.DoubleSide,
  }),
  mushStem: new THREE.MeshStandardMaterial({ color: 0xf5ead1, roughness: 0.75, flatShading: true }),
  mushCap: new THREE.MeshStandardMaterial({ color: 0xa65ebb, roughness: 0.5, flatShading: true }),
  white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x7a4a22, roughness: 0.85 }),
  canopyDark: new THREE.MeshStandardMaterial({
    color: 0x2e7d2b,
    roughness: 0.75,
    flatShading: true,
  }),
  canopyLight: new THREE.MeshStandardMaterial({
    color: 0x4eae3f,
    roughness: 0.7,
    flatShading: true,
  }),
  fruit: new THREE.MeshStandardMaterial({ color: 0xe73b2f, roughness: 0.4 }),
  fruitHi: new THREE.MeshStandardMaterial({ color: 0xff6e5a, roughness: 0.4 }),
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

function bush(g: THREE.Group) {
  const parts: [THREE.BufferGeometry, THREE.Material, number, number, number][] = [
    [geo.bushMid, mat.bushDark, -0.16, 0.28, 0.05],
    [geo.bushBig, mat.bushLight, 0.15, 0.3, -0.05],
    [geo.bushSmall, mat.bushLight, 0.02, 0.42, 0.02],
  ];
  for (const [gm, mm, x, y, z] of parts) {
    const m = mesh(gm, mm);
    m.position.set(x, y, z);
    g.add(m);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const b = mesh(geo.berry, mat.berry, false);
    b.position.set(Math.cos(a) * 0.2, 0.4, Math.sin(a) * 0.2);
    g.add(b);
  }
}

function tulips(g: THREE.Group) {
  const offsets: [number, number, number][] = [
    [-0.16, 0.05, 0.55],
    [0.15, -0.08, 0.65],
    [0.02, 0.12, 0.5],
  ];
  offsets.forEach(([x, z, h], i) => {
    const stem = mesh(geo.stemThin, mat.stem);
    stem.scale.y = h;
    stem.position.set(x, h / 2 + 0.06, z);
    g.add(stem);

    const petalMat = i === 1 ? mat.petalHi : mat.petal;
    const cup = mesh(geo.tulipCup, petalMat);
    cup.position.set(x, h + 0.14, z);
    g.add(cup);

    const top = mesh(geo.tulipTop, petalMat);
    top.position.set(x, h + 0.24, z);
    top.scale.y = 0.7;
    g.add(top);
  });
  for (let i = 0; i < 2; i++) {
    const leaf = mesh(geo.leaf, mat.leafGreen, false);
    leaf.scale.set(1.6, 0.3, 0.7);
    leaf.position.set(i === 0 ? -0.22 : 0.22, 0.15, 0);
    leaf.rotation.z = i === 0 ? 0.5 : -0.5;
    g.add(leaf);
  }
}

function mushroom(g: THREE.Group) {
  const stemBig = mesh(geo.mushStemBig, mat.mushStem);
  stemBig.position.set(0.05, 0.27, 0.05);
  g.add(stemBig);

  const capBig = mesh(geo.mushCapBig, mat.mushCap);
  capBig.position.set(0.05, 0.5, 0.05);
  g.add(capBig);

  const spots: [number, number, number][] = [
    [0.05, 0.68, 0.15],
    [-0.15, 0.55, 0.1],
    [0.2, 0.55, -0.05],
  ];
  for (const [x, y, z] of spots) {
    const dot = mesh(geo.spot, mat.white, false);
    dot.position.set(x, y, z);
    g.add(dot);
  }

  const stemSmall = mesh(geo.mushStemSmall, mat.mushStem);
  stemSmall.position.set(-0.22, 0.18, -0.15);
  g.add(stemSmall);

  const capSmall = mesh(geo.mushCapSmall, mat.mushCap);
  capSmall.position.set(-0.22, 0.32, -0.15);
  g.add(capSmall);

  const dotSmall = mesh(geo.spotSmall, mat.white, false);
  dotSmall.position.set(-0.22, 0.43, -0.08);
  g.add(dotSmall);
}

function fruitTree(g: THREE.Group) {
  const trunk = mesh(geo.trunk, mat.trunk);
  trunk.position.y = 0.34;
  g.add(trunk);

  const blobs: [THREE.BufferGeometry, THREE.Material, number, number, number][] = [
    [geo.canopyBig, mat.canopyDark, 0, 0.85, 0],
    [geo.canopyMid, mat.canopyLight, -0.28, 0.78, 0.05],
    [geo.canopyMid, mat.canopyLight, 0.28, 0.78, -0.05],
    [geo.canopySmall, mat.canopyLight, 0.05, 1.05, 0],
  ];
  for (const [gm, mm, x, y, z] of blobs) {
    const m = mesh(gm, mm);
    m.position.set(x, y, z);
    g.add(m);
  }

  const fruits: [number, number, number][] = [
    [-0.2, 0.75, 0.32],
    [0.3, 0.65, 0.2],
    [0.1, 0.55, -0.3],
    [-0.25, 0.95, -0.15],
    [0.05, 1.15, 0.15],
  ];
  fruits.forEach(([x, y, z], i) => {
    const f = mesh(geo.fruit, i % 2 === 0 ? mat.fruit : mat.fruitHi);
    f.position.set(x, y, z);
    g.add(f);
  });
}

const BUILDERS: Record<Tier, (g: THREE.Group) => void> = {
  green: bush,
  yellow: tulips,
  purple: mushroom,
  red: fruitTree,
};

/**
 * تبني نبتة واحدة. `slotIndex` يُبذِّر الدوران فتبدو المزرعة طبيعية بدل
 * صفوف متطابقة، ويبقى ثابتًا بين التحميلات لأن نفس الخانة تعطي نفس البذرة.
 */
export function buildPlant(tier: Tier, slotIndex: number): THREE.Group {
  const g = new THREE.Group();

  const patch = new THREE.Mesh(geo.patch, mat.dirt);
  patch.position.y = 0.03;
  patch.receiveShadow = true;
  g.add(patch);

  BUILDERS[tier](g);

  const rng = seeded(slotIndex + 1);
  g.rotation.y = rng() * Math.PI * 2;
  return g;
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

  for (let ix = -playHalf; ix < playHalf; ix++) {
    for (let iz = -playHalf; iz < playHalf; iz++) {
      const tile = new THREE.Mesh(tileGeo, ((ix + iz) & 1) === 0 ? grassA : grassB);
      tile.position.set(ix * TILE + TILE / 2, -0.05, iz * TILE + TILE / 2);
      tile.receiveShadow = true;
      scene.add(tile);
    }
  }

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

  for (let i = -playHalf; i < playHalf; i++) {
    const along = i * TILE + TILE / 2;
    for (const [x, z] of [
      [along, -edge],
      [along, edge],
      [-edge, along],
      [edge, along],
    ] as const) {
      const w = new THREE.Mesh(wallGeo, wallMat);
      w.position.set(x, wallH / 2 - 0.05, z);
      w.castShadow = true;
      w.receiveShadow = true;
      scene.add(w);

      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(x, wallH + 0.01, z);
      cap.castShadow = true;
      scene.add(cap);
    }
  }

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
