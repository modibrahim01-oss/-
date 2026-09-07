-- ============================================================
-- إتقان المقاس — كل ملفات قاعدة البيانات مجمّعة في ملف واحد
-- ============================================================
-- الاستخدام: افتح مشروعك في Supabase ← SQL Editor ← New query،
-- الصق هذا الملف كاملًا، ثم اضغط Run. يُنفَّذ مرة واحدة فقط.
--
-- هذا الملف مولَّد آليًا من supabase/migrations/ بالترتيب الرقمي.
-- لا تعدّله يدويًا — عدّل الملفات الأصلية وأعد توليده بـ:
--   ./scripts/build-schema.sh
-- ============================================================


-- ══════════════════════════════════════════════════════════
-- 0001_extensions_and_users.sql
-- ══════════════════════════════════════════════════════════

-- 0001: Extensions + جدول المستخدمين
create extension if not exists "pgcrypto";

create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  phone       text,
  role        text not null check (role in ('admin', 'rep')),
  share_pct   numeric(5,2) not null default 50,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.users is 'حسابات المستخدمين: مشرف واحد أو أكثر، ومندوبون. id يطابق auth.users.id';
comment on column public.users.share_pct is 'نسبة المندوب من صافي الربح بعد الضريبة، افتراضيًا 50%، قابلة للتعديل من المشرف لكل مندوب';

create index if not exists idx_users_role on public.users(role);

-- دالة تساعد سياسات RLS على معرفة دور المستخدم الحالي دون إعادة تشغيل RLS
-- (security definer + search_path ثابت لمنع hijacking)
create or replace function public.current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select role from public.users where id = auth.uid()) = 'admin', false);
$$;

-- ══════════════════════════════════════════════════════════
-- 0002_clients.sql
-- ══════════════════════════════════════════════════════════

-- 0002: العملاء + دالة تطبيع الأسماء (name_normalized)

-- تطبيع اسم العميل: NFKC، إزالة التشكيل، توحيد الهمزات/التاء المربوطة،
-- توحيد الفواصل، ضغط المسافات، وإزالة الأرقام اللاحقة.
-- يطابق منطق src/lib/normalize.ts (normalizeClientName) لضمان اتساق النتيجة
-- بين التطبيق وقاعدة البيانات.
create or replace function public.normalize_client_name(raw text)
returns text
language plpgsql
immutable
as $$
declare
  s text;
begin
  if raw is null then
    return '';
  end if;

  s := normalize(raw, nfkc);

  -- إزالة رموز اتجاه النص الخفية (RLM/LRM وما شابه)
  s := regexp_replace(s, '[‎‏‪-‮]', '', 'g');

  -- إزالة حركات التشكيل العربية
  s := regexp_replace(s, '[ً-ٰۖ-ۭ]', '', 'g');

  -- توحيد الهمزات والألف المقصورة والتاء المربوطة
  s := translate(s, 'أإآاىةؤئ', 'اااايهوي');

  -- توحيد الفواصل الشائعة إلى مسافة
  s := regexp_replace(s, '[.:،,]', ' ', 'g');

  -- ضغط المسافات
  s := btrim(regexp_replace(s, '\s+', ' ', 'g'));

  -- إزالة الأرقام اللاحقة في نهاية الاسم
  s := btrim(regexp_replace(s, '\s*\d+$', ''));

  return s;
end;
$$;

