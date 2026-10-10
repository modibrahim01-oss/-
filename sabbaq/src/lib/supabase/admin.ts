import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "./env";

/**
 * عميل بمفتاح service_role — يتجاوز RLS بالكامل.
 *
 * استخدامه الوحيد المشروع: إنشاء وحذف حسابات المشرفين من لوحة المدير، وهي
 * عمليات في auth.users لا تملكها سياسات RLS. كل مسار استدعاء لهذا العميل
 * يجب أن يتحقق من أن المستدعي مدير قبل النداء — العميل نفسه لا يتحقق.
 */
export function createAdminClient() {
  return createSupabaseClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
