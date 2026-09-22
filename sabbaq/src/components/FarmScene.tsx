"use client";

import { type CSSProperties, useEffect, useRef } from "react";
import * as THREE from "three";
import {
  PALETTES,
  TILE,
  buildPlant,
  buildTerrain,
  gridToWorld,
  playHalfFor,
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
// الحد الأدنى منخفض عمدًا: مزرعة فصل كامل تبلغ الطبقة ١٢+، وتأطيرها كاملة
// على شاشة ضيّقة يحتاج تصغيرًا أبعد بكثير من الافتراضي.
const MIN_ZOOM = 0.12;
const MAX_ZOOM = 3;

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
  // آخر مجموعة نبتات مرسومة — نقارن بها لنُضيف الجديد فقط بدل إعادة البناء
  const drawnRef = useRef<Map<number, THREE.Group>>(new Map());
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

    // امتداد المزرعة يحدّد حجم الملعب: السياج يحيط بأبعد نبتة بهامش ثابت
    // بدل أن يقف عند حدّ ثابت يغرق المزارع الصغيرة في عشب فارغ.
    let maxRing = 1;
    for (const p of plants) {
      maxRing = Math.max(maxRing, Math.abs(p.grid_x), Math.abs(p.grid_y));
    }
    const playHalf = playHalfFor(maxRing);

    const scene = new THREE.Scene();
    buildTerrain(scene, dusk ? PALETTES.dusk : PALETTES.day, playHalf);

    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
    let zoom = 1;
    let panX = 0;
    let panZ = 0;

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
        const group = buildPlant(p.tier, p.slot_index);
        const [x, y, z] = gridToWorld(p.grid_x, p.grid_y);
        group.position.set(x, y, z);
        scene.add(group);
        drawn.set(p.slot_index, group);
      }
    }

    /** النبتة الجديدة تكبر من الصفر بارتداد خفيف. */
    function growIn(slot: number) {
      const group = drawn.get(slot);
      if (!group) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) return;
      const start = performance.now();
      const step = () => {
        const t = Math.min(1, (performance.now() - start) / 550);
        const eased = 1 - (1 - t) ** 3;
        const s = eased * (1 + Math.sin(eased * Math.PI) * 0.15);
        group.scale.setScalar(Math.max(0.01, s));
        if (t < 1) requestAnimationFrame(step);
        else group.scale.setScalar(1);
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
        panX + Math.cos(ISO_AZIM) * Math.cos(ISO_ELEV) * dist,
        Math.sin(ISO_ELEV) * dist,
        panZ + Math.sin(ISO_AZIM) * Math.cos(ISO_ELEV) * dist,
      );
      camera.lookAt(panX, 0, panZ);
    }

    /**
     * يؤطّر المزرعة كاملة عند الفتح.
     *
     * تكبير ثابت يصلح لعشرات النبتات ويفشل لمئاتها: طالب بعد فصل كامل كان
     * سيفتح مزرعته فيرى زاوية منها فقط. المربع يدور ٤٥° في الإسقاط
     * المتساوي القياس فيصير قطره هو العرض على الشاشة، وارتفاعه ذلك القطر
     * مضروبًا في جيب زاوية الارتفاع.
     */
    function fitToPlants() {
      // نؤطّر السياج لا النبتات: حجمه محسوب من امتدادها أصلًا، وتأطيره
      // يُظهر الجزيرة كاملة بهامش عشب متّسق في كل المراحل.
      const half = playHalf * TILE;
      const diagonal = half * Math.SQRT2 * 2;
      const neededH = diagonal * Math.sin(ISO_ELEV);
      const aspect = host.clientWidth / Math.max(1, host.clientHeight);
      // على الشاشة الطولية نسمح بقصّ طرفي الجزيرة — زاويتاها عشب بلا نبتات.
      // بدون هذا يفرض عرضُ المعيّن ارتفاعَ عرضٍ مضاعفًا، فتنحصر المزرعة في
      // شريط بربع ارتفاع الشاشة وسط سماء فارغة.
      const widthAllowance = aspect < 1 ? 0.72 : 1;
      const viewH =
        Math.max(neededH, (diagonal * widthAllowance) / Math.max(0.2, aspect)) * 1.08;
      zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, BASE_VIEW_HEIGHT / viewH));
      panX = 0;
      panZ = 0;
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
      panX += dx * worldPerPx * sinA - (dy * worldPerPx * cosA) / sinE;
      panZ += -dx * worldPerPx * cosA - (dy * worldPerPx * sinA) / sinE;
      const lim = playHalf * TILE * 0.95;
      panX = Math.max(-lim, Math.min(lim, panX));
      panZ = Math.max(-lim, Math.min(lim, panZ));
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
    // الترتيب مقصود: التأطير يقرأ أبعاد الحاوية، فلا بد أن يسبقه setSize
    renderer.setSize(host.clientWidth, Math.max(1, host.clientHeight), false);
    fitToPlants();
    applyCamera();

    let raf = 0;
    const loop = () => {
      if (cinematic) {
        const t = performance.now();
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
        camera.position.set(
          Math.cos(azim) * Math.cos(ISO_ELEV) * dist,
          Math.sin(ISO_ELEV) * dist,
          Math.sin(azim) * Math.cos(ISO_ELEV) * dist,
        );
        camera.lookAt(0, 0, 0);
      }
      renderer.render(scene, camera);
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
      // الهندسات والموادّ مُشتركة عبر lib/plants ولا تُتلَف هنا؛ نتلف الـ
      // renderer وحده وإلا فقدت المشاهد اللاحقة موادّها.
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
    // المشهد يُبنى مرة واحدة؛ تغيّر النبتات يُعالَج في الـ effect التالي عبر
    // sync، فإعادة البناء الكاملة على كل منح نقطة تفقد موضع الكاميرا.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cinematic, dusk]);

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
            gap: 6,
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
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        color: "var(--ink)",
        fontSize: small ? 14 : 18,
        fontWeight: 700,
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {label}
    </button>
  );
}
