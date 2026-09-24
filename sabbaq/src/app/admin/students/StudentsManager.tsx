"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge, buttonStyle, Card, field, Td, Th } from "@/components/ui";
import {
  createStudent,
  deactivateStudent,
  importStudents,
  updateStudent,
} from "@/lib/actions/admin";
import { parseStudentSheet } from "@/lib/actions/import-sheet";
import { formatNumber, t, localizeDigits } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import type { Group, Student } from "@/lib/types";


type Row = Pick<Student, "id" | "full_name" | "group_id" | "grade">;

export default function StudentsManager({
  locale,
  groups,
  students,
}: {
  locale: Locale;
  groups: Group[];
  students: Row[];
}) {
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<number | "all">("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const groupName = (id: number) => {
    const g = groups.find((x) => x.id === id);
    return g ? (locale === "ar" ? g.name_ar : g.name_en) : "—";
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter(
      (s) =>
        (groupFilter === "all" || s.group_id === groupFilter) &&
        (q === "" || s.full_name.toLowerCase().includes(q)),
    );
  }, [students, query, groupFilter]);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, okText: string) {
    startTransition(async () => {
      const res = await action();
      setNotice(res.ok ? { tone: "ok", text: okText } : { tone: "err", text: res.error ?? "error" });
      if (res.ok) setEditing(null);
    });
  }

  return (
    <>
      {notice && (
        <div
          role="status"
          style={{
            padding: "11px 16px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 500,
            background: notice.tone === "ok" ? "var(--brand-soft)" : "var(--coral-soft)",
            color: notice.tone === "ok" ? "var(--brand-deep)" : "var(--coral)",
          }}
        >
          {notice.text}
        </div>
      )}

      <Card>
        <h2 style={{ fontSize: 16, margin: "0 0 14px" }}>{t(locale, "addStudent")}</h2>
        <form
          action={(fd) => run(() => createStudent(fd), t(locale, "saved"))}
          style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}
        >
          <label style={{ flex: "2 1 220px" }}>
            <span style={labelStyle}>{t(locale, "name")}</span>
            <input name="fullName" required minLength={2} style={{ ...field, width: "100%" }} />
          </label>
          <label style={{ flex: "1 1 140px" }}>
            <span style={labelStyle}>{t(locale, "group")}</span>
            <select name="groupId" required style={{ ...field, width: "100%" }}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {locale === "ar" ? g.name_ar : g.name_en}
                </option>
              ))}
            </select>
          </label>
          <label style={{ flex: "1 1 120px" }}>
            <span style={labelStyle}>{t(locale, "grade")}</span>
            <input name="grade" style={{ ...field, width: "100%" }} />
          </label>
          <button className="press" type="submit" disabled={pending} style={buttonStyle("primary")}>
            {t(locale, "save")}
          </button>
          <button
            type="button"
            onClick={() => setShowImport((v) => !v)}
            style={buttonStyle()}
          >
            {t(locale, "importExcel")}
          </button>
        </form>

        {showImport && (
          <ImportBox
            locale={locale}
            groups={groups}
            pending={pending}
            onSubmit={(rows) =>
              startTransition(async () => {
                const res = await importStudents(rows);
                setNotice(
                  res.ok
                    ? { tone: "ok", text: `${t(locale, "saved")} · ${formatNumber(locale, res.inserted)}` }
                    : { tone: "err", text: res.error },
                );
                if (res.ok) setShowImport(false);
              })
            }
          />
        )}
      </Card>

      <Card>
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(locale, "searchByName")}
            aria-label={t(locale, "searchByName")}
            style={{ ...field, flex: "1 1 200px" }}
          />
          <select
            value={groupFilter}
            onChange={(e) =>
              setGroupFilter(e.target.value === "all" ? "all" : Number(e.target.value))
            }
            aria-label={t(locale, "group")}
            style={field}
          >
            <option value="all">{t(locale, "allGroups")}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {locale === "ar" ? g.name_ar : g.name_en}
              </option>
            ))}
          </select>
          <span className="tabular" style={{ fontSize: 13, color: "var(--ink-mute)" }}>
            {formatNumber(locale, filtered.length)} {t(locale, "students")}
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <Th>{t(locale, "name")}</Th>
                <Th>{t(locale, "group")}</Th>
                <Th>{t(locale, "grade")}</Th>
                <Th>{t(locale, "actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) =>
                editing === s.id ? (
                  <tr key={s.id}>
                    <td colSpan={4} style={{ padding: "10px 12px", background: "var(--surface)" }}>
                      <form
                        action={(fd) => run(() => updateStudent(fd), t(locale, "saved"))}
                        style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
                      >
                        <input type="hidden" name="id" value={s.id} />
                        <input
                          name="fullName"
                          defaultValue={s.full_name}
                          required
                          style={{ ...field, flex: "2 1 200px" }}
                        />
                        <select name="groupId" defaultValue={s.group_id} style={field}>
                          {groups.map((g) => (
                            <option key={g.id} value={g.id}>
                              {locale === "ar" ? g.name_ar : g.name_en}
                            </option>
                          ))}
                        </select>
                        <input
                          name="grade"
                          defaultValue={s.grade ?? ""}
                          placeholder={t(locale, "grade")}
                          style={{ ...field, flex: "1 1 110px" }}
                        />
                        <button className="press" type="submit" disabled={pending} style={buttonStyle("primary")}>
                          {t(locale, "save")}
                        </button>
                        <button type="button" onClick={() => setEditing(null)} style={buttonStyle()}>
                          {t(locale, "cancel")}
                        </button>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={s.id}>
                    <Td>{s.full_name}</Td>
                    <Td>
                      <Badge>{groupName(s.group_id)}</Badge>
                    </Td>
                    <Td muted>{s.grade ? localizeDigits(locale, s.grade) : "—"}</Td>
                    <Td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => setEditing(s.id)}
                          style={{ ...buttonStyle(), padding: "5px 10px", fontSize: 12 }}
                        >
                          {t(locale, "edit")}
                        </button>
                        <form
                          action={(fd) => run(() => deactivateStudent(fd), t(locale, "saved"))}
                        >
                          <input type="hidden" name="id" value={s.id} />
                          <button className="press"
                            type="submit"
                            disabled={pending}
                            style={{ ...buttonStyle("danger"), padding: "5px 10px", fontSize: 12 }}
                          >
                            {t(locale, "remove")}
                          </button>
                        </form>
                      </div>
                    </Td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 5,
  color: "var(--ink-soft)",
};

type SheetState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; rows: number; skippedHeader: boolean }
  | { kind: "error"; code: string };

