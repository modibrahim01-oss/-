import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * دخول المشرف برابطه: /k/<token>
 *
 * الرمز يُطابَق بمفتاح الخدمة (جدول الروابط مقروء للمدير وحده)، ثم تُنشأ
 * للمشرف جلسة عادية كأنه دخل بالإيميل: رابط سحري يُولَّد على الخادم ويُتحقَّق
 * منه فورًا، فلا يُرسَل بريد ولا يرى المشرف أي خطوة وسيطة. الجلسة تُكتب في
 * الكوكيز وتبقى على جهازه حتى يخرج أو تُلغيها الإدارة.
 *
 * المدير لا يدخل من هنا أبدًا، ولا مشرف معطَّل.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const fail = () => NextResponse.redirect(new URL("/login?error=link", request.url));

  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return fail();

  const admin = createAdminClient();
  const { data: key } = await admin.from("staff_login_keys").select("user_id").eq("token", token).maybeSingle();
  if (!key) return fail();

  const { data: staff } = await admin.from("users").select("role, is_active").eq("id", key.user_id).maybeSingle();
  if (!staff || !staff.is_active || staff.role === "admin") return fail();

  const { data: authUser } = await admin.auth.admin.getUserById(key.user_id as string);
  const email = authUser.user?.email;
  if (!email) return fail();

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const hashed = link?.properties?.hashed_token;
  if (linkError || !hashed) return fail();

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: hashed });
  if (error) return fail();

  return NextResponse.redirect(new URL("/supervisor", request.url));
}
