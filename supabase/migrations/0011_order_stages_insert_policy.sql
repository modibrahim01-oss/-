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
