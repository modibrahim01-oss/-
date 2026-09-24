-- ════════════════════════════════════════════════════════════════════════
-- سبّاق — تراجع المشرف عن منحه، وبساتين بلا فجوات
--
-- ١. زرّ «تراجع» للمشرف: من ضغط الفئة الخطأ أو الطالب الخطأ يلغي منحه هو
--    خلال دقيقتين، بلا انتظار للمدير. الإلغاء ناعم كسحب المدير: السجل يبقى
--    ويُكتب في سجل التدقيق.
--
-- ٢. الخانة التي تخلو بإلغاءٍ تعود للمنح التالي من نفس الفئة. كانت الخانة
--    المسحوبة محجوزة للأبد فتبقى فجوة في البستان؛ ومع التراجع تكثر الإلغاءات
--    فتكثر الفجوات. الآن تُملأ من المركز للخارج: أول خانة شاغرة في الربع.
--
-- يُطبَّق مرّة واحدة فوق 0001–0005، في معاملة واحدة.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── القيد: نبتتان **حيّتان** لا تقعان على خانة واحدة ─────────────────────
-- النبتة المُلغاة لا تشغل خانتها بعد الآن، فالقيد يشمل الحيّة وحدها. وإلا
-- رفض القيد المنح الذي يملأ الفجوة.
alter table points_ledger drop constraint if exists points_ledger_one_plant_per_cell;

create unique index if not exists points_ledger_one_live_plant_per_cell
  on points_ledger (student_id, semester_id, grid_x, grid_y)
  where revoked_at is null;

-- ── منح النقاط: أول خانة شاغرة في ربع الفئة ─────────────────────────────
-- كل ما عدا اختيار الخانة مطابق لـ 0005. الخانات تُفحص بترتيبها من زاوية
-- الربع للخارج (quadrant_coord)، وأولها غير المشغول بنبتة حيّة هي خانة
-- النبتة الجديدة. بلا إلغاءات يطابق هذا الترتيبَ السابق تمامًا (الترتيب =
-- عدد نبتات الفئة)، فلا تتحرّك نبتة قائمة بتطبيق هذا الملف.
--
-- الفحص تحت قفل صف الطالب، فمنحان متزامنان لا يختاران نفس الخانة، والفهرس
-- الجزئي أعلاه يجعل كل فحص بحثًا في فهرس لا مسحًا للجدول.
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
    select points_perday into v_limit from daily_limits where role = v_role;
    v_limit := coalesce(v_limit, 0);

    select coalesce(sum(points), 0) into v_used
      from points_ledger
     where supervisor_id = v_actor
       and revoked_at is null
       and awarded_at >= date_trunc('day', now());

    if v_used + v_points > v_limit then
      raise exception 'DAILY_LIMIT_EXCEEDED used=% limit=% requested=%',
        v_used, v_limit, v_points
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

-- ── تراجع المشرف عن منحه ────────────────────────────────────────────────
-- ثلاثة شروط، كلها في جملة التحديث نفسها فلا يفصل بينها سباق:
--   * المنح منحُه هو — لا يلغي مشرفٌ منح غيره، فذلك للمدير وحده.
--   * لم يُلغَ من قبل.
--   * لم يمضِ عليه أكثر من دقيقتين ونصف. الواجهة تعرض دقيقتين؛ نصف الدقيقة
--     هامشٌ لفرق الساعة بين الجهاز والخادم ولتأخّر الشبكة، لا نافذة أطول.
--
-- النقاط المُلغاة تعود إلى رصيد المشرف اليومي تلقائيًا: الحد يُحسب من
-- السجلات الحيّة وحدها.
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

  -- نفس ترتيب الأقفال في award_points (المشرف ثم الطالب): التراجع والمنح
  -- المتزامنان على نفس الطالب لا يتعارضان
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
  returning points, tier into v_points, v_tier;

  if not found then
    raise exception 'UNDO_WINDOW_PASSED' using errcode = 'P0001';
  end if;

  insert into audit_log (actor_id, action, entity, entity_id, details)
  values (v_actor, 'undo_award', 'points_ledger', p_ledger_id::text,
          jsonb_build_object('student_id', v_student, 'points', v_points, 'tier', v_tier));

  return jsonb_build_object(
    'ledger_id',  p_ledger_id,
    'student_id', v_student,
    'points',     v_points,
    'tier',       v_tier
  );
end;
$$;

revoke all on function undo_my_award(bigint) from public;
grant execute on function undo_my_award(bigint) to authenticated;

commit;
