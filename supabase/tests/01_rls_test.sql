-- اختبارات العزل الإلزامية (القسم 11 من الوثيقة).
-- تُشغَّل بعد 00_supabase_shim.sql وكل ملفات supabase/migrations.
-- كل اختبار يفشل بصوت عالٍ عبر raise exception إن اختلّ العزل.

\set ON_ERROR_STOP on

-- ===================== تهيئة البيانات =====================
-- الإدراج هنا بصلاحيات المالك (postgres) الذي يتجاوز RLS — هذا مقصود
-- لتجهيز الحالة، والاختبار الفعلي يجري لاحقًا بدور authenticated.

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'admin@test.local',
   '{"full_name":"أبو أيمن","role":"admin","share_pct":50}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', 'repa@test.local',
   '{"full_name":"مندوب أ","role":"rep","share_pct":50}'::jsonb),
  ('33333333-3333-3333-3333-333333333333', 'repb@test.local',
   '{"full_name":"مندوب ب","role":"rep","share_pct":50}'::jsonb);

-- trigger على auth.users يفترض أن ينشئ صفوف public.users تلقائيًا
do $$
begin
  if (select count(*) from public.users) <> 3 then
    raise exception 'فشل: trigger إنشاء المستخدمين لم ينشئ 3 صفوف (أنشأ %)',
      (select count(*) from public.users);
  end if;
  if (select role from public.users where id = '11111111-1111-1111-1111-111111111111') <> 'admin' then
    raise exception 'فشل: دور المشرف لم يُقرأ من raw_user_meta_data';
  end if;
  if (select share_pct from public.users where id = '22222222-2222-2222-2222-222222222222') <> 50 then
    raise exception 'فشل: النسبة الافتراضية ليست 50';
  end if;
end
$$;

insert into public.clients (id, name, name_normalized, owner_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'عميل المندوب أ', 'placeholder-a',
   '22222222-2222-2222-2222-222222222222'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'عميل المندوب ب', 'placeholder-b',
   '33333333-3333-3333-3333-333333333333');

