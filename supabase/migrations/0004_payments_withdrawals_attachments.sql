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
