"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { arrangeBounds, farmBounds, insideBounds } from "@/lib/farm-layout";
import { cumulative, mowRoute, pointAt } from "@/lib/mow-path";
import { buildMower, clippingParts } from "@/lib/mower-model";
import {
  PALETTES,
  TILE,
  buildPlant,
  detailFor,
  buildTerrain,
  fieldBox,
  gridToWorld,
} from "@/lib/plants";
import type { Tier } from "@/lib/tiers";
import type { Plant } from "@/lib/types";

/**
 * البستان: منظور isometric ثابت بكاميرا orthographic — نفس لغة Clash of
 * Clans البصرية. الزاوية لا تتغيّر (لا تدوير)، والمستخدم يسحب ويكبّر فقط،
 * فالمشهد يقرأ بنفس الشكل على كل شاشة.
 *
 * النبتات تُبنى من `plants` وحدها: مواضعها محسوبة في قاعدة البيانات وقت
 * المنح، وهذا المكوّن يرسم ما يُعطى له ولا يحسب موضعًا.
 */

const ISO_AZIM = Math.PI / 4;
const ISO_ELEV = Math.PI / 6;
const BASE_VIEW_HEIGHT = 13;
// الحد الأدنى منخفض عمدًا: بستان فصل كامل يمتدّ ثلاثين خانة، وتأطيره كاملًا
// على شاشة ضيّقة يحتاج تصغيرًا أبعد بكثير من الافتراضي.
const MIN_ZOOM = 0.08;
const MAX_ZOOM = 3;

/**
 * محورا الشاشة في العالم: يمين الكاميرا وأعلاها.
 *
 * الزاوية ثابتة فيُحسبان مرّة واحدة. إسقاط أي نقطة عليهما يعطي موضعها على
 * الشاشة، وهو ما يجعل التأطير حسابًا دقيقًا لا تقديرًا بالقطر والجيب.
 */
function screenAxes(azim: number) {
  const toCamera = new THREE.Vector3(
    Math.cos(azim) * Math.cos(ISO_ELEV),
    Math.sin(ISO_ELEV),
    Math.sin(azim) * Math.cos(ISO_ELEV),
  );
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), toCamera).normalize();
  const up = new THREE.Vector3().crossVectors(toCamera, right);
  return { toCamera, right, up };
}

type Props = {
  plants: Plant[];
  /** وضع العرض: يتجاهل مدخلات المستخدم ويحرّك الكاميرا تلقائيًا */
  cinematic?: boolean;
  dusk?: boolean;
  className?: string;
  /** يُدمج فوق التموضع الافتراضي — الحاوية الأب يجب أن تكون مُموضَعة */
  style?: CSSProperties;
  /**
   * وضع الترتيب: سحب النبتة يضعها في خانة جديدة داخل السور، وإفلاتها على
   * نبتة أخرى يبادلهما. المشهد يحرّك الشبكات بنفسه ويُبلغ بكل نقلة؛ لا يُعاد
   * بناؤه، فلا تقفز الكاميرا ولا يومض شيء.
   */
  arrange?: { onMove: (moves: { slot: number; x: number; y: number }[]) => void };
  /**
   * الخصم: جزّازة تمرّ على خانات نبتات أُزيلت من البستان. النبتات تُرسم في
   * خاناتها مؤقتًا ثم تقصّها الجزّازة واحدة واحدة. `key` يميّز كل تشغيل.
   */
  mow?: { key: string; cells: MowCell[]; onDone: () => void } | null;
  /** يُزاد لإنهاء الجزّازة فورًا (زرّ «تخطٍّ») */
  skipMow?: number;
};

export type MowCell = { x: number; y: number; tier: Tier };

