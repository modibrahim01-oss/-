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
