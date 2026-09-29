-- ════════════════════════════════════════════════════════════════════════
-- سبّاق — حدّ بعدد النبتات، ودخول المشرف برابط، ومفتاح بستان الطالب
--
-- ١. حدّ المشرف اليومي يصبح بعدد النبتات من كل نوع لا بمجموع النقاط: كم
--    سنبلة وكم نبتة وكم زهرة وكم شجرة. حدّ لكل دور، واستثناء اختياري لمشرف.
-- ٢. رابط دخول دائم لكل مشرف بدل الإيميل وكلمة المرور.
-- ٣. مفتاح لكل طالب يرتّب به نبتات بستانه داخل سوره، ولا يرتّب غيره.
-- ٤. نقاط إضافية من اللجنة القيمية: رصيد نبتات يرسله مشرف اللجنة لمشرف
--    مجموعة، مقفلًا حتى يعرض المستلم المحتوى ويفتحه، ثم يوزّعه خارج حدّه.
--
-- يعتمد على 0006 (الفهرس الجزئي للخانات الحيّة، و award_points بأول خانة
-- شاغرة). يُطبَّق مرّة واحدة في معاملة واحدة، ولا يحرّك أي نبتة قائمة.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ═══════════════════ ٠. جداول رصيد اللجنة القيمية ═══════════════════════
-- تُنشأ أولًا لأن المنح (١) يعرف مصدره منها: منحٌ من رصيد اللجنة لا يُحسب
-- على حدّ المشرف اليومي. الدوال في القسم ٤.

-- صلاحية الإرسال: تمنحها الإدارة لمشرف بعينه
alter table users add column if not exists value_committee boolean not null default false;

create table if not exists committee_grants (
  id           bigserial primary key,
  sender_id    uuid not null references users,
  recipient_id uuid not null references users,
  semester_id  uuid not null references semesters,
  title        text not null check (length(title) between 2 and 120),
  note         text check (note is null or length(note) <= 500),
  status       text not null default 'locked' check (status in ('locked', 'active', 'cancelled')),
  created_at   timestamptz not null default now(),
  unlocked_at  timestamptz,
  cancelled_at timestamptz
);
create index if not exists committee_grants_recipient_idx on committee_grants (recipient_id, status);
create index if not exists committee_grants_sender_idx on committee_grants (sender_id, created_at desc);

create table if not exists committee_grant_items (
  grant_id bigint     not null references committee_grants on delete cascade,
  tier     point_tier not null,
  quantity integer    not null check (quantity between 1 and 50),
  used     integer    not null default 0 check (used >= 0 and used <= quantity),
  primary key (grant_id, tier)
);

-- مصدر كل منح: null للمنح العادي، ورقم الرصيد لمنحٍ من رصيد اللجنة
alter table points_ledger add column if not exists grant_id bigint references committee_grants;

-- ════════════════════════════ ١. حدّ النبتات ════════════════════════════

create table if not exists tier_limits (
  role       user_role  not null,
  tier       point_tier not null,
  per_day    integer    not null check (per_day >= 0),
  updated_by uuid references users,
  updated_at timestamptz not null default now(),
  primary key (role, tier)
);

-- قيم بداية يضبطها المدير من «الحدود اليومية» قبل الاستعمال. المشرف يرى
-- حدّه فورًا، فلا يبقى الجدول فارغًا فيُمنع المنح كله.
insert into tier_limits (role, tier, per_day) values
  ('group_supervisor',     'green',  8),
  ('group_supervisor',     'yellow', 5),
  ('group_supervisor',     'purple', 3),
  ('group_supervisor',     'red',    2),
  ('committee_supervisor', 'green',  16),
  ('committee_supervisor', 'yellow', 10),
  ('committee_supervisor', 'purple', 6),
  ('committee_supervisor', 'red',    4)
on conflict do nothing;

-- استثناء لمشرف بعينه: يتغلّب على حدّ دوره للفئة المذكورة وحدها
create table if not exists supervisor_tier_limits (
  supervisor_id uuid       not null references users on delete cascade,
  tier          point_tier not null,
  per_day       integer    not null check (per_day >= 0),
  updated_by    uuid references users,
  updated_at    timestamptz not null default now(),
  primary key (supervisor_id, tier)
);

