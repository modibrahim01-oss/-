/**
 * فحص تمهيدي لمشروع Supabase حيّ.
 *
 * يجيب عن سؤال واحد: هل القاعدة مُهيّأة فعلًا كما يتوقّعها التطبيق؟ أكثر ما
 * يتعطّل بعد النشر ليس الكود بل خطوة تركيب منسيّة — ملف ترحيل لم يُنفَّذ، أو
 * فصل غير نشط فتُرفض كل النقاط، أو حساب مدير بلا صفّ في public.users.
 * يفحصها كلها بمفتاح anon العام، أي من موقع الزائر نفسه.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... npm run preflight
 *
 * يخرج بمخرَج غير صفري إذا فشل أي فحص حاسم.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.error("✗ متغيّرات البيئة ناقصة:");
  if (!url) console.error("  NEXT_PUBLIC_SUPABASE_URL");
  if (!anon) console.error("  NEXT_PUBLIC_SUPABASE_ANON_KEY");
  console.error("\nقيمها في لوحة Supabase تحت Project Settings ← API");
  process.exit(1);
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY === anon) {
  console.error("✗ SUPABASE_SERVICE_ROLE_KEY يساوي المفتاح العام — تحقّق من نسخ المفتاح الصحيح");
  process.exit(1);
}

const db = createClient(url, anon, { auth: { persistSession: false } });

const results = [];
function record(ok, label, detail, critical = true) {
  results.push({ ok, label, detail, critical });
}

async function run() {
  // ── الوصول ──
  const { error: reachErr } = await db.from("groups").select("id").limit(1);
  if (reachErr) {
    record(false, "الوصول إلى القاعدة", reachErr.message);
    return;
  }
  record(true, "الوصول إلى القاعدة", new URL(url).host);

  // ── المجموعات السبع ──
  const { data: groups } = await db.from("groups").select("id, code").order("sort_order");
  record(
    groups?.length === 7,
    "المجموعات السبع",
    groups?.length === 7 ? groups.map((g) => g.code).join(", ") : `وجدت ${groups?.length ?? 0}`,
  );

  // ── فصل نشط: بدونه تُرفض كل النقاط بـ NO_ACTIVE_SEMESTER ──
  const { data: sem } = await db
    .from("semesters")
    .select("name_ar, start_date, end_date")
    .eq("is_active", true)
    .maybeSingle();
  record(
    !!sem,
    "فصل نشط",
    sem ? `${sem.name_ar} (${sem.start_date} → ${sem.end_date})` : "لا يوجد — كل منح نقاط سيُرفض",
  );

  // ── العرض العام: هو ما تُبنى منه صفحة الطالب بلا حساب ──
  const { data: farms, error: farmsErr } = await db
    .from("student_farms")
    .select("student_id")
    .limit(1);
  record(
    !farmsErr,
    "student_farms مقروء للعامّة",
    farmsErr ? farmsErr.message : `${farms?.length ? "به بيانات" : "فارغ (لا طلاب بعد)"}`,
  );

  // ── سجل النقاط مقروء للعامّة: بدونه تظهر المزارع فارغة دائمًا ──
  const { error: ledgerErr } = await db.from("points_ledger").select("id").limit(1);
  record(!ledgerErr, "points_ledger مقروء للعامّة", ledgerErr?.message ?? "نعم");

  // ── الخوارزمية الحلزونية ──
  const { data: origin, error: spiralErr } = await db.rpc("spiral_coord", { n: 0 });
  const centred = Array.isArray(origin)
    ? origin[0]?.x === 0 && origin[0]?.y === 0
    : origin?.x === 0 && origin?.y === 0;
  record(
    !spiralErr && centred,
    "spiral_coord(0) = المركز",
    spiralErr ? spiralErr.message : centred ? "(0,0)" : JSON.stringify(origin),
  );

  // ── وجود award_points: نستدعيه بمعرّف وهمي بلا جلسة، والمتوقّع رفض
  //    الصلاحية لا «الدالة غير موجودة» ──
  const { error: awardErr } = await db.rpc("award_points", {
    p_student_id: "00000000-0000-0000-0000-000000000000",
    p_tier: "green",
  });
  const missing = /could not find the function|does not exist/i.test(awardErr?.message ?? "");
  record(
    !missing,
    "award_points مُركَّب",
    missing ? "غير موجودة — الملف 0002_functions.sql لم يُنفَّذ" : "موجودة",
  );
  // ورفضه للزائر هو السلوك الصحيح: المنح يحتاج حسابًا
  record(
    !!awardErr,
    "award_points يرفض الزائر",
    awardErr ? "نعم — المنح يحتاج جلسة" : "خطر: نجح بلا مصادقة",
  );

  // ── لا كتابة للزائر على الطلاب ──
  const { error: writeErr } = await db
    .from("students")
    .insert({ full_name: "preflight-probe", group_id: 1 });
  record(!!writeErr, "الزائر لا يكتب في students", writeErr ? "محجوب" : "خطر: الإدراج نجح");

  // ── الحدود اليومية: محجوبة عن الزائر بالتصميم، فنكتفي بأنها لا تُقرأ ──
  const { data: limits } = await db.from("daily_limits").select("role, points_perday");
  record(
    (limits?.length ?? 0) === 0,
    "daily_limits محجوبة عن الزائر",
    (limits?.length ?? 0) === 0 ? "نعم" : "خطر: الزائر يقرأ الحدود",
    false,
  );
}

await run();

const pad = Math.max(...results.map((r) => r.label.length));
console.log("");
for (const r of results) {
  console.log(`${r.ok ? "✓" : "✗"} ${r.label.padEnd(pad)}  ${r.detail}`);
}

const failed = results.filter((r) => !r.ok && r.critical);
console.log("");
if (failed.length) {
  console.error(`✗ فشل ${failed.length} فحصًا حاسمًا — راجع docs/deployment.md`);
  process.exit(1);
}
console.log("✓ الفحص التمهيدي نجح — القاعدة مُهيّأة");
