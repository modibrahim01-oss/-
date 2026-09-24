"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  PALETTES,
  buildPlant,
  detailFor,
  buildTerrain,
  fieldBoundsFor,
  fieldBox,
  gridToWorld,
} from "@/lib/plants";
import type { Plant } from "@/lib/types";

/**
 * المزرعة: منظور isometric ثابت بكاميرا orthographic — نفس لغة Clash of
 * Clans البصرية. الزاوية لا تتغيّر (لا تدوير)، والمستخدم يسحب ويكبّر فقط،
 * فالمشهد يقرأ بنفس الشكل على كل شاشة.
 *
 * النبتات تُبنى من `plants` وحدها: مواضعها محسوبة في قاعدة البيانات وقت
 * المنح، وهذا المكوّن يرسم ما يُعطى له ولا يحسب موضعًا.
 */

const ISO_AZIM = Math.PI / 4;
const ISO_ELEV = Math.PI / 6;
const BASE_VIEW_HEIGHT = 13;
// الحد الأدنى منخفض عمدًا: مزرعة فصل كامل تمتدّ ثلاثين خانة، وتأطيرها كاملة
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
};

export default function FarmScene({
  plants,
  cinematic = false,
  dusk = false,
  className,
  style,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  // يُزاد لإعادة بناء المشهد كاملًا حين لا تكفي الإضافة: نبتات قائمة انتقلت
  // من خاناتها، أو مزرعة تجاوزت سورها
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

    // امتداد المزرعة يحدّد الساحة: السور يحيط بالنبتات بهامش ثابت من كل
    // جهة على حدة، فلا تغرق مزرعة صغيرة في عشب فارغ.
    const cells = plants.map((p) => ({ x: p.grid_x, y: p.grid_y }));
    const bounds = fieldBoundsFor(cells);
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
    // نقطة النظر: مركز المشهد المؤطَّر، لا الأصل — المزرعة لم تعد متناظرة
    // حوله، فبستان كبير في جهة واحدة كان سيُدفع خارج الإطار
    let panX = 0;
    let panY = 0;
    let panZ = 0;
    const axes = screenAxes(ISO_AZIM);
    // الرسم عند الحاجة لا كل إطار: المزرعة ساكنة معظم الوقت، ورسمها ستين مرة
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
        // يمحوها فتعود المزرعة صفوفًا مستوية
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
     * يؤطّر المزرعة كاملة عند الفتح: السور والنبتات، بلا قصّ ولا فراغ زائد.
     *
     * يُسقط زوايا الصندوق المحيط بالمشهد على محوري الشاشة ويأخذ امتدادها
     * الفعلي — لا تقديرًا بالقطر. التقدير السابق كان يسمح بقصّ طرفي السور على
     * الشاشة الطولية، فظهر السور مقطوعًا على الجوّال كأن المزرعة معطوبة.
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
      panX = center.x;
      panY = center.y;
      panZ = center.z;

      // هامش العرض أوسع: الكاميرا تتمايل فيه وتتنفّس تكبيرًا، وبطاقتا الاسم
      // ولوحة الصدارة تشغلان زاويتين من الشاشة
      const pad = cinematic ? 1.3 : 1.06;
      const aspect = host.clientWidth / Math.max(1, host.clientHeight);
      const viewH = Math.max(maxU - minU, (maxR - minR) / Math.max(0.2, aspect)) * pad;
      zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, BASE_VIEW_HEIGHT / viewH));
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
      // يمين الشاشة) فتنزاح المزرعة يمينًا مع الإصبع. كانت الإشارة معكوسة
      // أفقيًا فتهرب المزرعة عكس اليد
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

    // ── المدخلات ──
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStart = 0;
    let pinchZoom = 1;

    const onPointerDown = (e: PointerEvent) => {
      if (cinematic) return;
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
        // مزرعة كبيرة بدل المزرعة كاملة
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
      // «إعادة الضبط» تعني الرجوع لإطار المزرعة الكاملة، لا لتكبير ثابت
      reset: () => {
        fitToPlants();
        applyCamera();
      },
      sync: (next) => {
        // الإضافة وحدها تفترض أن النبتات القائمة ثابتة وأن السور يسعها. إن
        // انتقلت نبتة (إعادة ترتيب المزرعة) أو خرجت الجديدة عن السور، يُعاد
        // بناء المشهد بالساحة الجديدة بدل رسم نبتة في مكانها القديم أو خارج السور
        const nextBounds = fieldBoundsFor(next.map((p) => ({ x: p.grid_x, y: p.grid_y })));
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