-- trigger التطبيع يفترض أن يعيد كتابة name_normalized متجاهلًا القيمة الممرَّرة
do $$
begin
  if (select name_normalized from public.clients
      where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'placeholder-a' then
    raise exception 'فشل: trigger التطبيع لم يحسب name_normalized';
  end if;
end
$$;

-- طلب المندوب أ بأرقام حقيقية من seed-orders.csv (Dr. Mohammed Alqurashi)
insert into public.orders (id, client_id, rep_id, order_date, cost_carton, client_price, rep_share_pct)
values ('11111111-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001',
        '22222222-2222-2222-2222-222222222222', '2026-01-04', 4916.14, 5709.06, 50);

-- طلب المندوب ب (شركة حقول الربيع)
insert into public.orders (id, client_id, rep_id, order_date, cost_carton, client_price, rep_share_pct)
values ('22222222-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000002',
        '33333333-3333-3333-3333-333333333333', '2025-07-09', 86351.51, 95130.3, 50);

-- طلب بلا تاريخ: يجب أن يُعلَّم تلقائيًا "يحتاج مراجعة"
insert into public.orders (id, client_id, rep_id, order_date, cost_carton, client_price)
values ('33333333-0000-0000-0000-00000000000c', 'aaaaaaaa-0000-0000-0000-000000000001',
        '22222222-2222-2222-2222-222222222222', null, 4596.87, 5430.48);

do $$
begin
  if not (select needs_review from public.orders
          where id = '33333333-0000-0000-0000-00000000000c') then
    raise exception 'فشل: الطلب بلا تاريخ لم يُعلَّم needs_review';
  end if;
  if (select review_reason from public.orders
      where id = '33333333-0000-0000-0000-00000000000c') <> 'تاريخ مفقود' then
    raise exception 'فشل: سبب المراجعة غير مضبوط';
  end if;
end
$$;

-- trigger إنشاء المراحل السبع لكل طلب
do $$
begin
  if (select count(*) from public.order_stages
      where order_id = '11111111-0000-0000-0000-00000000000a') <> 7 then
    raise exception 'فشل: لم تُنشأ المراحل السبع تلقائيًا';
  end if;
end
$$;

insert into public.withdrawals (rep_id, amount, withdrawn_at, note)
values ('22222222-2222-2222-2222-222222222222', 100, '2026-02-01', 'مسحوبات المندوب أ');

-- ===================== اختبار الحساب المالي =====================
do $$
declare
  f record;
begin
  select * into f from public.order_financials
  where id = '11111111-0000-0000-0000-00000000000a';

  if round(f.profit, 2) <> 792.92 then
    raise exception 'فشل: الربح المحسوب % بدل 792.92', round(f.profit, 2);
  end if;
  if round(f.profit_ex_vat, 2) <> 689.50 then
    raise exception 'فشل: الربح بدون ضريبة % بدل 689.50', round(f.profit_ex_vat, 2);
  end if;
  if round(f.rep_share, 2) <> 344.75 then
    raise exception 'فشل: حصة المندوب % بدل 344.75', round(f.rep_share, 2);
  end if;
  -- الحصص الأربع (مندوب + مالك + شريك + شركة) مجموعها الربح بعد الضريبة
  if round(f.rep_share + f.owner_share + f.partner_share + f.company_share
           - f.profit_ex_vat, 6) <> 0 then
    raise exception 'فشل: مجموع الحصص الأربع لا يساوي الربح بعد الضريبة';
  end if;
  if round(f.vat_due + f.profit_ex_vat - f.profit, 6) <> 0 then
    raise exception 'فشل: الضريبة + الربح بدون ضريبة لا يساوي الربح';
  end if;
end
$$;

-- ===================== اختبار سجل التدقيق =====================
update public.orders set client_price = 6000
where id = '11111111-0000-0000-0000-00000000000a';

do $$
declare
  entry record;
begin
  select * into entry from public.audit_log
  where table_name = 'orders'
    and record_id = '11111111-0000-0000-0000-00000000000a'
    and action = 'update'
  order by changed_at desc limit 1;

  if entry is null then
    raise exception 'فشل: تعديل المبلغ لم يُسجَّل في audit_log';
  end if;
  if (entry.old_values->>'client_price')::numeric <> 5709.06 then
    raise exception 'فشل: القيمة القديمة غير مسجّلة (%)', entry.old_values->>'client_price';
  end if;
  if (entry.new_values->>'client_price')::numeric <> 6000 then
    raise exception 'فشل: القيمة الجديدة غير مسجّلة';
  end if;
end
$$;

-- أعِد القيمة الأصلية لبقية الاختبارات
update public.orders set client_price = 5709.06
where id = '11111111-0000-0000-0000-00000000000a';

-- ===================== منح الصلاحيات لدور authenticated =====================
grant usage on schema public to authenticated;
grant select, insert, update on all tables in schema public to authenticated;
grant select on public.order_financials to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ===================== اختبارات العزل الفعلية =====================
set role authenticated;

-- --- المندوب أ ---
set "test.user_id" = '22222222-2222-2222-2222-222222222222';

do $$
declare
  visible_orders int;
  other_rep_orders int;
begin
  select count(*) into visible_orders from public.orders;
  select count(*) into other_rep_orders from public.orders
  where rep_id <> '22222222-2222-2222-2222-222222222222';

  if other_rep_orders <> 0 then
    raise exception 'فشل حرج: المندوب أ يرى % من طلبات مندوب آخر', other_rep_orders;
  end if;
  if visible_orders <> 2 then
    raise exception 'فشل: المندوب أ يرى % طلبًا بدل طلبيه', visible_orders;
  end if;
end
$$;

-- العرض المالي يجب أن يخضع لنفس RLS (security_invoker)
do $$
declare
  n int;
begin
  select count(*) into n from public.order_financials
  where rep_id <> '22222222-2222-2222-2222-222222222222';
  if n <> 0 then
    raise exception 'فشل حرج: العرض order_financials يسرّب % صفًا من مندوب آخر', n;
  end if;
end
$$;

-- لا يستطيع رؤية إجماليات الشركة: أي تجميع يعيد أرقامه هو فقط
do $$
declare
  total numeric;
begin
  select coalesce(sum(client_price), 0) into total from public.orders;
  -- 5709.06 + 5430.48 = 11139.54 (طلباه فقط، لا 95130.3 الخاصة بالمندوب ب)
  if round(total, 2) <> 11139.54 then
    raise exception 'فشل حرج: إجمالي مبيعات مرئي للمندوب = % (متوقع 11139.54)', round(total, 2);
  end if;
end
$$;

-- لا يرى قائمة المستخدمين عدا صفّه
do $$
declare
  n int;
begin
  select count(*) into n from public.users;
  if n <> 1 then
    raise exception 'فشل حرج: المندوب يرى % مستخدمًا بدل صفّه فقط', n;
  end if;
  if (select id from public.users) <> '22222222-2222-2222-2222-222222222222' then
    raise exception 'فشل: الصف المرئي ليس صف المندوب نفسه';
  end if;
end
$$;

-- لا يرى عملاء مندوب آخر
do $$
declare
  n int;
begin
  select count(*) into n from public.clients;
  if n <> 1 then
    raise exception 'فشل حرج: المندوب يرى % عميلًا بدل عميله الوحيد', n;
  end if;
end
$$;

-- لا يرى سجل التدقيق إطلاقًا
do $$
declare
  n int;
begin
  select count(*) into n from public.audit_log;
  if n <> 0 then
    raise exception 'فشل حرج: المندوب يرى % صفًا من سجل التدقيق', n;
  end if;
end
$$;

-- لا يرى مسحوبات مندوب آخر، ويرى مسحوباته
do $$
declare
  n int;
begin
  select count(*) into n from public.withdrawals;
  if n <> 1 then
    raise exception 'فشل: المندوب يرى % مسحوبات بدل مسحوباته', n;
  end if;
end
$$;

-- لا يستطيع إنشاء مسحوبات لنفسه (المشرف فقط)
do $$
begin
  begin
    insert into public.withdrawals (rep_id, amount, withdrawn_at)
    values ('22222222-2222-2222-2222-222222222222', 99999, '2026-03-01');
    raise exception 'فشل حرج: المندوب استطاع تسجيل مسحوبات لنفسه';
  exception
    when insufficient_privilege then null;  -- السلوك الصحيح
  end;
end
$$;

-- لا يستطيع إنشاء طلب لعميل مندوب آخر
do $$
begin
  begin
    insert into public.orders (client_id, rep_id, order_date, cost_carton, client_price)
    values ('bbbbbbbb-0000-0000-0000-000000000002',
            '22222222-2222-2222-2222-222222222222', '2026-03-01', 100, 200);
    raise exception 'فشل حرج: المندوب أنشأ طلبًا لعميل مندوب آخر';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

-- لا يستطيع إنشاء طلب باسم مندوب آخر
do $$
begin
  begin
    insert into public.orders (client_id, rep_id, order_date, cost_carton, client_price)
    values ('aaaaaaaa-0000-0000-0000-000000000001',
            '33333333-3333-3333-3333-333333333333', '2026-03-01', 100, 200);
    raise exception 'فشل حرج: المندوب أنشأ طلبًا منسوبًا لمندوب آخر';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

-- لا يستطيع تعديل طلب مندوب آخر (التحديث يجب ألا يصيب أي صف)
do $$
declare
  affected int;
begin
  update public.orders set client_price = 1
  where id = '22222222-0000-0000-0000-00000000000b';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'فشل حرج: المندوب عدّل طلب مندوب آخر';
  end if;
end
$$;

-- لا يستطيع الحذف النهائي إطلاقًا
do $$
declare
  affected int;
begin
  begin
    delete from public.orders where id = '11111111-0000-0000-0000-00000000000a';
    get diagnostics affected = row_count;
    if affected <> 0 then
      raise exception 'فشل حرج: المندوب حذف طلبًا نهائيًا';
    end if;
  exception
    when insufficient_privilege then null;
  end;
end
$$;

-- لا يرى بنود التسوية (adjustments) الخاصة بالمشرف
do $$
declare
  n int;
begin
  select count(*) into n from public.adjustments;
  if n <> 0 then
    raise exception 'فشل: المندوب يرى بنود تسوية';
  end if;
end
$$;

-- --- المندوب ب: نفس العزل بالاتجاه المعاكس ---
set "test.user_id" = '33333333-3333-3333-3333-333333333333';

do $$
declare
  n int;
begin
  select count(*) into n from public.orders
  where rep_id <> '33333333-3333-3333-3333-333333333333';
  if n <> 0 then
    raise exception 'فشل حرج: المندوب ب يرى طلبات المندوب أ';
  end if;
  if (select count(*) from public.orders) <> 1 then
    raise exception 'فشل: المندوب ب لا يرى طلبه الوحيد';
  end if;
end
$$;

-- --- المشرف: يرى كل شيء ---
set "test.user_id" = '11111111-1111-1111-1111-111111111111';

do $$
begin
  if (select count(*) from public.orders) <> 3 then
    raise exception 'فشل: المشرف يرى % طلبًا بدل 3', (select count(*) from public.orders);
  end if;
  if (select count(*) from public.users) <> 3 then
    raise exception 'فشل: المشرف لا يرى كل المستخدمين';
  end if;
  if (select count(*) from public.clients) <> 2 then
    raise exception 'فشل: المشرف لا يرى كل العملاء';
  end if;
  if (select count(*) from public.audit_log) = 0 then
    raise exception 'فشل: المشرف لا يرى سجل التدقيق';
  end if;
  if (select count(*) from public.withdrawals) <> 1 then
    raise exception 'فشل: المشرف لا يرى المسحوبات';
  end if;
end
$$;

-- المشرف يستطيع تسجيل مسحوبات لأي مندوب
insert into public.withdrawals (rep_id, amount, withdrawn_at, note)
values ('33333333-3333-3333-3333-333333333333', 250, '2026-03-01', 'من المشرف');

-- رصيد المندوب = مجموع حصصه − مجموع مسحوباته
do $$
declare
  share_sum numeric;
  withdrawn_sum numeric;
begin
  select coalesce(sum(rep_share), 0) into share_sum
  from public.order_financials
  where rep_id = '22222222-2222-2222-2222-222222222222';

  select coalesce(sum(amount), 0) into withdrawn_sum
  from public.withdrawals
  where rep_id = '22222222-2222-2222-2222-222222222222';

  if round(share_sum - withdrawn_sum, 2) <> round(share_sum - 100, 2) then
    raise exception 'فشل: معادلة الرصيد غير صحيحة';
  end if;
end
$$;

-- ===================== تحويل العملاء بين المندوبين =====================
-- الضمان: المشرف وحده يحوّل العميل. المندوب لا يستطيع التنازل عن عميله ولا
-- الاستيلاء على عميل غيره. وبعد التحويل تبقى الطلبات السابقة (وعمولاتها)
-- منسوبة لمندوبها الأصلي.

-- --- المندوب أ يحاول التنازل عن عميله للمندوب ب ---
set "test.user_id" = '22222222-2222-2222-2222-222222222222';

-- نسجّل عدد طلبات المندوب أ لهذا العميل قبل التحويل، لنقارن به بعده بدل
-- توقّع رقم ثابت يتغيّر كلما أُضيف طلب لبيانات الاختبار
do $$
begin
  perform set_config('test.rep_a_orders_before',
    (select count(*)::text from public.orders
     where client_id = 'aaaaaaaa-0000-0000-0000-000000000001'), false);
end
$$;

do $$
declare
  n int;
begin
  update public.clients
    set owner_id = '33333333-3333-3333-3333-333333333333'
    where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'فشل حرج: المندوب أ نجح في تحويل عميله لمندوب آخر';
  end if;
exception
  when insufficient_privilege or check_violation then
    null; -- الرفض بخطأ مقبول أيضًا
end
$$;

-- --- المندوب ب يحاول الاستيلاء على عميل المندوب أ ---
set "test.user_id" = '33333333-3333-3333-3333-333333333333';

do $$
declare
  n int;
begin
  update public.clients
    set owner_id = '33333333-3333-3333-3333-333333333333'
    where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'فشل حرج: المندوب ب استولى على عميل المندوب أ';
  end if;
exception
  when insufficient_privilege or check_violation then
    null;
end
$$;

-- --- المشرف يحوّل عميل المندوب أ إلى المندوب ب ---
set "test.user_id" = '11111111-1111-1111-1111-111111111111';

do $$
declare
  n int;
begin
  update public.clients
    set owner_id = '33333333-3333-3333-3333-333333333333'
    where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'فشل: المشرف لم يستطع تحويل العميل';
  end if;
end
$$;

-- --- بعد التحويل: المندوب ب يرى العميل، والمندوب أ لم يعد يراه ---
set "test.user_id" = '33333333-3333-3333-3333-333333333333';

do $$
begin
  if (select count(*) from public.clients
      where id = 'aaaaaaaa-0000-0000-0000-000000000001') <> 1 then
    raise exception 'فشل: المندوب ب لا يرى العميل المحوَّل إليه';
  end if;
  -- الطلب القديم يبقى للمندوب أ ولا يظهر للمندوب ب رغم امتلاكه العميل الآن
  if (select count(*) from public.orders
      where client_id = 'aaaaaaaa-0000-0000-0000-000000000001') <> 0 then
    raise exception 'فشل حرج: تحويل العميل سرّب طلبات المندوب أ للمندوب ب';
  end if;
end
$$;

set "test.user_id" = '22222222-2222-2222-2222-222222222222';

do $$
begin
  if (select count(*) from public.clients
      where id = 'aaaaaaaa-0000-0000-0000-000000000001') <> 0 then
    raise exception 'فشل: المندوب أ ما زال يرى العميل بعد تحويله';
  end if;
  -- لكن طلباته السابقة وعمولتها تبقى له
  if (select count(*) from public.orders
      where client_id = 'aaaaaaaa-0000-0000-0000-000000000001')
     <> current_setting('test.rep_a_orders_before')::int then
    raise exception 'فشل: التحويل غيّر عدد طلبات المندوب أ السابقة (كان % والآن %)',
      current_setting('test.rep_a_orders_before'),
      (select count(*) from public.orders
       where client_id = 'aaaaaaaa-0000-0000-0000-000000000001');
  end if;
  if round((select sum(rep_share) from public.order_financials
            where rep_id = '22222222-2222-2222-2222-222222222222'), 2) <= 0 then
    raise exception 'فشل: عمولة المندوب أ السابقة ضاعت بعد التحويل';
  end if;
end
$$;

-- ===================== إنشاء طلب فعليًا (مسار الكتابة) =====================
-- الاختبارات أعلاه تتحقق من القراءة والمنع. هذا يتحقق من نجاح المسار
-- الأساسي: ضغط المندوب على "حفظ الطلب". كان يفشل قبل الترحيل 0011 لأن
-- trigger إنشاء المراحل يعمل بصلاحيات المستخدم و order_stages بلا سياسة
-- إدراج — أي أن أهم زر في النظام كان معطّلًا.

-- المندوب ب صار مالك العميل بعد التحويل أعلاه
set "test.user_id" = '33333333-3333-3333-3333-333333333333';

do $$
declare
  new_id uuid;
  stage_count int;
begin
  insert into public.orders (client_id, rep_id, order_date, cost_carton, client_price, rep_share_pct)
  values ('aaaaaaaa-0000-0000-0000-000000000001',
          '33333333-3333-3333-3333-333333333333',
          '2026-05-01', 1000, 1500, 50)
  returning id into new_id;

  select count(*) into stage_count from public.order_stages where order_id = new_id;
  if stage_count <> 7 then
    raise exception 'فشل: أُنشئت % مرحلة بدل 7 عند إنشاء الطلب', stage_count;
  end if;

  -- وتحديث المرحلة يعمل أيضًا (شريط المراحل في شاشة التفاصيل)
  update public.order_stages set state = 'done'
  where order_id = new_id and stage = 'plate';
  if (select state from public.order_stages
      where order_id = new_id and stage = 'plate') <> 'done' then
    raise exception 'فشل: المندوب لا يستطيع تحديث مرحلة طلبه';
  end if;
end
$$;

-- المشرف أيضًا يستطيع إنشاء طلب (نيابةً عن مندوب)
set "test.user_id" = '11111111-1111-1111-1111-111111111111';

do $$
declare
  new_id uuid;
begin
  insert into public.orders (client_id, rep_id, order_date, cost_carton, client_price, rep_share_pct)
  values ('bbbbbbbb-0000-0000-0000-000000000002',
          '33333333-3333-3333-3333-333333333333',
          '2026-05-02', 2000, 2500, 50)
  returning id into new_id;

  if (select count(*) from public.order_stages where order_id = new_id) <> 7 then
    raise exception 'فشل: المشرف لا يستطيع إنشاء طلب بمراحله';
  end if;
end
$$;

reset role;

select 'كل اختبارات العزل والحساب نجحت ✓' as result;
