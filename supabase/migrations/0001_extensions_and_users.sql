-- 0001: Extensions + جدول المستخدمين
create extension if not exists "pgcrypto";

create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  phone       text,
  role        text not null check (role in ('admin', 'rep')),
  share_pct   numeric(5,2) not null default 50,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.users is 'حسابات المستخدمين: مشرف واحد أو أكثر، ومندوبون. id يطابق auth.users.id';
comment on column public.users.share_pct is 'نسبة المندوب من صافي الربح بعد الضريبة، افتراضيًا 50%، قابلة للتعديل من المشرف لكل مندوب';

create index if not exists idx_users_role on public.users(role);

-- دالة تساعد سياسات RLS على معرفة دور المستخدم الحالي دون إعادة تشغيل RLS
-- (security definer + search_path ثابت لمنع hijacking)
create or replace function public.current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select role from public.users where id = auth.uid()) = 'admin', false);
$$;
