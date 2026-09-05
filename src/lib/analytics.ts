import type { OrderWithClient } from "@/lib/data";
import type { MonthPoint } from "@/components/MonthlyChart";

const AR_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  return `${AR_MONTHS[Number(month) - 1]} ${year.slice(2)}`;
}

/** سلسلة آخر N أشهر (تشمل الشهر الحالي) بمبيعات وأرباح كل شهر. */
export function buildMonthlySeries(orders: OrderWithClient[], months = 6): MonthPoint[] {
  const now = new Date();
  const buckets = new Map<string, { sales: number; profit: number }>();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.set(monthKey(d), { sales: 0, profit: 0 });
  }

  for (const order of orders) {
    if (!order.order_date) continue;
    const key = order.order_date.slice(0, 7);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.sales += order.client_price;
    bucket.profit += order.profit;
  }

  return [...buckets.entries()].map(([key, value]) => ({
    label: monthLabel(key),
    sales: Number(value.sales.toFixed(2)),
    profit: Number(value.profit.toFixed(2)),
  }));
}

export function isInCurrentMonth(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const now = new Date();
  return dateStr.slice(0, 7) === monthKey(now);
}

export interface Totals {
  count: number;
  sales: number;
  cost: number;
  profit: number;
  profitExVat: number;
  vatDue: number;
  repShare: number;
  companyShare: number;
  avgMarginPct: number;
}

export function sumOrders(orders: OrderWithClient[]): Totals {
  const totals = orders.reduce(
    (acc, o) => {
      acc.count += 1;
      acc.sales += o.client_price;
      acc.cost += o.factory_cost;
      acc.profit += o.profit;
      acc.profitExVat += o.profit_ex_vat;
      acc.vatDue += o.vat_due;
      acc.repShare += o.rep_share;
      acc.companyShare += o.company_share;
      return acc;
    },
    {
      count: 0,
      sales: 0,
      cost: 0,
      profit: 0,
      profitExVat: 0,
      vatDue: 0,
      repShare: 0,
      companyShare: 0,
      avgMarginPct: 0,
    } as Totals,
  );

  // متوسط الهامش محسوب على الإجماليات لا كمتوسط حسابي للنسب،
  // حتى لا تُشوّه الطلبات الصغيرة الصورة.
  totals.avgMarginPct = totals.sales !== 0 ? (totals.profit / totals.sales) * 100 : 0;
  return totals;
}

export interface ClientAggregate {
  clientId: string;
  clientName: string;
  ordersCount: number;
  sales: number;
  profit: number;
  marginPct: number;
}

export function aggregateByClient(orders: OrderWithClient[]): ClientAggregate[] {
  const map = new Map<string, ClientAggregate>();

  for (const order of orders) {
    const id = order.client_id;
    const existing = map.get(id) ?? {
      clientId: id,
      clientName: order.client?.name ?? "—",
      ordersCount: 0,
      sales: 0,
      profit: 0,
      marginPct: 0,
    };
    existing.ordersCount += 1;
    existing.sales += order.client_price;
    existing.profit += order.profit;
    map.set(id, existing);
  }

  const list = [...map.values()];
  for (const agg of list) {
    agg.marginPct = agg.sales !== 0 ? (agg.profit / agg.sales) * 100 : 0;
  }
  return list.sort((a, b) => b.sales - a.sales);
}
