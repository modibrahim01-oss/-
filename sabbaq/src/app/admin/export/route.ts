import { NextResponse } from "next/server";
import { type ExportLedgerRow, type ExportStudent, buildResultsWorkbook } from "@/lib/export-results";
import { fetchAll } from "@/lib/fetch-all";
import { getLocale } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";

/**
 * تنزيل نتائج الفصل النشط ملف Excel. للمدير وحده: التخطيط يحوّل غيره، لكن
 * مسار API لا يمرّ بالتخطيط، فالتحقّق هنا من جديد.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: me } = await supabase.from("users").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me || me.role !== "admin" || !me.is_active) return new NextResponse("Forbidden", { status: 403 });

  const locale = await getLocale();
  const { data: semester } = await supabase.from("semesters").select("id, name_ar, name_en").eq("is_active", true).maybeSingle();
  if (!semester) return new NextResponse("No active semester", { status: 404 });

  const [farms, ledger] = await Promise.all([
    fetchAll<Record<string, unknown>>((from, to) =>
      supabase
        .from("student_farms")
        .select("student_id, full_name, group_id, group_name_ar, group_name_en, grade, total_points")
        .order("student_id")
        .range(from, to),
    ),
    fetchAll<ExportLedgerRow>((from, to) =>
      supabase
        .from("points_ledger")
        .select("student_id, tier, points")
        .eq("semester_id", semester.id)
        .is("revoked_at", null)
        .order("id")
        .range(from, to),
    ),
  ]);

  const students: ExportStudent[] = farms.map((f) => ({
    student_id: f.student_id as string,
    full_name: f.full_name as string,
    group_id: f.group_id as number,
    group_name: (locale === "ar" ? f.group_name_ar : f.group_name_en) as string,
    grade: (f.grade as string | null) ?? null,
    total_points: f.total_points as number,
  }));

  const semesterName = (locale === "ar" ? semester.name_ar : semester.name_en) as string;
  const file = await buildResultsWorkbook(locale, semesterName, students, ledger);
  const date = new Date().toISOString().slice(0, 10);
  const name = `${locale === "ar" ? "نتائج سباق" : "Sabbaq results"} - ${semesterName} - ${date}.xlsx`;

  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      // الاسم بالعربية يحتاج ترميز RFC 5987، ونسخة ASCII احتياطية للمتصفّحات القديمة
      "Content-Disposition": `attachment; filename="sabbaq-results-${date}.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}