/** رسالة مفهومة لكل سبب رفض، بدل ترك المدير أمام كلمة إنجليزية مجرّدة. */
function sheetErrorText(locale: Locale, code: string): string {
  const ar: Record<string, string> = {
    forbidden: "هذا الإجراء للمدير وحده",
    no_file: "لم يُختَر ملف",
    empty_file: "الملف فارغ",
    too_large: "الملف أكبر من ٥ ميغابايت",
    unreadable: "تعذّرت قراءة الملف — تأكّد أنه ‎.xlsx وليس ‎.xls أو CSV",
    no_sheet: "لا توجد أوراق في الملف",
    no_rows: "لا صفوف فيها اسم في العمود الأول",
  };
  const en: Record<string, string> = {
    forbidden: "Admins only",
    no_file: "No file selected",
    empty_file: "The file is empty",
    too_large: "File is larger than 5 MB",
    unreadable: "Could not read the file — make sure it is .xlsx, not .xls or CSV",
    no_sheet: "The workbook has no sheets",
    no_rows: "No rows with a name in the first column",
  };
  const table = locale === "ar" ? ar : en;
  return table[code] ?? (locale === "ar" ? "تعذّر الاستيراد" : "Import failed");
}

/**
 * لصق صفوف من Excel: كل سطر «الاسم [tab|فاصلة] المجموعة [tab|فاصلة] الصف».
 * نعرض معاينة قبل الإدراج — لا يُكتب أي صف قبل أن يراجعها المدير.
 */
