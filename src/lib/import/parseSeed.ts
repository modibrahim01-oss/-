import { computeOrderFinancials, DEFAULT_REP_SHARE_PCT } from "@/lib/finance";
import { normalizeClientName } from "@/lib/normalize";
import { parseCsv, toRecords } from "./csv";

/**
 * ترحيل بيانات الإكسل القديم (القسم 8 من الوثيقة).
 * القاعدة الحاكمة: لا يمرّ أي صف مشكوك فيه بصمت — كل صف يُصنَّف ويُعرض
 * للمشرف في المعاينة قبل أي كتابة في قاعدة البيانات.
 */

export type RowClassification =
  | "ok"
  | "missing_date"
  | "conflict"
  | "duplicate"
  | "adjustment"
  | "error";

export type RowDecision = "import" | "import_as_adjustment" | "skip";

export interface ParsedOrderRow {
  srcRow: number;
  orderDate: string | null;
  clientName: string;
  clientNameNormalized: string;
  factoryCost: number | null;
  clientPrice: number | null;
  /** الربح كما هو مكتوب في الملف القديم — للمقارنة فقط، لا يُستورد. */
  statedProfit: number | null;
  classification: RowClassification;
  issueNote: string | null;
  /** الاقتراح الافتراضي في المعاينة؛ المشرف هو من يقرّر نهائيًا. */
  suggestedDecision: RowDecision | null;
  /** الأرقام المعاد حسابها بنسبة 50% (لا تُنسخ حصص الملف القديم أبدًا). */
  computed: {
    profit: number;
    profitExVat: number;
    repShare: number;
    companyShare: number;
    marginPct: number;
  } | null;
  rawNote: string | null;
}

export interface ImportSummary {
  total: number;
  ok: number;
  missingDate: number;
  conflicts: number;
  duplicates: number;
  adjustments: number;
  errors: number;
  totalSales: number;
  totalProfit: number;
  /** عدد الصفوف التي لن تُستورد تلقائيًا وتحتاج قرار المشرف. */
  needsDecision: number;
}

export interface ImportReport {
  rows: ParsedOrderRow[];
  summary: ImportSummary;
}

export interface ParsedClientRow {
  name: string;
  nameNormalized: string;
  ordersCount: number;
  totalSales: number;
  totalProfit: number;
  marginPct: number;
}

/** فرق مقبول بسبب التقريب في الملف القديم. */
const PROFIT_TOLERANCE = 0.02;

