-- ════════════════════════════════════════════════════════════════════════
-- محاكاة بيئة Supabase على Postgres محلي، لتشغيل ملفات الترحيل واختبارات
-- العزل كما تعمل فعلًا على الخادم: schema auth، الدالة auth.uid()، والأدوار
-- anon و authenticated و service_role.
--
-- ليس جزءًا من النشر — يُستخدم في الاختبارات وحدها.
-- ════════════════════════════════════════════════════════════════════════

create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at         timestamptz default now()
);

-- auth.uid() في Supabase يقرأ مطالبة sub من رمز JWT. نحاكيه بإعداد جلسة
-- قابل للضبط من الاختبار: set local request.jwt.claim.sub = '<uuid>'
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;
