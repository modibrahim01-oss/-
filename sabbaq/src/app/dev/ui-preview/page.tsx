import { notFound } from "next/navigation";
import AdminNav from "@/app/admin/AdminNav";
import StudentsManager from "@/app/admin/students/StudentsManager";
import CommitteeSender from "@/app/supervisor/CommitteeSender";
import type { CommitteeGrant } from "@/lib/types";
import TierLimitsEditor from "@/app/admin/limits/TierLimitsEditor";
import SupervisorLimitsForm from "@/app/admin/supervisors/SupervisorLimitsForm";
import AwardPanel from "@/app/supervisor/AwardPanel";
import { Brand } from "@/components/Brand";
import { LangToggle, ThemeToggle } from "@/components/Toggles";
import { Badge, Stat, buttonStyle, topbar, topbarInner } from "@/components/ui";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import type { Group, StudentFarmSummary } from "@/lib/types";

/**
 * معرض واجهات الموظّفين ببيانات مولَّدة، بلا تسجيل دخول.
 *
 * لوحة المشرف والإدارة خلف المصادقة، فلا يراها فحص بصري آلي ولا مراجِع لا
 * يملك حسابًا. هذا المعرض يرسم المكوّنات نفسها — لا نسخًا عنها — ببيانات
 * وهمية، فيُفحص شكلها كما يُفحص البستان في /dev/farm-preview. الأزرار تنادي
 * الخادم فعلًا فتفشل بلا جلسة، وهذا مقصود: المعرض للشكل لا للسلوك.
 *
 *   /dev/ui-preview?view=supervisor   أو   ?view=admin
 *
 * محجوب في الإنتاج.
 */
export const dynamic = "force-dynamic";

const GROUPS: Group[] = [
  { id: 1, code: "qabas", name_ar: "قبس", name_en: "Qabas", stage_ar: "الصفوف الأول والثاني", stage_en: "Grades 1-2", sort_order: 1 },
  { id: 2, code: "majd1", name_ar: "مجد ١", name_en: "Majd 1", stage_ar: "الصفوف الثالث والرابع", stage_en: "Grades 3-4", sort_order: 2 },
  { id: 3, code: "basil1", name_ar: "باسل ١", name_en: "Basil 1", stage_ar: "الصفوف الخامس والسادس", stage_en: "Grades 5-6", sort_order: 3 },
] as Group[];

const NAMES = ["محمد الحيمي", "سارة العتيبي", "يوسف السبيعي", "ريم القحطاني", "خالد الشمري", "لينا الحربي", "فهد الدوسري"];

const STUDENTS: StudentFarmSummary[] = NAMES.map((full_name, i) => ({
  student_id: `00000000-0000-0000-0000-00000000000${i}`,
  full_name,
  search_name: full_name,
  group_id: GROUPS[i % GROUPS.length].id,
  group_code: GROUPS[i % GROUPS.length].code,
  group_name_ar: GROUPS[i % GROUPS.length].name_ar,
  group_name_en: GROUPS[i % GROUPS.length].name_en,
  grade: String(3 + (i % 4)),
  semester_id: "demo",
  total_points: 670 - i * 80,
  plant_count: 18 - i * 2,
}));