create table if not exists public.clients (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  name_normalized  text not null,
  phone            text,
  city             text,
  vat_number       text,
  owner_id         uuid references public.users(id),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on column public.clients.owner_id is 'المندوب المسؤول عن العميل. يمكن أن يكون فارغًا لعملاء غير مُسندين (يديرهم المشرف فقط).';

-- منع تكرار العميل بنفس الاسم المطبَّع (يمنع "حذوه" و"أ.خالد : حذوه" كسجلين منفصلين لو كانا متطابقين فعليًا بعد التطبيع)
create unique index if not exists uq_clients_name_normalized on public.clients (name_normalized);

create index if not exists idx_clients_owner on public.clients(owner_id);

create or replace function public.set_client_normalized_name()
returns trigger
language plpgsql
as $$
begin
  new.name := normalize(new.name, nfkc);
  new.name_normalized := public.normalize_client_name(new.name);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_clients_normalize on public.clients;
create trigger trg_clients_normalize
  before insert or update on public.clients
  for each row execute function public.set_client_normalized_name();

-- ══════════════════════════════════════════════════════════
-- 0003_orders_and_stages.sql
-- ══════════════════════════════════════════════════════════

-- 0003: الطلبات + مراحل الحالة + عرض الحسابات المالية

create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    bigserial,
  client_id       uuid not null references public.clients(id),
  rep_id          uuid not null references public.users(id),
  -- تاريخ التعميد: يُسمح بأن يكون فارغًا للصفقات القديمة المستوردة بدون تاريخ
  -- (القسم 8: "استوردها بـ order_date = null ولا تخترع تواريخ"). أي طلب بلا
  -- تاريخ يُعتبر تلقائيًا "يحتاج مراجعة" حتى يكمّله المشرف.
  order_date      date,

  cost_carton     numeric(14,4) not null default 0,
  cost_mold       numeric(14,4) not null default 0,
  cost_plate      numeric(14,4) not null default 0,
  cost_shipping   numeric(14,4) not null default 0,
  factory_cost    numeric(14,4) generated always as
                    (cost_carton + cost_mold + cost_plate + cost_shipping) stored,
  client_price    numeric(14,4) not null,

  -- نسبة حصة المندوب وقت إنشاء الطلب (لقطة من users.share_pct) — تعديل
  -- المشرف لنسبة المندوب لاحقًا لا يغيّر عمولات الطلبات القديمة تلقائيًا.
  rep_share_pct   numeric(5,2) not null default 50,

  factory_name    text,
  status          text not null default 'active'
                    check (status in ('draft', 'active', 'completed', 'cancelled')),

  needs_review    boolean not null default false,
  review_reason   text,
  import_note     text,

  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

comment on column public.orders.needs_review is 'يُعلَّم تلقائيًا عند غياب التاريخ أو عند تعارض بيانات أثناء الاستيراد؛ يظهر في شاشة "يحتاج مراجعة" حتى يعتمده المشرف.';

create index if not exists idx_orders_rep on public.orders(rep_id);
create index if not exists idx_orders_client on public.orders(client_id);
create index if not exists idx_orders_date on public.orders(order_date);
create index if not exists idx_orders_needs_review on public.orders(needs_review) where needs_review;
create index if not exists idx_orders_not_deleted on public.orders(id) where deleted_at is null;

create or replace function public.orders_set_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.order_date is null then
    new.needs_review := true;
    new.review_reason := coalesce(new.review_reason, 'تاريخ مفقود');
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_orders_defaults on public.orders;
create trigger trg_orders_defaults
  before insert or update on public.orders
  for each row execute function public.orders_set_defaults();

-- مراحل حالة الطلب (7 مراحل، لكل واحدة: لم يبدأ / جاري / تم)
create table if not exists public.order_stages (
  order_id    uuid not null references public.orders(id) on delete cascade,
  stage       text not null check (stage in
                ('plate', 'mold', 'processing', 'ordered_from_factory',
                 'carton_ready', 'shipped', 'received')),
  state       text not null default 'not_yet'
                check (state in ('not_yet', 'in_progress', 'done')),
  changed_at  timestamptz,
  changed_by  uuid references public.users(id),
  primary key (order_id, stage)
);

create or replace function public.orders_seed_stages()
returns trigger
language plpgsql
as $$
declare
  s text;
begin
  foreach s in array array['plate','mold','processing','ordered_from_factory','carton_ready','shipped','received']
  loop
    insert into public.order_stages (order_id, stage, state)
    values (new.id, s, 'not_yet')
    on conflict (order_id, stage) do nothing;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_orders_seed_stages on public.orders;
create trigger trg_orders_seed_stages
  after insert on public.orders
  for each row execute function public.orders_seed_stages();

create or replace function public.order_stages_touch()
returns trigger
language plpgsql
as $$
begin
  if new.state is distinct from old.state then
    new.changed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_order_stages_touch on public.order_stages;
create trigger trg_order_stages_touch
  before update on public.order_stages
  for each row execute function public.order_stages_touch();

-- عرض الحسابات المالية للطلب: يطابق حرفيًا المعادلات في القسم 4.2 من الوثيقة
-- (src/lib/finance.ts). يُحسب بدقة كاملة في كل استعلام، ولا يُخزَّن مقرَّبًا.
-- security_invoker=true إلزامي: بدونه ستُنفَّذ الاستعلامات عبر هذا العرض
-- بصلاحيات مالك العرض (postgres) متجاوِزةً RLS تمامًا، وهذا بالضبط ما يمنعه
-- القسم 2 من الوثيقة ("العزل على مستوى قاعدة البيانات لا الإخفاء بالواجهة").
create or replace view public.order_financials
with (security_invoker = true)
as
select
  o.id,
  o.order_number,
  o.client_id,
  o.rep_id,
  o.order_date,
  o.factory_cost,
  o.client_price,
  o.rep_share_pct,
  o.status,
  o.needs_review,
  o.deleted_at,
  (o.client_price - o.factory_cost) as profit,
  (o.client_price - o.factory_cost) / 1.15 as profit_ex_vat,
  (o.client_price - o.factory_cost) - (o.client_price - o.factory_cost) / 1.15 as vat_due,
  ((o.client_price - o.factory_cost) / 1.15) * (o.rep_share_pct / 100) as rep_share,
  ((o.client_price - o.factory_cost) / 1.15) * (1 - o.rep_share_pct / 100) as company_share,
  case when o.client_price <> 0
    then (o.client_price - o.factory_cost) / o.client_price * 100
    else 0
  end as margin_pct
from public.orders o;

-- ══════════════════════════════════════════════════════════
-- 0004_payments_withdrawals_attachments.sql
-- ══════════════════════════════════════════════════════════

-- 0004: المدفوعات، المسحوبات، المرفقات، وتسويات "بدون طلب" (adjustments)

create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  amount      numeric(14,4) not null,
  paid_at     date not null,
  method      text,
  note        text,
  created_by  uuid references public.users(id),
  created_at  timestamptz not null default now()
);

