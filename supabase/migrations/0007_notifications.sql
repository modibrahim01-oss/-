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
