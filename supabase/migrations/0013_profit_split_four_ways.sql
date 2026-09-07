-- 0013: توزيع صافي الربح على أربع جهات بدل جهتين
--
-- نموذج صاحب العمل الفعلي: المندوب الذي جاء بالعميل 50% ، المالك 20% ،
-- الشريك 20% ، الشركة 10% — مجموعها 100% من الربح بعد الضريبة.
--
-- قبل هذا الترحيل كان العرض يحسب حصة الشركة على أنها «كل ما ليس للمندوب»،
-- فتختلط فيها حصة المالك والشريك. الآن لكل جهة عمود صريح.
--
-- كل طلب يحتفظ بنسخة من النسب وقت إنشائه (كما rep_share_pct)، فتعديل
-- التوزيع لاحقًا لا يعيد كتابة توزيع الطلبات القديمة.

alter table public.orders
  add column if not exists owner_share_pct   numeric(5,2) not null default 20,
  add column if not exists partner_share_pct numeric(5,2) not null default 20,
  add column if not exists company_share_pct numeric(5,2) not null default 10;

comment on column public.orders.owner_share_pct is 'حصة المالك (أبو أيمن) من صافي الربح بعد الضريبة';
comment on column public.orders.partner_share_pct is 'حصة الشريك من صافي الربح بعد الضريبة';
comment on column public.orders.company_share_pct is 'حصة الشركة (الاحتياطي) — ليست الباقي بعد المندوب';

-- الصفوف الموجودة: يُوضع الفارق في حصة الشركة حتى يصير المجموع 100%
-- بالضبط قبل تفعيل القيد (طلب بنسبة مندوب غير 50% لن يُرفض).
update public.orders
set company_share_pct = 100 - rep_share_pct - owner_share_pct - partner_share_pct
where rep_share_pct + owner_share_pct + partner_share_pct + company_share_pct <> 100;

alter table public.orders drop constraint if exists orders_shares_sum_100;
alter table public.orders add constraint orders_shares_sum_100
  check (rep_share_pct + owner_share_pct + partner_share_pct + company_share_pct = 100);

-- إعادة بناء العرض المالي بالحصص الأربع
drop view if exists public.order_financials;

create view public.order_financials
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
  o.owner_share_pct,
  o.partner_share_pct,
  o.company_share_pct,
  o.status,
  o.needs_review,
  o.deleted_at,
  (o.client_price - o.factory_cost) as profit,
  (o.client_price - o.factory_cost) / 1.15 as profit_ex_vat,
  (o.client_price - o.factory_cost) - (o.client_price - o.factory_cost) / 1.15 as vat_due,
  ((o.client_price - o.factory_cost) / 1.15) * (o.rep_share_pct / 100)     as rep_share,
  ((o.client_price - o.factory_cost) / 1.15) * (o.owner_share_pct / 100)   as owner_share,
  ((o.client_price - o.factory_cost) / 1.15) * (o.partner_share_pct / 100) as partner_share,
  ((o.client_price - o.factory_cost) / 1.15) * (o.company_share_pct / 100) as company_share,
  case when o.client_price <> 0
    then (o.client_price - o.factory_cost) / o.client_price * 100
    else 0
  end as margin_pct
from public.orders o;