create index if not exists idx_payments_order on public.payments(order_id);

create table if not exists public.withdrawals (
  id            uuid primary key default gen_random_uuid(),
  rep_id        uuid not null references public.users(id),
  amount        numeric(14,4) not null,
  withdrawn_at  date not null,
  note          text,
  created_by    uuid references public.users(id),
  created_at    timestamptz not null default now()
);

create index if not exists idx_withdrawals_rep on public.withdrawals(rep_id);

create table if not exists public.attachments (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  file_path    text not null,
  file_name    text not null,
  kind         text not null check (kind in
                 ('plate_design', 'factory_invoice', 'client_invoice', 'shipping', 'other')),
  uploaded_by  uuid references public.users(id),
  uploaded_at  timestamptz not null default now()
);

create index if not exists idx_attachments_order on public.attachments(order_id);

-- تسويات ربح بدون طلب/عميل — مثل قيد الـ20,000 ريال في الإكسل القديم بدون
-- عميل ولا تكلفة ولا مبيعات. لا تُستورد كطلب أبدًا (القسم 8)، بل تبقى هنا
-- "معلّقة" حتى يبتّ فيها المشرف. مرئية للمشرف فقط.
create table if not exists public.adjustments (
  id               uuid primary key default gen_random_uuid(),
  profit           numeric(14,4) not null,
  profit_ex_vat    numeric(14,4) not null,
  rep_share_pct    numeric(5,2) not null default 50,
  rep_id           uuid references public.users(id),
  status           text not null default 'pending_review'
                     check (status in ('pending_review', 'confirmed', 'rejected')),
  note             text,
  source           text not null default 'manual' check (source in ('manual', 'import')),
  created_by       uuid references public.users(id),
  created_at       timestamptz not null default now(),
  resolved_by      uuid references public.users(id),
  resolved_at      timestamptz
);

