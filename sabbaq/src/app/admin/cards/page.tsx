import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { BrandMark } from "@/components/Brand";
import { Card } from "@/components/ui";
import { localizeDigits, t } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import type { Group } from "@/lib/types";
import PrintButton from "./PrintButton";

/**
 * بطاقات أولياء الأمور: لكل طالب بطاقة برمز QR يفتح مزرعته.
 *
 * صفحة المزرعة عامة بلا تسجيل دخول، فالرمز وحده يكفي ولي الأمر ليتابع ابنه
 * من جواله. تُطبع على A4 تسع بطاقات في الورقة، وتُقصّ وتوزَّع.
 *
 * الرموز تُولَّد على الخادم SVG: تُطبع حادّة بأي مقاس، ولا مكتبة في المتصفح.
 */

/** أصل الموقع كما وصل إليه المدير — فالرمز يفتح النطاق نفسه الذي طُبع منه. */
async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return process.env.URL ?? "https://sapeeq.netlify.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function CardsPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
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

  const origin = await siteOrigin();
  const groupName = new Map(groups.map((g) => [g.id, locale === "ar" ? g.name_ar : g.name_en]));
  const order = new Map(groups.map((g, i) => [g.id, i]));

  const cards = await Promise.all(
    (students ?? [])
      .slice()
      .sort((a, b) => (order.get(a.group_id) ?? 0) - (order.get(b.group_id) ?? 0))
      .map(async (s) => ({
        ...s,
        qr: await QRCode.toString(`${origin}/farm/${s.id}`, {
          type: "svg",
          margin: 0,
          errorCorrectionLevel: "M",
          color: { dark: "#1d1b3a", light: "#ffffff" },
        }),
      })),
  );

  const chip = (active: boolean): React.CSSProperties => ({
    fontSize: 14,
    fontWeight: 700,
    padding: "5px 12px",
    borderRadius: 999,
    textDecoration: "none",
    border: "2px solid var(--outline)",
    background: active ? "var(--sun)" : "var(--surface)",
    color: active ? "var(--on-fill)" : "var(--ink)",
    whiteSpace: "nowrap",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="no-print" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 26, margin: 0 }}>{t(locale, "parentCards")}</h1>
          <span style={{ marginInlineStart: "auto" }}>
            <PrintButton label={`${t(locale, "printCards")} (${localizeDigits(locale, String(cards.length))})`} />
          </span>
        </div>
        <p style={{ margin: 0, color: "var(--ink-soft)", fontWeight: 500 }}>{t(locale, "parentCardsHint")}</p>
        <nav style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/admin/cards" style={chip(groupId === null)}>
            {t(locale, "allGroups")}
          </Link>
          {groups.map((g) => (
            <Link key={g.id} href={`/admin/cards?group=${g.id}`} style={chip(groupId === g.id)}>
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
            <article key={s.id} className="parent-card">
              <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <BrandMark size={26} />
                <strong style={{ fontFamily: "var(--font-display)", fontSize: 17 }}>{t(locale, "appName")}</strong>
              </header>
              <div
                className="parent-card-qr"
                // SVG من مكتبة qrcode على الخادم، مدخلها رابط نبنيه نحن من معرّف UUID
                dangerouslySetInnerHTML={{ __html: s.qr }}
              />
              <strong className="parent-card-name">{s.full_name}</strong>
              <span className="parent-card-group">
                {groupName.get(s.group_id) ?? ""}
                {s.grade ? ` · ${localizeDigits(locale, s.grade)}` : ""}
              </span>
              <span className="parent-card-cta">{t(locale, "scanToSee")}</span>
            </article>
          ))}
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .cards-sheet { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
            .parent-card {
              display: grid; justify-items: center; align-content: start; gap: 6px; text-align: center;
              padding: 12px 12px 14px; border: 2.5px dashed #1d1b3a; border-radius: 18px; background: #fff; color: #1d1b3a;
              break-inside: avoid; page-break-inside: avoid;
              background-image: linear-gradient(90deg, #7ddc3f 0 25%, #ffce1f 25% 50%, #b77cff 50% 75%, #ff5a4e 75% 100%);
              background-size: 100% 6px; background-repeat: no-repeat;
            }
            .parent-card-qr { width: 132px; height: 132px; padding: 6px; background: #fff; border: 2px solid #1d1b3a; border-radius: 10px; }
            .parent-card-qr svg { width: 100%; height: 100%; display: block; }
            .parent-card-name { font-family: var(--font-display); font-size: 18px; line-height: 1.25; overflow-wrap: anywhere; }
            .parent-card-group { font-size: 13px; font-weight: 700; color: #4a4870; }
            .parent-card-cta { font-size: 12px; font-weight: 700; padding: 2px 10px; border-radius: 999px; background: #ffce1f; border: 2px solid #1d1b3a; }
            @media (max-width: 700px) { .cards-sheet { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
            @media print {
              @page { size: A4; margin: 10mm; }
              html, body { background: #fff !important; background-image: none !important; }
              body > header, header[style*="sticky"], nav.pop, .no-print, .admin-grid > nav { display: none !important; }
              .admin-grid { display: block !important; padding: 0 !important; max-width: none !important; }
              .cards-sheet { grid-template-columns: repeat(3, 1fr); gap: 6mm; }
              .parent-card { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          `,
        }}
      />
    </div>
  );
}
