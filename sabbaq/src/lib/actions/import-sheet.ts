"use server";

import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";

/**
 * يقرأ ملف Excel ويحوّله إلى نصّ الصفوف الذي يفهمه محلّل الاستيراد.
 *
 * التحويل إلى نص مقصود: مسار اللصق يملك أصلًا مطابقة المجموعات والمجموعة
 * الاحتياطية والمعاينة قبل الإدراج، فبدل بناء مسار ثانٍ موازٍ يمرّ الملف
 * بالمسار نفسه — ويرى المدير المعاينة ذاتها قبل أن يُكتب صفٌّ واحد.
 *
 * التحليل على الخادم لا في المتصفح: exceljs حزمة ثقيلة لا داعي لتحميلها في
 * حزمة العميل، وقراءة ملف المدير لا تحتاج أن تصل إلى أي مكان آخر.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 2000;

// كلمات ترويسة شائعة: وجودها في الصف الأول يعني أنه عناوين لا بيانات
const HEADER_HINTS = [
  "الاسم",
  "اسم",
  "الطالب",
  "المجموعة",
  "الصف",
  "name",
  "student",
  "group",
  "grade",
  "class",
];

export type SheetParseResult =
  | { ok: true; text: string; rows: number; skippedHeader: boolean }
  | { ok: false; error: string };

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    // خلايا الصيغ تحمل النتيجة في result، والنص الغني في richText
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text).join("").trim();
    }
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
  }
  return "";
}

export async function parseStudentSheet(formData: FormData): Promise<SheetParseResult> {
  // الاستيراد فعل إداري: نتحقّق من الدور قبل قراءة أي بايت من الملف
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "forbidden" };

  const { data: me } = await supabase
    .from("users")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!me || me.role !== "admin" || !me.is_active) return { ok: false, error: "forbidden" };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "no_file" };
  if (file.size === 0) return { ok: false, error: "empty_file" };
  if (file.size > MAX_BYTES) return { ok: false, error: "too_large" };

  let workbook: ExcelJS.Workbook;
  try {
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    return { ok: false, error: "unreadable" };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) return { ok: false, error: "no_sheet" };

  const lines: string[] = [];
  let skippedHeader = false;

  sheet.eachRow((row, rowNumber) => {
    if (lines.length >= MAX_ROWS) return;

    const name = cellText(row.getCell(1).value);
    const group = cellText(row.getCell(2).value);
    const grade = cellText(row.getCell(3).value);

    if (!name) return;

    if (rowNumber === 1 && HEADER_HINTS.some((h) => name.toLowerCase().includes(h))) {
      skippedHeader = true;
      return;
    }

    // الفاصل tab لأن الأسماء والمجموعات العربية قد تحتوي فاصلة
    lines.push([name, group, grade].join("\t"));
  });

  if (lines.length === 0) return { ok: false, error: "no_rows" };

  return { ok: true, text: lines.join("\n"), rows: lines.length, skippedHeader };
}
