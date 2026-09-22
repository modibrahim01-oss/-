/**
 * فحص بصري للمزرعة ثلاثية الأبعاد.
 *
 * محرّك WebGL لا تغطّيه اختبارات الوحدة: مشهد سليم منطقيًا قد يُرسَم بارتفاع
 * صفر أو بتأطير يقطع نصف المزرعة، والاختبار الوحيد الذي يكشف ذلك هو فتحه في
 * متصفح فعلي. هذا السكربت يفعل ذلك ويحفظ لقطات للمراجعة.
 *
 *   npx next dev -p 3312 &   ثم   npm run shoot
 *
 * يخرج بمخرَج غير صفري إذا كان الـ canvas بلا أبعاد أو وقع خطأ في الصفحة —
 * وهما العطبان اللذان أخفاهما البناء الناجح سابقًا.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.SHOOT_BASE ?? "http://127.0.0.1:3312";
const OUT = process.env.SHOOT_OUT ?? "/tmp/shots";

const SHOTS = [
  { name: "farm-120", query: "count=120", w: 1280, h: 800 },
  { name: "farm-600", query: "count=600", w: 1280, h: 800 },
  { name: "farm-dusk", query: "count=200&dusk=1&cinematic=1", w: 1600, h: 900 },
  { name: "farm-mobile", query: "count=120", w: 390, h: 780 },
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  // Chromium مثبَّت في البيئة؛ swiftshader يعطي WebGL بلا كرت رسومات
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});

const failures = [];

for (const shot of SHOTS) {
  const page = await browser.newPage({ viewport: { width: shot.w, height: shot.h } });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await page.goto(`${BASE}/dev/farm-preview?${shot.query}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  // امنح WebGL وقتًا لبناء المشهد ورسم أول إطار
  await page.waitForTimeout(3500);

  const canvas = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    if (!c) return null;
    const gl = c.getContext("webgl2") ?? c.getContext("webgl");
    return { w: c.width, h: c.height, cssW: c.clientWidth, cssH: c.clientHeight, hasGL: !!gl };
  });

  await page.screenshot({ path: `${OUT}/${shot.name}.png` });
  await page.close();

  // الانهيار إلى ارتفاع صفر هو العطب الذي يمرّ من كل الفحوص الأخرى
  if (!canvas) failures.push(`${shot.name}: لا يوجد canvas`);
  else if (!canvas.hasGL) failures.push(`${shot.name}: WebGL غير متاح`);
  else if (canvas.cssW < 50 || canvas.cssH < 50) {
    failures.push(`${shot.name}: canvas منهار ${canvas.cssW}×${canvas.cssH}`);
  }
  if (pageErrors.length) failures.push(`${shot.name}: ${pageErrors.join(" | ")}`);

  console.log(
    `${failures.length ? "·" : "✓"} ${shot.name.padEnd(12)} ${canvas ? `${canvas.cssW}×${canvas.cssH}` : "—"}  →  ${OUT}/${shot.name}.png`,
  );
}

await browser.close();

if (failures.length) {
  console.error("\n✗ فشل الفحص البصري:");
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log("\n✓ الفحص البصري نجح — راجع اللقطات في", OUT);
