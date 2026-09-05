/**
 * محرك الحساب المالي — القسم 4 من وثيقة المواصفات.
 * كل مبالغ الشراء والبيع مُدخَلة شاملة ضريبة القيمة المضافة 15%.
 * احسب بدقة كاملة داخليًا، وقرّب للعرض فقط. لا تخزّن قيمًا مقرّبة.
 */

export const VAT_RATE = 0.15;
export const DEFAULT_REP_SHARE_PCT = 50;

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
  repSharePct: number;
  repShare: number;
  companyShare: number;
  marginPct: number;
}

export function computeFactoryCost(costs: OrderCosts): number {
  return costs.costCarton + costs.costMold + costs.costPlate + costs.costShipping;
}

/**
 * يطبّق المعادلات حرفيًا كما في القسم 4.2 من الوثيقة.
 * repSharePct هي نسبة المندوب (0-100)، افتراضيًا 50 لكل المندوبين (users.share_pct).
 */
export function computeOrderFinancials(
  factoryCost: number,
  clientPrice: number,
  repSharePct: number = DEFAULT_REP_SHARE_PCT,
): OrderFinancials {
  const profit = clientPrice - factoryCost;
  const profitExVat = profit / (1 + VAT_RATE);
  const vatDue = profit - profitExVat;
  const repShare = profitExVat * (repSharePct / 100);
  const companyShare = profitExVat - repShare;
  const marginPct = clientPrice !== 0 ? (profit / clientPrice) * 100 : 0;

  return {
    factoryCost,
    clientPrice,
    profit,
    profitExVat,
    vatDue,
    repSharePct,
    repShare,
    companyShare,
    marginPct,
  };
}

export function computeOrderFinancialsFromCosts(
  costs: OrderCosts,
  clientPrice: number,
  repSharePct: number = DEFAULT_REP_SHARE_PCT,
): OrderFinancials {
  return computeOrderFinancials(computeFactoryCost(costs), clientPrice, repSharePct);
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
