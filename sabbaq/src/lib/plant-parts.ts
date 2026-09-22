import * as THREE from "three";

/**
 * اللبنات النباتية: ورقة وبتلة وغصن.
 *
 * النماذج السابقة كانت كتلًا بدائية — كرة عشرينية الوجوه تنوب عن شجيرة كاملة،
 * ومخروط ينوب عن زهرة. تُقرأ من بعيد لكن لا ورقة فيها ولا غصن. هذه الدوالّ
 * تبني الأجزاء التي تجعل النبتة تُشبه نبتة: نصل ورقة مطويّ على عرقه، وبتلة
 * مفردة، وغصنًا مستدقًّا يمكن ربط عدّة منه في سلسلة منحنية.
 *
 * كلها قليلة المضلّعات ومسطّحة الأوجه عمدًا: الطراز كرتوني حادّ الحوافّ، وكل
 * مثلث زائد يُضرب في ستمئة نبتة على شاشة الممرّ.
 */

/**
 * نصل ورقة يمتدّ على المحور ‎+Z‎ من الأصل، عرضه على ‎X‎ وطيّته على ‎Y‎.
 *
 * الطيّة على العرق الأوسط ليست زينة: نصل مسطّح تمامًا يختفي حين يوازي الضوء،
 * والطيّة تمنح كل نصف ميلًا مختلفًا فتلتقط الورقة الضوء من أي زاوية.
 */
export function leafBlade(): THREE.BufferGeometry {
  // t على الطول، نصف العرض عنده، وارتفاع العرق
  const rings: [number, number, number][] = [
    [0.0, 0.0, 0.0],
    [0.28, 0.2, 0.075],
    [0.66, 0.17, 0.06],
    [1.0, 0.0, 0.0],
  ];

  const pos: number[] = [];
  const push = (x: number, y: number, z: number) => pos.push(x, y, z);

  for (let i = 0; i < rings.length - 1; i++) {
    const [z0, w0, h0] = rings[i];
    const [z1, w1, h1] = rings[i + 1];
    // النصف الأيسر: حافة ← عرق
    push(-w0, 0, z0); push(0, h0, z0); push(0, h1, z1);
    push(-w0, 0, z0); push(0, h1, z1); push(-w1, 0, z1);
    // النصف الأيمن: عرق ← حافة
    push(0, h0, z0); push(w0, 0, z0); push(w1, 0, z1);
    push(0, h0, z0); push(w1, 0, z1); push(0, h1, z1);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** بتلة: أقصر من الورقة وأعرض، بطرف مستدير بدل المدبّب. */
export function petalBlade(): THREE.BufferGeometry {
  const rings: [number, number, number][] = [
    [0.0, 0.045, 0.0],
    [0.35, 0.17, 0.05],
    [0.75, 0.19, 0.045],
    [1.0, 0.09, 0.0],
  ];

  const pos: number[] = [];
  const push = (x: number, y: number, z: number) => pos.push(x, y, z);

  for (let i = 0; i < rings.length - 1; i++) {
    const [z0, w0, h0] = rings[i];
    const [z1, w1, h1] = rings[i + 1];
    push(-w0, h0 * 0.2, z0); push(0, h0, z0); push(0, h1, z1);
    push(-w0, h0 * 0.2, z0); push(0, h1, z1); push(-w1, h1 * 0.2, z1);
    push(0, h0, z0); push(w0, h0 * 0.2, z0); push(w1, h1 * 0.2, z1);
    push(0, h0, z0); push(w1, h1 * 0.2, z1); push(0, h1, z1);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * مصفوفة تضع جسمًا ممتدًّا على ‎+Y‎ بين نقطتين — لبناء الأغصان والسيقان.
 *
 * الأسطوانة في three تُبنى على المحور ‎Y‎ ومركزها في وسطها، فتحتاج إزاحةً
 * ودورانًا لتصل من نقطة إلى أخرى. تجميع ذلك هنا يمنع تكراره في كل نبتة.
 */
export function limbMatrix(from: THREE.Vector3, to: THREE.Vector3): THREE.Matrix4 {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);

  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize(),
  );

  return new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, len, 1));
}

/**
 * مصفوفة ورقة: تضعها عند نقطة، تدير مِحورها نحو اتجاه، وتحدّد طولها.
 *
 * `roll` يلفّ الورقة حول محورها الطولي فلا تبدو كل الأوراق مسطّحة على مستوى
 * واحد — وهو أكثر ما يفضح التكرار في مزرعة فيها مئات النبتات.
 */
export function leafMatrix(
  at: THREE.Vector3,
  yaw: number,
  pitch: number,
  length: number,
  roll = 0,
): THREE.Matrix4 {
  const e = new THREE.Euler(pitch, yaw, roll, "YXZ");
  const q = new THREE.Quaternion().setFromEuler(e);
  return new THREE.Matrix4().compose(at, q, new THREE.Vector3(length, length, length));
}