alter table tier_limits            enable row level security;
alter table supervisor_tier_limits enable row level security;

drop policy if exists tier_limits_read_staff on tier_limits;
create policy tier_limits_read_staff on tier_limits
  for select using (current_role_of() is not null);
drop policy if exists tier_limits_admin_write on tier_limits;
create policy tier_limits_admin_write on tier_limits
  for all using (is_admin()) with check (is_admin());

-- المشرف يرى استثناءه هو فقط؛ المدير يرى الكل
drop policy if exists sup_limits_read on supervisor_tier_limits;
create policy sup_limits_read on supervisor_tier_limits
  for select using (supervisor_id = auth.uid() or is_admin());
drop policy if exists sup_limits_admin_write on supervisor_tier_limits;
create policy sup_limits_admin_write on supervisor_tier_limits
  for all using (is_admin()) with check (is_admin());

grant select, insert, update, delete on tier_limits, supervisor_tier_limits to authenticated;

-- حدّ مشرف لفئة: استثناؤه إن وُجد، وإلا حدّ دوره، وإلا صفر
create or replace function tier_limit_for(p_user uuid, p_role user_role, p_tier point_tier)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select per_day from supervisor_tier_limits where supervisor_id = p_user and tier = p_tier),
    (select per_day from tier_limits where role = p_role and tier = p_tier),
    0
  );
$$;

revoke all on function tier_limit_for(uuid, user_role, point_tier) from public;

-- ── الغرس نفسه: مشترك بين المنح العادي والمنح من رصيد اللجنة ─────────────
-- قفل صف الطالب، ونطاق مشرف المجموعة، وأول خانة شاغرة في ربع الفئة (0006)،
-- والإدراج. المستدعي يأخذ القفل الاستشاري على المشرف ويفحص ما يخصّه (الحد
-- اليومي أو الرصيد) قبل النداء. داخلية: لا صلاحية تنفيذ لأحد.
create or replace function plant_award(
  p_actor uuid, p_role user_role, p_student_id uuid, p_tier point_tier, p_grant bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points   smallint := tier_points(p_tier);
  v_semester uuid;
  v_group    smallint;
  v_slot     integer;
  v_rank     integer := 0;
  v_x        integer;
  v_y        integer;
  v_id       bigint;
begin
  select id into v_semester from semesters where is_active;
  if v_semester is null then
    raise exception 'NO_ACTIVE_SEMESTER' using errcode = 'P0002';
  end if;

  select group_id, next_slot_index
    into v_group, v_slot
    from students
   where id = p_student_id and is_active
     for update;

  if not found then
    raise exception 'STUDENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_role = 'group_supervisor'
     and not exists (
       select 1 from supervisor_groups
        where supervisor_id = p_actor and group_id = v_group
     )
  then
    raise exception 'STUDENT_OUT_OF_SCOPE' using errcode = '42501';
  end if;

  loop
    select q.x, q.y into v_x, v_y from quadrant_coord(p_tier, v_rank) q;
    exit when not exists (
      select 1 from points_ledger
       where student_id = p_student_id
         and semester_id = v_semester
         and grid_x = v_x
         and grid_y = v_y
         and revoked_at is null
    );
    v_rank := v_rank + 1;
  end loop;

  insert into points_ledger (
    student_id, supervisor_id, semester_id, points, tier, slot_index, grid_x, grid_y, grant_id
  ) values (
    p_student_id, p_actor, v_semester, v_points, p_tier, v_slot, v_x, v_y, p_grant
  )
  returning id into v_id;

  update students set next_slot_index = v_slot + 1 where id = p_student_id;

  return jsonb_build_object(
    'ledger_id',  v_id,
    'slot_index', v_slot,
    'grid_x',     v_x,
    'grid_y',     v_y,
    'points',     v_points,
    'tier',       p_tier
  );
end;
$$;

revoke all on function plant_award(uuid, user_role, uuid, point_tier, bigint) from public;

-- ── منح النقاط: الحدّ بعدد نبتات الفئة ──────────────────────────────────
-- عدد منح اليوم الحيّة لهذا المشرف من هذه الفئة، دون ما منحه من رصيد اللجنة.
-- الإلغاء والتراجع يُخرجان المنح من العدّ، فيعود للمشرف ما ألغاه. القفل
-- الاستشاري على المشرف يسبق العدّ، فمنحان متزامنان منه لا يقرآن نفس العدد.
create or replace function award_points(p_student_id uuid, p_tier point_tier)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role  user_role;
  v_limit integer;
  v_used  integer;
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select role into v_role from users where id = v_actor and is_active;
  if v_role is null then
    raise exception 'NOT_STAFF' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_actor::text, 0));

  if v_role <> 'admin' then
    v_limit := tier_limit_for(v_actor, v_role, p_tier);

    select count(*) into v_used
      from points_ledger
     where supervisor_id = v_actor
       and tier = p_tier
       and grant_id is null
       and revoked_at is null
       and awarded_at >= date_trunc('day', now());

    if v_used + 1 > v_limit then
      raise exception 'DAILY_LIMIT_EXCEEDED tier=% used=% limit=%',
        p_tier, v_used, v_limit
        using errcode = 'P0001';
    end if;
  end if;

  return plant_award(v_actor, v_role, p_student_id, p_tier, null);
