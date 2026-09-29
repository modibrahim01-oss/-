import type { Tier } from "./tiers";

export type UserRole = "admin" | "group_supervisor" | "committee_supervisor";

export type Group = {
  id: number;
  code: string;
  name_ar: string;
  name_en: string;
  stage_ar: string;
  stage_en: string;
  sort_order: number;
};

export type Semester = {
  id: string;
  name_ar: string;
  name_en: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  archived_at: string | null;
};

export type StaffUser = {
  id: string;
  full_name_ar: string;
  full_name_en: string | null;
  role: UserRole;
  is_active: boolean;
};

export type Student = {
  id: string;
  full_name: string;
  group_id: number;
  grade: string | null;
  is_active: boolean;
  next_slot_index: number;
};

/** صف من العرض student_farms — ملخّص جاهز للعرض العام. */
export type StudentFarmSummary = {
  student_id: string;
  full_name: string;
  /** الاسم المطبَّع الذي يبحث عليه مربّع البحث العام */
  search_name: string;
  group_id: number;
  group_code: string;
  group_name_ar: string;
  group_name_en: string;
  grade: string | null;
  semester_id: string;
  total_points: number;
  plant_count: number;
};

/** نبتة واحدة على الشبكة — ما ترسمه FarmScene. */
export type Plant = {
  slot_index: number;
  grid_x: number;
  grid_y: number;
  tier: Tier;
  points: number;
  awarded_at: string;
};

export type LedgerEntry = Plant & {
  id: number;
  student_id: string;
  supervisor_id: string;
};

/** حصّة المشرف اليومية من فئة واحدة، بعدد النبتات. -1 = بلا حد (المدير). */
export type TierAllowance = { limit: number; used: number; remaining: number };

export type DailyStatus = {
  role: UserRole | null;
  /**
   * الحد بالنقاط — شكل ما قبل 0007، يبقى ليعمل الموقع على قاعدة لم يُشغَّل
   * عليها الترحيل بعد. -1 يعني بلا حد (المدير).
   */
  limit: number;
  used: number;
  remaining: number;
  /** الحد بعدد النبتات لكل فئة (0007). وجوده يعني أن الواجهة تعرض العدّادات. */
  tiers?: Record<Tier, TierAllowance>;
};

export type AwardResult = {
  ledger_id: number;
  slot_index: number;
  grid_x: number;
  grid_y: number;
  points: number;
  tier: Tier;
};

/** بند من رصيد اللجنة القيمية: كم نبتة من الفئة، وكم وُزِّع منها. */
export type GrantItem = { tier: Tier; quantity: number; used: number };

/** رصيد «نقاط إضافية من اللجنة القيمية» كما تعيده my_grants (0007). */
export type CommitteeGrant = {
  id: number;
  title: string;
  note: string | null;
  status: "locked" | "active" | "cancelled";
  created_at: string;
  unlocked_at: string | null;
  direction: "in" | "out";
  sender_ar: string;
  sender_en: string | null;
  recipient_ar: string;
  recipient_en: string | null;
  items: GrantItem[];
};

export type GrantRecipient = {
  id: string;
  full_name_ar: string;
  full_name_en: string | null;
  groups_ar: string | null;
  groups_en: string | null;
};
