-- ════════════════════════════════════════════════════════════════════════
-- سبّاق — الدوال: الخوارزمية الحلزونية، منح النقاط، إدارة الفصول
-- ════════════════════════════════════════════════════════════════════════

-- ── تطبيع أسماء الطلاب للبحث ──────────────────────────────────────────────
-- يوحّد الهمزات والتاء المربوطة ويحذف التشكيل، فالبحث عن "احمد" يجد "أحمد".
create or replace function normalize_arabic(input text)
returns text
language sql
immutable
strict
as $$
  select lower(
    regexp_replace(
      translate(
        input,
        'أإآءؤئىة'  || U&'\0610' || U&'\0611' || U&'\0612' || U&'\0613'
                    || U&'\0614' || U&'\0615' || U&'\064B' || U&'\064C'
                    || U&'\064D' || U&'\064E' || U&'\064F' || U&'\0650'
                    || U&'\0651' || U&'\0652' || U&'\0653' || U&'\0654'
                    || U&'\0655' || U&'\0670',
        -- محرَّف بمحرَف مقابل 'أإآءؤئىة': أ إ آ ← ا، ء ← ء، ؤ ← و، ئ ← ي،
        -- ى ← ي، ة ← ه. الطول ثمانية بالضبط، فكل التشكيل بعده يُحذف.
        'اااءوييه'
      ),
      '\s+', ' ', 'g'
    )
  );
$$;

-- يُبقي search_name متزامنًا مع full_name دائمًا
create or replace function students_sync_search_name()
returns trigger
language plpgsql
as $$
begin
  new.search_name := trim(normalize_arabic(new.full_name));
  return new;
end;
$$;

create trigger students_search_name_sync
  before insert or update of full_name on students
  for each row execute function students_sync_search_name();

-- ── الخوارزمية الحلزونية: خانة → إحداثيات ────────────────────────────────
-- حلزون مربعي يبدأ من المركز (0,0) ويتوسّع للخارج طبقة طبقة.
-- الطبقة k تحتوي على (2k+1)² خانة تراكميًا، فـ 90 يومًا × عدة نقاط تكفيها
-- طبقات قليلة، والشبكة تتوسّع بلا حد نظريًا.
--
-- هذه الدالة مُطابِقة حرفيًا لـ src/lib/spiral.ts. أي تعديل هنا يجب أن
-- يُنسخ هناك، وإلا اختلفت إحداثيات الخادم عن رسم العميل.
create or replace function spiral_coord(n integer, out x integer, out y integer)
language plpgsql
immutable
as $$
declare
  k       integer;
  leg     integer;
  ring_lo integer;
  off     integer;
  side    integer;
  p       integer;
begin
  if n < 0 then
    raise exception 'spiral_coord: slot index must be non-negative, got %', n;
  end if;

  if n = 0 then
    x := 0; y := 0;
    return;
  end if;

  -- تقدير الطبقة، ثم تصحيحه. التصحيح يحمي من خطأ الفاصلة العائمة عند
  -- المربعات الكاملة (n = (2k+1)² − 1) حيث ceil قد يزيد طبقة زائدة.
  k := ceil((sqrt(n::double precision + 1) - 1) / 2.0)::integer;
  while k > 0 and n < (2 * k - 1) * (2 * k - 1) loop
    k := k - 1;
  end loop;
  while n >= (2 * k + 1) * (2 * k + 1) loop
    k := k + 1;
  end loop;

  leg     := 2 * k;
  ring_lo := (2 * k - 1) * (2 * k - 1);
  off     := n - ring_lo;
  side    := off / leg;
  p       := off % leg;

  case side
    when 0 then x := k;              y := -k + p + 1;   -- يمين، صعودًا
    when 1 then x := k - p - 1;      y := k;            -- أعلى، يسارًا
    when 2 then x := -k;             y := k - p - 1;    -- يسار، نزولًا
    else        x := -k + p + 1;     y := -k;           -- أسفل، يمينًا
  end case;
end;
$$;

-- ── فئات النقاط ───────────────────────────────────────────────────────────
create or replace function tier_points(t point_tier)
returns smallint
language sql
immutable
strict
as $$
  select case t
    when 'green'  then 10::smallint
    when 'yellow' then 20::smallint
    when 'purple' then 30::smallint
    when 'red'    then 50::smallint
  end;
$$;

-- ── مساعدات الصلاحيات ────────────────────────────────────────────────────
create or replace function current_role_of()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from users where id = auth.uid() and is_active;
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(current_role_of() = 'admin', false);
$$;