end;
$$;

revoke all on function award_points(uuid, point_tier) from public;
grant execute on function award_points(uuid, point_tier) to authenticated;

-- ── حالة الحد اليومي: لكل فئة حدّها وما استُعمل منها ─────────────────────
-- المدير بلا حد: limit = -1 في كل فئة، فلا ترسم الواجهة عدّادًا.
create or replace function my_daily_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role  user_role;
  v_tier  point_tier;
  v_limit integer;
  v_used  integer;
  v_tiers jsonb := '{}'::jsonb;
begin
  select role into v_role from users where id = v_actor and is_active;
  if v_role is null then
    return jsonb_build_object('role', null, 'tiers', v_tiers);
  end if;

  foreach v_tier in array enum_range(null::point_tier) loop
    select count(*) into v_used
      from points_ledger
     where supervisor_id = v_actor
       and tier = v_tier
       and grant_id is null
       and revoked_at is null
       and awarded_at >= date_trunc('day', now());

    v_limit := case when v_role = 'admin' then -1 else tier_limit_for(v_actor, v_role, v_tier) end;

    v_tiers := v_tiers || jsonb_build_object(v_tier::text, jsonb_build_object(
      'limit',     v_limit,
      'used',      v_used,
      'remaining', case when v_limit < 0 then -1 else greatest(0, v_limit - v_used) end
    ));
  end loop;

  return jsonb_build_object('role', v_role, 'tiers', v_tiers);
end;
$$;

revoke all on function my_daily_status() from public;
grant execute on function my_daily_status() to authenticated;

-- ── تعديل الحدود (المدير فقط) ───────────────────────────────────────────
create or replace function set_tier_limit(p_role user_role, p_tier point_tier, p_per_day integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'ADMIN_ONLY' using errcode = '42501';
  end if;
  if p_role = 'admin' or p_per_day is null or p_per_day < 0 then
    raise exception 'INVALID_LIMIT' using errcode = '22023';
  end if;

  insert into tier_limits (role, tier, per_day, updated_by, updated_at)
  values (p_role, p_tier, p_per_day, auth.uid(), now())
  on conflict (role, tier) do update
    set per_day = excluded.per_day, updated_by = excluded.updated_by, updated_at = now();

  insert into audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'set_tier_limit', 'tier_limits', p_role::text || ':' || p_tier::text,
          jsonb_build_object('per_day', p_per_day));
end;
$$;