-- ══════════════════════════════════════════════════════════
-- 0005_audit_log.sql
-- ══════════════════════════════════════════════════════════

-- 0005: سجل التدقيق — يُملأ حصرًا عبر Postgres trigger، وليس بكود التطبيق،
-- حتى لا يمكن تجاوزه (إلزامي في القسم 5 من الوثيقة).

create table if not exists public.audit_log (
  id           bigserial primary key,
  table_name   text not null,
  record_id    uuid not null,
  action       text not null check (action in ('insert', 'update', 'delete')),
  changed_by   uuid references public.users(id),
  changed_at   timestamptz not null default now(),
  old_values   jsonb,
  new_values   jsonb
);

create index if not exists idx_audit_log_table_record on public.audit_log(table_name, record_id);
create index if not exists idx_audit_log_changed_by on public.audit_log(changed_by);
create index if not exists idx_audit_log_changed_at on public.audit_log(changed_at);

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (table_name, record_id, action, changed_by, new_values)
    values (tg_table_name, new.id, 'insert', auth.uid(), to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_log (table_name, record_id, action, changed_by, old_values, new_values)
    values (tg_table_name, new.id, 'update', auth.uid(), to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (table_name, record_id, action, changed_by, old_values)
    values (tg_table_name, old.id, 'delete', auth.uid(), to_jsonb(old));
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_audit_orders on public.orders;
create trigger trg_audit_orders
  after insert or update or delete on public.orders
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_payments on public.payments;
create trigger trg_audit_payments
  after insert or update or delete on public.payments
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_withdrawals on public.withdrawals;
create trigger trg_audit_withdrawals
  after insert or update or delete on public.withdrawals
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_clients on public.clients;
create trigger trg_audit_clients
  after insert or update or delete on public.clients
  for each row execute function public.audit_row_change();

-- ══════════════════════════════════════════════════════════
-- 0006_import_staging.sql
-- ══════════════════════════════════════════════════════════

-- 0006: جداول الاستيراد المرحلي (staging) — القسم 8: شاشة الاستيراد
-- ثلاث خطوات: رفع → معاينة مع تمييز المشاكل → تأكيد. لا يُكتب أي شيء في
-- orders/clients/withdrawals إلا بعد أن يراجع المشرف كل صف ويقرر مصيره.

create table if not exists public.import_batches (
  id            uuid primary key default gen_random_uuid(),
  file_name     text not null,
  uploaded_by   uuid references public.users(id),
  uploaded_at   timestamptz not null default now(),
  status        text not null default 'previewed'
                  check (status in ('previewed', 'confirmed', 'discarded')),
  confirmed_at  timestamptz,
  confirmed_by  uuid references public.users(id)
);

create table if not exists public.import_rows (
  id                 uuid primary key default gen_random_uuid(),
  batch_id           uuid not null references public.import_batches(id) on delete cascade,
  src_row            int not null,
  raw                jsonb not null,
  client_name_raw    text,
  client_name_normalized text,
  -- تصنيف تلقائي أثناء المعاينة: ok=جاهز للاستيراد كطلب عادي،
  -- missing_date=بلا تاريخ، conflict=تعارض أرقام مع مصدر آخر،
  -- duplicate=تكرار محتمل، adjustment=قيد ربح بدون عميل/تكلفة، error=صف تالف
  classification     text not null check (classification in
                        ('ok', 'missing_date', 'conflict', 'duplicate', 'adjustment', 'error')),
  issue_note         text,
  -- قرار المشرف بعد المعاينة؛ يبقى NULL حتى يُحسم في شاشة التأكيد
  decision           text check (decision in ('import', 'import_as_adjustment', 'skip')),
  created_order_id       uuid references public.orders(id),
  created_adjustment_id  uuid references public.adjustments(id),
  created_at         timestamptz not null default now()
);

create index if not exists idx_import_rows_batch on public.import_rows(batch_id);

-- مسحوبات قديمة مرحّلة من الإكسل (القسم 8: 37,950 ريال، منها دفعة 17,950)
-- تُسجَّل مباشرة في withdrawals بتاريخ الاستيراد وملاحظة "رصيد مرحّل من
-- الإكسل"، لأنها ليست بحاجة لنفس مراجعة المعاينة التي تحتاجها الطلبات.

-- ══════════════════════════════════════════════════════════
-- 0007_notifications.sql
-- ══════════════════════════════════════════════════════════

-- 0007: طبقة التنبيهات — إشعارات داخل التطبيق + بريد (Resend)، مصمّمة لتوسّع
-- قناة واتساب لاحقًا بدون إعادة كتابة (القسم 7.2).

create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id),
  type          text not null check (type in
                  ('order_status_changed', 'order_created', 'payment_overdue',
                   'stage_stuck', 'low_margin_alert')),
  title         text not null,
  body          text,
  data          jsonb not null default '{}'::jsonb,
  channels      text[] not null default array['in_app'],
  related_table text,
  related_id    uuid,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id, read_at);

