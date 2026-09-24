import { Badge, Card, Td, Th } from "@/components/ui";
import { formatNumber, t } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import type { Semester } from "@/lib/types";
import SemesterActions from "./SemesterActions";

export default async function SemestersPage() {
  const locale = await getLocale();
  const supabase = await createClient();

  const [{ data: semesters }, { data: archives }] = await Promise.all([
    supabase.from("semesters").select("*").order("start_date", { ascending: false }),
    supabase
      .from("semester_archives")
      .select("id, semester_id, created_at, snapshot")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const list = (semesters ?? []) as Semester[];
  const active = list.find((s) => s.is_active) ?? null;

  const archiveCounts = new Map<string, { at: string; count: number }>();
  for (const a of archives ?? []) {
    const snapshot = a.snapshot as unknown[];
    archiveCounts.set(a.semester_id as string, {
      at: a.created_at as string,
      count: Array.isArray(snapshot) ? snapshot.length : 0,
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 26, margin: 0 }}>{t(locale, "semesters")}</h1>
        <p style={{ color: "var(--ink-mute)", fontSize: 13, margin: "4px 0 0" }}>
          {active
            ? `${locale === "ar" ? active.name_ar : active.name_en} · ${active.start_date} ${locale === "ar" ? "←" : "→"} ${active.end_date}`
            : locale === "ar"
              ? "لا يوجد فصل نشط — لن تُقبل أي نقاط حتى تُنشئ واحدًا."
              : "No active semester — awards are rejected until one exists."}
        </p>
      </div>

      <SemesterActions locale={locale} active={active} />

      <Card>
        <h2 style={{ fontSize: 16, margin: "0 0 14px" }}>
          {locale === "ar" ? "سجل الفصول" : "Semester history"}
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <Th>{t(locale, "name")}</Th>
                <Th>{locale === "ar" ? "من" : "From"}</Th>
                <Th>{locale === "ar" ? "إلى" : "To"}</Th>
                <Th>{locale === "ar" ? "الحالة" : "Status"}</Th>
                <Th>{locale === "ar" ? "الأرشيف" : "Archive"}</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => {
                const arch = archiveCounts.get(s.id);
                return (
                  <tr key={s.id}>
                    <Td>{locale === "ar" ? s.name_ar : s.name_en}</Td>
                    <Td muted>{s.start_date}</Td>
                    <Td muted>{s.end_date}</Td>
                    <Td>
                      {s.is_active ? (
                        <Badge>{locale === "ar" ? "نشط" : "Active"}</Badge>
                      ) : (
                        <Badge tone="grape">{locale === "ar" ? "منتهٍ" : "Closed"}</Badge>
                      )}
                    </Td>
                    <Td muted>
                      {arch
                        ? `${formatNumber(locale, arch.count)} ${t(locale, "students")}`
                        : "—"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