-- null = إلغاء الاستثناء والعودة لحدّ الدور
create or replace function set_supervisor_tier_limit(p_supervisor uuid, p_tier point_tier, p_per_day integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'ADMIN_ONLY' using errcode = '42501';
  end if;
  if p_per_day is not null and p_per_day < 0 then
    raise exception 'INVALID_LIMIT' using errcode = '22023';
  end if;

  if p_per_day is null then
    delete from supervisor_tier_limits where supervisor_id = p_supervisor and tier = p_tier;
  else
    insert into supervisor_tier_limits (supervisor_id, tier, per_day, updated_by, updated_at)
    values (p_supervisor, p_tier, p_per_day, auth.uid(), now())
    on conflict (supervisor_id, tier) do update
      set per_day = excluded.per_day, updated_by = excluded.updated_by, updated_at = now();
  end if;

  insert into audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'set_supervisor_tier_limit', 'supervisor_tier_limits',
          p_supervisor::text || ':' || p_tier::text, jsonb_build_object('per_day', p_per_day));
end;
$$;

revoke all on function set_tier_limit(user_role, point_tier, integer) from public;
revoke all on function set_supervisor_tier_limit(uuid, point_tier, integer) from public;
grant execute on function set_tier_limit(user_role, point_tier, integer) to authenticated;
grant execute on function set_supervisor_tier_limit(uuid, point_tier, integer) to authenticated;

-- ═══════════════════════ ٢. رابط دخول المشرف ═══════════════════════════
-- الرمز محفوظ كما هو ليعرض المدير الرابط متى شاء. القراءة للمدير وحده،
-- ومسار الدخول (/k/<token>) يطابقه بمفتاح الخدمة على الخادم. لا grant لـ anon.
create table if not exists staff_login_keys (
  user_id    uuid primary key references users on delete cascade,
  token      text not null unique check (length(token) >= 32),
  created_at timestamptz not null default now()
);

alter table staff_login_keys enable row level security;
drop policy if exists staff_keys_admin on staff_login_keys;
create policy staff_keys_admin on staff_login_keys
  for all using (is_admin()) with check (is_admin());
grant select, insert, update, delete on staff_login_keys to authenticated;

-- ═══════════════════════ ٣. مفتاح بستان الطالب ═════════════════════════
-- جدول منفصل عن students عمدًا: students مقروء للعامّة بالكامل (0003)،
-- فعمود مفتاح عليه ينكشف لأي زائر.
create table if not exists student_farm_keys (
  student_id uuid primary key references students on delete cascade,
  token      text not null unique check (length(token) >= 32),
  created_at timestamptz not null default now()
);

alter table student_farm_keys enable row level security;
drop policy if exists farm_keys_admin on student_farm_keys;
create policy farm_keys_admin on student_farm_keys
  for all using (is_admin()) with check (is_admin());
grant select, insert, update, delete on student_farm_keys to authenticated;

