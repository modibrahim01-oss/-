import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireUser } from "@/lib/auth";

interface ExportPayload {
  rows: Record<string, string | number>[];
  sheetName?: string;
  fileName?: string;
}

/**
 * تصدير أي جدول معروض إلى Excel بنفس الفلاتر المطبَّقة، مع صف إجماليات
 * وبتنسيق RTL (القسم 7.1). الصفوف تصل من الواجهة بعد أن مرّت أصلًا على
 * RLS في الاستعلام الذي أنتجها.
 */
export async function POST(request: Request) {
  await requireUser();

  const payload = (await request.json()) as ExportPayload;
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  if (rows.length === 0) {
    return NextResponse.json({ error: "لا توجد بيانات للتصدير" }, { status: 400 });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "إتقان المقاس";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(payload.sheetName ?? "بيانات", {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }],
  });

  const headers = Object.keys(rows[0]);
  sheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: Math.max(14, header.length + 4),
  }));

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { horizontal: "right" };

  for (const row of rows) {
    sheet.addRow(row);
  }

  // صف الإجماليات للأعمدة الرقمية
  const totals: Record<string, number | string> = {};
  let hasNumericColumn = false;
  for (const header of headers) {
    const values = rows.map((r) => r[header]).filter((v) => typeof v === "number") as number[];
    if (values.length === rows.length && values.length > 0) {
      totals[header] = values.reduce((sum, v) => sum + v, 0);
      hasNumericColumn = true;
    } else {
      totals[header] = "";
    }
  }

  if (hasNumericColumn) {
    totals[headers[0]] = "الإجمالي";
    const totalsRow = sheet.addRow(totals);
    totalsRow.font = { bold: true };
    totalsRow.border = { top: { style: "thin" } };
  }

  sheet.eachRow((row, rowNumber) => {
    row.alignment = { horizontal: "right", vertical: "middle" };
    if (rowNumber > 1) {
      row.eachCell((cell) => {
        if (typeof cell.value === "number") {
          cell.numFmt = "#,##0.00";
        }
      });
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = encodeURIComponent(`${payload.fileName ?? "تصدير"}.xlsx`);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${fileName}`,
    },
  });
}
