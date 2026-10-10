import * as THREE from "three";

/**
 * جزّازة العشب التي تمرّ على بستان الطالب حين يُخصم منه.
 *
 * بطراز النبتات نفسه: قطع قليلة المضلّعات بأوجه مسطّحة وألوان فاقعة، فتبدو
 * لعبةً من البستان لا جسمًا غريبًا عنه. جسم أحمر وعجلات سوداء ومقبض وكيس عشب
 * أخضر خلفها. الأمام على ‎+Z‎، فتدويرها بزاوية اتجاه الحركة يكفي لتوجيهها.
 *
 * موادّها وهندساتها خاصّة بها لا مشتركة كالنبتات: تظهر دقائق ثم تُتلَف.
 */
export function buildMower(): { group: THREE.Group; wheels: THREE.Object3D[]; dispose: () => void } {
  const owned: (THREE.BufferGeometry | THREE.Material)[] = [];
  const material = (color: number) => {
    const m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.6 });
    owned.push(m);
    return m;
  };
  const geometry = <G extends THREE.BufferGeometry>(g: G) => {
    owned.push(g);
    return g;
  };
  const part = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  const red = material(0xe8452c);
  const redDark = material(0xb3301c);
  const black = material(0x24222e);
  const grey = material(0xb9bfc6);
  const bag = material(0x5cbf3a);
  const bagDark = material(0x3f8f27);

  const group = new THREE.Group();

  // الهيكل: سطح منخفض عريض وغطاء محرّك فوقه
  group.add(part(geometry(new THREE.BoxGeometry(0.95, 0.22, 1.05)), red, 0, 0.27, 0.05));
  group.add(part(geometry(new THREE.BoxGeometry(0.7, 0.18, 0.62)), redDark, 0, 0.47, 0.12));
  const engine = part(geometry(new THREE.CylinderGeometry(0.17, 0.2, 0.22, 10)), grey, 0, 0.66, 0.12);
  group.add(engine);
  group.add(part(geometry(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8)), black, 0.1, 0.81, 0.12));

  // العجلات الأربع، ومحاورها جانبية
  const wheelGeo = geometry(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 12));
  const hubGeo = geometry(new THREE.CylinderGeometry(0.07, 0.07, 0.13, 8));
  const wheels: THREE.Object3D[] = [];
  for (const [x, z] of [
    [-0.5, 0.42],
    [0.5, 0.42],
    [-0.5, -0.36],
    [0.5, -0.36],
  ]) {
    const wheel = new THREE.Group();
    wheel.position.set(x, 0.17, z);
    const tire = part(wheelGeo, black, 0, 0, 0);
    tire.rotation.z = Math.PI / 2;
    const hub = part(hubGeo, grey, 0, 0, 0);
    hub.rotation.z = Math.PI / 2;
    wheel.add(tire, hub);
    group.add(wheel);
    wheels.push(wheel);
  }

  // كيس العشب خلف الجسم، والمقبض فوقه مائلًا إلى الخلف
  group.add(part(geometry(new THREE.BoxGeometry(0.62, 0.42, 0.42)), bag, 0, 0.44, -0.72));
  group.add(part(geometry(new THREE.BoxGeometry(0.64, 0.08, 0.44)), bagDark, 0, 0.68, -0.72));
  const barGeo = geometry(new THREE.CylinderGeometry(0.035, 0.035, 1.05, 6));
  for (const x of [-0.3, 0.3]) {
    const bar = part(barGeo, black, x, 0.85, -0.78);
    bar.rotation.x = -0.75;
    group.add(bar);
  }
  const grip = part(geometry(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8)), black, 0, 1.24, -1.12);
  grip.rotation.z = Math.PI / 2;
  group.add(grip);

  return {
    group,
    wheels,
    dispose: () => {
      for (const r of owned) r.dispose();
    },
  };
}

/** قصاصات العشب المتطايرة: مكعّبات خضراء صغيرة بثلاث درجات. */
export function clippingParts() {
  const geometry = new THREE.BoxGeometry(0.09, 0.05, 0.09);
  const materials = [0x7bd44e, 0x52a832, 0xc9ec7a].map(
    (color) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8 }),
  );
  return {
    geometry,
    materials,
    dispose: () => {
      geometry.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
