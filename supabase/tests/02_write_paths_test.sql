-- اختبارات مسارات الكتابة — كل عملية يقوم بها المستخدم فعليًا من الواجهة.
--
-- الاختبارات في 01 تغطّي القراءة والمنع: ماذا يرى المندوب وماذا يُمنع منه.
-- هذا الملف يغطّي الضدّ: هل تنجح العمليات التي *يجب* أن تنجح؟ غيابه هو ما
-- أخفى علة سياسة إدراج order_stages التي كانت تعطّل حفظ كل طلب.
--
-- يُشغَّل بعد 00_supabase_shim.sql وكل ملفات الترحيل (بيانات مستقلة عن 01).

\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('a1111111-1111-1111-1111-111111111111', 'admin2@test.local',
   '{"full_name":"المشرف","role":"admin","share_pct":50}'::jsonb),
  ('b2222222-2222-2222-2222-222222222222', 'rep1@test.local',
   '{"full_name":"مندوب الكتابة","role":"rep","share_pct":50}'::jsonb);

set role authenticated;

-- ===================== المندوب: إضافة عميل =====================
set "test.user_id" = 'b2222222-2222-2222-2222-222222222222';

do $$
declare
  cid uuid;
begin
  insert into public.clients (name, name_normalized, owner_id, city)
  values ('مؤسسة اختبار الكتابة', 'placeholder',
          'b2222222-2222-2222-2222-222222222222', 'الرياض')
  returning id into cid;

  -- trigger التطبيع يعيد كتابة name_normalized متجاهلًا القيمة الممرَّرة
  if (select name_normalized from public.clients where id = cid) = 'placeholder' then
    raise exception 'فشل: trigger التطبيع لم يعمل عند إضافة عميل من مندوب';
  end if;

  perform set_config('test.client_id', cid::text, false);
end
$$;

-- ===================== المندوب: إنشاء طلب =====================
do $$
declare
  oid uuid;
begin
  insert into public.orders (client_id, rep_id, order_date, cost_carton, cost_plate,
                             client_price, rep_share_pct)
  values (current_setting('test.client_id')::uuid,
          'b2222222-2222-2222-2222-222222222222',
          '2026-06-01', 4772.50, 0, 5536.10, 50)
  returning id into oid;

  if (select count(*) from public.order_stages where order_id = oid) <> 7 then
    raise exception 'فشل: مراحل الطلب السبع لم تُنشأ';
  end if;

  -- الأرقام المحسوبة تطابق seed-orders.csv (شام وقمر): ربح 763.60
  if round((select profit from public.order_financials where id = oid), 2) <> 763.60 then
    raise exception 'فشل: الربح المحسوب % بدل 763.60',
      (select round(profit, 2) from public.order_financials where id = oid);
  end if;
  if round((select rep_share from public.order_financials where id = oid), 2) <> 332.00 then
    raise exception 'فشل: حصة المندوب غير صحيحة';
  end if;

  perform set_config('test.order_id', oid::text, false);
end
$$;

-- ===================== المندوب: تحديث مرحلة =====================
do $$
begin
  update public.order_stages set state = 'in_progress'
  where order_id = current_setting('test.order_id')::uuid and stage = 'processing';

  if (select state from public.order_stages
      where order_id = current_setting('test.order_id')::uuid
        and stage = 'processing') <> 'in_progress' then
    raise exception 'فشل: تحديث مرحلة الطلب';
  end if;

  -- changed_at يُملأ تلقائيًا عند تغيّر الحالة
  if (select changed_at from public.order_stages
      where order_id = current_setting('test.order_id')::uuid
        and stage = 'processing') is null then
    raise exception 'فشل: changed_at لم يُملأ عند تغيير المرحلة';
  end if;
end
$$;

-- ===================== المندوب: تسجيل دفعة =====================
do $$
begin
  insert into public.payments (order_id, amount, paid_at, method, created_by)
  values (current_setting('test.order_id')::uuid, 2000, '2026-06-10', 'تحويل بنكي',
          'b2222222-2222-2222-2222-222222222222');

  if (select count(*) from public.payments
      where order_id = current_setting('test.order_id')::uuid) <> 1 then
    raise exception 'فشل: المندوب لا يستطيع تسجيل دفعة على طلبه';
  end if;
end
$$;

-- ===================== المندوب: تسجيل مرفق =====================
do $$
begin
  insert into public.attachments (order_id, file_path, file_name, kind, uploaded_by)
  values (current_setting('test.order_id')::uuid,
          current_setting('test.order_id') || '/1234-فاتورة.pdf',
          'فاتورة.pdf', 'factory_invoice',
          'b2222222-2222-2222-2222-222222222222');

  if (select count(*) from public.attachments
      where order_id = current_setting('test.order_id')::uuid) <> 1 then
    raise exception 'فشل: المندوب لا يستطيع تسجيل مرفق على طلبه';
  end if;
end
$$;

-- ===================== المندوب: تعديل طلبه =====================
do $$
begin
  update public.orders set client_price = 6000, notes = 'عُدّل من شاشة التعديل'
  where id = current_setting('test.order_id')::uuid;

  if (select client_price from public.orders
      where id = current_setting('test.order_id')::uuid) <> 6000 then
    raise exception 'فشل: المندوب لا يستطيع تعديل طلبه';
  end if;
end
$$;

-- ===================== المندوب: لا يملك الحذف إطلاقًا =====================
do $$
declare
  n int;
begin
  update public.orders set deleted_at = now()
  where id = current_setting('test.order_id')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'فشل حرج: المندوب استطاع حذف طلبه (soft delete)';
  end if;
exception
  when insufficient_privilege or check_violation then
    null;
end
$$;

