import { NextResponse, type NextRequest } from "next/server";
import { LOCK_COOKIE, isLockPath } from "@/lib/screen-lock";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // شاشة عرض مقفلة على هذا المتصفح: لا لوحة مشرف ولا إدارة ولا دخول حتى
  // يفتحها المشرف من الشاشة نفسها. الإجراءات (منح، تراجع، خصم) تُرسَل POST
  // إلى مسار اللوحة، فتُرفض هنا حتى من تبويب كان مفتوحًا قبل القفل.
  const lock = request.cookies.get(LOCK_COOKIE)?.value;
  if (isLockPath(lock)) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new NextResponse("Screen locked", { status: 423 });
    }
    return NextResponse.redirect(new URL(lock, request.url));
  }
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
  matcher: ["/supervisor/:path*", "/admin/:path*", "/deduct/:path*", "/login", "/k/:path*"],
};
