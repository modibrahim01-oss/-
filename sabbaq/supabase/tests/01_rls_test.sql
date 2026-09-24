-- ════════════════════════════════════════════════════════════════════════
-- اختبارات العزل الحقيقية — تُنفَّذ باستعلامات SQL مباشرة لا عبر الواجهة.
--
-- تتحقق من أن الضمانات المعلنة تصمد أمام مستخدم يعرف SQL ويتجاوز الواجهة:
--  1. مشرف المجموعة لا يمنح نقاطًا خارج مجموعاته
--  2. الحد اليومي صارم ولا يُتجاوز بنقطة واحدة
--  3. مشرف اللجنة يمنح الجميع، لكن بحدّه الخاص
--  4. لا insert مباشر على points_ledger لأي مشرف
--  5. العامّة (anon) تقرأ المزارع ولا تكتب شيئًا
--  6. المدير معفى من الحد
--  7. كل فئة في ربعها، تبدأ من زاويته ولا تخرج منه
--  8. مشرفان متزامنان لا يحصلان على نفس الخانة
--
-- التشغيل: psql -d sabbaq_test -v ON_ERROR_STOP=1 -f 01_rls_test.sql
-- ════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on
-- notice لا warning: أسطر PASS هي مخرَج الاختبار المفيد، وإخفاؤها يجعل
-- النجاح والتخطّي الصامت يبدوان متشابهين.
set client_min_messages = notice;

-- ── مساعدات التوكيد ──────────────────────────────────────────────────────
create or replace function assert(cond boolean, label text)
returns void language plpgsql as $$
begin
  if cond then
    raise notice 'PASS  %', label;
  else
    raise exception 'FAIL  %', label;
  end if;
end;
$$;

-- يشغّل تعبيرًا بهوية معيّنة ويعيد رسالة الخطأ إن وقع، أو null عند النجاح
create or replace function try_as(p_uid uuid, p_sql text)
returns text language plpgsql as $$
declare
  v_err text := null;
begin
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  begin
    execute p_sql;
  exception when others then
    v_err := sqlerrm;
  end;
  return v_err;
end;
$$;

-- ── تهيئة بيانات الاختبار ────────────────────────────────────────────────
-- الترتيب مقصود: daily_limits.updated_by و semester_archives.created_by
-- يشيران إلى users، فلا بد من تصفيرهما قبل حذف المستخدمين وإلا فشل الملف
-- في التشغيل الثاني بخطأ مفتاح أجنبي.
truncate points_ledger, supervisor_groups, students, audit_log,
         semester_archives restart identity cascade;
update daily_limits set updated_by = null;
update tier_limits set updated_by = null;
truncate supervisor_tier_limits, staff_login_keys;
delete from users;
delete from auth.users;

-- فصل واحد نشط وحديث في كل تشغيل، فاختبارات الأرشفة والتصفير حتمية
delete from semesters;
insert into semesters (name_ar, name_en, start_date, end_date, is_active)
values ('فصل الاختبار', 'Test semester', current_date, current_date + 90, true);

-- الإدراج في auth.users وحده: trigger handle_new_auth_user ينشئ صف
-- public.users. هذا هو المسار الحقيقي في الإنتاج، فنختبره بدل أن نُدرج
-- الصفوف يدويًا. البيانات الوصفية تحمل دورًا مزوّرًا عن قصد: المفتاح العام
-- في متناول أي زائر، والـ trigger يجب أن يتجاهل ما يضعه فيها.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'admin@test',
   '{"full_name_ar":"المدير","role":"admin"}'),
  ('22222222-2222-2222-2222-222222222222', 'gsup-basil@test',
   '{"full_name_ar":"مشرف باسل","role":"group_supervisor"}'),
  ('33333333-3333-3333-3333-333333333333', 'gsup-qabas@test',
   '{"full_name_ar":"مشرف قبس","role":"group_supervisor"}'),
  ('44444444-4444-4444-4444-444444444444', 'committee@test',
   '{"full_name_ar":"مشرف اللجنة","role":"admin"}');

