import { createClient } from "@/lib/supabase/server";
import type {
  AdjustmentRow,
  ClientRow,
  OrderFinancialsRow,
  OrderRow,
  OrderStageRow,
  PaymentRow,
  UserRow,
  WithdrawalRow,
} from "@/lib/supabase/types";

export interface OrderWithClient extends OrderFinancialsRow {
  client: { id: string; name: string } | null;
  rep?: { id: string; full_name: string } | null;
}

export interface OrderFilters {
  repId?: string;
  clientId?: string;
  from?: string;
  to?: string;
  status?: string;
  search?: string;
  needsReviewOnly?: boolean;
  maxMarginPct?: number;
}

/**
 * الطلبات مع أرقامها المالية المحسوبة في قاعدة البيانات (order_financials).
 * RLS يضمن أن استعلام المندوب لا يمكن أن يُرجع صف مندوب آخر حتى لو أُسقط
 * فلتر repId هنا — الفلتر هنا لتحديد نطاق الشاشة فقط، لا كإجراء أمني.
 */
export async function listOrders(filters: OrderFilters = {}): Promise<OrderWithClient[]> {
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select(
      `id, order_number, client_id, rep_id, order_date, factory_cost, client_price,
       rep_share_pct, owner_share_pct, partner_share_pct, company_share_pct,
       status, needs_review, review_reason, deleted_at, notes,
       client:clients(id, name), rep:users!orders_rep_id_fkey(id, full_name)`,
    )
    .is("deleted_at", null)
    .order("order_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filters.repId) query = query.eq("rep_id", filters.repId);
  if (filters.clientId) query = query.eq("client_id", filters.clientId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.from) query = query.gte("order_date", filters.from);
  if (filters.to) query = query.lte("order_date", filters.to);
  if (filters.needsReviewOnly) query = query.eq("needs_review", true);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as Array<
    OrderRow & { client: { id: string; name: string } | null; rep: { id: string; full_name: string } | null }
  >;

  let mapped = rows.map((row) => withFinancials(row));

  if (filters.search) {
    const needle = filters.search.trim();
    mapped = mapped.filter(
      (o) =>
        o.client?.name.includes(needle) || String(o.order_number).includes(needle),
    );
  }

  if (typeof filters.maxMarginPct === "number") {
    mapped = mapped.filter((o) => o.margin_pct < filters.maxMarginPct!);
  }

  return mapped;
}

/** يعيد حساب الأرقام المالية في الطبقة نفسها التي يستخدمها العرض SQL. */
function withFinancials(
  row: OrderRow & {
    client?: { id: string; name: string } | null;
    rep?: { id: string; full_name: string } | null;
  },
): OrderWithClient {
  const factoryCost = Number(row.factory_cost);
  const clientPrice = Number(row.client_price);
  const repSharePct = Number(row.rep_share_pct);
  const ownerSharePct = Number(row.owner_share_pct ?? 0);
  const partnerSharePct = Number(row.partner_share_pct ?? 0);
  const companySharePct = Number(row.company_share_pct ?? 0);
  const profit = clientPrice - factoryCost;
  const profitExVat = profit / 1.15;

  return {
    id: row.id,
    order_number: row.order_number,
    client_id: row.client_id,
    rep_id: row.rep_id,
    order_date: row.order_date,
    factory_cost: factoryCost,
    client_price: clientPrice,
    rep_share_pct: repSharePct,
    owner_share_pct: ownerSharePct,
    partner_share_pct: partnerSharePct,
    company_share_pct: companySharePct,
    status: row.status,
    needs_review: row.needs_review,
    deleted_at: row.deleted_at,
    profit,
    profit_ex_vat: profitExVat,
    vat_due: profit - profitExVat,
    rep_share: profitExVat * (repSharePct / 100),
    owner_share: profitExVat * (ownerSharePct / 100),
    partner_share: profitExVat * (partnerSharePct / 100),
    company_share: profitExVat * (companySharePct / 100),
    margin_pct: clientPrice !== 0 ? (profit / clientPrice) * 100 : 0,
    client: row.client ?? null,
    rep: row.rep ?? null,
  };
}

export async function getOrder(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `*, client:clients(id, name, phone, city), rep:users!orders_rep_id_fkey(id, full_name)`,
    )
    .eq("id", id)
    .single();

  if (error) return null;

  const row = data as unknown as OrderRow & {
    client: { id: string; name: string; phone: string | null; city: string | null } | null;
    rep: { id: string; full_name: string } | null;
  };

  return { raw: row, financials: withFinancials(row) };
}