-- ===================== سجل التدقيق سجّل كل ما سبق =====================
set "test.user_id" = 'a1111111-1111-1111-1111-111111111111';

do $$
declare
  insert_count int;
  update_count int;
  old_price numeric;
  new_price numeric;
begin
  select count(*) into insert_count from public.audit_log
  where table_name = 'orders' and action = 'insert'
    and record_id = current_setting('test.order_id')::uuid;
  if insert_count <> 1 then
    raise exception 'فشل: إنشاء الطلب لم يُسجَّل في سجل التدقيق';
  end if;

  select count(*) into update_count from public.audit_log
  where table_name = 'orders' and action = 'update'
    and record_id = current_setting('test.order_id')::uuid;
  if update_count = 0 then
    raise exception 'فشل: تعديل الطلب لم يُسجَّل في سجل التدقيق';
  end if;

  -- القيمة القديمة والجديدة مسجّلتان (متطلّب صريح في القسم 11)
  select (old_values->>'client_price')::numeric, (new_values->>'client_price')::numeric
  into old_price, new_price
  from public.audit_log
  where table_name = 'orders' and action = 'update'
    and record_id = current_setting('test.order_id')::uuid
    and old_values->>'client_price' is distinct from new_values->>'client_price'
  order by changed_at desc limit 1;

  if old_price <> 5536.10 or new_price <> 6000 then
    raise exception 'فشل: سجل التدقيق لم يحفظ القيمة القديمة والجديدة (% ← %)',
      old_price, new_price;
  end if;

  -- واسم من عدّلها
  if (select changed_by from public.audit_log
      where table_name = 'orders' and action = 'insert'
        and record_id = current_setting('test.order_id')::uuid)
     <> 'b2222222-2222-2222-2222-222222222222' then
    raise exception 'فشل: سجل التدقيق لم يحفظ هوية من نفّذ العملية';
  end if;
end
$$;

-- ===================== المشرف: الحذف الناعم متاح له =====================
do $$
begin
  update public.orders set deleted_at = now()
  where id = current_setting('test.order_id')::uuid;

  if (select deleted_at from public.orders
      where id = current_setting('test.order_id')::uuid) is null then
    raise exception 'فشل: المشرف لا يستطيع الحذف الناعم';
  end if;
end
$$;

-- ===================== دالة مسار التخزين لا تنفجر بمسار غير صالح =====================
do $$
begin
  if public.storage_order_id_from_path('ملف-رفعه-المشرف-يدويا.png') is not null then
    raise exception 'فشل: دالة مسار التخزين أعادت قيمة لمسار غير صالح';
  end if;
  if public.storage_order_id_from_path(
       'aaaaaaaa-0000-0000-0000-000000000001/file.pdf')
     <> 'aaaaaaaa-0000-0000-0000-000000000001'::uuid then
    raise exception 'فشل: دالة مسار التخزين لم تستخرج معرّف الطلب الصحيح';
  end if;
end
$$;

-- ===================== توزيع الربح على أربع جهات =====================
-- النموذج: المندوب الذي جاء بالعميل 50% · المالك 20% · الشريك 20% ·
-- الشركة 10%. يجب أن يطابق العرض SQL ما يحسبه src/lib/finance.ts.

do $$
declare
  oid uuid;
  f record;
begin
  insert into public.orders (client_id, rep_id, order_date, cost_carton,
                             client_price, rep_share_pct, owner_share_pct,
                             partner_share_pct, company_share_pct)
  values (current_setting('test.client_id')::uuid,
          'b2222222-2222-2222-2222-222222222222',
          '2026-07-01', 4772.50, 5536.10, 50, 20, 20, 10)
  returning id into oid;

  select * into f from public.order_financials where id = oid;

  -- نفس أرقام اختبار finance.test.ts لشام وقمر
  if round(f.profit_ex_vat, 2) <> 664.00 then
    raise exception 'فشل: الربح بعد الضريبة % بدل 664.00', round(f.profit_ex_vat, 2);
  end if;
  if round(f.rep_share, 2) <> 332.00 then
    raise exception 'فشل: حصة المندوب % بدل 332.00', round(f.rep_share, 2);
  end if;
  if round(f.owner_share, 2) <> 132.80 then
    raise exception 'فشل: حصة المالك % بدل 132.80', round(f.owner_share, 2);
  end if;
  if round(f.partner_share, 2) <> 132.80 then
    raise exception 'فشل: حصة الشريك % بدل 132.80', round(f.partner_share, 2);
  end if;
  if round(f.company_share, 2) <> 66.40 then
    raise exception 'فشل: حصة الشركة % بدل 66.40', round(f.company_share, 2);
  end if;

  -- مجموع الحصص الأربع = الربح بعد الضريبة بالضبط
  if round(f.rep_share + f.owner_share + f.partner_share + f.company_share, 6)
     <> round(f.profit_ex_vat, 6) then
    raise exception 'فشل: مجموع الحصص لا يساوي الربح بعد الضريبة';
  end if;
end
$$;

-- قيد قاعدة البيانات يرفض توزيعًا لا يساوي 100%
do $$
begin
  insert into public.orders (client_id, rep_id, order_date, cost_carton,
                             client_price, rep_share_pct, owner_share_pct,
                             partner_share_pct, company_share_pct)
  values (current_setting('test.client_id')::uuid,
          'b2222222-2222-2222-2222-222222222222',
          '2026-07-02', 1000, 1500, 50, 20, 20, 30);
  raise exception 'فشل حرج: قاعدة البيانات قبلت توزيعًا مجموعه 120%%';
exception
  when check_violation then
    null; -- الرفض هو المتوقّع
end
$$;

reset role;

select 'كل اختبارات مسارات الكتابة نجحت ✓' as result;
