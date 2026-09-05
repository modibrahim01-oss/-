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