-- ══════════════════════════════════════════════════════════
-- 0008_rls.sql
-- ══════════════════════════════════════════════════════════

-- 0008: سياسات Row Level Security — القسم 2 و5.3 من الوثيقة.
-- إلزامي: العزل بين المندوبين على مستوى قاعدة البيانات، لا بإخفاء الواجهة.
-- المندوب لا يملك أي صلاحية SELECT على users عدا صفّه هو.

alter table public.users            enable row level security;
alter table public.clients          enable row level security;
alter table public.orders           enable row level security;
alter table public.order_stages     enable row level security;
alter table public.payments         enable row level security;
alter table public.withdrawals      enable row level security;
alter table public.attachments      enable row level security;
alter table public.adjustments      enable row level security;
alter table public.audit_log        enable row level security;
alter table public.import_batches   enable row level security;
alter table public.import_rows      enable row level security;
alter table public.notifications    enable row level security;

-- ===================== users =====================
-- المشرف يرى الجميع. المندوب يرى صفّه فقط ولا يرى قائمة المستخدمين.
drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select using (public.is_admin() or id = auth.uid());

drop policy if exists users_admin_write on public.users;
create policy users_admin_write on public.users
  for insert with check (public.is_admin());

drop policy if exists users_admin_update on public.users;
create policy users_admin_update on public.users
  for update using (public.is_admin() or id = auth.uid())
  with check (
    public.is_admin()
    -- مندوب يمكنه تعديل بياناته الشخصية فقط (لا الدور ولا نسبته)
    or (id = auth.uid() and role = (select role from public.users where id = auth.uid())
        and share_pct = (select share_pct from public.users where id = auth.uid()))
  );

-- ===================== clients =====================
drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients
  for select using (public.is_admin() or owner_id = auth.uid());

drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients
  for insert with check (public.is_admin() or owner_id = auth.uid());

drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients
  for update using (public.is_admin() or owner_id = auth.uid());

-- لا حذف نهائي لأي عميل من الواجهة العادية؛ المشرف فقط عبر أدوات صيانة مباشرة

-- ===================== orders =====================
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select using (public.is_admin() or rep_id = auth.uid());

-- المندوب يستطيع إنشاء طلب فقط لعميل هو مالكه (owner_id = auth.uid())
drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
  for insert with check (
    public.is_admin()
    or (
      rep_id = auth.uid()
      and exists (
        select 1 from public.clients c
        where c.id = client_id and c.owner_id = auth.uid()
      )
    )
  );

-- المندوب لا يملك صلاحية الحذف إطلاقًا (القسم 9)؛ soft delete عبر deleted_at
-- من المشرف فقط. المندوب يستطيع تعديل تفاصيل طلباته (تكاليف/سعر/ملاحظات)
-- لكن ليس تغيير rep_id أو حذفها نهائيًا.
drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders
  for update using (
    public.is_admin()
    or (rep_id = auth.uid() and deleted_at is null)
  )
  with check (
    public.is_admin()
    or (rep_id = auth.uid() and deleted_at is null)
  );

