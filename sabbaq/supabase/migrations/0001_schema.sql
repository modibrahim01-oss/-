-- ════════════════════════════════════════════════════════════════════════
-- سبّاق — المخطط الأساسي
-- Sabbaq — core schema
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pg_trgm;

-- ── الأدوار ───────────────────────────────────────────────────────────────
create type user_role as enum (
  'admin',                 -- إدارة البرنامج: صلاحيات كاملة
  'group_supervisor',      -- مشرف مجموعة: مجموعاته فقط
  'committee_supervisor'   -- مشرف لجنة: كل الطلاب
);

create type point_tier as enum ('green', 'yellow', 'purple', 'red');

-- ── المجموعات ─────────────────────────────────────────────────────────────
create table groups (
  id          smallint primary key,
  code        text not null unique,
  name_ar     text not null,
  name_en     text not null,
  stage_ar    text not null,
  stage_en    text not null,
  sort_order  smallint not null
);

-- ── الفصول الدراسية ───────────────────────────────────────────────────────
create table semesters (
  id          uuid primary key default gen_random_uuid(),
  name_ar     text not null,
  name_en     text not null,
  start_date  date not null,
  end_date    date not null,
  is_active   boolean not null default false,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  constraint semester_dates check (end_date > start_date)
);

-- فصل واحد نشط فقط في أي وقت
create unique index one_active_semester on semesters (is_active) where is_active;

-- ── المستخدمون (المدير والمشرفون فقط — الطلاب لا يسجّلون دخولًا) ──────────
create table users (
  id           uuid primary key references auth.users on delete cascade,
  full_name_ar text not null,
  full_name_en text,
  role         user_role not null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ── إسناد مشرفي المجموعات إلى مجموعاتهم ───────────────────────────────────
create table supervisor_groups (
  supervisor_id uuid not null references users on delete cascade,
  group_id      smallint not null references groups on delete cascade,
  primary key (supervisor_id, group_id)
);

create index supervisor_groups_group_idx on supervisor_groups (group_id);

-- ── الطلاب ────────────────────────────────────────────────────────────────
create table students (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  -- اسم مُطبَّع (بلا تشكيل ولا همزات متغيّرة) للبحث؛ يُحدَّث بـ trigger
  search_name     text not null default '',
  group_id        smallint not null references groups,
  grade           text,
  is_active       boolean not null default true,
  -- عدّاد خانات الحلزون. يُقرأ ويُزاد داخل award_points فقط، تحت قفل صف،
  -- فلا يمكن لمشرفين متزامنين أن يحصلا على نفس الإحداثيات.
  next_slot_index integer not null default 0,
  created_at      timestamptz not null default now(),
  constraint next_slot_non_negative check (next_slot_index >= 0)
);

create index students_group_idx on students (group_id) where is_active;
create index students_search_idx on students using gin (search_name gin_trgm_ops);

-- ── حدود النقاط اليومية (يعدّلها المدير) ──────────────────────────────────
create table daily_limits (
  role          user_role primary key,
  points_perday integer not null,
  updated_by    uuid references users,
  updated_at    timestamptz not null default now(),
  constraint limit_non_negative check (points_perday >= 0)
);

-- ── سجل النقاط — المصدر الوحيد للحقيقة، append-only ───────────────────────
create table points_ledger (
  id            bigserial primary key,
  student_id    uuid not null references students on delete cascade,
  supervisor_id uuid not null references users,
  semester_id   uuid not null references semesters,
  points        smallint not null,
  tier          point_tier not null,
  -- خانة الحلزون والإحداثيات المشتقّة منها. تُحسب في قاعدة البيانات لا في
  -- العميل، فالطالب لا يضع نبتته أبدًا.
  slot_index    integer not null,
  grid_x        integer not null,
  grid_y        integer not null,
  awarded_at    timestamptz not null default now(),
  -- الإلغاء ناعم: المدير يستطيع سحب نقطة دون حذف السجل
  revoked_at    timestamptz,
  revoked_by    uuid references users,
  revoke_reason text,
  constraint points_allowed check (points in (10, 20, 30, 50)),
  constraint slot_non_negative check (slot_index >= 0),
  unique (student_id, semester_id, slot_index)
);

create index ledger_student_idx
  on points_ledger (student_id, semester_id)
  where revoked_at is null;

-- يخدم استعلام الحد اليومي: مجموع نقاط مشرف اليوم
create index ledger_supervisor_day_idx
  on points_ledger (supervisor_id, awarded_at)
  where revoked_at is null;

create index ledger_semester_idx on points_ledger (semester_id) where revoked_at is null;

-- ── أرشيف الفصول: لقطة كاملة تُحفظ قبل التصفير ───────────────────────────
create table semester_archives (
  id          uuid primary key default gen_random_uuid(),
  semester_id uuid not null references semesters,
  -- لقطة لكل طالب: الاسم والمجموعة والنقاط والنبتات
  snapshot    jsonb not null,
  created_by  uuid references users,
  created_at  timestamptz not null default now()
);

create index semester_archives_semester_idx on semester_archives (semester_id);

-- ── سجل التدقيق: كل تعديل إداري حسّاس ─────────────────────────────────────
create table audit_log (
  id         bigserial primary key,
  actor_id   uuid references users,
  action     text not null,
  entity     text not null,
  entity_id  text,
  details    jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_created_idx on audit_log (created_at desc);
