import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/**
 * عميل للصفحات العامّة: بلا كوكيز وبلا جلسة، بدور anon وحده.
 *
 * العميل المعتاد في server.ts يقرأ الكوكيز ليحمل جلسة المستخدم، وقراءة
 * الكوكي تجعل Next يعتبر الصفحة ديناميكية فيُلغي تخزينها — فكانت كل زيارة
 * لمزرعة أو لشاشة العرض رحلةً كاملة إلى دالة الخادم. والصفحات العامّة لا
 * جلسة فيها أصلًا: الطلاب والزوار لا يسجّلون دخولًا بالتصميم.
 *
 * العزل لا يضعف بهذا: سياسات RLS تحكم دور anon كما تحكم غيره، وما تقرأه
 * هذه الصفحات (المجموعات، الطلاب، سجل النقاط) مسموح للعامّة صراحةً.
 */
export function createPublicClient() {
  return createSupabaseClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
