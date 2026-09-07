import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl, missingSupabaseEnvVars } from "./env";

const PUBLIC_PATHS = ["/login", "/auth"];

/**
 * صفحة تشخيص تُعرض حين تنقص متغيّرات البيئة.
 *
 * بدونها كان الوسيط يرمي استثناءً فتظهر صفحة Vercel العامة
 * MIDDLEWARE_INVOCATION_FAILED — لا تقول شيئًا عن السبب، وتحوّل خطأ حرفٍ
 * واحد في اسم متغيّر إلى بحث طويل في السجلات.
 */
function envErrorResponse(missing: { name: string; label: string }[]) {
  const rows = missing
    .map((v) => `<li><code>${v.name}</code> — ${v.label}</li>`)
    .join("");

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>إعداد ناقص</title>
<style>
  body{font-family:Tahoma,system-ui,sans-serif;background:#f9fafb;color:#111827;
       margin:0;padding:24px;line-height:1.9}
  .box{max-width:640px;margin:8vh auto;background:#fff;border:1px solid #e5e7eb;
       border-radius:16px;padding:24px}
  h1{font-size:20px;margin:0 0 12px}
  code{background:#f3f4f6;padding:2px 6px;border-radius:6px;direction:ltr;
       display:inline-block;font-size:13px}
  ul{padding-inline-start:20px}
  .hint{color:#6b7280;font-size:14px;margin-top:16px}
</style></head>
<body><div class="box">
  <h1>المنصة غير مهيّأة بعد</h1>
  <p>هذه المتغيّرات ناقصة في إعدادات النشر:</p>
  <ul>${rows}</ul>
  <p class="hint">أضِفها في Vercel من <strong>Settings ← Environment Variables</strong>،
  وتأكّد من مطابقة الاسم حرفًا بحرف، ثم أعد النشر
  (<strong>Deployments ← ··· ← Redeploy</strong>). قيمها في لوحة Supabase تحت
  <strong>Project Settings ← API Keys</strong>.</p>
</div></body></html>`;

  return new NextResponse(html, {
    status: 503,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function updateSession(request: NextRequest) {
  const missing = missingSupabaseEnvVars();
  if (missing.length > 0) return envErrorResponse(missing);

  let response = NextResponse.next({ request });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}