export default function FarmScene({
  plants,
  cinematic = false,
  dusk = false,
  className,
  style,
  arrange,
  mow,
  skipMow = 0,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  // مرجع لا خاصية في تبعيات المشهد: الدخول إلى وضع الترتيب والخروج منه لا
  // يعيدان بناء المشهد، ومعالجات المؤشر تقرأ آخر قيمة
  const arrangeRef = useRef(arrange);
  arrangeRef.current = arrange;
  const mowRef = useRef(mow);
  mowRef.current = mow;
  // يُزاد لإعادة بناء المشهد كاملًا حين لا تكفي الإضافة: نبتات قائمة انتقلت
  // من خاناتها، أو بستان تجاوز سوره
  const [epoch, setEpoch] = useState(0);
  // النبتات المرسومة قبل إعادة البناء: ما سواها جديد فيكبر أمام الطالب كما
  // في الإضافة العادية، ولا يظهر فجأة لأن المشهد أُعيد بناؤه
  const keptRef = useRef<Set<number> | null>(null);
  // آخر مجموعة نبتات مرسومة — نقارن بها لنُضيف الجديد فقط بدل إعادة البناء
  const drawnRef = useRef<Map<number, THREE.Object3D>>(new Map());
  const apiRef = useRef<{
    zoomIn: () => void;
    zoomOut: () => void;
    reset: () => void;
    sync: (next: Plant[]) => void;
    mow: (cells: MowCell[], onDone: () => void) => void;
    skipMow: () => void;
  } | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    // نوع غير قابل للـ null صريحًا: دوال `function` المرفوعة أدناه لا ترث
    // تضييق النوع من الحارس أعلاه، فنمنحها مرجعًا نوعه مؤكَّد من الأصل.
    const host: HTMLDivElement = hostRef.current;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    // عدّاد كلفة الرسم لسكربت القياس. كائن حيّ يحدّثه three كل إطار، ومحجوب
    // عن الإنتاج: كلفة النبتات لا يكشفها بناء ناجح ولا اختبار وحدة.
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __farmInfo?: THREE.WebGLInfo }).__farmInfo = renderer.info;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = cinematic ? "default" : "grab";

    // امتداد البستان يحدّد الساحة: السور يحيط بالنبتات بهامش ثابت من كل
    // جهة على حدة، فلا يغرق بستان صغير في عشب فارغ.
    const cells = plants.map((p) => ({ x: p.grid_x, y: p.grid_y }));
    // السور من التخطيط الافتراضي لا من الخانات الفعلية: ترتيب الطالب لا
    // يحرّك السور، والترتيب يبقى داخله (انظر farm-layout.ts)
    const bounds = farmBounds(plants);
    const allowed = arrangeBounds(plants);
    const occupied = new Set(cells.map((c) => `${c.x},${c.y}`));
    const detail = detailFor(plants.length);

    const scene = new THREE.Scene();
    const disposeTerrain = buildTerrain(
      scene,
      dusk ? PALETTES.dusk : PALETTES.day,
      bounds,
      occupied,
    );

    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
    let zoom = 1;
    // نقطة النظر: مركز المشهد المؤطَّر، لا الأصل — البستان لم يعد متناظرًا
    // حوله، فركن كبير في جهة واحدة كان سيُدفع خارج الإطار
    let panX = 0;
    let panY = 0;
    let panZ = 0;
    const axes = screenAxes(ISO_AZIM);
    // الرسم عند الحاجة لا كل إطار: البستان ساكن معظم الوقت، ورسمه ستين مرة
    // في الثانية بظلالها كان يُبقي معالج الجوّال والتلفاز مشغولًا بلا توقّف
    // فتثقل الصفحة كلها وتتأخّر اللمسات. كل ما يغيّر الصورة يرفع هذه الراية.
    let dirty = true;
    const field = fieldBox(bounds);

    const drawn = drawnRef.current;

    function placePlants(list: Plant[]) {
      const wanted = new Set(list.map((p) => p.slot_index));

      for (const [slot, group] of drawn) {
        if (!wanted.has(slot)) {
          scene.remove(group);
          drawn.delete(slot);
        }
      }

      for (const p of list) {
        if (drawn.has(p.slot_index)) continue;
        const group = buildPlant(p.tier, p.slot_index, detail);
        const [x, y, z] = gridToWorld(p.grid_x, p.grid_y);
        // جمع لا إسناد: buildPlant يضع إزاحة النبتة داخل خانتها، و set كان
        // يمحوها فيعود البستان صفوفًا مستوية. الإزاحة تُحفظ لتبقى مع النبتة
        // إن نُقلت إلى خانة أخرى في وضع الترتيب
        group.userData.offset = group.position.clone();
        group.position.add(new THREE.Vector3(x, y, z));
        // buildPlant يعطي كل نبتة حجمًا مختلفًا قليلًا؛ يُحفَظ هنا لأن حركة
        // النموّ تكتب على scale، فبدونه تعود كل نبتة إلى حجم واحد بعد نموّها
        group.userData.baseScale = group.scale.x;
        group.userData.cell = `${p.grid_x},${p.grid_y}`;
        scene.add(group);
        drawn.set(p.slot_index, group);
      }
      dirty = true;
    }

    /** النبتة الجديدة تكبر من الصفر بارتداد خفيف. */
    function growIn(slot: number) {
      const group = drawn.get(slot);
      if (!group) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) return;
      const start = performance.now();
      const base = (group.userData.baseScale as number) ?? 1;
      const step = () => {
        const t = Math.min(1, (performance.now() - start) / 550);
        const eased = 1 - (1 - t) ** 3;
        const s = eased * (1 + Math.sin(eased * Math.PI) * 0.15);
        group.scale.setScalar(Math.max(0.01, s) * base);
        dirty = true;
        if (t < 1) requestAnimationFrame(step);
        else group.scale.setScalar(base);
      };
      group.scale.setScalar(0.01);
      step();
    }

    function applyCamera() {
      const w = host.clientWidth;
      const h = Math.max(1, host.clientHeight);
      const aspect = w / h;
      const viewH = BASE_VIEW_HEIGHT / zoom;
      const viewW = viewH * aspect;
      camera.left = -viewW / 2;
      camera.right = viewW / 2;
      camera.top = viewH / 2;
      camera.bottom = -viewH / 2;
      camera.updateProjectionMatrix();

      const dist = 50;
      camera.position.set(
        panX + axes.toCamera.x * dist,
        panY + axes.toCamera.y * dist,
        panZ + axes.toCamera.z * dist,
      );
      camera.lookAt(panX, panY, panZ);
      dirty = true;
    }

    /**
     * يؤطّر البستان كاملًا عند الفتح: السور والنبتات، بلا قصّ ولا فراغ زائد.
     *
     * يُسقط زوايا الصندوق المحيط بالمشهد على محوري الشاشة ويأخذ امتدادها
     * الفعلي — لا تقديرًا بالقطر. التقدير السابق كان يسمح بقصّ طرفي السور على
     * الشاشة الطولية، فظهر السور مقطوعًا على الجوّال كأن البستان معطوب.
     *
     * الصندوق متناظر مركزيًا، فإسقاطه متناظر حول إسقاط مركزه: توجيه الكاميرا
     * إلى مركز الصندوق يضع المشهد في منتصف الإطار بالضبط.
     */
    function fitToPlants() {
      const box = field.clone();
      for (const group of drawn.values()) {
        group.updateMatrixWorld(true);
        box.expandByObject(group);
      }
      const f = frameFor(box, cinematic ? 1.3 : 1.06);
      panX = f.x;
      panY = f.y;
      panZ = f.z;
      zoom = f.zoom;
    }

    /** نقطة النظر والتكبير اللذان يؤطّران صندوقًا كاملًا بهامش `pad`. */
    function frameFor(box: THREE.Box3, pad: number) {
      let minR = Infinity;
      let maxR = -Infinity;
      let minU = Infinity;
      let maxU = -Infinity;
      const corner = new THREE.Vector3();
      for (let i = 0; i < 8; i++) {
        corner.set(
          i & 1 ? box.max.x : box.min.x,
          i & 2 ? box.max.y : box.min.y,
          i & 4 ? box.max.z : box.min.z,
        );
        const r = corner.dot(axes.right);
        const u = corner.dot(axes.up);
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minU = Math.min(minU, u);
        maxU = Math.max(maxU, u);
      }

      const center = box.getCenter(new THREE.Vector3());
      // هامش العرض أوسع: الكاميرا تتمايل فيه وتتنفّس تكبيرًا، وبطاقتا الاسم
      // ولوحة الصدارة تشغلان زاويتين من الشاشة
      const aspect = host.clientWidth / Math.max(1, host.clientHeight);
      const viewH = Math.max(maxU - minU, (maxR - minR) / Math.max(0.2, aspect)) * pad;
      return {
        x: center.x,
        y: center.y,
        z: center.z,
        zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, BASE_VIEW_HEIGHT / viewH)),
      };
    }

    function resize() {
      renderer.setSize(host.clientWidth, Math.max(1, host.clientHeight), false);
      applyCamera();
    }

    /**
     * يحوّل سحب الإصبع إلى إزاحة على مستوى الأرض. المحور الأفقي للشاشة يقع
     * كاملًا في مستوى الأرض، أما المحور العمودي فمائل بزاوية الارتفاع،
     * فنقسم على sin(elev) لتتبع الأرض الإصبع ١:١ بصريًا.
     */
    function pan(dx: number, dy: number) {
      const worldPerPx = (camera.right - camera.left) / Math.max(1, host.clientWidth);
      const cosA = Math.cos(ISO_AZIM);
      const sinA = Math.sin(ISO_AZIM);
      const sinE = Math.sin(ISO_ELEV);
      // الأرض تلحق الإصبع: السحب يمينًا يحرّك نقطة النظر يسارًا (عكس محور
      // يمين الشاشة) فينزاح البستان يمينًا مع الإصبع. كانت الإشارة معكوسة
      // أفقيًا فيهرب البستان عكس اليد
      panX += -dx * worldPerPx * sinA - (dy * worldPerPx * cosA) / sinE;
      panZ += dx * worldPerPx * cosA - (dy * worldPerPx * sinA) / sinE;
      // السحب محصور في الساحة: لا يُترك المستخدم يحدّق في سماء فارغة
      panX = Math.max(field.min.x, Math.min(field.max.x, panX));
      panZ = Math.max(field.min.z, Math.min(field.max.z, panZ));
      applyCamera();
    }

    function setZoom(next: number) {
      zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
      applyCamera();
    }

    // ── الجزّازة ──
    let mowing: { finish: (notify: boolean) => void } | null = null;

    /** تنقل الكاميرا بنعومة إلى إطار آخر خلال `ms`. */
    function tweenCamera(to: { x: number; y: number; z: number; zoom: number }, ms: number, done?: () => void) {
      const from = { x: panX, y: panY, z: panZ, zoom };
      const start = performance.now();
      const step = () => {
        if (!mowing) return;
        const t = Math.min(1, (performance.now() - start) / ms);
        const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        panX = from.x + (to.x - from.x) * e;
        panY = from.y + (to.y - from.y) * e;
        panZ = from.z + (to.z - from.z) * e;
        zoom = from.zoom + (to.zoom - from.zoom) * e;
        applyCamera();
        if (t < 1) requestAnimationFrame(step);
        else done?.();
      };
      step();
    }

    function mowCells(cells: MowCell[], onDone: () => void) {
      if (mowing || cells.length === 0) {
        if (!mowing) onDone();
        return;
      }
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const order = mowRoute(cells);
      const taken = new Set([...drawn.values()].map((g) => g.userData.cell as string));

      // النبتات المخصومة تُرسم في خاناتها مؤقتًا لتقصّها الجزّازة. خانة نمت
      // فيها نبتة جديدة بعد الخصم تمرّ عليها الجزّازة دون رسم شيء
      const doomed = order.map((i, k) => {
        const c = cells[i];
        if (taken.has(`${c.x},${c.y}`)) return null;
        const g = buildPlant(c.tier, 900000 + k, detail);
        const [x, y, z] = gridToWorld(c.x, c.y);
        g.position.add(new THREE.Vector3(x, y, z));
        g.userData.baseScale = g.scale.x;
        scene.add(g);
        return g;
      });

      // حلقة حمراء تحت كل نبتة ستُزال: يرى الطالب ما ستقصّه الجزّازة قبل أن تصله
      const ringGeo = new THREE.RingGeometry(TILE * 0.3, TILE * 0.42, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xff5a4e, transparent: true, opacity: 0.85, depthWrite: false });
      const rings = order.map((i) => {
        const [x, , z] = gridToWorld(cells[i].x, cells[i].y);
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, 0.06, z);
        scene.add(ring);
        return ring;
      });

      const mower = buildMower();
      const clips = clippingParts();
      const flying: { mesh: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];
      let raf = 0;
      let ended = false;

      const finish = (notify: boolean) => {
        if (ended) return;
        ended = true;
        cancelAnimationFrame(raf);
        for (const g of doomed) if (g) scene.remove(g);
        for (const r of rings) scene.remove(r);
        ringGeo.dispose();
        ringMat.dispose();
        for (const f of flying) scene.remove(f.mesh);
        scene.remove(mower.group);
        mower.dispose();
        clips.dispose();
        mowing = null;
        dirty = true;
        if (notify) onDone();
      };
      mowing = { finish };

      if (reduced) {
        finish(true);
        return;
      }

      // المسار: من حافة البستان إلى أول خانة، ثم الخانات، ثم الخروج من الحافة
      const pts = order.map((i) => {
        const [x, , z] = gridToWorld(cells[i].x, cells[i].y);
        return { x, z };
      });
      const inside = (v: number, lo: number, hi: number) => Math.max(lo + TILE * 0.6, Math.min(hi - TILE * 0.6, v));
      const entry = { x: inside(pts[0].x - TILE * 2.5, field.min.x, field.max.x), z: pts[0].z };
      const last = pts[pts.length - 1];
      const exit = { x: inside(last.x + TILE * 2.5, field.min.x, field.max.x), z: last.z };
      const path = [entry, ...pts, exit];
      const cum = cumulative(path);
      const total = Math.max(0.001, cum[cum.length - 1]);
      // بين ثلاث ثوانٍ وسبع مهما تباعدت الخانات
      const duration = Math.max(3000, Math.min(7000, (total / 3.2) * 1000));
      const speed = total / duration;

      // الكاميرا تقترب من مكان الخصم، ثم تعود لإطار البستان كاملًا
      const area = new THREE.Box3();
      for (const q of path) area.expandByPoint(new THREE.Vector3(q.x, 0, q.z));
      area.expandByVector(new THREE.Vector3(TILE * 1.5, 0, TILE * 1.5));
      area.max.y = 1.6;
      // تقترب الكاميرا فقط إن كان مكان الخصم أصغر من البستان بوضوح؛ وإلا
      // يبقى الإطار الكامل فلا يُقصّ طرف البستان بلا فائدة
      const fitted = frameFor(area, 1.15);
      const close =
        fitted.zoom > zoom * 1.25
          ? { ...fitted, zoom: Math.min(fitted.zoom, zoom * 2.2, MAX_ZOOM) }
          : { x: panX, y: panY, z: panZ, zoom };

      // أكبر قليلًا من النبتات: هي بطلة اللحظة
      const MOWER_SCALE = 1.4;
      mower.group.position.set(entry.x, 0, entry.z);
      mower.group.scale.setScalar(0.01);
      scene.add(mower.group);

      const spray = (at: THREE.Vector3, n: number, power: number) => {
        for (let j = 0; j < n && flying.length < 160; j++) {
          const mesh = new THREE.Mesh(clips.geometry, clips.materials[j % clips.materials.length]);
          mesh.position.copy(at);
          mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
          const a = Math.random() * Math.PI * 2;
          const r = (0.6 + Math.random()) * power;
          flying.push({ mesh, v: new THREE.Vector3(Math.cos(a) * r, (2.2 + Math.random() * 1.6) * power, Math.sin(a) * r), life: 0.9 });
          scene.add(mesh);
        }
      };

      const cut = new Set<number>();
      let traveled = 0;
      let heading = Math.atan2(pts[0].x - entry.x, pts[0].z - entry.z || 1);
      let lastSpray = 0;
      let phase: "in" | "run" | "out" = "in";
      let phaseStart = 0;
      let last0 = performance.now();

      const step = (now: number) => {
        // سقف ربع ثانية لا عشرين ملّيثانية: على جهاز بطيء تبقى الجزّازة بسرعتها
        // الحقيقية بدل أن تزحف دقيقة كاملة
        const dt = Math.min(250, now - last0);
        last0 = now;
        if (phase === "in") {
          const t = Math.min(1, (now - phaseStart) / 700);
          mower.group.scale.setScalar(Math.max(0.01, t) * MOWER_SCALE);
          if (t >= 1) {
            phase = "run";
            phaseStart = now;
          }
        } else if (phase === "run") {
          traveled = Math.min(total, traveled + speed * dt);
          const p = pointAt(path, cum, traveled);
          const target = Math.atan2(p.dx, p.dz);
          let diff = target - heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          heading += diff * Math.min(1, dt / 120);
          mower.group.position.set(p.x, Math.abs(Math.sin(now / 45)) * 0.03, p.z);
          mower.group.rotation.y = heading;
          for (const w of mower.wheels) w.rotation.x += (speed * dt) / 0.17;

          // قصّ كل نبتة حين تبلغها الجزّازة
          for (let k = 0; k < doomed.length; k++) {
            if (cut.has(k) || traveled < cum[k + 1] - 0.25) continue;
            cut.add(k);
            scene.remove(rings[k]);
            const g = doomed[k];
            const at = new THREE.Vector3(path[k + 1].x, 0.35, path[k + 1].z);
            spray(at, 18, 1);
            if (g) {
              const base = (g.userData.baseScale as number) ?? 1;
              const t0 = now;
              const shrink = () => {
                if (ended) return;
                const t = Math.min(1, (performance.now() - t0) / 320);
                g.scale.set(base * (1 + t * 0.3), base * Math.max(0.01, 1 - t), base * (1 + t * 0.3));
                g.rotation.z = t * 0.6;
                dirty = true;
                if (t < 1) requestAnimationFrame(shrink);
                else scene.remove(g);
              };
              shrink();
            }
          }
          // قصاصات تتطاير من جانب الجزّازة وهي تمشي
          if (now - lastSpray > 70) {
            lastSpray = now;
            spray(new THREE.Vector3(p.x, 0.25, p.z), 2, 0.55);
          }
          if (traveled >= total) {
            phase = "out";
            phaseStart = now;
            tweenCamera(base0, 900);
          }
        } else {
          const t = Math.min(1, (now - phaseStart) / 500);
          mower.group.scale.setScalar(Math.max(0.01, 1 - t) * MOWER_SCALE);
        }
        // الحلقات تنبض حتى تصلها الجزّازة
        ringMat.opacity = 0.55 + Math.sin(now / 160) * 0.3;

        for (let j = flying.length - 1; j >= 0; j--) {
          const f = flying[j];
          f.life -= dt / 1000;
          f.v.y -= 9 * (dt / 1000);
          f.mesh.position.addScaledVector(f.v, dt / 1000);
          f.mesh.rotation.x += dt / 90;
          if (f.life <= 0 || f.mesh.position.y < 0) {
            scene.remove(f.mesh);
            flying.splice(j, 1);
          }
        }
        dirty = true;

        if (phase === "out" && now - phaseStart > 950 && flying.length === 0) {
          finish(true);
          return;
        }
        raf = requestAnimationFrame(step);
      };

      // الإطار الكامل الذي تعود إليه الكاميرا في النهاية
      const base0 = { x: panX, y: panY, z: panZ, zoom };
      dirty = true;
      tweenCamera(close, 800, () => {
        if (ended) return;
        phaseStart = performance.now();
        last0 = phaseStart;
        raf = requestAnimationFrame(step);
      });
    }

    // ── الترتيب ──
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hitPoint = new THREE.Vector3();
    const highlight = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE * 0.92, TILE * 0.92),
      new THREE.MeshBasicMaterial({ color: 0x7ddc3f, transparent: true, opacity: 0.55, depthWrite: false }),
    );
    highlight.rotation.x = -Math.PI / 2;
    highlight.position.y = 0.07;
    highlight.visible = false;
    scene.add(highlight);
    let drag: { slot: number; group: THREE.Object3D; from: { x: number; y: number }; pointerId: number } | null = null;

    function aim(e: PointerEvent) {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
    }

    function pickPlant(e: PointerEvent): number | null {
      aim(e);
      const hits = raycaster.intersectObjects([...drawn.values()], false);
      if (hits.length === 0) return null;
      for (const [slot, g] of drawn) if (g === hits[0].object) return slot;
      return null;
    }

    function groundCell(e: PointerEvent): { x: number; y: number } | null {
      aim(e);
      if (!raycaster.ray.intersectPlane(ground, hitPoint)) return null;
      return { x: Math.floor(hitPoint.x / TILE), y: Math.floor(hitPoint.z / TILE) };
    }

    function placeAt(group: THREE.Object3D, x: number, y: number) {
      const [wx, wy, wz] = gridToWorld(x, y);
      const off = (group.userData.offset as THREE.Vector3 | undefined) ?? new THREE.Vector3();
      group.position.set(wx + off.x, wy + off.y, wz + off.z);
      group.userData.cell = `${x},${y}`;
    }

    function cellOf(group: THREE.Object3D) {
      const [x, y] = String(group.userData.cell).split(",").map(Number);
      return { x, y };
    }

    // موضع نبتة على الشاشة لاختبارات المتصفح (السحب في وضع الترتيب). محجوب
    // عن الإنتاج كعدّاد الرسم أعلاه.
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __farmPlantAt?: (slot: number) => { x: number; y: number; cell: string } | null }).__farmPlantAt = (
        slot,
      ) => {
        const g = drawn.get(slot);
        if (!g) return null;
        const v = g.position.clone().add(new THREE.Vector3(0, 0.3, 0)).project(camera);
        const r = renderer.domElement.getBoundingClientRect();
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, cell: String(g.userData.cell) };
      };
    }

    // ── المدخلات ──
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStart = 0;
    let pinchZoom = 1;

    const onPointerDown = (e: PointerEvent) => {
      if (cinematic) return;
      // في وضع الترتيب: إصبع واحد على نبتة يمسكها، وعلى العشب يسحب المشهد
      if (arrangeRef.current && pointers.size === 0 && !drag) {
        const slot = pickPlant(e);
        const group = slot === null ? undefined : drawn.get(slot);
        if (slot !== null && group) {
          drag = { slot, group, from: cellOf(group), pointerId: e.pointerId };
          group.position.y += 0.35;
          renderer.domElement.setPointerCapture(e.pointerId);
          renderer.domElement.style.cursor = "grabbing";
          dirty = true;
          return;
        }
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      renderer.domElement.setPointerCapture(e.pointerId);
      renderer.domElement.style.cursor = "grabbing";
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
        pinchZoom = zoom;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (cinematic) return;
      if (drag) {
        if (e.pointerId !== drag.pointerId) return;
        const c = groundCell(e);
        if (c) {
          // النبتة تتبع الإصبع، والخانة تحتها تُضاء: خضراء داخل السور وحمراء خارجه
          drag.group.position.x = hitPoint.x;
          drag.group.position.z = hitPoint.z;
          const [hx, , hz] = gridToWorld(c.x, c.y);
          highlight.position.x = hx;
          highlight.position.z = hz;
          (highlight.material as THREE.MeshBasicMaterial).color.setHex(
            insideBounds(allowed, c.x, c.y) ? 0x7ddc3f : 0xff5a4e,
          );
          highlight.visible = true;
          dirty = true;
        }
        return;
      }
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const now = { x: e.clientX, y: e.clientY };

      if (pointers.size === 2) {
        pointers.set(e.pointerId, now);
        const [a, b] = [...pointers.values()];
        const spread = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchStart > 0) setZoom(pinchZoom * (spread / pinchStart));
        return;
      }

      pan(now.x - prev.x, now.y - prev.y);
      pointers.set(e.pointerId, now);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (drag && e.pointerId === drag.pointerId) {
        const { slot, group, from } = drag;
        drag = null;
        highlight.visible = false;
        const c = e.type === "pointercancel" ? null : groundCell(e);
        const target = c && insideBounds(allowed, c.x, c.y) ? c : null;
        if (!target || (target.x === from.x && target.y === from.y)) {
          placeAt(group, from.x, from.y);
        } else {
          // إفلات على نبتة أخرى يبادلهما؛ على خانة فارغة ينقلها وحدها
          let occupant: [number, THREE.Object3D] | null = null;
          for (const [s2, g2] of drawn) {
            if (s2 !== slot && g2.userData.cell === `${target.x},${target.y}`) occupant = [s2, g2];
          }
          placeAt(group, target.x, target.y);
          const moves = [{ slot, x: target.x, y: target.y }];
          if (occupant) {
            placeAt(occupant[1], from.x, from.y);
            moves.push({ slot: occupant[0], x: from.x, y: from.y });
          }
          arrangeRef.current?.onMove(moves);
        }
        renderer.domElement.style.cursor = "grab";
        dirty = true;
        return;
      }
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStart = 0;
      if (pointers.size === 0 && !cinematic) renderer.domElement.style.cursor = "grab";
    };

    const onWheel = (e: WheelEvent) => {
      if (cinematic) return;
      e.preventDefault();
      setZoom(zoom * (e.deltaY < 0 ? 1.12 : 0.9));
    };

    if (!cinematic) {
      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      renderer.domElement.addEventListener("pointermove", onPointerMove);
      renderer.domElement.addEventListener("pointerup", onPointerUp);
      renderer.domElement.addEventListener("pointercancel", onPointerUp);
      renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    }

    const observer = new ResizeObserver(resize);
    observer.observe(host);

    placePlants(plants);
    const kept = keptRef.current;
    keptRef.current = null;
    if (kept) {
      for (const slot of drawn.keys()) {
        if (!kept.has(slot)) growIn(slot);
      }
    }
    // الترتيب مقصود: التأطير يقرأ أبعاد الحاوية، فلا بد أن يسبقه setSize
    renderer.setSize(host.clientWidth, Math.max(1, host.clientHeight), false);
    fitToPlants();
    applyCamera();

    let raf = 0;
    let lastCinematic = 0;
    const loop = () => {
      const t = performance.now();
      // حركة العرض بطيئة جدًا (دورة في دقائق)، فثلاثون إطارًا تكفيها تمامًا
      // وتنصّف حمل شاشة تبقى تعمل طوال اليوم
      if (cinematic && t - lastCinematic >= 33) {
        lastCinematic = t;
        const azim = ISO_AZIM + Math.sin(t * 0.00007) * 0.16;
        const breathe = 1 + Math.sin(t * 0.00015) * 0.07;
        // ينطلق من التكبير المؤطَّر لا من ثابت، وإلا عرضت الشاشة زاوية من
        // بستان كبير بدل البستان كاملًا
        const viewH = BASE_VIEW_HEIGHT / zoom / breathe;
        const aspect = host.clientWidth / Math.max(1, host.clientHeight);
        camera.left = (-viewH * aspect) / 2;
        camera.right = (viewH * aspect) / 2;
        camera.top = viewH / 2;
        camera.bottom = -viewH / 2;
        camera.updateProjectionMatrix();
        const dist = 50;
        // يدور حول مركز المشهد المؤطَّر لا حول الأصل
        camera.position.set(
          panX + Math.cos(azim) * Math.cos(ISO_ELEV) * dist,
          panY + Math.sin(ISO_ELEV) * dist,
          panZ + Math.sin(azim) * Math.cos(ISO_ELEV) * dist,
        );
        camera.lookAt(panX, panY, panZ);
        dirty = true;
      }
      if (dirty) {
        dirty = false;
        renderer.render(scene, camera);
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

    apiRef.current = {
      zoomIn: () => setZoom(zoom * 1.25),
      zoomOut: () => setZoom(zoom * 0.8),
      // «إعادة الضبط» تعني الرجوع لإطار البستان كاملًا، لا لتكبير ثابت
      reset: () => {
        fitToPlants();
        applyCamera();
      },
      mow: mowCells,
      skipMow: () => {
        if (!mowing) return;
        mowing.finish(true);
        fitToPlants();
        applyCamera();
      },
      sync: (next) => {
        // الإضافة وحدها تفترض أن النبتات القائمة ثابتة وأن السور يسعها. إن
        // انتقلت نبتة (إعادة ترتيب البستان) أو خرجت الجديدة عن السور، يُعاد
        // بناء المشهد بالساحة الجديدة بدل رسم نبتة في مكانها القديم أو خارج السور
        const nextBounds = farmBounds(next);
        const moved = next.some((p) => {
          const g = drawn.get(p.slot_index);
          return g !== undefined && g.userData.cell !== `${p.grid_x},${p.grid_y}`;
        });
        if (
          moved ||
          nextBounds.minX !== bounds.minX ||
          nextBounds.maxX !== bounds.maxX ||
          nextBounds.minZ !== bounds.minZ ||
          nextBounds.maxZ !== bounds.maxZ
        ) {
          keptRef.current = new Set(drawn.keys());
          setEpoch((e) => e + 1);
          return;
        }
        const before = new Set(drawn.keys());
        placePlants(next);
        for (const slot of drawn.keys()) {
          if (!before.has(slot)) growIn(slot);
        }
      },
    };

    return () => {
      mowing?.finish(false);
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      apiRef.current = null;
      drawn.clear();
      // هندسات النبتات وموادّها مُشتركة عبر lib/plants ولا تُتلَف هنا وإلا
      // فقدتها المشاهد اللاحقة. موارد الأرضية خاصّة بهذا المشهد فتُتلَف.
      disposeTerrain();
      highlight.geometry.dispose();
      (highlight.material as THREE.Material).dispose();
      renderer.dispose();
      // dispose وحده لا يُنهي سياق WebGL. وضع العرض يعيد بناء المشهد لكل
      // طالب، فبدون هذا تتكدّس السياقات حتى يُسقط المتصفح أقدمها وتُظلم الشاشة.
      renderer.forceContextLoss();
      host.removeChild(renderer.domElement);
    };
    // المشهد يُبنى مرة واحدة؛ تغيّر النبتات يُعالَج في الـ effect التالي عبر
    // sync، فإعادة البناء الكاملة على كل منح نقطة تفقد موضع الكاميرا.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cinematic, dusk, epoch]);

  useEffect(() => {
    apiRef.current?.sync(plants);
  }, [plants]);

  // الجزّازة تبدأ حين يصل خصمٌ لم يُرَ؛ وإن أُعيد بناء المشهد أثناءها تُعاد
  const mowKey = mow?.key;
  useEffect(() => {
    const m = mowRef.current;
    if (!m || !mowKey) return;
    apiRef.current?.mow(m.cells, () => mowRef.current?.onDone());
  }, [mowKey, epoch]);

  useEffect(() => {
    if (skipMow > 0) apiRef.current?.skipMow();
  }, [skipMow]);

  return (
    // يملأ أقرب سلف مُموضَع بدل أن يقيس نفسه بمحتواه. أبناؤه كلهم absolute،
    // فلو كان الجذر في تدفّق عادي انهار ارتفاعه إلى صفر وظهر الـ canvas
    // شريطًا بلا ارتفاع. `style` يأتي أخيرًا ليبقى للمستدعي حق التجاوز.
    <div className={className} style={{ position: "absolute", inset: 0, ...style }}>
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />
      {!cinematic && (
        <div
          style={{
            position: "absolute",
            top: 12,
            insetInlineStart: 12,
            display: "flex",
            flexDirection: "column",
            gap: 9,
          }}
        >
          <SceneButton label="+" onClick={() => apiRef.current?.zoomIn()} title="تكبير" />
          <SceneButton label="−" onClick={() => apiRef.current?.zoomOut()} title="تصغير" />
          <SceneButton label="⌂" onClick={() => apiRef.current?.reset()} title="إعادة الضبط" small />
        </div>
      )}
    </div>
  );
}

function SceneButton({
  label,
  onClick,
  title,
  small,
}: {
  label: string;
  onClick: () => void;
  title: string;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="press"
      style={{
        width: 40,
        height: 40,
        borderRadius: 13,
        border: "2.5px solid var(--outline)",
        background: small ? "var(--sun)" : "var(--surface)",
        color: small ? "var(--on-fill)" : "var(--ink)",
        fontSize: small ? 16 : 22,
        fontWeight: 700,
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        boxShadow: "var(--pop)",
      }}
    >
      {label}
    </button>
  );
}