export async function getOrderStages(orderId: string): Promise<OrderStageRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("order_stages")
    .select("*")
    .eq("order_id", orderId);
  return (data ?? []) as OrderStageRow[];
}

export async function getOrderPayments(orderId: string): Promise<PaymentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("*")
    .eq("order_id", orderId)
    .order("paid_at", { ascending: false });
  return (data ?? []) as PaymentRow[];
}

export async function getOrderAuditTrail(orderId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id, action, changed_at, changed_by, old_values, new_values, users:changed_by(full_name)")
    .eq("table_name", "orders")
    .eq("record_id", orderId)
    .order("changed_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

export async function listClients(ownerId?: string): Promise<ClientRow[]> {
  const supabase = await createClient();
  let query = supabase.from("clients").select("*").order("name");
  if (ownerId) query = query.eq("owner_id", ownerId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ClientRow[];
}

export interface ClientWithOwner extends ClientRow {
  owner: { id: string; full_name: string } | null;
  ordersCount: number;
}

/**
 * كل العملاء مع مندوبهم المسؤول وعدد طلباتهم — لشاشة إسناد/تحويل العملاء
 * (للمشرف). عدّ الطلبات يوضّح للمشرف كم طلبًا سيبقى منسوبًا للمندوب الأصلي
 * بعد التحويل.
 */
export async function listClientsWithOwners(): Promise<ClientWithOwner[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(`*, owner:users!clients_owner_id_fkey(id, full_name)`)
    .order("name");
  if (error) throw new Error(error.message);

  const clients = (data ?? []) as unknown as (ClientRow & {
    owner: { id: string; full_name: string } | null;
  })[];

  const { data: orderRows } = await supabase.from("orders").select("client_id");
  const counts = new Map<string, number>();
  for (const row of (orderRows ?? []) as { client_id: string }[]) {
    counts.set(row.client_id, (counts.get(row.client_id) ?? 0) + 1);
  }

  return clients.map((c) => ({ ...c, ordersCount: counts.get(c.id) ?? 0 }));
}

export async function getClient(id: string): Promise<ClientRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("*").eq("id", id).single();
  return (data as ClientRow) ?? null;
}

export async function listWithdrawals(repId?: string): Promise<WithdrawalRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("withdrawals")
    .select("*")
    .order("withdrawn_at", { ascending: false });
  if (repId) query = query.eq("rep_id", repId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as WithdrawalRow[];
}

export async function listUsers(): Promise<UserRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("users").select("*").order("full_name");
  if (error) throw new Error(error.message);
  return (data ?? []) as UserRow[];
}

export async function listAdjustments(): Promise<AdjustmentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("adjustments")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as AdjustmentRow[];
}

/** رصيد المندوب: مجموع حصصه من الطلبات المكتملة − مجموع مسحوباته (القسم 4.4). */
export async function getRepBalance(repId: string) {
  const orders = await listOrders({ repId });
  const withdrawals = await listWithdrawals(repId);

  const completedShare = orders
    .filter((o) => o.status === "completed")
    .reduce((sum, o) => sum + o.rep_share, 0);
  const allShare = orders.reduce((sum, o) => sum + o.rep_share, 0);
  const withdrawn = withdrawals.reduce((sum, w) => sum + Number(w.amount), 0);

  return {
    completedShare,
    allShare,
    withdrawn,
    balance: completedShare - withdrawn,
    orders,
    withdrawals,
  };
}
