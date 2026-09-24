-- ════════════════════════════════════════════════════════════════════════
-- سبّاق — حدّ بعدد النبتات، ودخول المشرف برابط، ومفتاح مزرعة الطالب
--
-- ١. حدّ المشرف اليومي يصبح بعدد النبتات من كل نوع لا بمجموع النقاط: كم
--    سنبلة وكم نبتة وكم زهرة وكم شجرة. حدّ لكل دور، واستثناء اختياري لمشرف.
-- ٢. رابط دخول دائم لكل مشرف بدل الإيميل وكلمة المرور.
-- ٣. مفتاح لكل طالب يرتّب به نبتات مزرعته داخل سورها، ولا يرتّب غيرها.
--
-- يعتمد على 0006 (الفهرس الجزئي للخانات الحيّة، و award_points بأول خانة
-- شاغرة). يُطبَّق مرّة واحدة في معاملة واحدة، ولا يحرّك أي نبتة قائمة.
-- ════════════════════════════════════════════════════════════════════════

begin;

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

-- ── منح النقاط: الحدّ بعدد نبتات الفئة ──────────────────────────────────
-- مطابق لـ 0006 إلا فحص الحد: عدد منح اليوم الحيّة لهذا المشرف من هذه الفئة.
-- الإلغاء والتراجع يُخرجان المنح من العدّ، فيعود للمشرف ما ألغاه.
create or replace function award_points(p_student_id uuid, p_tier point_tier)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor    uuid := auth.uid();
  v_role     user_role;
  v_points   smallint;
  v_semester uuid;
  v_group    smallint;
  v_limit    integer;
  v_used     integer;
  v_slot     integer;
  v_rank     integer := 0;
  v_x        integer;
  v_y        integer;
  v_id       bigint;
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select role into v_role from users where id = v_actor and is_active;
  if v_role is null then
    raise exception 'NOT_STAFF' using errcode = '42501';
  end if;

  v_points := tier_points(p_tier);

  perform pg_advisory_xact_lock(hashtextextended(v_actor::text, 0));

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

  if v_role = 'group_supervisor'
     and not exists (
       select 1 from supervisor_groups
        where supervisor_id = v_actor and group_id = v_group
     )
  then
    raise exception 'STUDENT_OUT_OF_SCOPE' using errcode = '42501';
  end if;

  if v_role <> 'admin' then
    v_limit := tier_limit_for(v_actor, v_role, p_tier);

    select count(*) into v_used
      from points_ledger
     where supervisor_id = v_actor
       and tier = p_tier
       and revoked_at is null
       and awarded_at >= date_trunc('day', now());

    if v_used + 1 > v_limit then
      raise exception 'DAILY_LIMIT_EXCEEDED tier=% used=% limit=%',
        p_tier, v_used, v_limit
        using errcode = 'P0001';
    end if;
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
    student_id, supervisor_id, semester_id, points, tier, slot_index, grid_x, grid_y
  ) values (
    p_student_id, v_actor, v_semester, v_points, p_tier, v_slot, v_x, v_y
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

-- ═══════════════════════ ٣. مفتاح مزرعة الطالب ═════════════════════════
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

-- ── ترتيب المزرعة: [{slot, x, y}] ────────────────────────────────────────
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

commit;
