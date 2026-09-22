import { PostgrestClient } from "@supabase/postgrest-js";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/**
 * عميل قراءة خفيف للمتصفح في الصفحات العامّة: استعلامات الجداول وحدها.
 *
 * صفحة المزرعة تعيد قراءة بياناتها بعد الفتح، وكان ذلك يجرّ supabase-js كاملًا
 * — مصادقة واتصالات حيّة وتخزين — فزاد تحميل الصفحة ٦٦ كيلوبايت لثلاثة
 * استعلامات قراءة. postgrest-js هو ما يبني به supabase-js استعلاماته أصلًا،
 * فالاستعلام هنا هو نفسه حرفيًا، بجزء يسير من الحجم.
 *
 * دور anon بلا جلسة، كـ createPublicClient على الخادم: RLS هي ما يحكم.
 */
export function createRestClient() {
  const key = getSupabaseAnonKey();
  return new PostgrestClient(`${getSupabaseUrl()}/rest/v1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
}