drop policy if exists orders_delete on public.orders;
create policy orders_delete on public.orders
  for delete using (public.is_admin());

-- ===================== order_stages =====================
drop policy if exists order_stages_select on public.order_stages;
create policy order_stages_select on public.order_stages
  for select using (
    public.is_admin()
    or exists (select 1 from public.orders o where o.id = order_id and o.rep_id = auth.uid())
  );

drop policy if exists order_stages_update on public.order_stages;
create policy order_stages_update on public.order_stages
  for update using (
    public.is_admin()
    or exists (select 1 from public.orders o where o.id = order_id and o.rep_id = auth.uid())
  );

-- ===================== payments =====================
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select using (
    public.is_admin()
    or exists (select 1 from public.orders o where o.id = order_id and o.rep_id = auth.uid())
  );

drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments
  for insert with check (
    public.is_admin()
    or exists (select 1 from public.orders o where o.id = order_id and o.rep_id = auth.uid())
  );

-- ===================== withdrawals =====================
-- المندوب يرى مسحوباته فقط، ولا يملك صلاحية إنشائها (المشرف فقط يسجّلها)
drop policy if exists withdrawals_select on public.withdrawals;
create policy withdrawals_select on public.withdrawals
  for select using (public.is_admin() or rep_id = auth.uid());

drop policy if exists withdrawals_admin_write on public.withdrawals;
create policy withdrawals_admin_write on public.withdrawals
  for insert with check (public.is_admin());

drop policy if exists withdrawals_admin_update on public.withdrawals;
create policy withdrawals_admin_update on public.withdrawals
  for update using (public.is_admin());

-- ===================== attachments =====================
drop policy if exists attachments_select on public.attachments;
create policy attachments_select on public.attachments
  for select using (
    public.is_admin()
    or exists (select 1 from public.orders o where o.id = order_id and o.rep_id = auth.uid())
  );

drop policy if exists attachments_insert on public.attachments;
create policy attachments_insert on public.attachments
  for insert with check (
    public.is_admin()
    or exists (select 1 from public.orders o where o.id = order_id and o.rep_id = auth.uid())
  );

-- ===================== adjustments =====================
-- بنود التسوية (مثل قيد الـ20,000 اليتيم) مرئية للمشرف فقط
drop policy if exists adjustments_admin_all on public.adjustments;
create policy adjustments_admin_all on public.adjustments
  for all using (public.is_admin()) with check (public.is_admin());

-- ===================== audit_log =====================
-- المشرف فقط يرى سجل التدقيق الكامل. لا صلاحية إدراج/تعديل من التطبيق
-- إطلاقًا؛ الإدراج حصرًا عبر trigger بصلاحيات security definer.
drop policy if exists audit_log_admin_select on public.audit_log;
create policy audit_log_admin_select on public.audit_log
  for select using (public.is_admin());

-- ===================== import_batches / import_rows =====================
-- أداة الاستيراد للمشرف فقط
drop policy if exists import_batches_admin_all on public.import_batches;
create policy import_batches_admin_all on public.import_batches
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists import_rows_admin_all on public.import_rows;
create policy import_rows_admin_all on public.import_rows
  for all using (public.is_admin()) with check (public.is_admin());

-- ===================== notifications =====================
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select using (public.is_admin() or user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════
-- 0009_storage.sql
-- ══════════════════════════════════════════════════════════

-- 0009: مخزن المرفقات (Supabase Storage) — القسم 7.3
-- الحاوية خاصة (public=false)، والوصول للملف مربوط بنفس صلاحيات الطلب:
-- نخزّن الملفات تحت المسار attachments/<order_id>/<file>، ونتحقق من ملكية
-- الطلب (rep_id = auth.uid()) أو أن المستخدم مشرف.

insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 10485760) -- 10MB
on conflict (id) do nothing;

