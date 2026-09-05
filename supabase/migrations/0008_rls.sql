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
