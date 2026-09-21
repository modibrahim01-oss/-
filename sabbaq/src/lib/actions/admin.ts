"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * كل إجراء هنا يتحقق أولًا من أن المستدعي مدير. لا نعتمد على إخفاء الزر في
 * الواجهة: Server Action نقطة نهاية عامة، ومن يعرف اسمها يستطيع مناداتها.
 *
 * التعديلات على البيانات تمرّ بعميل المستخدم (فتفرضها RLS مرة ثانية)، ولا
 * نستخدم service_role إلا لإنشاء وحذف حسابات auth التي لا تملكها RLS.
 */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, supabase: null };

  const { data } = await supabase
    .from("users")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!data || data.role !== "admin" || !data.is_active) {
    return { ok: false as const, supabase: null };
  }
  return { ok: true as const, supabase, actorId: user.id };
}

export type ActionResult = { ok: true } | { ok: false; error: string };

// ── الطلاب ────────────────────────────────────────────────────────────────

const studentInput = z.object({
  fullName: z.string().trim().min(2).max(120),
  groupId: z.coerce.number().int().min(1).max(7),
  grade: z.string().trim().max(40).optional().or(z.literal("")),
});

export async function createStudent(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: "forbidden" };

  const parsed = studentInput.safeParse({
    fullName: formData.get("fullName"),
    groupId: formData.get("groupId"),
    grade: formData.get("grade") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "invalid" };

  const { error } = await auth.supabase.from("students").insert({
    full_name: parsed.data.fullName,
    group_id: parsed.data.groupId,
    grade: parsed.data.grade || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/students");
  revalidatePath("/");
  return { ok: true };
}

export async function updateStudent(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: "forbidden" };

  const id = z.string().uuid().safeParse(formData.get("id"));
  const parsed = studentInput.safeParse({
    fullName: formData.get("fullName"),
    groupId: formData.get("groupId"),
    grade: formData.get("grade") ?? "",
  });
  if (!id.success || !parsed.success) return { ok: false, error: "invalid" };

  const { error } = await auth.supabase
    .from("students")
    .update({
      full_name: parsed.data.fullName,
      group_id: parsed.data.groupId,
      grade: parsed.data.grade || null,
    })
    .eq("id", id.data);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/students");
  revalidatePath(`/farm/${id.data}`);
  return { ok: true };
}

/**
 * الإخفاء لا الحذف. حذف الطالب يحذف سجل نقاطه بـ cascade، فتضيع مساهمة
 * المشرفين من الإحصاءات. الإخفاء يُبقي التاريخ ويُخرجه من القوائم.
 */
export async function deactivateStudent(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: "forbidden" };

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "invalid" };

  const { error } = await auth.supabase
    .from("students")
    .update({ is_active: false })
    .eq("id", id.data);
  if (error) return { ok: false, error: error.message };

  await auth.supabase.from("audit_log").insert({
    actor_id: auth.actorId,
    action: "deactivate_student",
    entity: "students",
    entity_id: id.data,
  });

  revalidatePath("/admin/students");
  revalidatePath("/");
  return { ok: true };
}

/** استيراد دفعة: صفوف «الاسم, المجموعة, الصف» من لصق أو ملف. */
const bulkRow = z.object({
  fullName: z.string().trim().min(2).max(120),
  groupId: z.number().int().min(1).max(7),
  grade: z.string().trim().max(40).nullable(),
});

export async function importStudents(
  rows: { fullName: string; groupId: number; grade: string | null }[],
): Promise<{ ok: true; inserted: number } | { ok: false; error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: "forbidden" };

  const parsed = z.array(bulkRow).max(2000).safeParse(rows);
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (parsed.data.length === 0) return { ok: true, inserted: 0 };

  const { error, count } = await auth.supabase
    .from("students")
    .insert(
      parsed.data.map((r) => ({
        full_name: r.fullName,
        group_id: r.groupId,
        grade: r.grade,
      })),
      { count: "exact" },
    );
  if (error) return { ok: false, error: error.message };

  await auth.supabase.from("audit_log").insert({
    actor_id: auth.actorId,
    action: "import_students",
    entity: "students",
    details: { count: parsed.data.length },
  });

  revalidatePath("/admin/students");
  revalidatePath("/");
  return { ok: true, inserted: count ?? parsed.data.length };
}

// ── المشرفون ──────────────────────────────────────────────────────────────

const supervisorInput = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  fullNameAr: z.string().trim().min(2).max(120),
  fullNameEn: z.string().trim().max(120).optional().or(z.literal("")),
  role: z.enum(["group_supervisor", "committee_supervisor", "admin"]),
  groupIds: z.array(z.coerce.number().int().min(1).max(7)).default([]),
});

