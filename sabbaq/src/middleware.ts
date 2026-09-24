import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

/**
 * الوسيط يعمل على مسارات الجلسة وحدها.
 *
 * كان يعمل على كل مسار، فكانت كل زيارة لصفحة عامّة — والشاشة المعلّقة في
 * الممر تُعيد التحميل بلا توقّف — تمرّ بتجديد جلسة لا وجود لها، وتمنع خدمة
 * الصفحة من ذاكرة الحافة. حصره هنا يترك الصفحات العامّة تُخدَم مخزَّنةً من
 * أقرب خادم للزائر، ويُبقي الحماية كما هي تمامًا على ما يحتاجها.
 */
export const config = {
  matcher: ["/supervisor/:path*", "/admin/:path*", "/login"],
};
