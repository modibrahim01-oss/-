/**
 * محرك الحساب المالي — القسم 4 من وثيقة المواصفات.
 * كل مبالغ الشراء والبيع مُدخَلة شاملة ضريبة القيمة المضافة 15%.
 * احسب بدقة كاملة داخليًا، وقرّب للعرض فقط. لا تخزّن قيمًا مقرّبة.
 */

export const VAT_RATE = 0.15;

/**
 * توزيع صافي الربح بعد الضريبة على أربع جهات، ومجموعها 100%:
 *   المندوب الذي جاء بالعميل 50% · المالك 20% · الشريك 20% · الشركة 10%
 * كل طلب يحتفظ بنسخة من هذه النسب وقت إنشائه، فتعديلها لاحقًا لا يغيّر
 * توزيع الطلبات القديمة.
 */
export const DEFAULT_REP_SHARE_PCT = 50;
export const DEFAULT_OWNER_SHARE_PCT = 20;
export const DEFAULT_PARTNER_SHARE_PCT = 20;
export const DEFAULT_COMPANY_SHARE_PCT = 10;

export interface ProfitSplit {
  repPct: number;
  ownerPct: number;
  partnerPct: number;
  companyPct: number;
}

export const DEFAULT_SPLIT: ProfitSplit = {
  repPct: DEFAULT_REP_SHARE_PCT,
  ownerPct: DEFAULT_OWNER_SHARE_PCT,
  partnerPct: DEFAULT_PARTNER_SHARE_PCT,
  companyPct: DEFAULT_COMPANY_SHARE_PCT,
};

export function splitTotal(split: ProfitSplit): number {
  return split.repPct + split.ownerPct + split.partnerPct + split.companyPct;
}

/** التوزيع صالح فقط إذا كان مجموعه 100% بالضبط. */
export function isValidSplit(split: ProfitSplit): boolean {
  return Math.abs(splitTotal(split) - 100) < 0.001;
}

export interface OrderCosts {
  costCarton: number;
  costMold: number;
  costPlate: number;
  costShipping: number;
}

export interface OrderFinancials {
  factoryCost: number;
  clientPrice: number;
  profit: number;
  profitExVat: number;
  vatDue: number;
  split: ProfitSplit;
  repSharePct: number;
  repShare: number;
  ownerShare: number;
  partnerShare: number;
  /**
   * حصة الشركة وحدها (الاحتياطي)، لا مجموع ما تبقّى بعد المندوب.
   * قبل إضافة الشريك كانت تعني «كل ما ليس للمندوب» — انتبه لهذا الفرق
   * عند قراءة أي تقرير قديم.
   */
  companyShare: number;
  marginPct: number;
}

export function computeFactoryCost(costs: OrderCosts): number {
  return costs.costCarton + costs.costMold + costs.costPlate + costs.costShipping;
}

/**
 * المعادلات كما في القسم 4.2 من الوثيقة، مع توزيع صافي الربح على أربع
 * جهات بدل جهتين.
 *
 * يقبل الوسيط الثالث نسبة المندوب وحدها (رقمًا) للتوافق مع الاستدعاءات
 * القديمة — وعندها تُكمَّل بقية النسب من التوزيع الافتراضي بحيث يبقى
 * المجموع 100%.
 */
export function computeOrderFinancials(
  factoryCost: number,
  clientPrice: number,
  splitOrRepPct: ProfitSplit | number = DEFAULT_SPLIT,
): OrderFinancials {
  const split =
    typeof splitOrRepPct === "number"
      ? normalizeSplitFromRepPct(splitOrRepPct)
      : splitOrRepPct;

  const profit = clientPrice - factoryCost;
  const profitExVat = profit / (1 + VAT_RATE);
  const vatDue = profit - profitExVat;

  const repShare = profitExVat * (split.repPct / 100);
  const ownerShare = profitExVat * (split.ownerPct / 100);
  const partnerShare = profitExVat * (split.partnerPct / 100);
  const companyShare = profitExVat * (split.companyPct / 100);

  const marginPct = clientPrice !== 0 ? (profit / clientPrice) * 100 : 0;

  return {
    factoryCost,
    clientPrice,
    profit,
    profitExVat,
    vatDue,
    split,
    repSharePct: split.repPct,
    repShare,
    ownerShare,
    partnerShare,
    companyShare,
    marginPct,
  };
}

/**
 * يبني توزيعًا كاملًا من نسبة المندوب وحدها: يوزّع ما تبقّى على المالك
 * والشريك والشركة بنفس تناسب التوزيع الافتراضي (20/20/10)، فيبقى
 * المجموع 100% مهما كانت نسبة المندوب.
 */
export function normalizeSplitFromRepPct(repPct: number): ProfitSplit {
  const remainder = 100 - repPct;
  const defaultRemainder =
    DEFAULT_OWNER_SHARE_PCT + DEFAULT_PARTNER_SHARE_PCT + DEFAULT_COMPANY_SHARE_PCT;

  if (defaultRemainder === 0) {
    return { repPct, ownerPct: 0, partnerPct: 0, companyPct: remainder };
  }

  const scale = remainder / defaultRemainder;
  const ownerPct = DEFAULT_OWNER_SHARE_PCT * scale;
  const partnerPct = DEFAULT_PARTNER_SHARE_PCT * scale;
  // الشركة تأخذ الباقي بالضبط حتى لا يضيع كسر في التقريب
  const companyPct = remainder - ownerPct - partnerPct;

  return { repPct, ownerPct, partnerPct, companyPct };
}

export function computeOrderFinancialsFromCosts(
  costs: OrderCosts,
  clientPrice: number,
  splitOrRepPct: ProfitSplit | number = DEFAULT_SPLIT,
): OrderFinancials {
  return computeOrderFinancials(computeFactoryCost(costs), clientPrice, splitOrRepPct);
}

/** رصيد المندوب = مجموع حصصه من الطلبات المكتملة − مجموع مسحوباته. لا يُخزَّن، يُحسب لحظيًا. */
export function computeRepBalance(totalRepShare: number, totalWithdrawals: number): number {
  return totalRepShare - totalWithdrawals;
}

/** مؤشر تركّز العملاء: نسبة أكبر عميل وأكبر 3 عملاء من إجمالي المبيعات. */
export function computeClientConcentration(
  clientSales: number[],
  totalSales: number,
): { topClientPct: number; top3ClientsPct: number } {
  if (totalSales === 0) return { topClientPct: 0, top3ClientsPct: 0 };
  const sorted = [...clientSales].sort((a, b) => b - a);
  const top1 = sorted[0] ?? 0;
  const top3 = sorted.slice(0, 3).reduce((s, v) => s + v, 0);
  return {
    topClientPct: (top1 / totalSales) * 100,
    top3ClientsPct: (top3 / totalSales) * 100,
  };
}

export const LOW_MARGIN_THRESHOLD_PCT = 12;
export const CRITICAL_LOW_MARGIN_THRESHOLD_PCT = 10;

export function isLowMargin(marginPct: number): boolean {
  return marginPct < LOW_MARGIN_THRESHOLD_PCT;
}

export function isCriticallyLowMargin(marginPct: number): boolean {
  return marginPct < CRITICAL_LOW_MARGIN_THRESHOLD_PCT;
}
