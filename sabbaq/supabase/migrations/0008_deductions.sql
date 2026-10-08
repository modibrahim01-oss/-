-- ════════════════════════════════════════════════════════════════════════
-- سبّاق — الخصم: «الليدر» يزيل نبتة من بستان طالب
--
-- الخصم بيد المدير ومن يمنحه المدير صلاحية الخصم (users.can_deduct). كل خصم
-- يسحب أحدث نبتة حيّة من النوع المختار، فتنقص نقاط الطالب بقيمتها، ويُسجَّل
-- بسببه في deductions. صفحة البستان تقرأ الخصومات القائمة من العرض العام
-- garden_deductions (بلا السبب ولا الفاعل) فتمرّ الجزّازة على مكان النبتة.
--
-- يعتمد على 0007. يُطبَّق مرّة واحدة في معاملة واحدة، ولا يغيّر أي نقطة قائمة.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- صلاحية الخصم: يمنحها المدير لمن يشاء
alter table users add column if not exists can_deduct boolean not null default false;

create table if not exists deductions (
  id          bigserial primary key,
  student_id  uuid not null references students on delete cascade,
  semester_id uuid not null references semesters,
  actor_id    uuid not null references users,
  ledger_id   bigint not null references points_ledger,
  tier        point_tier not null,
  points      smallint not null,
  grid_x      integer not null,
  grid_y      integer not null,
  reason      text not null check (length(reason) between 2 and 200),
  created_at  timestamptz not null default now(),
  undone_at   timestamptz
);
create index if not exists deductions_student_idx on deductions (student_id, semester_id) where undone_at is null;
create index if not exists deductions_actor_idx on deductions (actor_id, created_at desc);

-- السبب والفاعل للمدير ولصاحب الخصم وحدهما؛ لا كتابة مباشرة
alter table deductions enable row level security;
drop policy if exists deductions_read on deductions;
create policy deductions_read on deductions
  for select using (actor_id = auth.uid() or is_admin());
grant select on deductions to authenticated;

-- ما تحتاجه الجزّازة فقط: أين ومتى وأي نوع. صفحة البستان عامة يفتحها ولي
-- الأمر برمز QR، فالسبب لا يُعرض فيها.
create or replace view garden_deductions as
  select id, student_id, semester_id, tier, points, grid_x, grid_y, created_at
    from deductions
   where undone_at is null;
grant select on garden_deductions to anon, authenticated;

create or replace function can_deduct()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' or can_deduct from users where id = auth.uid() and is_active),
    false
  );
$$;

