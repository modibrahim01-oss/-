/**
 * قياس كلفة رسم المزرعة: عدد الأجسام في المشهد ومعدّل الإطارات.
 *
 * البناء الناجح لا يقول شيئًا عن كلفة الرسم، وعدد الشبكات هو ما يحدّد
 * نداءات الرسم — وهو ما يخنق جوّالًا ضعيفًا أو شاشة ممرّ معلّقة.
 *
 *   npx next dev -p 3312 &   ثم   node scripts/measure-farm.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.MEASURE_BASE ?? "http://127.0.0.1:3312";
const CASES = [
  { count: 120, w: 1280, h: 800, label: "١٢٠ نبتة · سطح مكتب" },
  { count: 600, w: 1280, h: 800, label: "٦٠٠ نبتة · سطح مكتب" },
  { count: 600, w: 390, h: 780, label: "٦٠٠ نبتة · جوّال ٣٩٠px" },
];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
});

console.log("الحالة".padEnd(26) + "شبكات   مثلثات      إطار/ث");
console.log("─".repeat(58));

for (const c of CASES) {
  const page = await browser.newPage({ viewport: { width: c.w, height: c.h } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${BASE}/dev/farm-preview?count=${c.count}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  const stats = await page.evaluate(async () => {
    // نعدّ الأجسام من الـ canvas عبر عدّاد three المكشوف على الـ renderer،
    // وإن لم يكن مكشوفًا نكتفي بعدّ الإطارات
    let frames = 0;
    const start = performance.now();
    await new Promise((resolve) => {
      const tick = () => {
        frames++;
        if (performance.now() - start < 2000) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    const info = window.__farmInfo || null;
    return {
      fps: Math.round((frames / (performance.now() - start)) * 1000),
      calls: info ? info.render.calls : null,
      triangles: info ? info.render.triangles : null,
    };
  });

  const calls = stats.calls === null ? "—" : String(stats.calls);
  const tris = stats.triangles === null ? "—" : stats.triangles.toLocaleString("en-US");
  console.log(
    c.label.padEnd(24) + calls.padStart(6) + tris.padStart(10) + String(stats.fps).padStart(10),
  );
  if (errors.length) console.log("   أخطاء: " + errors.join(" | "));
  await page.close();
}

await browser.close();