create or replace function supervises_group(p_group_id smallint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from supervisor_groups
     where supervisor_id = auth.uid() and group_id = p_group_id
  );
$$;

-- ── منح النقاط — العملية الذرّية الأساسية ─────────────────────────────────
-- كل شيء في معاملة واحدة: التحقق من الصلاحية، ثم الحد اليومي، ثم حجز خانة
-- الحلزون تحت قفل صف الطالب، ثم إدراج السجل. مشرفان يضغطان على نفس الطالب
-- في نفس اللحظة لا يمكن أن يحصلا على نفس الإحداثيات.
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

  -- قفل استشاري على المشرف نفسه، قبل أي قفل آخر. قفل صف الطالب وحده يسلسل
  -- المنح على طالب واحد، لكن الحد اليومي مجموعٌ عبر كل الطلاب: مشرف يمنح
  -- طالبين في نفس اللحظة من جهازين كان كلا الطلبين يقرأ نفس v_used ويمرّ،
  -- فيتجاوز حدّه. الترتيب ثابت (المشرف ثم الطالب) فلا يحدث تعارض أقفال.
  perform pg_advisory_xact_lock(hashtextextended(v_actor::text, 0));

  select id into v_semester from semesters where is_active;
  if v_semester is null then
    raise exception 'NO_ACTIVE_SEMESTER' using errcode = 'P0002';
  end if;

  -- قفل صف الطالب يسلسل كل المنح المتزامنة عليه
  select group_id, next_slot_index
    into v_group, v_slot
    from students
   where id = p_student_id and is_active
     for update;

  if not found then
    raise exception 'STUDENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- نطاق مشرف المجموعة محصور بمجموعاته. مشرف اللجنة والمدير: الجميع.
  if v_role = 'group_supervisor'
     and not exists (
       select 1 from supervisor_groups
        where supervisor_id = v_actor and group_id = v_group
     )
  then
    raise exception 'STUDENT_OUT_OF_SCOPE' using errcode = '42501';
  end if;

  -- الحد اليومي صارم على المشرفين. المدير معفى: الوثيقة تمنحه حق التجاوز
  -- والتعديل العام، وكل تجاوزاته مسجّلة في points_ledger باسمه.
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

  select s.x, s.y into v_x, v_y from spiral_coord(v_slot) s;

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

-- ── حالة الحد اليومي للمستخدم الحالي (تقرأها واجهة المشرف) ───────────────
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
  v_limit integer;
  v_used  integer;
begin
  select role into v_role from users where id = v_actor and is_active;
  if v_role is null then
    return jsonb_build_object('role', null, 'limit', 0, 'used', 0, 'remaining', 0);
  end if;

  select coalesce(sum(points), 0) into v_used
    from points_ledger
   where supervisor_id = v_actor
     and revoked_at is null
     and awarded_at >= date_trunc('day', now());

  if v_role = 'admin' then
    -- المدير بلا حد: نُرجع -1 لتعرف الواجهة أنها لا ترسم شريط استهلاك
    return jsonb_build_object('role', v_role, 'limit', -1, 'used', v_used, 'remaining', -1);
  end if;

  select points_perday into v_limit from daily_limits where role = v_role;
  v_limit := coalesce(v_limit, 0);

  return jsonb_build_object(
    'role',      v_role,
    'limit',     v_limit,
    'used',      v_used,
    'remaining', greatest(0, v_limit - v_used)
  );
end;
$$;

-- ── سحب نقطة (المدير فقط) ─────────────────────────────────────────────────
-- إلغاء ناعم: السجل يبقى، ولا نعيد استخدام خانة الحلزون. النبتة تختفي من
-- المزرعة لكن الخانة تبقى محجوزة، فلا تتغيّر مواضع النبتات الأخرى.
create or replace function revoke_points(p_ledger_id bigint, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'ADMIN_ONLY' using errcode = '42501';
  end if;

  update points_ledger
     set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = p_reason
   where id = p_ledger_id and revoked_at is null;

  if not found then
    raise exception 'LEDGER_ROW_NOT_FOUND_OR_ALREADY_REVOKED' using errcode = 'P0002';
  end if;

  insert into audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'revoke_points', 'points_ledger', p_ledger_id::text,
          jsonb_build_object('reason', p_reason));
end;
$$;

