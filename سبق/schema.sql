-- ═══════════════════════════════════════════════════════════════
--  سَبْق — مجمع أبي يوسف القرآني
--  الصق هذا الملف كاملًا في: Supabase ← SQL Editor ← New query ← Run
--  آمن للتشغيل أكثر من مرة (لا يحذف بيانات موجودة).
--
--  ⚠️ قبل التشغيل: أنشئ حساب المشرف من Authentication ← Users
--     بالبريد admin@sabaq.local بالضبط (انظر دليل-الإعداد.md).
-- ═══════════════════════════════════════════════════════════════

-- ── 1) الجداول ──────────────────────────────────────────────────
create table if not exists public.program (
  id             text primary key default 'main',
  goal           int  not null default 10,
  cycle_length   int  not null default 20,
  cycle_start    date,
  points         jsonb not null default '{"half":50,"rev":150,"present":100,"late":50,"gen":75,"uni":25}'::jsonb,
  raffle_history jsonb not null default '[]'::jsonb
);

create table if not exists public.stages (
  id   uuid primary key default gen_random_uuid(),
  name text not null,
  sort bigint not null default 0
);

create table if not exists public.circles (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,
  stage_id uuid references public.stages(id) on delete set null,
  sort     bigint not null default 0
);

create table if not exists public.admins (
  id   uuid primary key references auth.users(id) on delete cascade,
  name text
);

create table if not exists public.teachers (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  email      text,
  circle_ids uuid[] not null default '{}'::uuid[]
);

create table if not exists public.students (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  circle_id       uuid references public.circles(id) on delete set null,
  stage_id        uuid references public.stages(id)  on delete set null,
  sort            bigint not null default 0,
  records         jsonb not null default '{}'::jsonb,
  streak_override jsonb
);

-- ترقية جدول قديم أُنشئ قبل إضافة عمود التعديل اليدوي
alter table public.students add column if not exists streak_override jsonb;

-- سجل تدقيق كامل لكل تعديل يدوي على مسار التقدم — لا يُكتفى بآخر قيمة
create table if not exists public.streak_overrides (
  id           bigserial primary key,
  student_id   uuid not null references public.students(id) on delete cascade,
  cycle_start  text not null,
  value        int  not null,
  reason       text not null,
  set_by       uuid references auth.users(id),
  set_by_email text,
  set_at       timestamptz not null default now()
);

create index if not exists students_circle_idx on public.students(circle_id);
create index if not exists students_stage_idx  on public.students(stage_id);

insert into public.program (id) values ('main') on conflict (id) do nothing;

-- ── 2) دوال الصلاحيات ───────────────────────────────────────────
-- security definer حتى لا تدخل السياسات في حلقة لا نهائية
create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public, pg_temp as $$
  select exists(select 1 from public.admins where id = auth.uid());
$$;

create or replace function public.my_circles() returns uuid[]
language sql security definer stable set search_path = public, pg_temp as $$
  select coalesce((select circle_ids from public.teachers where id = auth.uid()), '{}'::uuid[]);
$$;

create or replace function public.my_role() returns text
language sql security definer stable set search_path = public, pg_temp as $$
  select case
    when auth.uid() is null then 'none'
    when exists(select 1 from public.admins   where id = auth.uid()) then 'admin'
    when exists(select 1 from public.teachers where id = auth.uid()) then 'teacher'
    else 'none' end;
$$;

grant execute on function public.my_role() to anon, authenticated;

-- ── 3) تسجيل تقييم يوم واحد ─────────────────────────────────────
-- المعلم لا يكتب في جدول الطلاب مباشرة، بل عبر هذه الدالة وحدها.
-- الدالة تتحقق من الصلاحية وتنقّي القيم قبل الحفظ.
create or replace function public.set_record(p_student uuid, p_day text, p_rec jsonb)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_circle uuid;
  v_clean  jsonb;
begin
  if p_day !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'صيغة التاريخ غير صحيحة';
  end if;

  select circle_id into v_circle from public.students where id = p_student;
  if not found then raise exception 'الطالب غير موجود'; end if;

  if not (public.is_admin() or v_circle = any(public.my_circles())) then
    raise exception 'لا تملك صلاحية تقييم هذا الطالب';
  end if;

  v_clean := jsonb_build_object(
    'h', least(greatest(coalesce((p_rec->>'h')::numeric, 0), 0), 10),
    'r', least(greatest(coalesce((p_rec->>'r')::numeric, 0), 0), 10),
    'a', case when p_rec->>'a' in ('present','late','absent','excused') then p_rec->>'a' else '' end,
    'd', jsonb_build_object(
           'g', coalesce((p_rec->'d'->>'g')::boolean, false),
           'u', coalesce((p_rec->'d'->>'u')::boolean, false))
  );

  update public.students
     set records = jsonb_set(coalesce(records, '{}'::jsonb), array[p_day], v_clean, true)
   where id = p_student;
