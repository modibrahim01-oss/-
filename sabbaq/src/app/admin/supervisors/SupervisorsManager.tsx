"use client";

import { useState, useTransition } from "react";
import { Badge, Card, Td, Th, buttonStyle } from "@/components/ui";
import {
  createSupervisor,
  setSupervisorActive,
  setSupervisorGroups,
} from "@/lib/actions/admin";
import { roleLabel, t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import type { Group, UserRole } from "@/lib/types";

type StaffRow = {
  id: string;
  nameAr: string;
  nameEn: string | null;
  role: UserRole;
  isActive: boolean;
  groupIds: number[];
};

const field: React.CSSProperties = {
  font: "inherit",
  padding: "9px 12px",
  borderRadius: 9,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  outline: 0,
  minWidth: 0,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 5,
  color: "var(--ink-soft)",
};

export default function SupervisorsManager({
  locale,
  groups,
  staff,
}: {
  locale: Locale;
  groups: Group[];
  staff: StaffRow[];
}) {
  const [role, setRole] = useState<UserRole>("group_supervisor");
  const [editingGroups, setEditingGroups] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const groupName = (id: number) => {
    const g = groups.find((x) => x.id === id);
    return g ? (locale === "ar" ? g.name_ar : g.name_en) : "—";
  };

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await action();
      setNotice(
        res.ok
          ? { tone: "ok", text: t(locale, "saved") }
          : { tone: "err", text: res.error ?? "error" },
      );
      if (res.ok) setEditingGroups(null);
    });
  }

  const roleTone = (r: UserRole) =>
    r === "admin" ? "coral" : r === "committee_supervisor" ? "grape" : "brand";

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
        <h2 style={{ fontSize: 16, margin: "0 0 14px" }}>
          {locale === "ar" ? "إضافة مشرف" : "Add supervisor"}
        </h2>
        <form
          action={(fd) => run(() => createSupervisor(fd))}
          style={{ display: "grid", gap: 12 }}
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 200px" }}>
              <span style={labelStyle}>{t(locale, "name")}</span>
              <input name="fullNameAr" required minLength={2} style={{ ...field, width: "100%" }} />
            </label>
            <label style={{ flex: "1 1 200px" }}>
              <span style={labelStyle}>{t(locale, "name")} (EN)</span>
              <input name="fullNameEn" dir="ltr" style={{ ...field, width: "100%" }} />
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 200px" }}>
              <span style={labelStyle}>{t(locale, "email")}</span>
              <input
                name="email"
                type="email"
                required
                dir="ltr"
                autoComplete="off"
                style={{ ...field, width: "100%" }}
              />
            </label>
            <label style={{ flex: "1 1 160px" }}>
              <span style={labelStyle}>{t(locale, "password")}</span>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                dir="ltr"
                autoComplete="new-password"
                style={{ ...field, width: "100%" }}
              />
            </label>
            <label style={{ flex: "1 1 160px" }}>
              <span style={labelStyle}>{t(locale, "role")}</span>
              <select
                name="role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                style={{ ...field, width: "100%" }}
              >
                <option value="group_supervisor">{roleLabel(locale, "group_supervisor")}</option>
                <option value="committee_supervisor">
                  {roleLabel(locale, "committee_supervisor")}
                </option>
                <option value="admin">{roleLabel(locale, "admin")}</option>
              </select>
            </label>
          </div>

          {/* مجموعات المشرف تُسأل فقط لمشرف المجموعة: الآخرون نطاقهم الجميع */}
          {role === "group_supervisor" && (
            <fieldset
              style={{
                border: "1px solid var(--border-soft)",
                borderRadius: 10,
                padding: "10px 14px",
              }}
            >
              <legend style={{ ...labelStyle, marginBottom: 0, padding: "0 6px" }}>
                {t(locale, "myGroups")}
              </legend>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                {groups.map((g) => (
                  <label
                    key={g.id}
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
                  >
                    <input type="checkbox" name="groupIds" value={g.id} />
                    {locale === "ar" ? g.name_ar : g.name_en}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <button
            type="submit"
            disabled={pending}
            style={{ ...buttonStyle("primary"), justifySelf: "start" }}
          >
            {t(locale, "save")}
          </button>
        </form>
      </Card>

      <Card>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <Th>{t(locale, "name")}</Th>
                <Th>{t(locale, "role")}</Th>
                <Th>{t(locale, "myGroups")}</Th>
                <Th>{t(locale, "actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {staff.map((u) => (
                <tr key={u.id} style={{ opacity: u.isActive ? 1 : 0.5 }}>
                  <Td>{locale === "en" && u.nameEn ? u.nameEn : u.nameAr}</Td>
                  <Td>
                    <Badge tone={roleTone(u.role)}>{roleLabel(locale, u.role)}</Badge>
                  </Td>
                  <Td muted>
                    {u.role === "group_supervisor"
                      ? editingGroups === u.id
                        ? null
                        : u.groupIds.map(groupName).join(" · ") || "—"
                      : t(locale, "allGroupsScope")}
                    {editingGroups === u.id && (
                      <form action={(fd) => run(() => setSupervisorGroups(fd))}>
                        <input type="hidden" name="id" value={u.id} />
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                          {groups.map((g) => (
                            <label
                              key={g.id}
                              style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}
                            >
                              <input
                                type="checkbox"
                                name="groupIds"
                                value={g.id}
                                defaultChecked={u.groupIds.includes(g.id)}
                              />
                              {locale === "ar" ? g.name_ar : g.name_en}
                            </label>
                          ))}
                        </div>
                        <button
                          type="submit"
                          disabled={pending}
                          style={{ ...buttonStyle("primary"), padding: "5px 10px", fontSize: 12 }}
                        >
                          {t(locale, "save")}
                        </button>
                      </form>
                    )}
                  </Td>
                  <Td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {u.role === "group_supervisor" && (
                        <button
                          type="button"
                          onClick={() => setEditingGroups(editingGroups === u.id ? null : u.id)}
                          style={{ ...buttonStyle(), padding: "5px 10px", fontSize: 12 }}
                        >
                          {editingGroups === u.id ? t(locale, "cancel") : t(locale, "edit")}
                        </button>
                      )}
                      <form action={(fd) => run(() => setSupervisorActive(fd))}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="active" value={String(!u.isActive)} />
                        <button
                          type="submit"
                          disabled={pending}
                          style={{
                            ...buttonStyle(u.isActive ? "danger" : "default"),
                            padding: "5px 10px",
                            fontSize: 12,
                          }}
                        >
                          {u.isActive
                            ? locale === "ar"
                              ? "تعطيل"
                              : "Disable"
                            : locale === "ar"
                              ? "تنشيط"
                              : "Enable"}
                        </button>
                      </form>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
