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
