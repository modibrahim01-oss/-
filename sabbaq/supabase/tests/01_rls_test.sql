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

update daily_limits set points_perday = 50  where role = 'group_supervisor';
update daily_limits set points_perday = 100 where role = 'committee_supervisor';

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

-- ── 2. الحد اليومي صارم ─────────────────────────────────────────────────
do $$
declare v_err text; v_used integer;
begin
  -- الحد 50، وقد استُهلك 10 في الاختبار السابق. 30 تمرّ فيصبح 40.
  v_err := try_as('22222222-2222-2222-2222-222222222222',
    $q$select award_points('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'purple')$q$);
  perform assert(v_err is null, '2a. award within remaining limit succeeds');

  -- 20 أخرى تجعل المجموع 60 > 50: يجب أن تُرفض
  v_err := try_as('22222222-2222-2222-2222-222222222222',
    $q$select award_points('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'yellow')$q$);
  perform assert(v_err like '%DAILY_LIMIT_EXCEEDED%',
    '2b. award that would exceed the daily limit is BLOCKED');

  -- 10 تُكمل المجموع إلى 50 بالضبط: مسموحة (الحد شامل)
  v_err := try_as('22222222-2222-2222-2222-222222222222',
    $q$select award_points('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'green')$q$);
  perform assert(v_err is null, '2c. award hitting the limit exactly is allowed');

  select coalesce(sum(points), 0) into v_used from points_ledger
   where supervisor_id = '22222222-2222-2222-2222-222222222222' and revoked_at is null;
  perform assert(v_used = 50, '2d. supervisor total is exactly the limit, never above');

  -- ولا حتى أصغر فئة بعد استنفاد الحد
  v_err := try_as('22222222-2222-2222-2222-222222222222',
    $q$select award_points('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'green')$q$);
  perform assert(v_err like '%DAILY_LIMIT_EXCEEDED%',
    '2e. exhausted supervisor cannot award even the smallest tier');
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

  -- حدّه 100، استهلك 100: التالي يُرفض
  v_err := try_as('44444444-4444-4444-4444-444444444444',
    $q$select award_points('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'green')$q$);
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
                   when 'purple' then -1 else 1 end,
       case f.tier when 'green' then 1 when 'yellow' then 1
                   when 'purple' then -1 else -1 end)) = 0,
    '7a. the first plant of each tier sits at its quadrant''s corner');

  -- ولا نبتة خارج ربع فئتها ولا على المحورين
  perform assert((select count(*) from points_ledger
     where student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       and not (
         (tier = 'green'  and grid_x > 0 and grid_y > 0) or
         (tier = 'yellow' and grid_x < 0 and grid_y > 0) or
         (tier = 'purple' and grid_x < 0 and grid_y < 0) or
         (tier = 'red'    and grid_x > 0 and grid_y < 0))) = 0,
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

-- ── 9e. الخانة المسحوبة لا يعيد المنح التالي استعمالها ───────────────────
-- الترتيب داخل الفئة يُعدّ شاملًا السحوبات؛ لو عُدّت الحيّة وحدها لوقع المنح
-- التالي على خانة النبتة المسحوبة، والقيد يرفضه فيفشل المنح كله.
do $$
declare v_err text; v_tier point_tier; v_x integer; v_y integer; v_r jsonb;
begin
  select tier, grid_x, grid_y into v_tier, v_x, v_y from points_ledger
   where student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
     and revoked_at is not null
   order by id limit 1;

  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  v_r := award_points('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', v_tier);
  perform assert(
    ((v_r->>'grid_x')::int, (v_r->>'grid_y')::int) is distinct from (v_x, v_y),
    '9e. a revoked plant''s cell is never handed to the next award of its tier');
end;
$$;

-- ── 9f. القيد يرفض نبتتين على خانة واحدة مهما كان مصدرهما ──────────────────
do $$
declare v_err text;
begin
  begin
    update points_ledger set grid_x = 1, grid_y = 1
     where student_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       and (grid_x, grid_y) <> (1, 1);
    v_err := null;
  exception when unique_violation then
    v_err := sqlerrm;
  end;
  perform assert(v_err is not null,
    '9f. the database refuses two plants on the same cell');
end;
$$;

-- ── 10. تعديل الحد: المدير فقط ──────────────────────────────────────────
do $$
declare v_err text;
begin
  v_err := try_as('44444444-4444-4444-4444-444444444444',
    $q$select set_daily_limit('group_supervisor', 9999)$q$);
  perform assert(v_err like '%ADMIN_ONLY%', '10a. committee supervisor CANNOT raise limits');

  v_err := try_as('11111111-1111-1111-1111-111111111111',
    $q$select set_daily_limit('group_supervisor', 300)$q$);
  perform assert(v_err is null, '10b. admin CAN change the daily limit');

  perform assert(
    (select points_perday from daily_limits where role = 'group_supervisor') = 300,
    '10c. the new limit is stored');

  -- ورفع الحد يُفرج عن المشرف الذي كان قد استنفده فورًا
  v_err := try_as('22222222-2222-2222-2222-222222222222',
    $q$select award_points('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'green')$q$);
  perform assert(v_err is null,
    '10d. raising the limit immediately unblocks an exhausted supervisor');
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

\echo ''
\echo '════════════════════════════════════════════'
\echo ' كل اختبارات العزل نجحت — All isolation tests passed'
\echo '════════════════════════════════════════════'
