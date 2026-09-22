-- ════════════════════════════════════════════════════════════════════════
-- سبّاق — تخطيط الأرباع: كل فئة نقاط بستانٌ قائم بذاته
--
-- الحلزون العام كان يضع النبتة في الخانة التالية أيًّا كان نوعها، فتخرج
-- المزرعة خليطًا: فطر بجانب زهرة بجانب شجرة. هنا تملك كل فئة ربعًا من
-- الشبكة تنمو فيه من المركز للخارج.
--
-- هذا الملف يُطبَّق مرّة واحدة فوق 0001–0004، ويعيد رسم المزارع القائمة
-- بالتخطيط الجديد في نفس المعاملة: لا لحظة تكون فيها بعض المزارع بالتخطيط
-- القديم وبعضها بالجديد.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── الإحداثي: (الفئة، ترتيب النبتة داخل فئتها) → خانة ────────────────────
-- الخانات مرتّبة داخل الربع قشرةً قشرة من الزاوية للخارج. القشرة s فيها
-- 2s−1 خانة والمجموع حتى نهايتها s²، فالجذر يعطي القشرة مباشرة.
--
-- **القيد الحاكم:** الموضع دالّة صرفة في الوسيطين. لا يعتمد على تاريخ المنح
-- ولا على أعداد الفئات الأخرى، وإلا انتقلت نبتة زُرعت أمس لأن الطالب نال
-- اليوم نقطة من فئة أخرى.
--
-- مُطابِقة حرفيًا لـ quadrantCoord في src/lib/layout.ts، ويحرس التطابقَ
-- tests/quadrant-parity.test.ts على مخرَج هذه الدالة نفسها.
create or replace function quadrant_coord(
  p_tier point_tier, n integer, out x integer, out y integer
)
language plpgsql
immutable
strict
as $$
declare
  s  integer;
  r  integer;
  sx integer;
  sy integer;
begin
  if n < 0 then
    raise exception 'quadrant_coord: rank must be non-negative, got %', n;
  end if;

  -- تقدير القشرة ثم تصحيحه: جذرٌ يعود 1.9999 بدل 2 عند مربّع كامل يُنقص
  -- قشرةً فتقع النبتة على المحور، أي خارج ربعها وفوق نبتة أخرى
  s := floor(sqrt(n::double precision))::integer + 1;
  while s > 1 and n < (s - 1) * (s - 1) loop
    s := s - 1;
  end loop;
  while n >= s * s loop
    s := s + 1;
  end loop;

  r := n - (s - 1) * (s - 1);
  if r < s then
    x := s;              y := r + 1;
  else
    x := 2 * s - 1 - r;  y := s;
  end if;

  -- الربع الذي تملكه كل فئة
  case p_tier
    when 'green'  then sx :=  1; sy :=  1;
    when 'yellow' then sx := -1; sy :=  1;
    when 'purple' then sx := -1; sy := -1;
    else               sx :=  1; sy := -1;   -- red
  end case;

  x := x * sx;
  y := y * sy;
end;
$$;

grant execute on function quadrant_coord(point_tier, integer) to anon, authenticated;

-- ── منح النقاط: الإحداثي من ترتيب النبتة داخل فئتها ──────────────────────
-- كل ما عدا حساب الإحداثي مطابق لـ 0002: القفل الاستشاري على المشرف، ثم
-- قفل صف الطالب، ثم النطاق، ثم الحد اليومي.
--
-- الترتيب يُعدّ **شاملًا السحوبات**: النبتة المسحوبة تبقى محجوزة خانتها،
-- وإلا أعاد المنح التالي استعمال الخانة نفسها. وهو يُعدّ تحت قفل صف الطالب،
-- فمنحان متزامنان لنفس الفئة لا يقرآن نفس العدد.
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
  v_rank     integer;
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

  select count(*) into v_rank
    from points_ledger
   where student_id = p_student_id
     and semester_id = v_semester
     and tier = p_tier;

  select q.x, q.y into v_x, v_y from quadrant_coord(p_tier, v_rank) q;

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

-- ── إعادة رسم المزارع القائمة ────────────────────────────────────────────
-- ترتيب كل نبتة داخل فئتها بترتيب منحها (slot_index)، شاملًا المسحوبة
-- كما يفعل award_points — فأول منح بعد هذا الملف يُكمل من حيث انتهت.
with ranked as (
  select id, tier,
         (row_number() over (
            partition by student_id, semester_id, tier
            order by slot_index
          ) - 1)::integer as rnk
    from points_ledger
)
update points_ledger l
   set grid_x = q.x,
       grid_y = q.y
  from ranked r
  cross join lateral quadrant_coord(r.tier, r.rnk) q
 where l.id = r.id;

-- ── خطّ دفاع أخير: نبتتان لا تقعان على خانة واحدة ────────────────────────
-- التخطيط يضمن ذلك رياضيًا، وقفل الصف يضمنه تزامنيًا. القيد يجعل أي عطب
-- مستقبلي في أيٍّ منهما خطأً صريحًا بدل نبتتين متراكبتين لا يلاحظهما أحد.
alter table points_ledger
  add constraint points_ledger_one_plant_per_cell
  unique (student_id, semester_id, grid_x, grid_y);

-- الحلزون العام لم يعد يحدّد أي موضع
drop function if exists spiral_coord(integer);

commit;
