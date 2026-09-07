/**
 * أسماء المتغيّرات التي لا يعمل التطبيق بدونها، مع وصف عربي لكل واحد.
 * تُستخدم لعرض رسالة مفهومة بدل انهيار غامض حين تنقص عن بيئة النشر.
 */
export function missingSupabaseEnvVars(): { name: string; label: string }[] {
  // مرجع ثابت لكل متغيّر عمدًا: Next يستبدل process.env.NEXT_PUBLIC_*
  // نصيًا وقت البناء، والقراءة بمفتاح ديناميكي (process.env[name]) تُرجع
  // undefined في بيئة Edge حتى لو كان المتغيّر مضبوطًا.
  const missing: { name: string; label: string }[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push({ name: "NEXT_PUBLIC_SUPABASE_URL", label: "رابط مشروع Supabase" });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    missing.push({
      name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      label: "المفتاح العام (anon / publishable)",
    });
  }
  return missing;
}

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL غير مُعرَّف في متغيرات البيئة");
  return url;
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY غير مُعرَّف في متغيرات البيئة");
  return key;
}

export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY غير مُعرَّف في متغيرات البيئة");
  return key;
}
