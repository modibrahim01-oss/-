import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/Brand";
import { LangToggle, ThemeToggle } from "@/components/Toggles";
import { buttonStyle, topbar, topbarInner } from "@/components/ui";
import { signOut } from "@/app/login/actions";
import { fetchDailyStatus } from "@/lib/actions/award";
import { roleLabel, t } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { groupSegment } from "@/lib/tv-data";
import { createClient } from "@/lib/supabase/server";
import type { CommitteeGrant, Group, GrantRecipient, StaffUser, StudentFarmSummary } from "@/lib/types";
import AwardPanel from "./AwardPanel";
import CommitteeSender from "./CommitteeSender";

export const dynamic = "force-dynamic";

export default async function SupervisorPage() {
  const locale = await getLocale();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/supervisor");

  const { data: me } = await supabase
    .from("users")
    .select("id, full_name_ar, full_name_en, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!me || !me.is_active) {
    return (
      <main style={{ maxWidth: 480, margin: "12vh auto", padding: 20, textAlign: "center" }}>
        <h1 style={{ fontSize: 22 }}>{t(locale, "error")}</h1>
        <p style={{ color: "var(--ink-soft)" }}>
          {locale === "ar"
            ? "حسابك غير مرتبط بدور في النظام. راجع الإدارة."
            : "Your account has no role in the system. Contact the admin."}
        </p>
        <form action={signOut}>
          <button className="press" type="submit" style={buttonStyle()}>
            {t(locale, "logout")}
          </button>
        </form>
      </main>
    );
  }

  const staff = me as StaffUser;

  // مشرف المجموعة يرى مجموعاته وحدها. القائمة تُبنى هنا للعرض، لكن الحماية
  // الحقيقية في award_points و RLS: تمرير معرّف طالب خارج النطاق يُرفض.
  const { data: myGroups } = await supabase
    .from("supervisor_groups")
    .select("group_id, groups(id, code, name_ar, name_en, stage_ar, stage_en, sort_order)")
    .eq("supervisor_id", staff.id);

  const scopedGroups: Group[] =
    staff.role === "group_supervisor"
      ? ((myGroups ?? [])
          .map((r) => r.groups)
          .filter(Boolean)
          .flat() as unknown as Group[])
      : (((await supabase.from("groups").select("*").order("sort_order")).data ?? []) as Group[]);

  const groupIds = scopedGroups.map((g) => g.id);

  // مشرف مجموعة بلا إسناد نطاقه فارغ لا مفتوح: تخطّي المرشِّح عند
  // groupIds.length === 0 كان يُرجع طلاب المدرسة كلهم في قائمته.
  const scopeIsEmpty = staff.role === "group_supervisor" && groupIds.length === 0;

  let students: StudentFarmSummary[] = [];
  if (!scopeIsEmpty) {
    let studentsQuery = supabase
      .from("student_farms")
      .select("*")
      .order("full_name")
      .limit(600);
    if (staff.role === "group_supervisor") {
      studentsQuery = studentsQuery.in("group_id", groupIds);
    }
    const { data } = await studentsQuery;
    students = (data ?? []) as StudentFarmSummary[];
  }

  const todayQuery = (columns: string) =>
    supabase
      .from("points_ledger")
      .select(columns)
      .eq("supervisor_id", staff.id)
      .is("revoked_at", null)
      .gte("awarded_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      .order("awarded_at", { ascending: false })
      .limit(12);

  const [status, todayFirst, grantsRes, vcRes, cdRes] = await Promise.all([
    fetchDailyStatus(),
    todayQuery("id, student_id, points, tier, awarded_at, grant_id, students(full_name)"),
    // أرصدة اللجنة القيمية وصلاحيتها (0007). غيابها قبل تشغيل الملف يُخفي
    // القسم بدل أن يكسر الصفحة
    supabase.rpc("my_grants"),
    supabase.from("users").select("value_committee").eq("id", staff.id).maybeSingle(),
    // صلاحية الخصم (0008)
    supabase.from("users").select("can_deduct").eq("id", staff.id).maybeSingle(),
  ]);
  const canDeduct =
    !cdRes.error && (staff.role === "admin" || Boolean((cdRes.data as { can_deduct?: boolean } | null)?.can_deduct));
  // grant_id عمود من 0007: قبله يُعاد الاستعلام بدونه
  const { data: todayRows } = todayFirst.error
    ? await todayQuery("id, student_id, points, tier, awarded_at, students(full_name)")
    : todayFirst;

  const grants = grantsRes.error ? null : ((grantsRes.data ?? []) as CommitteeGrant[]);
  const isValueCommittee = !vcRes.error && Boolean((vcRes.data as { value_committee?: boolean } | null)?.value_committee);
  let recipients: GrantRecipient[] = [];
  if (isValueCommittee) {
    const { data } = await supabase.rpc("grant_recipients");
    recipients = (data ?? []) as GrantRecipient[];
  }

  const recent = ((todayRows ?? []) as unknown as Record<string, unknown>[]).map((r) => {
    const joined = r.students as unknown as { full_name: string } | { full_name: string }[] | null;
    const name = Array.isArray(joined) ? joined[0]?.full_name : joined?.full_name;
    return {
      id: r.id as number,
      studentId: r.student_id as string,
      studentName: name ?? "—",
      points: r.points as number,
      tier: r.tier as string,
      awardedAt: r.awarded_at as string,
      grantId: (r.grant_id as number | null | undefined) ?? null,
    };
  });

  const displayName =
    locale === "en" && staff.full_name_en ? staff.full_name_en : staff.full_name_ar;

  return (
    <>
      <header style={topbar}>
        <div style={topbarInner}>
          <Brand locale={locale} href="/supervisor" />
          {/* تلتفّ الأزرار إلى سطر ثانٍ على الجوّال بدل أن تتجاوز حافة الشاشة */}
          <div
            style={{
              marginInlineStart: "auto",
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            {/* شاشة العرض: مشرف المجموعة يعرض سباق مجموعته وحدها */}
            <a
              href={staff.role === "group_supervisor" && groupIds.length > 0 ? `/tv/${groupSegment(groupIds)}` : "/tv"}
              target="_blank"
              rel="noopener"
              style={{
                fontSize: 14,
                fontWeight: 700,
                padding: "7px 14px",
                borderRadius: 999,
                color: "var(--on-fill)",
                background: "var(--sky)",
                border: "2.5px solid var(--outline)",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              {t(locale, staff.role === "group_supervisor" && groupIds.length > 0 ? "myGroupScreen" : "tvMode")}
            </a>
            {canDeduct && (
              <Link
                href="/deduct"
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  padding: "7px 14px",
                  borderRadius: 999,
                  color: "var(--on-fill)",
                  background: "var(--coral-fill)",
                  border: "2.5px solid var(--outline)",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {t(locale, "deductLink")}
              </Link>
            )}
            {staff.role === "admin" && (
              <Link
                href="/admin"
                style={{
                  font: "inherit",
                  fontSize: 14,
                  fontWeight: 700,
                  padding: "8px 14px",
                  borderRadius: 999,
                  color: "var(--ink)",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {t(locale, "adminDashboard")}
              </Link>
            )}
            <LangToggle />
            <ThemeToggle />
            <form action={signOut}>
              <button className="press" type="submit" style={{ ...buttonStyle(), padding: "7px 13px", fontSize: 13, whiteSpace: "nowrap" }}>
                {t(locale, "logout")}
              </button>
            </form>
          </div>
        </div>
      </header>

      <AwardPanel
        locale={locale}
        supervisorName={displayName}
        roleName={roleLabel(locale, staff.role)}
        scopeLabel={
          staff.role === "group_supervisor"
            ? scopedGroups.map((g) => (locale === "ar" ? g.name_ar : g.name_en)).join(" · ")
            : t(locale, "allGroupsScope")
        }
        students={students}
        initialStatus={status}
        initialRecent={recent}
        initialGrants={(grants ?? []).filter((g) => g.direction === "in")}
      />
      {isValueCommittee && (
        <CommitteeSender
          locale={locale}
          recipients={recipients}
          sent={(grants ?? []).filter((g) => g.direction === "out")}
        />
      )}
    </>
  );
}
