-- محاكاة بيئة Supabase على Postgres عادي، لتشغيل اختبارات RLS محليًا
-- بدون الحاجة لمشروع Supabase. لا تُشغَّل هذه على قاعدة الإنتاج.

create extension if not exists "pgcrypto";

create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

-- في Supabase تقرأ auth.uid() هوية المستخدم من ادعاءات JWT.
-- هنا نقرأها من إعداد جلسة حتى نستطيع "تسجيل الدخول" كمستخدم في الاختبار.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('test.user_id', true), '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$$;

create table if not exists storage.buckets (
  id               text primary key,
  name             text not null,
  public           boolean not null default false,
  file_size_limit  bigint,
  created_at       timestamptz not null default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets(id),
  name       text not null,
  owner      uuid,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

grant usage on schema public, auth, storage to anon, authenticated;
