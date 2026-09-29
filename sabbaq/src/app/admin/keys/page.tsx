import Link from "next/link";
import { BrandMark } from "@/components/Brand";
import { Card } from "@/components/ui";
import { localizeDigits, t } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { newToken, qrSvg, siteOrigin } from "@/lib/login-links";
import { createClient } from "@/lib/supabase/server";
import type { Group } from "@/lib/types";
import PrintButton from "../cards/PrintButton";
import NewKeyButton from "./NewKeyButton";

/**
 * بطاقات مفاتيح البساتين: لكل طالب رمز QR يفتح بستانه ومعه مفتاح ترتيبه.
 *
 * على قالب بطاقات أولياء الأمور (cards/page.tsx)، بلون مختلف وتنبيه «لا
 * تشاركه» — فلا تختلط البطاقتان عند التوزيع. المفتاح في الـ hash من الرابط
 * (#k=…) فلا يصل الخادم ولا سجلّاته. الطلاب بلا مفتاح يُنشأ لهم عند فتح الصفحة.
 */
export default async function KeysPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const locale = await getLocale();
  const supabase = await createClient();
  const { group } = await searchParams;
  const groupId = group && /^\d+$/.test(group) ? Number(group) : null;

  const { data: groupRows } = await supabase.from("groups").select("*").order("sort_order");
  const groups = (groupRows ?? []) as Group[];

  let query = supabase
    .from("students")
    .select("id, full_name, group_id, grade")
    .eq("is_active", true)
    .order("full_name")
    .limit(1000);
  if (groupId !== null) query = query.eq("group_id", groupId);
  const { data: students } = await query;
  const list = students ?? [];

  const keysRes = await supabase
    .from("student_farm_keys")
    .select("student_id, token")
    .in(
      "student_id",
      list.map((s) => s.id),
    );
  if (keysRes.error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>{t(locale, "farmKeys")}</h1>
        <Card>
          <p style={{ margin: 0, fontWeight: 700, color: "var(--coral)" }}>{t(locale, "needsMigration")}</p>
        </Card>
      </div>
    );
  }

  const tokens = new Map((keysRes.data ?? []).map((k) => [k.student_id as string, k.token as string]));
  const missing = list.filter((s) => !tokens.has(s.id)).map((s) => ({ student_id: s.id, token: newToken() }));
  if (missing.length > 0) {
    const { error } = await supabase.from("student_farm_keys").insert(missing);
    if (!error) for (const m of missing) tokens.set(m.student_id, m.token);
  }

  const origin = await siteOrigin();
  const groupName = new Map(groups.map((g) => [g.id, locale === "ar" ? g.name_ar : g.name_en]));
  const order = new Map(groups.map((g, i) => [g.id, i]));

  const cards = await Promise.all(
    list
      .filter((s) => tokens.has(s.id))
      .sort((a, b) => (order.get(a.group_id) ?? 0) - (order.get(b.group_id) ?? 0))
      .map(async (s) => ({ ...s, qr: await qrSvg(`${origin}/farm/${s.id}#k=${tokens.get(s.id)}`) })),
  );

  const chip = (active: boolean): React.CSSProperties => ({
    fontSize: 14,
    fontWeight: 700,
    padding: "5px 12px",
    borderRadius: 999,
    textDecoration: "none",
    border: "2px solid var(--outline)",
    background: active ? "var(--grape-fill)" : "var(--surface)",
    color: active ? "var(--on-fill)" : "var(--ink)",
    whiteSpace: "nowrap",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="no-print" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 26, margin: 0 }}>{t(locale, "farmKeys")}</h1>
          <span style={{ marginInlineStart: "auto" }}>
            <PrintButton label={`${t(locale, "printCards")} (${localizeDigits(locale, String(cards.length))})`} />
          </span>
        </div>
        <p style={{ margin: 0, color: "var(--ink-soft)", fontWeight: 500 }}>{t(locale, "farmKeysHint")}</p>
        <nav style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/admin/keys" style={chip(groupId === null)}>
            {t(locale, "allGroups")}
          </Link>
          {groups.map((g) => (
            <Link key={g.id} href={`/admin/keys?group=${g.id}`} style={chip(groupId === g.id)}>
              {locale === "ar" ? g.name_ar : g.name_en}
            </Link>
          ))}
        </nav>
      </div>

      {cards.length === 0 ? (
        <Card>
          <p style={{ margin: 0, fontWeight: 700, color: "var(--ink-soft)" }}>{t(locale, "noResults")}</p>
        </Card>
      ) : (
        <div className="cards-sheet">
          {cards.map((s) => (
            <article key={s.id} className="key-card">
              <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <BrandMark size={26} />
                <strong style={{ fontFamily: "var(--font-display)", fontSize: 17 }}>{t(locale, "appName")}</strong>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1d1b3a" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                  <circle cx="8" cy="15" r="4" />
                  <path d="M11 12l8-8M16 7l3 3M14 9l2 2" />
                </svg>
              </header>
              <div className="key-card-qr" dangerouslySetInnerHTML={{ __html: s.qr }} />
              <strong className="key-card-name">{s.full_name}</strong>
              <span className="key-card-group">
                {groupName.get(s.group_id) ?? ""}
                {s.grade ? ` · ${localizeDigits(locale, s.grade)}` : ""}
              </span>
              <span className="key-card-cta">{t(locale, "farmKeyCard")}</span>
              <NewKeyButton studentId={s.id} label={t(locale, "newKey")} confirm={t(locale, "newKeyConfirm")} />
            </article>
          ))}
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .cards-sheet { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
            .key-card {
              display: grid; justify-items: center; align-content: start; gap: 6px; text-align: center;
              padding: 12px 12px 14px; border: 2.5px solid #1d1b3a; border-radius: 18px; color: #1d1b3a;
              background: repeating-linear-gradient(135deg, #f4ecff 0 10px, #fbf7ff 10px 20px);
              break-inside: avoid; page-break-inside: avoid;
            }
            .key-card-qr { width: 132px; height: 132px; padding: 6px; background: #fff; border: 2px solid #1d1b3a; border-radius: 10px; }
            .key-card-qr svg { width: 100%; height: 100%; display: block; }
            .key-card-name { font-family: var(--font-display); font-size: 18px; line-height: 1.25; overflow-wrap: anywhere; }
            .key-card-group { font-size: 13px; font-weight: 700; color: #4a4870; }
            .key-card-cta { font-size: 12px; font-weight: 700; padding: 2px 10px; border-radius: 999px; background: #b77cff; border: 2px solid #1d1b3a; }
            @media (max-width: 700px) { .cards-sheet { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
            @media print {
              @page { size: A4; margin: 10mm; }
              html, body { background: #fff !important; background-image: none !important; }
              header[style*="sticky"], .no-print, .admin-grid > nav { display: none !important; }
              .admin-grid { display: block !important; padding: 0 !important; max-width: none !important; }
              .cards-sheet { grid-template-columns: repeat(3, 1fr); gap: 6mm; }
              .key-card { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          `,
        }}
      />
    </div>
  );
}