create or replace function public.storage_order_id_from_path(object_name text)
returns uuid
language sql
immutable
as $$
  select nullif(split_part(object_name, '/', 1), '')::uuid;
$$;

drop policy if exists attachments_storage_select on storage.objects;
create policy attachments_storage_select on storage.objects
  for select using (
    bucket_id = 'attachments'
    and (
      public.is_admin()
      or exists (
        select 1 from public.orders o
        where o.id = public.storage_order_id_from_path(name)
          and o.rep_id = auth.uid()
      )
    )
  );

drop policy if exists attachments_storage_insert on storage.objects;
create policy attachments_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'attachments'
    and (
      public.is_admin()
      or exists (
        select 1 from public.orders o
        where o.id = public.storage_order_id_from_path(name)
          and o.rep_id = auth.uid()
      )
    )
  );

drop policy if exists attachments_storage_delete on storage.objects;
create policy attachments_storage_delete on storage.objects
  for delete using (bucket_id = 'attachments' and public.is_admin());

-- ══════════════════════════════════════════════════════════
-- 0010_auth_trigger.sql
-- ══════════════════════════════════════════════════════════

-- 0010: عند إنشاء حساب Auth جديد (من الخادم عبر service role)، أنشئ تلقائيًا
-- صفّه في public.users من raw_user_meta_data. يمرَّر full_name/role/share_pct
-- كـ user_metadata في استدعاء supabase.auth.admin.createUser من إجراء الخادم
-- (لا يمكن لمندوب إنشاء حسابات بنفسه — هذا محصور بالمشرف عبر service role).

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, full_name, phone, role, share_pct)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email, 'مستخدم جديد'),
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'role', 'rep'),
    coalesce((new.raw_user_meta_data->>'share_pct')::numeric, 50)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_handle_new_auth_user on auth.users;
create trigger trg_handle_new_auth_user
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ══════════════════════════════════════════════════════════
-- 0011_order_stages_insert_policy.sql
-- ══════════════════════════════════════════════════════════

-- 0011: سياسة إدراج مراحل الطلب
--
-- المراحل السبع تُنشأ عبر trigger (orders_seed_stages) يعمل بصلاحيات
-- المستخدم المُدرِج لا بصلاحيات مالك الدالة. وبما أن RLS مفعّل على
-- order_stages بلا سياسة إدراج، كان كل إنشاء طلب يُرفض بالخطأ:
--   new row violates row-level security policy for table "order_stages"
-- أي أن زر "حفظ الطلب" كان معطّلًا للمندوب والمشرف معًا.
--
-- الشرط يطابق سياستَي select/update على الجدول نفسه: المشرف، أو صاحب
-- الطلب. الاستعلام الفرعي على orders يمرّ بسياسة orders_select، والطلب
-- المُدرَج للتوّ مرئي لصاحبه داخل المعاملة نفسها.

drop policy if exists order_stages_insert on public.order_stages;
create policy order_stages_insert on public.order_stages
  for insert with check (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_id and o.rep_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════
-- 0012_harden_storage_path.sql
-- ══════════════════════════════════════════════════════════

-- 0012: تحصين استخراج معرّف الطلب من مسار ملف التخزين
--
-- النسخة السابقة كانت تحوّل الجزء الأول من المسار إلى uuid مباشرة، فأي
-- كائن في الحاوية لا يبدأ بمعرّف طلب صالح (ملف يرفعه المشرف يدويًا من
-- لوحة Supabase مثلًا) يجعل التحويل يرمي خطأً أثناء تقييم سياسة التخزين،
-- فتتعطّل قراءة المرفقات كلها لا ذلك الملف وحده.
--
-- الآن: يُعاد NULL للمسارات غير الصالحة، فتمنعها السياسة بهدوء بدل أن
-- تنفجر.

create or replace function public.storage_order_id_from_path(object_name text)
returns uuid
language sql
immutable
as $$
  select case
    when split_part(object_name, '/', 1) ~
         '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then split_part(object_name, '/', 1)::uuid
  end;
$$;
