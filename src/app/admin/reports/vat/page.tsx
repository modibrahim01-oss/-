import { PrintButton } from "@/components/PrintButton";
import { requireAdmin } from "@/lib/auth";
import { listOrders } from "@/lib/data";
import { sumOrders } from "@/lib/analytics";
import { VAT_RATE } from "@/lib/finance";
import { formatDate, formatNumber, formatSAR } from "@/lib/format";

/**
 * الكشف الضريبي الربع سنوي (القسم 7.1).
 * كل المبالغ مُدخَلة شاملة الضريبة، لذا:
 *   ضريبة المخرجات = المبيعات × 15/115
 *   ضريبة المدخلات = المشتريات × 15/115
 *   الصافي المستحق = الفرق = 15% من القيمة المضافة
 */
export default async function VatReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const quarter = Number(params.quarter) || Math.floor(now.getMonth() / 3) + 1;

  const startMonth = (quarter - 1) * 3;
  const from = `${year}-${String(startMonth + 1).padStart(2, "0")}-01`;
  const endDate = new Date(year, startMonth + 3, 0);
  const to = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(
    endDate.getDate(),
  ).padStart(2, "0")}`;

  const orders = await listOrders({ from, to });
  const totals = sumOrders(orders);

  const vatFactor = VAT_RATE / (1 + VAT_RATE);
  const salesExVat = totals.sales / (1 + VAT_RATE);
  const purchasesExVat = totals.cost / (1 + VAT_RATE);
  const outputVat = totals.sales * vatFactor;
  const inputVat = totals.cost * vatFactor;
  const netVat = outputVat - inputVat;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 no-print">
        <h1 className="text-xl font-bold">الكشف الضريبي</h1>
        <PrintButton />
      </div>

      <div className="print-page bg-white rounded-2xl border shadow-sm p-6 space-y-6">
        <header className="text-center border-b pb-4">
          <h2 className="text-lg font-bold">إتقان المقاس — كشف ضريبة القيمة المضافة</h2>
          <p className="text-sm text-gray-500 mt-1">
            الربع <span className="nums">{quarter}</span> لعام <span className="nums">{year}</span> ·
            من <span className="nums">{from}</span> إلى <span className="nums">{to}</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            صدر بتاريخ <span className="nums">{formatDate(new Date())}</span>
          </p>
        </header>

        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b">
              <td className="py-2 text-gray-600">عدد الطلبات</td>
              <td className="py-2 text-left nums">{formatNumber(totals.count, 0)}</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 text-gray-600">إجمالي المبيعات (شامل الضريبة)</td>
              <td className="py-2 text-left nums">{formatSAR(totals.sales)}</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 text-gray-600">المبيعات قبل الضريبة</td>
              <td className="py-2 text-left nums">{formatSAR(salesExVat)}</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 text-gray-600">ضريبة المخرجات (على المبيعات)</td>
              <td className="py-2 text-left nums">{formatSAR(outputVat)}</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 text-gray-600">إجمالي المشتريات (شامل الضريبة)</td>
              <td className="py-2 text-left nums">{formatSAR(totals.cost)}</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 text-gray-600">المشتريات قبل الضريبة</td>
              <td className="py-2 text-left nums">{formatSAR(purchasesExVat)}</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 text-gray-600">ضريبة المدخلات (على المشتريات)</td>
              <td className="py-2 text-left nums">{formatSAR(inputVat)}</td>
            </tr>
            <tr className="border-t-2 border-gray-900">
              <td className="py-3 font-bold">صافي الضريبة المستحقة</td>
              <td className="py-3 text-left font-bold nums">{formatSAR(netVat)}</td>
            </tr>
          </tbody>
        </table>

        <p className="text-xs text-gray-500 border-t pt-3">
          كل المبالغ مُدخَلة شاملة ضريبة القيمة المضافة بنسبة{" "}
          <span className="nums">15%</span>. صافي المستحق = ضريبة المخرجات − ضريبة المدخلات ={" "}
          <span className="nums">15%</span> من القيمة المضافة.
        </p>
      </div>
    </div>
  );
}
