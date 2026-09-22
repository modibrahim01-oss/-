import Link from "next/link";
import { Brand } from "@/components/Brand";
import StudentSearch from "@/components/StudentSearch";
import { LangToggle, ThemeToggle } from "@/components/Toggles";
import { page, topbar, topbarInner } from "@/components/ui";
import { formatNumber, t } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import type { Group } from "@/lib/types";

// الصفحة العامة تُعرض على شاشات تُعيد التحميل باستمرار. التخزين لدقيقة
// يمنع كل مشاهد من أن يصبح استعلامًا على قاعدة البيانات.
export const revalidate = 60;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const locale = await getLocale();
  const supabase = await createClient();

  // بطاقات المجموعات تربط إلى ‎/?group=N‎ — نقرأ المعامل هنا، وإلا كان النقر
  // عليها لا يفعل شيئًا لأن مربّع البحث يبدأ دائمًا على «كل المجموعات».
  const { group } = await searchParams;
  const requestedGroup = Number(group);
  const initialGroupId =
    Number.isInteger(requestedGroup) && requestedGroup > 0 ? requestedGroup : undefined;

  const [{ data: groups }, { data: counts }] = await Promise.all([
    supabase.from("groups").select("*").order("sort_order"),
    supabase.from("students").select("group_id").eq("is_active", true),
  ]);

  const perGroup = new Map<number, number>();
  for (const row of counts ?? []) {
    perGroup.set(row.group_id, (perGroup.get(row.group_id) ?? 0) + 1);
  }

  const groupList = (groups ?? []) as Group[];

  return (
    <>
      <header style={topbar}>
        <div style={topbarInner}>
          <Brand locale={locale} />
          <div style={{ marginInlineStart: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <Link
              href="/tv"
              style={{
                font: "inherit",
                fontSize: 13,
                fontWeight: 500,
                padding: "8px 14px",
                borderRadius: 999,
                color: "var(--ink-soft)",
                textDecoration: "none",
              }}
            >
              {t(locale, "tvMode")}
            </Link>
            <Link
              href="/login"
              style={{
                font: "inherit",
                fontSize: 13,
                fontWeight: 500,
                padding: "8px 14px",
                borderRadius: 999,
                color: "var(--ink-soft)",
                textDecoration: "none",
              }}
            >
              {t(locale, "login")}
            </Link>
            <LangToggle locale={locale} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main style={page}>
        <section
          style={{
            padding: "44px 24px 36px",
            textAlign: "center",
            background:
              "radial-gradient(circle at 22% 20%, var(--brand-soft) 0%, transparent 46%), radial-gradient(circle at 82% 28%, var(--gold-soft) 0%, transparent 52%), linear-gradient(180deg, var(--surface) 0%, var(--surface-alt) 100%)",
            border: "1px solid var(--border-soft)",
            borderRadius: 20,
          }}
        >
          <h1
            style={{
              fontSize: "clamp(28px, 5vw, 42px)",
              margin: "0 0 8px",
              letterSpacing: "-0.01em",
            }}
          >
            {t(locale, "findYourFarm")}
          </h1>
          <p
            style={{
              color: "var(--ink-soft)",
              margin: "0 auto 26px",
              maxWidth: "48ch",
            }}
          >
            {t(locale, "publicIntro")}
          </p>
          <StudentSearch locale={locale} groups={groupList} initialGroupId={initialGroupId} />
        </section>

        <section style={{ marginTop: 40 }}>
          <h2
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--ink-mute)",
              fontWeight: 600,
              margin: "0 0 14px",
              fontFamily: "var(--font-body)",
            }}
          >
            {t(locale, "groups")}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
              gap: 12,
            }}
          >
            {groupList.map((g) => (
              <Link
                key={g.id}
                href={`/?group=${g.id}#student-query`}
                style={{
                  padding: "18px 16px",
                  borderRadius: 14,
                  background: "var(--surface-alt)",
                  border: "1px solid var(--border-soft)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                  textDecoration: "none",
                  color: "var(--ink)",
                }}
              >
                <span
                  style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}
                >
                  {locale === "ar" ? g.name_ar : g.name_en}
                </span>
                <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                  {locale === "ar" ? g.stage_ar : g.stage_en}
                </span>
                <span
                  className="tabular"
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--brand-deep)",
                  }}
                >
                  {formatNumber(locale, perGroup.get(g.id) ?? 0)} {t(locale, "students")}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