end $$;

grant execute on function public.set_record(uuid, text, jsonb) to authenticated;

-- ── 3ب) تعديل يدوي لمسار التقدم — للمشرف وحده، مع سجل تدقيق دائم ──
create or replace function public.set_streak_override(p_student uuid, p_value int, p_reason text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_cycle text;
  v_override jsonb;
begin
  if not public.is_admin() then
    raise exception 'هذا الإجراء للمشرف فقط';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'سبب التعديل مطلوب';
  end if;
  if not exists(select 1 from public.students where id = p_student) then
    raise exception 'الطالب غير موجود';
  end if;

  select coalesce(cycle_start::text, to_char(now(),'YYYY-MM-DD')) into v_cycle from public.program where id = 'main';

  insert into public.streak_overrides (student_id, cycle_start, value, reason, set_by, set_by_email)
  values (p_student, v_cycle, greatest(p_value,0), trim(p_reason), auth.uid(), auth.email());

  v_override := jsonb_build_object(
    'value', greatest(p_value,0), 'reason', trim(p_reason),
    'cycle', v_cycle, 'by', coalesce(auth.email(),'المشرف'), 'at', now()
  );
  update public.students set streak_override = v_override where id = p_student;
end $$;

grant execute on function public.set_streak_override(uuid, int, text) to authenticated;

-- ── 4) تفعيل حماية الصفوف ───────────────────────────────────────
alter table public.program  enable row level security;
alter table public.stages   enable row level security;
alter table public.circles  enable row level security;
alter table public.students enable row level security;
alter table public.teachers enable row level security;
alter table public.admins   enable row level security;
alter table public.streak_overrides enable row level security;

-- ── 5) السياسات ─────────────────────────────────────────────────
-- قراءة عامة: يفتح الطالب صفحته بلا حساب. لا توجد بيانات حساسة هنا.
do $$
declare t text;
begin
  foreach t in array array['program','stages','circles','students'] loop
    execute format('drop policy if exists read_public on public.%I', t);
    execute format('create policy read_public on public.%I for select using (true)', t);

    execute format('drop policy if exists admin_insert on public.%I', t);
    execute format('create policy admin_insert on public.%I for insert with check (public.is_admin())', t);

    execute format('drop policy if exists admin_update on public.%I', t);
    execute format('create policy admin_update on public.%I for update using (public.is_admin()) with check (public.is_admin())', t);

    execute format('drop policy if exists admin_delete on public.%I', t);
    execute format('create policy admin_delete on public.%I for delete using (public.is_admin())', t);
  end loop;
end $$;

-- المعلمون: المشرف يرى الجميع، والمعلم يرى نفسه فقط. بريده لا يُكشف للطلاب.
drop policy if exists read_teachers on public.teachers;
create policy read_teachers on public.teachers
  for select using (public.is_admin() or id = auth.uid());

drop policy if exists admin_write_teachers on public.teachers;
create policy admin_write_teachers on public.teachers
  for all using (public.is_admin()) with check (public.is_admin());

-- المشرفون: لا قراءة ولا كتابة من الموقع إطلاقًا.
-- تُدار من محرر SQL وحده، فلا يستطيع أحد ترقية نفسه.
-- (التطبيق يعرف دوره عبر دالة my_role فقط.)

-- سجل تدقيق الشعلة: يقرؤه المشرف وحده. لا سياسة كتابة — يُكتب عبر set_streak_override فقط.
drop policy if exists read_overrides on public.streak_overrides;
create policy read_overrides on public.streak_overrides
  for select using (public.is_admin());

-- ── 6) البث اللحظي ──────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['program','stages','circles','students','teachers'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ── 7) عيّن نفسك مشرفًا ─────────────────────────────────────────
-- يعتمد على أنك أنشأت حساب المشرف الأول بالبريد admin@sabaq.local بالضبط (انظر دليل-الإعداد.md)
insert into public.admins (id, name)
select id, 'المشرف' from auth.users
 where email = 'admin@sabaq.local'
on conflict (id) do nothing;

-- للتحقق: يجب أن يُرجع صفًا واحدًا
select u.email, a.name from public.admins a join auth.users u on u.id = a.id;