function ImportBox({
  locale,
  groups,
  pending,
  onSubmit,
}: {
  locale: Locale;
  groups: Group[];
  pending: boolean;
  onSubmit: (rows: { fullName: string; groupId: number; grade: string | null }[]) => void;
}) {
  const [raw, setRaw] = useState("");
  const [fallbackGroup, setFallbackGroup] = useState(groups[0]?.id ?? 1);
  const [sheetState, setSheetState] = useState<SheetState>({ kind: "idle" });

  const parsed = useMemo(() => {
    const rows: { fullName: string; groupId: number; grade: string | null }[] = [];
    const bad: string[] = [];

    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const cells = trimmed.split(/\t|,|;/).map((c) => c.trim());
      const name = cells[0];
      if (!name || name.length < 2) {
        bad.push(trimmed);
        continue;
      }
      // المجموعة تُطابَق بالاسم العربي أو الإنجليزي أو الرمز؛ غير المتطابق
      // يأخذ المجموعة الافتراضية المختارة أعلاه بدل أن يُرفض الصف
      const token = (cells[1] ?? "").toLowerCase();
      const match = groups.find(
        (g) =>
          g.name_ar === cells[1] ||
          g.name_en.toLowerCase() === token ||
          g.code.toLowerCase() === token,
      );
      rows.push({
        fullName: name,
        groupId: match?.id ?? fallbackGroup,
        grade: cells[2] || null,
      });
    }
    return { rows, bad };
  }, [raw, groups, fallbackGroup]);

  return (
    <div
      style={{
        marginTop: 16,
        paddingTop: 16,
        borderTop: "1px dashed var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: 0 }}>
        {locale === "ar"
          ? "ارفع ملف ‎.xlsx أو الصق الصفوف: الاسم، المجموعة، الصف — سطر لكل طالب."
          : "Upload an .xlsx file or paste rows: name, group, grade — one line per student."}
      </p>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          id="student-sheet"
          type="file"
          accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setSheetState({ kind: "loading" });
            const fd = new FormData();
            fd.set("file", file);
            const res = await parseStudentSheet(fd);
            // الملف يصبح نصًّا في نفس المربّع، فيمرّ بالمعاينة ومطابقة
            // المجموعات التي يمرّ بها اللصق — لا مسار ثانٍ بلا مراجعة
            if (res.ok) {
              setRaw(res.text);
              setSheetState({ kind: "ok", rows: res.rows, skippedHeader: res.skippedHeader });
            } else {
              setSheetState({ kind: "error", code: res.error });
            }
            e.target.value = "";
          }}
          style={{ ...field, flex: "1 1 220px", padding: 7 }}
        />
        {sheetState.kind === "loading" && (
          <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{t(locale, "loading")}</span>
        )}
        {sheetState.kind === "ok" && (
          <span style={{ fontSize: 12, color: "var(--brand-deep)", fontWeight: 600 }}>
            ✓ {formatNumber(locale, sheetState.rows)} {t(locale, "students")}
            {sheetState.skippedHeader && (locale === "ar" ? " · تُخطّيت الترويسة" : " · header skipped")}
          </span>
        )}
        {sheetState.kind === "error" && (
          <span role="alert" style={{ fontSize: 12, color: "var(--coral)", fontWeight: 600 }}>
            {sheetErrorText(locale, sheetState.code)}
          </span>
        )}
      </div>

      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={6}
        style={{ ...field, width: "100%", fontFamily: "ui-monospace, monospace", fontSize: 13 }}
        placeholder={"محمد الأحمد\tباسل ١\tالخامس\nنورة السالم\tتميز\tالعاشر"}
      />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ fontSize: 12, color: "var(--ink-soft)" }}>
          {locale === "ar" ? "المجموعة الافتراضية" : "Fallback group"}{" "}
          <select
            value={fallbackGroup}
            onChange={(e) => setFallbackGroup(Number(e.target.value))}
            style={field}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {locale === "ar" ? g.name_ar : g.name_en}
              </option>
            ))}
          </select>
        </label>
        <span className="tabular" style={{ fontSize: 13, color: "var(--ink-soft)" }}>
          {formatNumber(locale, parsed.rows.length)} {t(locale, "students")}
          {parsed.bad.length > 0 && (
            <span style={{ color: "var(--coral)", marginInlineStart: 8 }}>
              · {formatNumber(locale, parsed.bad.length)} {locale === "ar" ? "صف تالف" : "bad rows"}
            </span>
          )}
        </span>
        <button
          type="button"
          disabled={pending || parsed.rows.length === 0}
          onClick={() => onSubmit(parsed.rows)}
          style={{ ...buttonStyle("primary"), opacity: parsed.rows.length === 0 ? 0.5 : 1 }}
        >
          {t(locale, "importExcel")}
        </button>
      </div>
    </div>
  );
}
