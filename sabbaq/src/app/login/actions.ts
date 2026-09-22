"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

/**
 * يفصل رفض المصادقة عن تعذّر الوصول إليها.
 *
 * كان كل خطأ يُعرض "بيانات الدخول غير صحيحة" مهما كان سببه، فظهر عنوان مشروع
 * خاطئ ومفتاح تالف كأنهما كلمة مرور خاطئة — وضاع وقت طويل في البحث عن خطأ لم
 * يكن موجودًا. معزول في دالة لأن redirect أدناه يعمل برمي استثناء، فلو أحاط
 * به try لابتلعه وما تحوّل أحد بعد دخول صحيح.
 */
async function attempt(email: string, password: string): Promise<"ok" | "invalid" | "unavailable"> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) return "ok";
    // 400 هو ما تردّه المصادقة لبيانات مرفوضة؛ ما عداه عطبٌ لا علاقة للمستخدم به
    return error.status === 400 || error.code === "invalid_credentials"
      ? "invalid"
      : "unavailable";
  } catch {
    // متغيّر بيئة ناقص أو شبكة ساقطة: الاستدعاء يرمي قبل أن يصل إلى المصادقة
    return "unavailable";
  }
}

export async function signIn(_prev: { error?: string } | null, formData: FormData) {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  const outcome = await attempt(parsed.data.email, parsed.data.password);
  if (outcome !== "ok") return { error: outcome };

  // مسار العودة يُقبل فقط إن كان مسارًا داخليًا. بدون هذا القيد يصبح
  // ?next=https://... تحويلًا مفتوحًا يُستغل في التصيّد. المحرف الثاني يُفحص
  // لا `//` وحدها: المتصفحات تطبّع `/\evil.com` إلى رابط بروتوكول-نسبي أيضًا.
  const target = parsed.data.next;
  const safe =
    target && /^\/(?![/\\])/.test(target) ? target : "/supervisor";
  redirect(safe);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
