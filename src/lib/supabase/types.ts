export type UserRole = "admin" | "rep";

export interface UserRow {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  share_pct: number;
  is_active: boolean;
  created_at: string;
}

export interface ClientRow {
  id: string;
  name: string;
  name_normalized: string;
  phone: string | null;
  city: string | null;
  vat_number: string | null;
  owner_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type OrderStatus = "draft" | "active" | "completed" | "cancelled";

export interface OrderRow {
  id: string;
  order_number: number;
  client_id: string;
  rep_id: string;
  order_date: string | null;
  cost_carton: number;
  cost_mold: number;
  cost_plate: number;
  cost_shipping: number;
  factory_cost: number;
  client_price: number;
  rep_share_pct: number;
  owner_share_pct: number;
  partner_share_pct: number;
  company_share_pct: number;
  factory_name: string | null;
  status: OrderStatus;
  needs_review: boolean;
  review_reason: string | null;
  import_note: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface OrderFinancialsRow {
  id: string;
  order_number: number;
  client_id: string;
  rep_id: string;
  order_date: string | null;
  factory_cost: number;
  client_price: number;
  rep_share_pct: number;
  owner_share_pct: number;
  partner_share_pct: number;
  company_share_pct: number;
  status: OrderStatus;
  needs_review: boolean;
  deleted_at: string | null;
  profit: number;
  profit_ex_vat: number;
  vat_due: number;
  rep_share: number;
  owner_share: number;
  partner_share: number;
  company_share: number;
  margin_pct: number;
}

export type StageName =
  | "plate"
  | "mold"
  | "processing"
  | "ordered_from_factory"
  | "carton_ready"
  | "shipped"
  | "received";

export type StageState = "not_yet" | "in_progress" | "done";

export interface OrderStageRow {
  order_id: string;
  stage: StageName;
  state: StageState;
  changed_at: string | null;
  changed_by: string | null;
}

export interface PaymentRow {
  id: string;
  order_id: string;
  amount: number;
  paid_at: string;
  method: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface WithdrawalRow {
  id: string;
  rep_id: string;
  amount: number;
  withdrawn_at: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export type AttachmentKind =
  | "plate_design"
  | "factory_invoice"
  | "client_invoice"
  | "shipping"
  | "other";

export interface AttachmentRow {
  id: string;
  order_id: string;
  file_path: string;
  file_name: string;
  kind: AttachmentKind;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface AdjustmentRow {
  id: string;
  profit: number;
  profit_ex_vat: number;
  rep_share_pct: number;
  rep_id: string | null;
  status: "pending_review" | "confirmed" | "rejected";
  note: string | null;
  source: "manual" | "import";
  created_by: string | null;
  created_at: string;
  resolved_by: string | null;
  resolved_at: string | null;
}

export const STAGES: StageName[] = [
  "plate",
  "mold",
  "processing",
  "ordered_from_factory",
  "carton_ready",
  "shipped",
  "received",
];