do $$
begin
  perform assert(
    (select count(*) from users) = 4,
    '0a. auth trigger created a public.users row for every new account');
  -- الضمانة الأمنية: لا ترقية ذاتية. من يسجّل نفسه بـ role=admin في
  -- user_metadata يخرج مشرف مجموعة، فترقيته تحتاج مديرًا موجودًا سلفًا.
  perform assert(
    (select count(*) from users where role <> 'group_supervisor') = 0,
    '0b. auth trigger IGNORES the role in user_metadata — no self-promotion');
end;
$$;

-- الأدوار تُسند بعد الإنشاء، كما تفعل لوحة المدير (سياسة users_admin_write)
update users set role = 'admin'
 where id = '11111111-1111-1111-1111-111111111111';
update users set role = 'committee_supervisor'
 where id = '44444444-4444-4444-4444-444444444444';

-- مشرف (أ) على باسل ١ (id=4)، مشرف (ب) على قبس (id=1)
insert into supervisor_groups (supervisor_id, group_id) values
  ('22222222-2222-2222-2222-222222222222', 4),
  ('33333333-3333-3333-3333-333333333333', 1);

insert into students (id, full_name, group_id, grade) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'طالب باسل', 4, 'الخامس'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'طالب قبس',  1, 'الأول');

-- الحد بعدد النبتات من كل فئة (0007): مشرف المجموعة سنبلتان وزهرة، ولا
-- نبتات ولا أشجار؛ مشرف اللجنة شجرتان فقط
update tier_limits set per_day = 0;
update tier_limits set per_day = 2 where role = 'group_supervisor' and tier = 'green';
update tier_limits set per_day = 1 where role = 'group_supervisor' and tier = 'purple';
update tier_limits set per_day = 2 where role = 'committee_supervisor' and tier = 'red';