export async function createSupervisor(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: "forbidden" };

  const parsed = supervisorInput.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullNameAr: formData.get("fullNameAr"),
    fullNameEn: formData.get("fullNameEn") ?? "",
    role: formData.get("role"),
    groupIds: formData.getAll("groupIds"),
  });
  if (!parsed.success) return { ok: false, error: "invalid" };

  // إنشاء حساب auth يحتاج service_role — RLS لا تملك schema auth
  const admin = createAdminClient();
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name_ar: parsed.data.fullNameAr,
      full_name_en: parsed.data.fullNameEn || null,
      role: parsed.data.role,
    },
  });
  if (authError || !created.user) return { ok: false, error: authError?.message ?? "auth_failed" };

  // trigger handle_new_auth_user أنشأ صف users؛ نُسند المجموعات فوقه
  if (parsed.data.role === "group_supervisor" && parsed.data.groupIds.length > 0) {
    await auth.supabase.from("supervisor_groups").insert(
      parsed.data.groupIds.map((gid) => ({
        supervisor_id: created.user.id,
        group_id: gid,
      })),
    );
  }

  await auth.supabase.from("audit_log").insert({
    actor_id: auth.actorId,
    action: "create_supervisor",
    entity: "users",
    entity_id: created.user.id,
    details: { role: parsed.data.role, groups: parsed.data.groupIds },
  });

  revalidatePath("/admin/supervisors");
  return { ok: true };
}

export async function setSupervisorGroups(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: "forbidden" };

  const id = z.string().uuid().safeParse(formData.get("id"));
  const groupIds = z
    .array(z.coerce.number().int().min(1).max(7))
    .safeParse(formData.getAll("groupIds"));
  if (!id.success || !groupIds.success) return { ok: false, error: "invalid" };

  await auth.supabase.from("supervisor_groups").delete().eq("supervisor_id", id.data);
  if (groupIds.data.length > 0) {
    const { error } = await auth.supabase
      .from("supervisor_groups")
      .insert(groupIds.data.map((gid) => ({ supervisor_id: id.data, group_id: gid })));
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/admin/supervisors");
  return { ok: true };
}

export async function setSupervisorActive(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: "forbidden" };

  const id = z.string().uuid().safeParse(formData.get("id"));
  const active = formData.get("active") === "true";
  if (!id.success) return { ok: false, error: "invalid" };

  // المدير لا يستطيع تعطيل نفسه — وإلا بقي النظام بلا مدير يستطيع الدخول
  if (id.data === auth.actorId) return { ok: false, error: "cannot_disable_self" };

  const { error } = await auth.supabase
    .from("users")
    .update({ is_active: active })
    .eq("id", id.data);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/supervisors");
  return { ok: true };
}

// ── الحدود اليومية ────────────────────────────────────────────────────────

export async function updateDailyLimit(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: "forbidden" };

  const parsed = z
    .object({
      role: z.enum(["group_supervisor", "committee_supervisor"]),
      points: z.coerce.number().int().min(0).max(100000),
    })
    .safeParse({ role: formData.get("role"), points: formData.get("points") });
  if (!parsed.success) return { ok: false, error: "invalid" };

  // set_daily_limit يسجّل التغيير في audit_log ويتحقق من الدور مرة ثانية
  const { error } = await auth.supabase.rpc("set_daily_limit", {
    p_role: parsed.data.role,
    p_points: parsed.data.points,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/limits");
  revalidatePath("/supervisor");
  return { ok: true };
}

// ── سحب نقاط ──────────────────────────────────────────────────────────────

export async function revokeAward(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: "forbidden" };

  const parsed = z
    .object({
      ledgerId: z.coerce.number().int().positive(),
      reason: z.string().trim().max(200),
      studentId: z.string().uuid(),
    })
    .safeParse({
      ledgerId: formData.get("ledgerId"),
      reason: formData.get("reason") ?? "",
      studentId: formData.get("studentId"),
    });
  if (!parsed.success) return { ok: false, error: "invalid" };

  const { error } = await auth.supabase.rpc("revoke_points", {
    p_ledger_id: parsed.data.ledgerId,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/farm/${parsed.data.studentId}`);
  revalidatePath("/admin");
  return { ok: true };
}

// ── نهاية الفصل ───────────────────────────────────────────────────────────

const closeInput = z.object({
  archive: z.boolean(),
  reset: z.boolean(),
  nextNameAr: z.string().trim().max(120).optional(),
  nextNameEn: z.string().trim().max(120).optional(),
  nextStart: z.string().optional(),
  nextEnd: z.string().optional(),
  confirm: z.string(),
});

export async function closeSemester(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: "forbidden" };

  const parsed = closeInput.safeParse({
    archive: formData.get("archive") === "on" || formData.get("archive") === "true",
    reset: formData.get("reset") === "on" || formData.get("reset") === "true",
    nextNameAr: formData.get("nextNameAr") ?? undefined,
    nextNameEn: formData.get("nextNameEn") ?? undefined,
    nextStart: formData.get("nextStart") ?? undefined,
    nextEnd: formData.get("nextEnd") ?? undefined,
    confirm: formData.get("confirm") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "invalid" };

  // إجراء يمسّ كل طالب في المدرسة — الكتابة اليدوية للتأكيد مقصودة
  const word = parsed.data.confirm.trim().toUpperCase();
  if (word !== "تأكيد" && word !== "CONFIRM") {
    return { ok: false, error: "confirm_required" };
  }
  if (!parsed.data.archive && !parsed.data.reset) {
    return { ok: false, error: "nothing_to_do" };
  }

  const { error } = await auth.supabase.rpc("close_semester", {
    p_archive: parsed.data.archive,
    p_reset: parsed.data.reset,
    p_next_name_ar: parsed.data.nextNameAr || null,
    p_next_name_en: parsed.data.nextNameEn || null,
    p_next_start: parsed.data.nextStart || null,
    p_next_end: parsed.data.nextEnd || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/semesters");
  revalidatePath("/");
  revalidatePath("/tv");
  return { ok: true };
}
