import { Badge, Card, Td, Th, buttonStyle } from "@/components/ui";
import { formatNumber, t } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import type { Semester, StudentFarmSummary } from "@/lib/types";

export default async function AdminOverview() {
  const locale = await getLocale();
  const supabase = await createClient();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    { data: semester },
    { count: studentCount },
    { data: todayPoints },
    { data: farms },
    { data: staff },
    { data: groupTotals },
  ] = await Promise.all([
    supabase.from("semesters").select("*").eq("is_active", true).maybeSingle(),
    supabase.from("students").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase
      .from("points_ledger")
      .select("points, supervisor_id")
      .is("revoked_at", null)
      .gte("awarded_at", startOfToday.toISOString()),
    supabase.from("student_farms").select("*").order("total_points", { ascending: false }).limit(10),
    supabase.from("users").select("id, role, is_active").eq("is_active", true),
    // «أعلى مجموعة» تحتاج كل الطلاب لا العشرة الأوائل: مجموعة من متوسّطين
    // كثيرين تتقدّم على مجموعة فيها متصدّر واحد، وهذا لا يظهر في قائمة مقصوصة.
    supabase.from("student_farms").select("group_name_ar, group_name_en, total_points"),
  ]);

  const pointsToday = (todayPoints ?? []).reduce((sum, r) => sum + (r.points as number), 0);
  const activeToday = new Set((todayPoints ?? []).map((r) => r.supervisor_id)).size;
  const supervisorCount = (staff ?? []).filter((u) => u.role !== "admin").length;

  const top = (farms ?? []) as StudentFarmSummary[];

  // أعلى مجموعة بمجموع نقاط أعضائها — على كل الطلاب
  const byGroup = new Map<string, number>();
  for (const f of groupTotals ?? []) {
    const key = (locale === "ar" ? f.group_name_ar : f.group_name_en) as string;
    byGroup.set(key, (byGroup.get(key) ?? 0) + (f.total_points as number));
  }
  const topGroup = [...byGroup.entries()].sort((a, b) => b[1] - a[1])[0];

  const sem = semester as Semester | null;
  let dayLabel = "—";
  if (sem) {
    const start = new Date(sem.start_date);
    const end = new Date(sem.end_date);
    const elapsed = Math.floor((Date.now() - start.getTime()) / 86400000) + 1;
    const span = Math.round((end.getTime() - start.getTime()) / 86400000);
    const clamped = Math.max(1, Math.min(span, elapsed));
    dayLabel = `${t(locale, "day")} ${formatNumber(locale, clamped)} / ${formatNumber(locale, span)}`;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px" }}>
          <h1 style={{ fontSize: 26, margin: 0 }}>{t(locale, "overview")}</h1>
          <p style={{ color: "var(--ink-mute)", fontSize: 13, margin: "4px 0 0" }}>
            {sem ? (locale === "ar" ? sem.name_ar : sem.name_en) : "—"} · {dayLabel}
          </p>
        </div>
        {sem && (
          // رابط تنزيل عادي لا زرّ: المتصفح يتولّى الملف وشريط التقدّم بنفسه
          <a
            href="/admin/export"
            download
            className="press"
            title={t(locale, "exportHint")}
            style={{ ...buttonStyle("primary"), textDecoration: "none", whiteSpace: "nowrap" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />
            </svg>
            {t(locale, "exportResults")}
          </a>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))",
          gap: 12,
        }}
      >
        <Kpi label={t(locale, "activeStudents")} value={formatNumber(locale, studentCount ?? 0)} />
        <Kpi label={t(locale, "pointsToday")} value={formatNumber(locale, pointsToday)} />
        <Kpi
          label={t(locale, "activeSupervisors")}
          value={`${formatNumber(locale, activeToday)}/${formatNumber(locale, supervisorCount)}`}
        />
        <Kpi
          label={t(locale, "topGroup")}
          value={topGroup ? topGroup[0] : "—"}
          sub={topGroup ? `${formatNumber(locale, topGroup[1])} ${t(locale, "points")}` : undefined}
          small
        />
      </div>

      <Card>
        <h2 style={{ fontSize: 16, margin: "0 0 14px" }}>{t(locale, "topStudents")}</h2>
        {top.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--ink-mute)", margin: 0 }}>
            {t(locale, "noResults")}
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>{t(locale, "name")}</Th>
                  <Th>{t(locale, "group")}</Th>
                  <Th>{t(locale, "plants")}</Th>
                  <Th>{t(locale, "totalPoints")}</Th>
                </tr>
              </thead>
              <tbody>
                {top.map((s, i) => (
                  <tr key={s.student_id}>
                    <Td muted>{formatNumber(locale, i + 1)}</Td>
                    <Td>{s.full_name}</Td>
                    <Td>
                      <Badge tone={i === 0 ? "gold" : "brand"}>
                        {locale === "ar" ? s.group_name_ar : s.group_name_en}
                      </Badge>
                    </Td>
                    <Td>{formatNumber(locale, s.plant_count)}</Td>
                    <Td strong>{formatNumber(locale, s.total_points)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  small,
}: {
  label: string;
  value: string;
  sub?: string;
  small?: boolean;
}) {
  return (
    <Card style={{ padding: "16px 18px" }}>
      <div
        style={{
          fontSize: 12,
          color: "var(--ink-mute)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
      <div
        className="tabular"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: small ? 20 : 29,
          fontWeight: 700,
          marginTop: 6,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          className="tabular"
          style={{ fontSize: 12, color: "var(--brand-deep)", fontWeight: 600, marginTop: 4 }}
        >
          {sub}
        </div>
      )}
    </Card>
  );
}