-- ── 1. مشرف المجموعة لا يمنح خارج مجموعاته ──────────────────────────────
do $$
declare v_err text;
begin
  -- مشرف باسل يمنح طالب باسل: يجب أن ينجح
  v_err := try_as('22222222-2222-2222-2222-222222222222',
    $q$select award_points('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'green')$q$);
  perform assert(v_err is null,
    '1a. group supervisor awards inside own group');

  -- نفس المشرف يمنح طالب قبس: يجب أن يُرفض
  v_err := try_as('22222222-2222-2222-2222-222222222222',
    $q$select award_points('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'green')$q$);
  perform assert(v_err like '%STUDENT_OUT_OF_SCOPE%',
    '1b. group supervisor BLOCKED outside own group');

  perform assert(
    (select count(*) from points_ledger
      where student_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = 0,
    '1c. no ledger row leaked for the out-of-scope student');
end;
$$;

-- ── 2. الحد اليومي صارم، بعدد نبتات كل فئة على حدة ─────────────────────
do $$
declare v_err text; v_used integer;
begin
  -- حدّ الزهور ١: الأولى تمرّ
  v_err := try_as('22222222-2222-2222-2222-222222222222',
    $q$select award_points('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'purple')$q$);
  perform assert(v_err is null, '2a. award within the tier''s daily count succeeds');

  -- والثانية تُرفض: نفدت الزهور
  v_err := try_as('22222222-2222-2222-2222-222222222222',
    $q$select award_points('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'purple')$q$);
  perform assert(v_err like '%DAILY_LIMIT_EXCEEDED%',
    '2b. an award past the tier''s daily count is BLOCKED');

  -- نفاد فئة لا يمسّ غيرها: السنبلة الثانية (من ٢) تمرّ
  v_err := try_as('22222222-2222-2222-2222-222222222222',
    $q$select award_points('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'green')$q$);
  perform assert(v_err is null, '2c. another tier is unaffected and reaches its limit exactly');

  select count(*) into v_used from points_ledger
   where supervisor_id = '22222222-2222-2222-2222-222222222222'
     and tier = 'green' and revoked_at is null;
  perform assert(v_used = 2, '2d. the tier count is exactly its limit, never above');

  v_err := try_as('22222222-2222-2222-2222-222222222222',
    $q$select award_points('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'green')$q$);
  perform assert(v_err like '%DAILY_LIMIT_EXCEEDED%',
    '2e. an exhausted tier stays blocked');

  -- فئة حدّها صفر ممنوعة من أول منح
  v_err := try_as('22222222-2222-2222-2222-222222222222',
    $q$select award_points('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'yellow')$q$);
  perform assert(v_err like '%DAILY_LIMIT_EXCEEDED%', '2f. a tier with a zero limit is blocked');

  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  perform assert(
    (my_daily_status()->'tiers'->'green'->>'remaining')::int = 0
    and (my_daily_status()->'tiers'->'purple'->>'used')::int = 1
    and (my_daily_status()->'tiers'->'red'->>'limit')::int = 0,
    '2g. my_daily_status reports each tier''s limit, use and remainder');
end;
$$;

-- ── 3. مشرف اللجنة: كل الطلاب، وبحدّه الخاص ─────────────────────────────
do $$
declare v_err text;
begin
  v_err := try_as('44444444-4444-4444-4444-444444444444',
    $q$select award_points('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'red')$q$);
  perform assert(v_err is null, '3a. committee supervisor awards across groups (basil)');

  v_err := try_as('44444444-4444-4444-4444-444444444444',
    $q$select award_points('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'red')$q$);
  perform assert(v_err is null, '3b. committee supervisor awards across groups (qabas)');

  -- حدّه شجرتان، استهلكهما: الثالثة تُرفض
  v_err := try_as('44444444-4444-4444-4444-444444444444',
    $q$select award_points('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'red')$q$);
  perform assert(v_err like '%DAILY_LIMIT_EXCEEDED%',
    '3c. committee supervisor bound by their own limit');
end;
$$;

-- ── 4. لا insert مباشر على السجل (تجاوز award_points) ───────────────────
do $$
declare v_err text;
begin
  set local role authenticated;
  v_err := try_as('22222222-2222-2222-2222-222222222222', $q$
    insert into points_ledger
      (student_id, supervisor_id, semester_id, points, tier, slot_index, grid_x, grid_y)
    select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
           '22222222-2222-2222-2222-222222222222',
           (select id from semesters where is_active), 50, 'red', 999, 9, 9
  $q$);
  reset role;
  perform assert(v_err is not null,
    '4. supervisor CANNOT insert into points_ledger directly (bypassing the limit)');
end;
$$;

-- ── 5. العامّة تقرأ ولا تكتب ────────────────────────────────────────────
do $$
declare v_count integer; v_err text;
begin
  set local role anon;
  select count(*) into v_count from student_farms;
  perform assert(v_count = 2, '5a. anon CAN read farms without logging in');

  select count(*) into v_count from points_ledger where revoked_at is null;
  perform assert(v_count > 0, '5b. anon CAN read the ledger that builds the farm');

  begin
    insert into students (full_name, group_id) values ('متسلل', 1);
    v_err := null;
  exception when others then
    v_err := sqlerrm;
  end;
  perform assert(v_err is not null, '5c. anon CANNOT insert a student');

  begin
    update students set full_name = 'محرَّف'
     where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    v_err := case when found then null else 'no rows' end;
  exception when others then
    v_err := sqlerrm;
  end;
  reset role;
  perform assert(
    (select full_name from students where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
      = 'طالب باسل',
    '5d. anon CANNOT modify a student name');
end;
$$;

-- ── 6. المدير معفى من الحد ──────────────────────────────────────────────
do $$
declare v_err text; v_total integer;
begin
  for i in 1..6 loop
    v_err := try_as('11111111-1111-1111-1111-111111111111',
      $q$select award_points('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'red')$q$);
    perform assert(v_err is null, format('6a. admin award #%s is not limited', i));
  end loop;

  select sum(points) into v_total from points_ledger
   where supervisor_id = '11111111-1111-1111-1111-111111111111';
  perform assert(v_total = 300,
    '6b. admin awarded 300 points in one day with no limit applied');
end;
$$;

-- ── 7. تخطيط الأرباع: كل فئة في ربعها، وتبدأ من زاويته ────────────────
do $$
declare v_slots integer[];
begin
  -- أول نبتة من كل فئة في زاوية ربعها الملاصقة للمركز (±1,±1)
  perform assert((select count(*) from (
      select distinct on (tier) tier, grid_x, grid_y
        from points_ledger
       where student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       order by tier, slot_index) f
     where (f.grid_x, f.grid_y) is distinct from (
       case f.tier when 'green' then 1 when 'yellow' then -1
                   when 'purple' then 1 else -1 end,
       case f.tier when 'green' then 1 when 'yellow' then 1
                   when 'purple' then -1 else -1 end)) = 0,
    '7a. the first plant of each tier sits at its quadrant''s corner');

  -- ولا نبتة خارج ربع فئتها ولا على المحورين
  perform assert((select count(*) from points_ledger
     where student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       and not (
         (tier = 'green'  and grid_x > 0 and grid_y > 0) or
         (tier = 'yellow' and grid_x < 0 and grid_y > 0) or
         (tier = 'purple' and grid_x > 0 and grid_y < 0) or
         (tier = 'red'    and grid_x < 0 and grid_y < 0))) = 0,
    '7d. every plant lies inside its own tier''s quadrant');

  select array_agg(slot_index order by slot_index) into v_slots
    from points_ledger where student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  perform assert(v_slots = array(select generate_series(0, array_length(v_slots, 1) - 1)),
    '7b. slots are consecutive from zero with no gaps or repeats');

  perform assert(
    (select count(*) from (
       select grid_x, grid_y, count(*) c
         from points_ledger
        where student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
        group by grid_x, grid_y having count(*) > 1
     ) dup) = 0,
    '7c. no two plants share a coordinate');
end;
$$;

-- ── 8. التزامن: نفس الطالب من مشرفين لا يعطي نفس الخانة ────────────────
-- القيد unique(student_id, semester_id, slot_index) هو خط الدفاع الأخير؛
-- قفل الصف في award_points يمنع الوصول إليه أصلًا.
do $$
declare v_err text;
begin
  v_err := try_as('11111111-1111-1111-1111-111111111111', $q$
    insert into points_ledger
      (student_id, supervisor_id, semester_id, points, tier, slot_index, grid_x, grid_y)
    select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
           '11111111-1111-1111-1111-111111111111',
           (select id from semesters where is_active), 10, 'green', 0, 0, 0
  $q$);
  perform assert(v_err like '%duplicate key%' or v_err like '%unique%',
    '8. duplicate slot for the same student is rejected by the unique constraint');
end;
$$;

-- ── 9. سحب النقاط: المدير فقط، والخانة لا تُعاد ─────────────────────────
do $$
declare v_err text; v_id bigint; v_before integer; v_after integer;
begin
  select id into v_id from points_ledger
   where student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' order by id limit 1;

  v_err := try_as('22222222-2222-2222-2222-222222222222',
    format($q$select revoke_points(%s, 'test')$q$, v_id));
  perform assert(v_err like '%ADMIN_ONLY%', '9a. supervisor CANNOT revoke points');

  select next_slot_index into v_before from students
   where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  v_err := try_as('11111111-1111-1111-1111-111111111111',
    format($q$select revoke_points(%s, 'test')$q$, v_id));
  perform assert(v_err is null, '9b. admin CAN revoke points');

  select next_slot_index into v_after from students
   where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  perform assert(v_before = v_after,
    '9c. revoking does NOT free the slot — other plants keep their positions');

  perform assert(
    (select revoked_at is not null from points_ledger where id = v_id),
    '9d. revoke is soft: the row survives for the audit trail');
end;
$$;

-- ── 9e. الخانة المسحوبة تعود لأول منح تالٍ من فئتها ─────────────────────
-- المنح يختار أول خانة شاغرة من زاوية الربع للخارج؛ النبتة المسحوبة لا تشغل
-- خانتها، فالمنح التالي من فئتها يملأ الفجوة بدل أن يتركها في البستان.
do $$
declare v_tier point_tier; v_x integer; v_y integer; v_r jsonb;
begin
  select tier, grid_x, grid_y into v_tier, v_x, v_y from points_ledger
   where student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
     and revoked_at is not null
   order by id limit 1;

  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  v_r := award_points('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', v_tier);
  perform assert(
    ((v_r->>'grid_x')::int, (v_r->>'grid_y')::int) = (v_x, v_y),
    '9e. a revoked plant''s cell is refilled by the next award of its tier — no holes');
end;
$$;

-- ── 9f. القيد يرفض نبتتين حيّتين على خانة واحدة مهما كان مصدرهما ──────────────────
do $$
declare v_err text;
begin
  begin
    update points_ledger set grid_x = 1, grid_y = 1
     where student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       and revoked_at is null
       and (grid_x, grid_y) <> (1, 1);
    v_err := null;
  exception when unique_violation then
    v_err := sqlerrm;
  end;
  perform assert(v_err is not null,
    '9f. the database refuses two plants on the same cell');
end;
$$;

-- ── 10. تعديل الحد: المدير فقط، واستثناء المشرف يتغلّب على حدّ دوره ─────
do $$
declare v_err text;
begin
  v_err := try_as('44444444-4444-4444-4444-444444444444',
    $q$select set_tier_limit('group_supervisor', 'green', 9999)$q$);
  perform assert(v_err like '%ADMIN_ONLY%', '10a. committee supervisor CANNOT raise limits');

  v_err := try_as('11111111-1111-1111-1111-111111111111',
    $q$select set_tier_limit('group_supervisor', 'green', 5)$q$);
  perform assert(v_err is null, '10b. admin CAN change a tier''s daily limit');

  perform assert(
    (select per_day from tier_limits where role = 'group_supervisor' and tier = 'green') = 5,
    '10c. the new limit is stored');

  -- ورفع الحد يُفرج عن المشرف الذي كان قد استنفده فورًا
  v_err := try_as('22222222-2222-2222-2222-222222222222',
    $q$select award_points('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'green')$q$);
  perform assert(v_err is null,
    '10d. raising the limit immediately unblocks an exhausted supervisor');

  -- استثناء لمشرف واحد: نبتة واحدة له، وحدّ دوره صفر
  v_err := try_as('11111111-1111-1111-1111-111111111111',
    $q$select set_supervisor_tier_limit('22222222-2222-2222-2222-222222222222', 'yellow', 1)$q$);
  perform assert(v_err is null, '10e. admin CAN set a per-supervisor override');

  v_err := try_as('22222222-2222-2222-2222-222222222222',
    $q$select award_points('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'yellow')$q$);
  perform assert(v_err is null, '10f. the override beats the role''s limit for that supervisor');

  v_err := try_as('33333333-3333-3333-3333-333333333333',
    $q$select award_points('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'yellow')$q$);
  perform assert(v_err like '%DAILY_LIMIT_EXCEEDED%',
    '10g. other supervisors of the same role keep the role''s limit');

  v_err := try_as('22222222-2222-2222-2222-222222222222',
    $q$select set_supervisor_tier_limit('22222222-2222-2222-2222-222222222222', 'yellow', 50)$q$);
  perform assert(v_err like '%ADMIN_ONLY%', '10h. a supervisor CANNOT set their own override');

  perform try_as('11111111-1111-1111-1111-111111111111',
    $q$select set_supervisor_tier_limit('22222222-2222-2222-2222-222222222222', 'yellow', null)$q$);
  perform assert(
    not exists (select 1 from supervisor_tier_limits
                 where supervisor_id = '22222222-2222-2222-2222-222222222222' and tier = 'yellow'),
    '10i. null removes the override');
end;
$$;

-- ── 11. أرشفة الفصل وتصفيره ─────────────────────────────────────────────
do $$
declare v_err text; v_snapshot jsonb; v_slots integer;
begin
  v_err := try_as('22222222-2222-2222-2222-222222222222',
    $q$select close_semester(true, false, null, null, null, null)$q$);
  perform assert(v_err like '%ADMIN_ONLY%', '11a. supervisor CANNOT close the semester');

  v_err := try_as('11111111-1111-1111-1111-111111111111',
    format($q$select close_semester(true, true, 'الفصل الثاني', 'Semester 2', %L, %L)$q$,
           current_date, current_date + 90));
  perform assert(v_err is null, '11b. admin CAN archive and reset');

  select snapshot into v_snapshot from semester_archives order by created_at desc limit 1;
  perform assert(jsonb_array_length(v_snapshot) = 2,
    '11c. the archive holds a snapshot row per student');

  perform assert(
    (select count(*) from students where next_slot_index <> 0) = 0,
    '11d. reset returns every farm to the centre for the new semester');

  perform assert(
    (select count(*) from semesters where is_active) = 1,
    '11e. exactly one semester is active after the roll-over');

  -- والسجل القديم لم يُمسّ: الأرشفة لا تحذف التاريخ
  perform assert(
    (select count(*) from points_ledger) > 0,
    '11f. the historical ledger survives the reset');
end;
$$;

-- ── 12. بعد التصفير: أول نبتة تعود لزاوية ربعها ───────────────────────────────
do $$
declare v_err text; v_x integer; v_y integer; v_sem uuid;
begin
  v_err := try_as('11111111-1111-1111-1111-111111111111',
    $q$select award_points('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'yellow')$q$);
  perform assert(v_err is null, '12a. awarding works in the new semester');

  select id into v_sem from semesters where is_active;
  select grid_x, grid_y into v_x, v_y from points_ledger
   where student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and semester_id = v_sem;
  perform assert(v_x = -1 and v_y = 1,
    '12b. the new semester''s first flower starts again at its quadrant''s corner');
end;
$$;

-- ── 13. سجل التدقيق مقصور على المدير ────────────────────────────────────
do $$
declare v_count integer;
begin
  perform set_config('request.jwt.claim.sub',
    '22222222-2222-2222-2222-222222222222', true);
  set local role authenticated;
  select count(*) into v_count from audit_log;
  reset role;
  perform assert(v_count = 0, '13a. supervisor sees NO audit rows');

  perform set_config('request.jwt.claim.sub',
    '11111111-1111-1111-1111-111111111111', true);
  set local role authenticated;
  select count(*) into v_count from audit_log;
  reset role;
  perform assert(v_count > 0, '13b. admin sees the audit trail');
end;
$$;

-- ── 13c/13d. الكتابة في السجل: المدير فقط، وباسمه ────────────────────────
-- إجراءات لوحة المدير تسجّل الأثر بعميل المستخدم لا بدالة SECURITY DEFINER،
-- فلا بد من سياسة إدراج. غيابها كان يُسقط كل سطر أثر بصمت.
do $$
declare v_err text;
begin
  v_err := try_as('22222222-2222-2222-2222-222222222222', $q$
    set local role authenticated;
    insert into audit_log (actor_id, action, entity)
    values ('22222222-2222-2222-2222-222222222222', 'forged', 'students');
  $q$);
  reset role;
  perform assert(v_err is not null, '13c. supervisor CANNOT write to the audit log');

  v_err := try_as('11111111-1111-1111-1111-111111111111', $q$
    set local role authenticated;
    insert into audit_log (actor_id, action, entity)
    values ('11111111-1111-1111-1111-111111111111', 'deactivate_student', 'students');
  $q$);
  reset role;
  perform assert(v_err is null, '13d. admin CAN write to the audit log');
end;
$$;

-- ── 14. المشرف لا يرى بقية المشرفين ─────────────────────────────────────
do $$
declare v_count integer;
begin
  perform set_config('request.jwt.claim.sub',
    '22222222-2222-2222-2222-222222222222', true);
  set local role authenticated;
  select count(*) into v_count from users;
  reset role;
  perform assert(v_count = 1, '14. supervisor sees only their own user row');
end;
$$;

-- ── 15. تراجع المشرف عن منحه ────────────────────────────────────────────
do $$
declare
  v_err text; v_r jsonb; v_id bigint; v_x integer; v_y integer;
  v_used_before integer; v_used_after integer;
begin
  -- رصيد كافٍ للمشرف حتى لا يتدخّل الحد اليومي في الاختبار
  perform try_as('11111111-1111-1111-1111-111111111111',
    $q$select set_tier_limit('group_supervisor', 'purple', 100000)$q$);

  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  v_used_before := (my_daily_status()->'tiers'->'purple'->>'used')::int;
  v_r := award_points('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'purple');
  v_id := (v_r->>'ledger_id')::bigint;
  v_x := (v_r->>'grid_x')::int; v_y := (v_r->>'grid_y')::int;

  -- مشرف آخر لا يلغي منح غيره
  v_err := try_as('44444444-4444-4444-4444-444444444444',
    format($q$select undo_my_award(%s)$q$, v_id));
  perform assert(v_err like '%UNDO_NOT_YOURS%', '15a. a supervisor CANNOT undo someone else''s award');

  v_err := try_as('22222222-2222-2222-2222-222222222222',
    format($q$select undo_my_award(%s)$q$, v_id));
  perform assert(v_err is null, '15b. a supervisor CAN undo their own fresh award');

  perform assert(
    (select revoked_at is not null and revoke_reason = 'undo' from points_ledger where id = v_id),
    '15c. undo is soft: the row survives, marked as an undo');

  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  v_used_after := (my_daily_status()->'tiers'->'purple'->>'used')::int;
  perform assert(v_used_after = v_used_before,
    '15d. the undone points return to the supervisor''s daily balance');

  v_err := try_as('22222222-2222-2222-2222-222222222222',
    format($q$select undo_my_award(%s)$q$, v_id));
  perform assert(v_err like '%UNDO_ALREADY_REVOKED%', '15e. the same award cannot be undone twice');

  -- المنح التالي من نفس الفئة يأخذ الخانة التي أخلاها التراجع
  v_r := award_points('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'purple');
  perform assert(((v_r->>'grid_x')::int, (v_r->>'grid_y')::int) = (v_x, v_y),
    '15f. the next award of the tier takes the cell the undo freed');

  -- منح قديم خرج من نافذة التراجع
  v_id := (v_r->>'ledger_id')::bigint;
  update points_ledger set awarded_at = now() - interval '10 minutes' where id = v_id;
  v_err := try_as('22222222-2222-2222-2222-222222222222',
    format($q$select undo_my_award(%s)$q$, v_id));
  perform assert(v_err like '%UNDO_WINDOW_PASSED%', '15g. an award older than the window cannot be undone');

  perform assert(
    (select count(*) from audit_log where action = 'undo_award') = 1,
    '15h. every undo is written to the audit log');
end;
$$;

-- ── 16. مفتاح المزرعة وترتيبها ──────────────────────────────────────────
do $$
declare
  v_err text; v_ok boolean; v_n integer; v_sem uuid;
  a_slot integer; a_x integer; a_y integer;
  b_slot integer; b_x integer; b_y integer;
  v_b record;
begin
  select id into v_sem from semesters where is_active;
  insert into student_farm_keys (student_id, token) values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', repeat('a', 43)),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', repeat('b', 43));

  -- العامّة لا ترى المفاتيح
  set local role anon;
  begin
    select count(*) into v_n from student_farm_keys;
    v_err := null;
  exception when others then v_err := sqlerrm;
  end;
  reset role;
  perform assert(v_err is not null, '16a. anon CANNOT read farm keys');

  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  set local role authenticated;
  select count(*) into v_n from student_farm_keys;
  reset role;
  perform assert(v_n = 0, '16b. a supervisor sees NO farm keys');

  set local role anon;
  v_ok := farm_key_ok('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', repeat('a', 43));
  reset role;
  perform assert(v_ok, '16c. the right key opens its own farm');
  perform assert(not farm_key_ok('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', repeat('b', 43)),
    '16d. another student''s key does NOT open this farm');

  -- نبتتان حيّتان للطالب (أ) في الفصل النشط
  select slot_index, grid_x, grid_y into a_slot, a_x, a_y from points_ledger
   where student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and semester_id = v_sem and revoked_at is null
   order by slot_index limit 1;
  select slot_index, grid_x, grid_y into b_slot, b_x, b_y from points_ledger
   where student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and semester_id = v_sem and revoked_at is null
   order by slot_index offset 1 limit 1;

  v_err := try_as('00000000-0000-0000-0000-000000000000', format(
    $q$select arrange_farm('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', %L, '[{"slot":%s,"x":0,"y":0}]')$q$,
    repeat('b', 43), a_slot));
  perform assert(v_err like '%FARM_KEY_INVALID%', '16e. a wrong key CANNOT arrange the farm');

  -- تبديل نبتتين: يمرّ رغم أن كل هدف مشغول بالأخرى لحظة البدء
  v_err := try_as('00000000-0000-0000-0000-000000000000', format(
    $q$select arrange_farm('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', %L,
       '[{"slot":%s,"x":%s,"y":%s},{"slot":%s,"x":%s,"y":%s}]')$q$,
    repeat('a', 43), a_slot, b_x, b_y, b_slot, a_x, a_y));
  perform assert(v_err is null, '16f. swapping two plants succeeds');
  perform assert(
    (select (grid_x, grid_y) = (b_x, b_y) from points_ledger
      where student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and semester_id = v_sem and slot_index = a_slot),
    '16g. the plants really traded places');

  -- نقل إلى خانة فارغة على المحور (0,0) داخل السور
  v_err := try_as('00000000-0000-0000-0000-000000000000', format(
    $q$select arrange_farm('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', %L, '[{"slot":%s,"x":0,"y":0}]')$q$,
    repeat('a', 43), a_slot));
  perform assert(v_err is null, '16h. moving a plant to an empty cell inside the fence succeeds');

  select * into v_b from farm_default_bounds('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', v_sem);
  v_err := try_as('00000000-0000-0000-0000-000000000000', format(
    $q$select arrange_farm('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', %L, '[{"slot":%s,"x":%s,"y":0}]')$q$,
    repeat('a', 43), a_slot, v_b.max_x + 1));
  perform assert(v_err like '%FARM_MOVE_OUT_OF_BOUNDS%', '16i. a move outside the fence is refused');

  -- هدف على نبتة لم تُنقل: يُرفض ولا يتغيّر شيء
  v_err := try_as('00000000-0000-0000-0000-000000000000', format(
    $q$select arrange_farm('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', %L, '[{"slot":%s,"x":%s,"y":%s}]')$q$,
    repeat('a', 43), a_slot, a_x, a_y));
  perform assert(v_err like '%FARM_CELL_TAKEN%', '16j. dropping onto an unmoved plant is refused');
  perform assert(
    (select (grid_x, grid_y) = (0, 0) from points_ledger
      where student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and semester_id = v_sem and slot_index = a_slot),
    '16k. a refused arrangement changes nothing');

  -- مفتاح الطالب (ب) لا يحرّك نبتات (أ) حتى لو ذُكرت خاناتها
  v_err := try_as('00000000-0000-0000-0000-000000000000', format(
    $q$select arrange_farm('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', %L, '[{"slot":%s,"x":1,"y":1}]')$q$,
    repeat('b', 43), a_slot));
  perform assert(
    (select (grid_x, grid_y) = (0, 0) from points_ledger
      where student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and semester_id = v_sem and slot_index = a_slot),
    '16l. one student''s key never moves another student''s plant');

  -- المنح بعد الترتيب لا يصادم ما نقله الطالب
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  v_err := null;
  begin
    perform award_points('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'yellow');
  exception when others then v_err := sqlerrm;
  end;
  perform assert(v_err is null, '16m. awarding after an arrangement does not collide');

  v_err := try_as('00000000-0000-0000-0000-000000000000', format(
    $q$select reset_farm('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', %L)$q$, repeat('a', 43)));
  perform assert(v_err is null, '16n. reset returns the farm to its default layout');
  perform assert((select count(*) from (
      select l.grid_x, l.grid_y, q.x, q.y
        from (select grid_x, grid_y, tier,
                     (row_number() over (partition by tier order by slot_index) - 1)::integer as rnk
                from points_ledger
               where student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
                 and semester_id = v_sem and revoked_at is null) l,
             lateral quadrant_coord(l.tier, l.rnk) q
       where (l.grid_x, l.grid_y) <> (q.x, q.y)) d) = 0,
    '16o. after reset every plant sits on its default cell');
end;
$$;

-- ── 17. روابط دخول المشرفين: للمدير وحده ─────────────────────────────────
do $$
declare v_err text; v_n integer;
begin
  insert into staff_login_keys (user_id, token)
  values ('22222222-2222-2222-2222-222222222222', repeat('k', 43));

  set local role anon;
  begin
    select count(*) into v_n from staff_login_keys;
    v_err := null;
  exception when others then v_err := sqlerrm;
  end;
  reset role;
  perform assert(v_err is not null, '17a. anon CANNOT read supervisor login links');

  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  set local role authenticated;
  select count(*) into v_n from staff_login_keys;
  reset role;
  perform assert(v_n = 0, '17b. a supervisor CANNOT read login links, not even their own');

  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  set local role authenticated;
  select count(*) into v_n from staff_login_keys;
  reset role;
  perform assert(v_n = 1, '17c. admin reads the login links');
end;
$$;

\echo ''
\echo '════════════════════════════════════════════'
\echo ' كل اختبارات العزل نجحت — All isolation tests passed'
\echo '════════════════════════════════════════════'
