import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "./env";

/**
 * عميل بصلاحيات service role — يتجاوز RLS بالكامل.
 * استخدمه فقط داخل Server Actions محمية بفحص صريح public.is_admin()
 * (مثل إنشاء حسابات المندوبين عبر Supabase Auth Admin API)، ولا تستورده
 * أبدًا في أي كود يعمل على المتصفح.
 */
export function createAdminClient() {
  return createSupabaseClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
