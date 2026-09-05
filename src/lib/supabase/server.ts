import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/**
 * عميل Supabase لاستخدامه داخل Server Components و Server Actions.
 * يحترم صلاحيات RLS الخاصة بالمستخدم المسجّل دخوله (لا يستخدم service role).
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
          // يُستدعى من Server Component حيث لا يمكن تعديل الكوكيز — يتم
          // تجاهله لأن middleware.ts يتكفّل بتجديد الجلسة في هذه الحالة.
        }
      },
    },
  });
}