-- ── تعديل الحد اليومي (المدير فقط) ────────────────────────────────────────
create or replace function set_daily_limit(p_role user_role, p_points integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old integer;
begin
  if not is_admin() then
    raise exception 'ADMIN_ONLY' using errcode = '42501';
  end if;
  if p_points < 0 then
    raise exception 'LIMIT_MUST_BE_NON_NEGATIVE' using errcode = '22023';
  end if;
  if p_role = 'admin' then
    raise exception 'ADMIN_HAS_NO_LIMIT' using errcode = '22023';
  end if;

  select points_perday into v_old from daily_limits where role = p_role;

  insert into daily_limits (role, points_perday, updated_by, updated_at)
  values (p_role, p_points, auth.uid(), now())
  on conflict (role) do update
    set points_perday = excluded.points_perday,
        updated_by    = excluded.updated_by,
        updated_at    = now();

  insert into audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'set_daily_limit', 'daily_limits', p_role::text,
          jsonb_build_object('from', v_old, 'to', p_points));
end;
$$;

-- ── نهاية الفصل: أرشفة، تصفير، أو الاثنان ────────────────────────────────
-- المدير يختار: p_archive يحفظ لقطة كاملة، p_reset يصفّر المزارع ويبدأ فصلًا
-- جديدًا. تمريرهما معًا يؤرشف أولًا ثم يصفّر — وهو الاستخدام المعتاد.
create or replace function close_semester(
  p_archive      boolean,
  p_reset        boolean,
  p_next_name_ar text default null,
  p_next_name_en text default null,
  p_next_start   date default null,
  p_next_end     date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current  uuid;
  v_snapshot jsonb;
  v_next     uuid;
  v_archived integer := 0;
begin
  if not is_admin() then
    raise exception 'ADMIN_ONLY' using errcode = '42501';
  end if;

  select id into v_current from semesters where is_active;
  if v_current is null then
    raise exception 'NO_ACTIVE_SEMESTER' using errcode = 'P0002';
  end if;

  if p_archive then
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_snapshot
      from (
        select s.id            as student_id,
               s.full_name,
               g.code          as group_code,
               g.name_ar       as group_name_ar,
               s.grade,
               coalesce(sum(l.points), 0)  as total_points,
               count(l.id)                 as plant_count
          from students s
          join groups g on g.id = s.group_id
          left join points_ledger l
                 on l.student_id = s.id
                and l.semester_id = v_current
                and l.revoked_at is null
         group by s.id, s.full_name, g.code, g.name_ar, s.grade
      ) t;

    insert into semester_archives (semester_id, snapshot, created_by)
    values (v_current, v_snapshot, auth.uid());

    v_archived := jsonb_array_length(v_snapshot);
  end if;

  update semesters set is_active = false, archived_at = now() where id = v_current;

  if p_reset then
    if p_next_name_ar is null or p_next_start is null or p_next_end is null then
      raise exception 'NEXT_SEMESTER_DETAILS_REQUIRED' using errcode = '22023';
    end if;

    insert into semesters (name_ar, name_en, start_date, end_date, is_active)
    values (p_next_name_ar, coalesce(p_next_name_en, p_next_name_ar),
            p_next_start, p_next_end, true)
    returning id into v_next;

    -- الفصل الجديد يبدأ بمزارع فارغة: العدّاد يرجع للصفر فتُغرَس أول نبتة
    -- في المركز من جديد. سجل الفصل السابق يبقى مرتبطًا بمعرّفه.
    update students set next_slot_index = 0;
  end if;

  insert into audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'close_semester', 'semesters', v_current::text,
          jsonb_build_object('archived', p_archive, 'reset', p_reset,
                             'students_archived', v_archived,
                             'next_semester', v_next));

  return jsonb_build_object(
    'closed_semester',   v_current,
    'archived',          p_archive,
    'students_archived', v_archived,
    'new_semester',      v_next
  );
end;
$$;

-- ── الصلاحيات على الدوال ──────────────────────────────────────────────────
revoke all on function award_points(uuid, point_tier)        from public;
revoke all on function revoke_points(bigint, text)           from public;
revoke all on function set_daily_limit(user_role, integer)   from public;
revoke all on function close_semester(boolean, boolean, text, text, date, date) from public;
revoke all on function my_daily_status()                     from public;

grant execute on function award_points(uuid, point_tier)      to authenticated;
grant execute on function revoke_points(bigint, text)         to authenticated;
grant execute on function set_daily_limit(user_role, integer) to authenticated;
grant execute on function close_semester(boolean, boolean, text, text, date, date) to authenticated;
grant execute on function my_daily_status()                   to authenticated;

-- دوال القراءة الخالصة متاحة للعامّة: صفحة المزرعة لا تسجّل دخولًا
grant execute on function spiral_coord(integer)  to anon, authenticated;
grant execute on function tier_points(point_tier) to anon, authenticated;
grant execute on function normalize_arabic(text)  to anon, authenticated;