export default async function UiPreview({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { view } = await searchParams;
  const locale = DEFAULT_LOCALE;

  const header = (
    <header style={topbar}>
      <div style={topbarInner}>
        <Brand locale={locale} />
        <div style={{ marginInlineStart: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <LangToggle />
          <ThemeToggle />
          <button className="press" type="button" style={{ ...buttonStyle(), padding: "7px 13px", fontSize: 13 }}>
            تسجيل الخروج
          </button>
        </div>
      </div>
    </header>
  );

  const GRANTS: CommitteeGrant[] = [
    {
      id: 1, title: "درس الأمانة", note: "بعد صلاة الظهر في المصلى", status: "locked", created_at: new Date().toISOString(),
      unlocked_at: null, direction: "in", sender_ar: "عبدالله البكري", sender_en: null, recipient_ar: "البراء العبدالجبار",
      recipient_en: null, items: [{ tier: "purple", quantity: 3, used: 0 }, { tier: "red", quantity: 2, used: 0 }],
    },
    {
      id: 2, title: "قيمة الصدق", note: null, status: "active", created_at: new Date().toISOString(),
      unlocked_at: new Date().toISOString(), direction: "in", sender_ar: "عبدالله البكري", sender_en: null,
      recipient_ar: "البراء العبدالجبار", recipient_en: null,
      items: [{ tier: "yellow", quantity: 4, used: 1 }, { tier: "red", quantity: 1, used: 0 }],
    },
  ];

  if (view === "committee") {
    return (
      <>
        {header}
        <div style={{ paddingTop: 22 }}>
          <CommitteeSender
            locale={locale}
            recipients={[
              { id: "11111111-1111-1111-1111-111111111111", full_name_ar: "البراء العبدالجبار", full_name_en: null, groups_ar: "قبس · مجد ١", groups_en: null },
              { id: "22222222-2222-2222-2222-222222222222", full_name_ar: "خالد الشمري", full_name_en: null, groups_ar: "باسل ١", groups_en: null },
            ]}
            sent={GRANTS.map((g, i) => ({ ...g, direction: "out", status: i === 0 ? "locked" : "active" }))}
          />
        </div>
      </>
    );
  }

  if (view === "limits") {
    const roleLimits = { green: 8, yellow: 5, purple: 3, red: 2 };
    return (
      <>
        {header}
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "22px 20px 64px", display: "grid", gridTemplateColumns: "236px minmax(0, 1fr)", gap: 22, alignItems: "start" }}>
          <AdminNav locale={locale} />
          <main style={{ minWidth: 0, display: "grid", gap: 18 }}>
            <h1 style={{ fontSize: 26, margin: 0 }}>حدّ كل نوع في اليوم</h1>
            <TierLimitsEditor
              locale={locale}
              initial={{
                group_supervisor: roleLimits,
                committee_supervisor: { green: 16, yellow: 10, purple: 6, red: 4 },
              }}
            />
            <h2 style={{ fontSize: 20, margin: "8px 0 0" }}>حدّ خاص لمشرف</h2>
            <div className="pop" style={{ background: "var(--surface-alt)", borderRadius: 18, padding: 16 }}>
              <SupervisorLimitsForm locale={locale} supervisorId="00000000-0000-0000-0000-000000000000" roleLimits={roleLimits} overrides={{ red: 4 }} />
            </div>
          </main>
        </div>
      </>
    );
  }

  if (view === "admin") {
    return (
      <>
        {header}
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "22px 20px 64px", display: "grid", gridTemplateColumns: "236px minmax(0, 1fr)", gap: 22, alignItems: "start" }}>
          <AdminNav locale={locale} />
          <main style={{ minWidth: 0, display: "grid", gap: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              <Stat label="الطلاب" value="٤٢" accent="sky" />
              <Stat label="نقاط اليوم" value="٣٢٠" accent="gold" />
              <Stat label="نبتات الفصل" value="٥٬٣٧٦" accent="brand" />
              <Stat label="بلا نقاط" value="٢" accent="coral" />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Badge tone="brand">نشط</Badge>
              <Badge tone="gold">مشرف لجنة</Badge>
              <Badge tone="grape">مشرف مجموعة</Badge>
              <Badge tone="coral">موقوف</Badge>
            </div>
            <StudentsManager
              locale={locale}
              groups={GROUPS}
              students={STUDENTS.map((s) => ({
                id: s.student_id,
                full_name: s.full_name,
                group_id: s.group_id,
                grade: s.grade,
              }))}
            />
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <AwardPanel
        locale={locale}
        supervisorName="أ. عبدالله الغامدي"
        roleName="مشرف مجموعة"
        scopeLabel="قبس · مجد ١"
        students={STUDENTS}
        initialStatus={{
          role: "group_supervisor",
          limit: 0,
          used: 0,
          remaining: 0,
          tiers: {
            green: { limit: 8, used: 3, remaining: 5 },
            yellow: { limit: 5, used: 5, remaining: 0 },
            purple: { limit: 3, used: 1, remaining: 2 },
            red: { limit: 2, used: 0, remaining: 2 },
          },
        }}
        initialGrants={GRANTS}
        initialRecent={[
          { id: 3, studentId: "s3", studentName: "سارة العتيبي", points: 50, tier: "red", awardedAt: new Date().toISOString() },
          { id: 2, studentId: "s2", studentName: "محمد الحيمي", points: 30, tier: "purple", awardedAt: new Date(Date.now() - 70_000).toISOString() },
          { id: 1, studentId: "s1", studentName: "يوسف السبيعي", points: 10, tier: "green", awardedAt: new Date(Date.now() - 600_000).toISOString() },
        ]}
      />
    </>
  );
}