-- ── الخصم: أحدث نبتة حيّة من النوع ────────────────────────────────────────
-- قفل صف الطالب كالمنح، فخصم ومنح متزامنان على نفس الطالب لا يتعارضان على
-- خانة. الخانة المحرَّرة يملؤها المنح التالي من نوعها (أول خانة شاغرة، 0006).
create or replace function deduct_plant(p_student uuid, p_tier point_tier, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor    uuid := auth.uid();
  v_reason   text := btrim(coalesce(p_reason, ''));
  v_semester uuid;
  v_ledger   bigint;
  v_points   smallint;
  v_x        integer;
  v_y        integer;
  v_id       bigint;
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not can_deduct() then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  if length(v_reason) < 2 or length(v_reason) > 200 then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;

  select id into v_semester from semesters where is_active;
  if v_semester is null then
    raise exception 'NO_ACTIVE_SEMESTER' using errcode = 'P0002';
  end if;

  perform 1 from students where id = p_student and is_active for update;
  if not found then
    raise exception 'STUDENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  select id, points, grid_x, grid_y
    into v_ledger, v_points, v_x, v_y
    from points_ledger
   where student_id = p_student
     and semester_id = v_semester
     and tier = p_tier
     and revoked_at is null
   order by awarded_at desc, id desc
   limit 1;

  if v_ledger is null then
    raise exception 'NO_PLANT_OF_TIER' using errcode = 'P0002';
  end if;

  update points_ledger
     set revoked_at = now(), revoked_by = v_actor, revoke_reason = 'deduction'
   where id = v_ledger;

  insert into deductions (student_id, semester_id, actor_id, ledger_id, tier, points, grid_x, grid_y, reason)
  values (p_student, v_semester, v_actor, v_ledger, p_tier, v_points, v_x, v_y, v_reason)
  returning id into v_id;

  insert into audit_log (actor_id, action, entity, entity_id, details)
  values (v_actor, 'deduct_plant', 'students', p_student::text,
          jsonb_build_object('deduction_id', v_id, 'ledger_id', v_ledger, 'tier', p_tier,
                             'points', v_points, 'reason', v_reason));

  return jsonb_build_object(
    'deduction_id', v_id,
    'student_id',   p_student,
    'tier',         p_tier,
    'points',       v_points,
    'created_at',   now()
  );
end;
$$;

-- ── التراجع عن خصم: صاحبه أو المدير، خلال دقيقتين كتراجع المنح ─────────────
-- إن مُنحت نبتة جديدة في الخانة نفسها بعد الخصم فلا مكان لإعادتها.
create or replace function undo_deduction(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor   uuid := auth.uid();
  v_d       deductions%rowtype;
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into v_d from deductions where id = p_id;
  if not found or (v_d.actor_id is distinct from v_actor and not is_admin()) then
    raise exception 'UNDO_NOT_YOURS' using errcode = '42501';
  end if;
  if v_d.undone_at is not null then
    raise exception 'UNDO_ALREADY_REVOKED' using errcode = 'P0002';
  end if;
  if v_d.created_at < now() - interval '150 seconds' then
    raise exception 'UNDO_WINDOW_PASSED' using errcode = 'P0001';
  end if;

  perform 1 from students where id = v_d.student_id for update;

  if exists (
    select 1 from points_ledger
     where student_id = v_d.student_id
       and semester_id = v_d.semester_id
       and grid_x = v_d.grid_x
       and grid_y = v_d.grid_y
       and revoked_at is null
  ) then
    raise exception 'CELL_TAKEN' using errcode = 'P0001';
  end if;

  update points_ledger
     set revoked_at = null, revoked_by = null, revoke_reason = null
   where id = v_d.ledger_id
     and revoke_reason = 'deduction';

  update deductions set undone_at = now() where id = p_id;

  insert into audit_log (actor_id, action, entity, entity_id, details)
  values (v_actor, 'undo_deduction', 'students', v_d.student_id::text,
          jsonb_build_object('deduction_id', p_id, 'ledger_id', v_d.ledger_id));

  return jsonb_build_object('deduction_id', p_id, 'tier', v_d.tier, 'points', v_d.points);
end;
$$;

-- ── آخر خصومات الفاعل (أو كل الخصومات للمدير) بأسماء الطلاب ───────────────
create or replace function my_recent_deductions()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]'::jsonb)
    from (
      select d.id, d.student_id, s.full_name, d.tier, d.points, d.reason,
             d.created_at, d.undone_at, u.full_name_ar as actor_name
        from deductions d
        join students s on s.id = d.student_id
        join users u on u.id = d.actor_id
       where can_deduct()
         and (d.actor_id = auth.uid() or is_admin())
       order by d.created_at desc
       limit 30
    ) t;
$$;

-- ── الحدّ اليومي للمشرف لا يتأثّر بالخصم ──────────────────────────────────
-- الحدّ يُعدّ من منح اليوم الحيّة. لو خُصمت نبتة مُنحت اليوم لعاد لمشرفها
-- مكانها في حدّه — والخصم عقوبة للطالب لا رصيد للمشرف. فالمسحوب بالخصم يبقى
-- محسوبًا. الدالتان كما في 0007 عدا شرط العدّ.
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
       and (revoked_at is null or revoke_reason = 'deduction')
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
       and (revoked_at is null or revoke_reason = 'deduction')
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

revoke all on function can_deduct()                              from public;
revoke all on function deduct_plant(uuid, point_tier, text)      from public;
revoke all on function undo_deduction(bigint)                    from public;
revoke all on function my_recent_deductions()                    from public;
revoke all on function award_points(uuid, point_tier)            from public;
revoke all on function my_daily_status()                         from public;
grant execute on function can_deduct()                           to authenticated;
grant execute on function deduct_plant(uuid, point_tier, text)   to authenticated;
grant execute on function undo_deduction(bigint)                 to authenticated;
grant execute on function my_recent_deductions()                 to authenticated;
grant execute on function award_points(uuid, point_tier)         to authenticated;
grant execute on function my_daily_status()                      to authenticated;

commit;