/** أسماء تدل على قيد غير منسوب لعميل حقيقي. */
const UNRESOLVED_CLIENT_MARKERS = ["قيد غير مفس", "بدون عميل", "غير معروف"];

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[,\s]/g, "").replace(/[٠-٩]/g, (d) =>
    String("٠١٢٣٤٥٦٧٨٩".indexOf(d)),
  );
  if (cleaned === "") return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function parseDate(value: string | undefined): string | null {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function isUnresolvedClient(name: string): boolean {
  return UNRESOLVED_CLIENT_MARKERS.some((marker) => name.includes(marker));
}

export function parseOrdersCsv(csvText: string): ImportReport {
  const records = toRecords(parseCsv(csvText));

  const rows: ParsedOrderRow[] = records.map((record, index) => {
    const srcRow = Number(record.src_row) || index + 2;
    const clientName = (record.client_name ?? "").trim();
    const factoryCost = parseNumber(record.factory_cost);
    const clientPrice = parseNumber(record.client_price);
    const statedProfit = parseNumber(record.profit);
    const orderDate = parseDate(record.order_date);
    const rawNote = (record.note ?? "").trim() || null;

    const base: ParsedOrderRow = {
      srcRow,
      orderDate,
      clientName,
      clientNameNormalized: normalizeClientName(clientName),
      factoryCost,
      clientPrice,
      statedProfit,
      classification: "ok",
      issueNote: null,
      suggestedDecision: "import",
      computed: null,
      rawNote,
    };

    // 1) قيد ربح بدون عميل ولا تكلفة ولا مبيعات (صف 15 في الإكسل: 20,000 ريال)
    //    لا يُستورد كطلب إطلاقًا — يُعرض كتسوية معلّقة يبتّ فيها المشرف.
    if (
      statedProfit !== null &&
      (factoryCost === null || clientPrice === null) &&
      (clientName === "" || isUnresolvedClient(clientName))
    ) {
      return {
        ...base,
        classification: "adjustment",
        issueNote:
          rawNote ??
          `ربح ${statedProfit} بدون عميل ولا تكلفة ولا مبيعات — لا يُستورد كطلب`,
        suggestedDecision: "import_as_adjustment",
        computed: null,
      };
    }

    // 2) صف تالف: لا يمكن حساب أي شيء منه
    if (factoryCost === null || clientPrice === null) {
      return {
        ...base,
        classification: "error",
        issueNote: "تكلفة أو سعر غير صالح",
        suggestedDecision: "skip",
      };
    }

    const financials = computeOrderFinancials(factoryCost, clientPrice, DEFAULT_REP_SHARE_PCT);
    const computed = {
      profit: financials.profit,
      profitExVat: financials.profitExVat,
      repShare: financials.repShare,
      companyShare: financials.companyShare,
      marginPct: financials.marginPct,
    };

    // 3) تعارض الأرقام: الربح المكتوب في الملف لا يساوي (سعر العميل − التكلفة).
    //    الجدول الرئيسي هو المصدر المعتمد، فنستورد المحسوب ونُدرج التعارض
    //    في التقرير ليراجعه المشرف.
    if (statedProfit !== null && Math.abs(statedProfit - financials.profit) > PROFIT_TOLERANCE) {
      return {
        ...base,
        classification: "conflict",
        issueNote: `تعارض: الربح في الملف ${statedProfit} والمحسوب ${financials.profit.toFixed(2)} — سيُعتمد المحسوب من الجدول الرئيسي`,
        suggestedDecision: "import",
        computed,
      };
    }

    // 4) تاريخ مفقود: يُستورد بـ order_date = null ويظهر في "يحتاج مراجعة".
    //    لا تُخترع تواريخ.
    if (!orderDate) {
      return {
        ...base,
        classification: "missing_date",
        issueNote: "تاريخ مفقود — يُستورد بدون تاريخ ويظهر في شاشة يحتاج مراجعة",
        suggestedDecision: "import",
        computed,
      };
    }

    return { ...base, computed };
  });

  markDuplicates(rows);

  return { rows, summary: summarize(rows) };
}

/**
 * تكرار محتمل: نفس العميل بنفس سعر العميل ونفس التكلفة أكثر من مرة
 * (حالة "شام وقمر" المكرر في شهر 8 وشهر 9 بنفس المبلغ 5,756.25).
 * لا تُستورد أي نسخة تلقائيًا — القرار للمشرف.
 */
function markDuplicates(rows: ParsedOrderRow[]): void {
  const groups = new Map<string, ParsedOrderRow[]>();

  for (const row of rows) {
    if (row.classification === "adjustment" || row.classification === "error") continue;
    if (row.clientPrice === null || row.factoryCost === null) continue;
    const key = `${row.clientNameNormalized}|${row.clientPrice}|${row.factoryCost}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const row of group) {
      row.classification = "duplicate";
      row.issueNote = `تكرار محتمل: ${group.length} صفوف بنفس العميل والمبلغ (صفوف ${group
        .map((r) => r.srcRow)
        .join(", ")}) — لا تُستورد تلقائيًا`;
      row.suggestedDecision = null;
    }
  }
}

function summarize(rows: ParsedOrderRow[]): ImportSummary {
  const summary: ImportSummary = {
    total: rows.length,
    ok: 0,
    missingDate: 0,
    conflicts: 0,
    duplicates: 0,
    adjustments: 0,
    errors: 0,
    totalSales: 0,
    totalProfit: 0,
    needsDecision: 0,
  };

  for (const row of rows) {
    switch (row.classification) {
      case "ok":
        summary.ok++;
        break;
      case "missing_date":
        summary.missingDate++;
        break;
      case "conflict":
        summary.conflicts++;
        break;
      case "duplicate":
        summary.duplicates++;
        break;
      case "adjustment":
        summary.adjustments++;
        break;
      case "error":
        summary.errors++;
        break;
    }

    if (row.suggestedDecision === null) summary.needsDecision++;
    if (row.clientPrice !== null && row.classification !== "adjustment") {
      summary.totalSales += row.clientPrice;
    }
    if (row.computed) summary.totalProfit += row.computed.profit;
  }

  return summary;
}

export function parseClientsCsv(csvText: string): ParsedClientRow[] {
  const records = toRecords(parseCsv(csvText));
  return records
    .filter((record) => (record.client_name ?? "").trim() !== "")
    .map((record) => {
      const name = record.client_name.trim();
      return {
        name,
        nameNormalized: normalizeClientName(name),
        ordersCount: parseNumber(record.orders_count) ?? 0,
        totalSales: parseNumber(record.total_sales) ?? 0,
        totalProfit: parseNumber(record.total_profit) ?? 0,
        marginPct: parseNumber(record.margin_pct) ?? 0,
      };
    });
}

/**
 * المسحوبات القديمة المرحّلة من الإكسل (القسم 8): 37,950 ريال إجمالًا،
 * منها 17,950 دفعة واحدة في أول صف. تُسجَّل باسم حساب المشرف بتاريخ
 * الاستيراد وملاحظة توضّح مصدرها.
 */
export const LEGACY_WITHDRAWALS = [
  { amount: 17950, note: "رصيد مرحّل من الإكسل — دفعة واحدة في أول صف" },
  { amount: 20000, note: "رصيد مرحّل من الإكسل — باقي المسحوبات القديمة" },
] as const;

export const LEGACY_WITHDRAWALS_TOTAL = LEGACY_WITHDRAWALS.reduce(
  (sum, w) => sum + w.amount,
  0,
);
