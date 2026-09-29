import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/**
 * عميل Supabase لـ Server Components و Server Actions. يستخدم المفتاح العام
 * ويحترم RLS الخاص بالمستخدم المسجّل — أو بدور anon إن لم يكن هناك جلسة،
 * وهي الحالة الطبيعية لصفحات العرض العامّة.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // يُستدعى من Server Component حيث لا يمكن تعديل الكوكيز — يُتجاهل
          // لأن middleware يتكفّل بتجديد الجلسة في هذه الحالة.
        }
      },
    },
  });
}