create or replace function farm_key_ok(p_student uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_key is not null and exists (
    select 1 from student_farm_keys where student_id = p_student and token = p_key
  );
$$;

-- حدود السور المسموح بالترتيب داخلها: حدود **التخطيط الافتراضي** لا الفعلي،
-- فلا يتّسع السور مع كل حفظ. مرآة fieldBoundsFor في src/lib/plants.ts:
-- هامش خانتين حول أبعد نبتة من كل جهة، وثلاث خانات حول المركز على الأقل.
create or replace function farm_default_bounds(
  p_student uuid, p_semester uuid,
  out min_x integer, out max_x integer, out min_y integer, out max_y integer
)
language sql
stable
set search_path = public
as $$
  with ranked as (
    select tier,
           (row_number() over (partition by tier order by slot_index) - 1)::integer as rnk
      from points_ledger
     where student_id = p_student and semester_id = p_semester and revoked_at is null
  )
  select least(-3, min(q.x) - 2), greatest(3, max(q.x) + 2),
         least(-3, min(q.y) - 2), greatest(3, max(q.y) + 2)
    from ranked r cross join lateral quadrant_coord(r.tier, r.rnk) q;
$$;

-- ── ترتيب البستان: [{slot, x, y}] ────────────────────────────────────────
-- النقل بخطوتين: الصفوف المنقولة تُركن أولًا في خانات مؤقتة خارج الشبكة ثم
-- تنزل أهدافها، فيمرّ تبديل نبتتين من الفهرس الفريد. أي تصادم نهائي (هدفان
-- لخانة واحدة، أو هدف على نبتة لم تُنقل) يُسقط الترتيب كله.
create or replace function arrange_farm(p_student uuid, p_key text, p_moves jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sem   uuid;
  v_b     record;
  v_count integer;
begin
  if not farm_key_ok(p_student, p_key) then
    raise exception 'FARM_KEY_INVALID' using errcode = '42501';
  end if;
  if jsonb_typeof(p_moves) is distinct from 'array' or jsonb_array_length(p_moves) > 5000 then
    raise exception 'FARM_MOVES_INVALID' using errcode = '22023';
  end if;

  select id into v_sem from semesters where is_active;
  if v_sem is null then
    raise exception 'NO_ACTIVE_SEMESTER' using errcode = 'P0002';
  end if;

  -- نفس قفل award_points: ترتيب ومنح متزامنان على طالب واحد لا يتسابقان
  perform 1 from students where id = p_student and is_active for update;
  if not found then
    raise exception 'STUDENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  drop table if exists pg_temp.arrange_moves;
  create temp table arrange_moves on commit drop as
    select m.slot, m.x, m.y, row_number() over () as ord
      from jsonb_to_recordset(p_moves) as m(slot integer, x integer, y integer);

  v_count := (select count(*) from arrange_moves);
  if v_count = 0 then
    return 0;
  end if;

  if exists (select 1 from arrange_moves where slot is null or x is null or y is null)
     or (select count(distinct slot) from arrange_moves) <> v_count
     or exists (
       select 1 from arrange_moves m
        where not exists (
          select 1 from points_ledger l
           where l.student_id = p_student and l.semester_id = v_sem
             and l.slot_index = m.slot and l.revoked_at is null
        )
     )
  then
    raise exception 'FARM_MOVES_INVALID' using errcode = '22023';
  end if;

  select * into v_b from farm_default_bounds(p_student, v_sem);
  if exists (
    select 1 from arrange_moves
     where x < v_b.min_x or x > v_b.max_x or y < v_b.min_y or y > v_b.max_y
  ) then
    raise exception 'FARM_MOVE_OUT_OF_BOUNDS' using errcode = '22023';
  end if;

  update points_ledger l
     set grid_x = 100000 + m.ord, grid_y = 100000
    from arrange_moves m
   where l.student_id = p_student and l.semester_id = v_sem
     and l.slot_index = m.slot and l.revoked_at is null;

  begin
    update points_ledger l
       set grid_x = m.x, grid_y = m.y
      from arrange_moves m
     where l.student_id = p_student and l.semester_id = v_sem
       and l.slot_index = m.slot and l.revoked_at is null;
  exception when unique_violation then
    raise exception 'FARM_CELL_TAKEN' using errcode = '23505';
  end;

  insert into audit_log (actor_id, action, entity, entity_id, details)
  values (null, 'arrange_farm', 'students', p_student::text, jsonb_build_object('moves', v_count));

  return v_count;
end;
$$;

-- ── الترتيب الأصلي: كل نبتة حيّة إلى خانتها الافتراضية ─────────────────────
create or replace function reset_farm(p_student uuid, p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sem uuid;
begin
  if not farm_key_ok(p_student, p_key) then
    raise exception 'FARM_KEY_INVALID' using errcode = '42501';
  end if;

  select id into v_sem from semesters where is_active;
  if v_sem is null then
    raise exception 'NO_ACTIVE_SEMESTER' using errcode = 'P0002';
  end if;

  perform 1 from students where id = p_student and is_active for update;

  update points_ledger l
     set grid_x = 100000 + r.n, grid_y = 100000
    from (select id, row_number() over (order by id)::integer as n
            from points_ledger
           where student_id = p_student and semester_id = v_sem and revoked_at is null) r
   where l.id = r.id;

  update points_ledger l
     set grid_x = q.x, grid_y = q.y
    from (select id, tier,
                 (row_number() over (partition by tier order by slot_index) - 1)::integer as rnk
            from points_ledger
           where student_id = p_student and semester_id = v_sem and revoked_at is null) r
    cross join lateral quadrant_coord(r.tier, r.rnk) q
   where l.id = r.id;

  insert into audit_log (actor_id, action, entity, entity_id, details)
  values (null, 'reset_farm', 'students', p_student::text, null);
end;
$$;

revoke all on function farm_key_ok(uuid, text)          from public;
revoke all on function farm_default_bounds(uuid, uuid)  from public;
revoke all on function arrange_farm(uuid, text, jsonb)  from public;
revoke all on function reset_farm(uuid, text)           from public;
grant execute on function farm_key_ok(uuid, text)         to anon, authenticated;
grant execute on function arrange_farm(uuid, text, jsonb) to anon, authenticated;
grant execute on function reset_farm(uuid, text)          to anon, authenticated;

-- ═══════════════════ ٤. نقاط إضافية من اللجنة القيمية ════════════════════
-- مشرف اللجنة القيمية يرسل لمشرف مجموعة رصيدًا من النبتات مع عنوان المحتوى.
-- يصل مقفلًا؛ يعرض المستلم المحتوى على طلابه ثم يفتحه، فيمنح منه خارج حدّه
-- اليومي. المُرسِل يسحب ما لم يُوزَّع متى شاء، وما وُزِّع يبقى في البساتين.

alter table committee_grants      enable row level security;
alter table committee_grant_items enable row level security;

drop policy if exists grants_read_parties on committee_grants;
create policy grants_read_parties on committee_grants
  for select using (sender_id = auth.uid() or recipient_id = auth.uid() or is_admin());
drop policy if exists grant_items_read_parties on committee_grant_items;
create policy grant_items_read_parties on committee_grant_items
  for select using (exists (
    select 1 from committee_grants g
     where g.id = grant_id
       and (g.sender_id = auth.uid() or g.recipient_id = auth.uid() or is_admin())
  ));

-- قراءة فقط: الإرسال والفتح والمنح والسحب تمرّ بالدوال أدناه وحدها
grant select on committee_grants, committee_grant_items to authenticated;

create or replace function is_value_committee()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select value_committee from users where id = auth.uid() and is_active), false);
$$;

-- ── إرسال رصيد: items = {"purple": 3, "red": 2} ──────────────────────────
create or replace function send_committee_grant(
  p_recipient uuid, p_title text, p_note text, p_items jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_sem   uuid;
  v_id    bigint;
  v_item  record;
  v_count integer := 0;
begin
  if not is_value_committee() then
    raise exception 'NOT_VALUE_COMMITTEE' using errcode = '42501';
  end if;
  if not exists (
    select 1 from users where id = p_recipient and is_active and role = 'group_supervisor'
  ) then
    raise exception 'INVALID_RECIPIENT' using errcode = '22023';
  end if;
  if p_title is null or length(trim(p_title)) not between 2 and 120
     or (p_note is not null and length(p_note) > 500)
     or jsonb_typeof(p_items) is distinct from 'object'
  then
    raise exception 'GRANT_INVALID' using errcode = '22023';
  end if;

  select id into v_sem from semesters where is_active;
  if v_sem is null then
    raise exception 'NO_ACTIVE_SEMESTER' using errcode = 'P0002';
  end if;

  insert into committee_grants (sender_id, recipient_id, semester_id, title, note)
  values (v_actor, p_recipient, v_sem, trim(p_title), nullif(trim(coalesce(p_note, '')), ''))
  returning id into v_id;

  for v_item in select key, value from jsonb_each_text(p_items) loop
    if v_item.key not in (select unnest(enum_range(null::point_tier))::text)
       or v_item.value !~ '^[0-9]+$'
    then
      raise exception 'GRANT_INVALID' using errcode = '22023';
    end if;
    if v_item.value::integer = 0 then
      continue;
    end if;
    if v_item.value::integer > 50 then
      raise exception 'GRANT_INVALID' using errcode = '22023';
    end if;
    insert into committee_grant_items (grant_id, tier, quantity)
    values (v_id, v_item.key::point_tier, v_item.value::integer);
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'GRANT_INVALID' using errcode = '22023';
  end if;

  insert into audit_log (actor_id, action, entity, entity_id, details)
  values (v_actor, 'send_committee_grant', 'committee_grants', v_id::text,
          jsonb_build_object('recipient', p_recipient, 'items', p_items));
  return v_id;
end;
$$;

-- ── فتح الرصيد: المستلم وحده، بعد عرض المحتوى ────────────────────────────
create or replace function unlock_committee_grant(p_grant bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update committee_grants
     set status = 'active', unlocked_at = now()
   where id = p_grant
     and recipient_id = auth.uid()
     and status = 'locked'
     and exists (select 1 from users where id = auth.uid() and is_active);
  if not found then
    raise exception 'GRANT_NOT_AVAILABLE' using errcode = 'P0002';
  end if;

  insert into audit_log (actor_id, action, entity, entity_id)
  values (auth.uid(), 'unlock_committee_grant', 'committee_grants', p_grant::text);
end;
$$;

-- ── المنح من الرصيد: خارج الحد اليومي، ضمن نطاق المستلم ───────────────────
create or replace function award_from_grant(p_grant bigint, p_student_id uuid, p_tier point_tier)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role  user_role;
  v_qty   integer;
  v_used  integer;
  v_res   jsonb;
begin
  select role into v_role from users where id = v_actor and is_active;
  if v_role is null then
    raise exception 'NOT_STAFF' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_actor::text, 0));

  perform 1 from committee_grants g
   where g.id = p_grant
     and g.recipient_id = v_actor
     and g.status = 'active'
     and g.semester_id = (select id from semesters where is_active)
     for update;
  if not found then
    raise exception 'GRANT_NOT_AVAILABLE' using errcode = 'P0002';
  end if;

  select quantity, used into v_qty, v_used
    from committee_grant_items
   where grant_id = p_grant and tier = p_tier
     for update;
  if not found or v_used >= v_qty then
    raise exception 'GRANT_TIER_EXHAUSTED' using errcode = 'P0001';
  end if;

  v_res := plant_award(v_actor, v_role, p_student_id, p_tier, p_grant);

  update committee_grant_items set used = used + 1 where grant_id = p_grant and tier = p_tier;

  return v_res || jsonb_build_object('grant_id', p_grant);
end;
$$;

-- ── سحب الباقي: المُرسِل أو المدير. ما وُزِّع قبلها يبقى في البساتين ─────────
create or replace function cancel_committee_grant(p_grant bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update committee_grants
     set status = 'cancelled', cancelled_at = now()
   where id = p_grant
     and status in ('locked', 'active')
     and (sender_id = auth.uid() or is_admin());
  if not found then
    raise exception 'GRANT_NOT_AVAILABLE' using errcode = 'P0002';
  end if;

  insert into audit_log (actor_id, action, entity, entity_id)
  values (auth.uid(), 'cancel_committee_grant', 'committee_grants', p_grant::text);
end;
$$;

-- ── من يستقبل: مشرفو المجموعات ومجموعاتهم، لمن يحمل الصلاحية وحده ─────────
-- سياسة users تمنع المشرف من قراءة غيره، فالقائمة تمرّ من هنا.
create or replace function grant_recipients()
returns table (id uuid, full_name_ar text, full_name_en text, groups_ar text, groups_en text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.full_name_ar, u.full_name_en,
         string_agg(g.name_ar, ' · ' order by g.sort_order),
         string_agg(g.name_en, ' · ' order by g.sort_order)
    from users u
    left join supervisor_groups sg on sg.supervisor_id = u.id
    left join groups g on g.id = sg.group_id
   where is_value_committee()
     and u.is_active and u.role = 'group_supervisor'
   group by u.id, u.full_name_ar, u.full_name_en
   order by u.full_name_ar;
$$;

-- ── أرصدتي: الواردة والمرسلة في الفصل النشط، بأسماء الطرفين وبنودها ───────
create or replace function my_grants()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]'::jsonb)
    from (
      select g.id, g.title, g.note, g.status, g.created_at, g.unlocked_at,
             case when g.recipient_id = auth.uid() then 'in' else 'out' end as direction,
             s.full_name_ar as sender_ar, s.full_name_en as sender_en,
             r.full_name_ar as recipient_ar, r.full_name_en as recipient_en,
             (select coalesce(jsonb_agg(jsonb_build_object('tier', i.tier, 'quantity', i.quantity, 'used', i.used)
                                        order by i.tier), '[]'::jsonb)
                from committee_grant_items i where i.grant_id = g.id) as items
        from committee_grants g
        join users s on s.id = g.sender_id
        join users r on r.id = g.recipient_id
       where (g.sender_id = auth.uid() or g.recipient_id = auth.uid())
         and g.semester_id = (select id from semesters where is_active)
       order by g.created_at desc
       limit 100
    ) t;
$$;

-- ── التراجع: منحٌ من رصيد اللجنة تعود وحدته إلى الرصيد ─────────────────────
-- مطابق لـ 0006، وزيادته السطر الذي يعيد الوحدة.
create or replace function undo_my_award(p_ledger_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor   uuid := auth.uid();
  v_student uuid;
  v_points  smallint;
  v_tier    point_tier;
  v_grant   bigint;
  v_owner   uuid;
  v_at      timestamptz;
  v_revoked timestamptz;
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not exists (select 1 from users where id = v_actor and is_active) then
    raise exception 'NOT_STAFF' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_actor::text, 0));

  select student_id, supervisor_id, awarded_at, revoked_at
    into v_student, v_owner, v_at, v_revoked
    from points_ledger
   where id = p_ledger_id;

  if not found or v_owner is distinct from v_actor then
    raise exception 'UNDO_NOT_YOURS' using errcode = '42501';
  end if;
  if v_revoked is not null then
    raise exception 'UNDO_ALREADY_REVOKED' using errcode = 'P0002';
  end if;
  if v_at < now() - interval '150 seconds' then
    raise exception 'UNDO_WINDOW_PASSED' using errcode = 'P0001';
  end if;

  perform 1 from students where id = v_student for update;

  update points_ledger
     set revoked_at = now(), revoked_by = v_actor, revoke_reason = 'undo'
   where id = p_ledger_id
     and supervisor_id = v_actor
     and revoked_at is null
     and awarded_at >= now() - interval '150 seconds'
  returning points, tier, grant_id into v_points, v_tier, v_grant;

  if not found then
    raise exception 'UNDO_WINDOW_PASSED' using errcode = 'P0001';
  end if;

  if v_grant is not null then
    update committee_grant_items
       set used = greatest(0, used - 1)
     where grant_id = v_grant and tier = v_tier;
  end if;

  insert into audit_log (actor_id, action, entity, entity_id, details)
  values (v_actor, 'undo_award', 'points_ledger', p_ledger_id::text,
          jsonb_build_object('student_id', v_student, 'points', v_points, 'tier', v_tier, 'grant_id', v_grant));

  return jsonb_build_object(
    'ledger_id',  p_ledger_id,
    'student_id', v_student,
    'points',     v_points,
    'tier',       v_tier,
    'grant_id',   v_grant
  );
end;
$$;

revoke all on function is_value_committee()                              from public;
revoke all on function send_committee_grant(uuid, text, text, jsonb)     from public;
revoke all on function unlock_committee_grant(bigint)                    from public;
revoke all on function award_from_grant(bigint, uuid, point_tier)        from public;
revoke all on function cancel_committee_grant(bigint)                    from public;
revoke all on function grant_recipients()                                from public;
revoke all on function my_grants()                                       from public;
revoke all on function undo_my_award(bigint)                             from public;
grant execute on function is_value_committee()                           to authenticated;
grant execute on function send_committee_grant(uuid, text, text, jsonb)  to authenticated;
grant execute on function unlock_committee_grant(bigint)                 to authenticated;
grant execute on function award_from_grant(bigint, uuid, point_tier)     to authenticated;
grant execute on function cancel_committee_grant(bigint)                 to authenticated;
grant execute on function grant_recipients()                             to authenticated;
grant execute on function my_grants()                                    to authenticated;
grant execute on function undo_my_award(bigint)                          to authenticated;

commit;
