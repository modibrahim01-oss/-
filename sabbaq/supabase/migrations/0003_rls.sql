-- ════════════════════════════════════════════════════════════════════════
-- سبّاق — سياسات Row Level Security
--
-- المبدأ: العزل يُفرَض في قاعدة البيانات لا في الواجهة. مشرف المجموعة لا
-- يستطيع منح نقاط لطالب خارج مجموعته حتى باستعلام SQL مباشر، والعامّة
-- يقرأون المزارع دون تسجيل دخول لكن لا يكتبون شيئًا أبدًا.
-- ════════════════════════════════════════════════════════════════════════

alter table groups            enable row level security;
alter table semesters         enable row level security;
alter table users             enable row level security;
alter table supervisor_groups enable row level security;
alter table students          enable row level security;
alter table daily_limits      enable row level security;
alter table points_ledger     enable row level security;
alter table semester_archives enable row level security;
alter table audit_log         enable row level security;

-- ── المجموعات: يقرأها الجميع (شبكة الاختيار في الصفحة العامة) ────────────
create policy groups_read_all on groups
  for select using (true);

create policy groups_admin_write on groups
  for all using (is_admin()) with check (is_admin());

-- ── الفصول: يقرأها الجميع، المدير وحده يعدّل ─────────────────────────────
create policy semesters_read_all on semesters
  for select using (true);

create policy semesters_admin_write on semesters
  for all using (is_admin()) with check (is_admin());

-- ── المستخدمون: كل مستخدم يرى صفّه، والمدير يرى الجميع ───────────────────
-- المشرف لا يرى قائمة بقية المشرفين ولا أدوارهم.
create policy users_read_self on users
  for select using (id = auth.uid());

create policy users_read_all_admin on users
  for select using (is_admin());

create policy users_admin_write on users
  for all using (is_admin()) with check (is_admin());

-- ── إسنادات المجموعات: المشرف يرى إسناداته، المدير يرى ويعدّل الكل ───────
create policy supervisor_groups_read_self on supervisor_groups
  for select using (supervisor_id = auth.uid());

create policy supervisor_groups_read_admin on supervisor_groups
  for select using (is_admin());

create policy supervisor_groups_admin_write on supervisor_groups
  for all using (is_admin()) with check (is_admin());

-- ── الطلاب ────────────────────────────────────────────────────────────────
-- القراءة عامّة بالكامل: الوثيقة تنصّ على أن أي شخص يستطيع عرض مزرعة أي
-- طالب، وهذا ما يجعل العرض على شاشات المدرسة ممكنًا بدون حسابات.
create policy students_read_all on students
  for select using (true);

create policy students_admin_write on students
  for all using (is_admin()) with check (is_admin());

-- ── حدود النقاط: يقرأها كل موظّف (المشرف يحتاج حدّه)، المدير وحده يعدّل ──
create policy daily_limits_read_staff on daily_limits
  for select using (current_role_of() is not null);

create policy daily_limits_admin_write on daily_limits
  for all using (is_admin()) with check (is_admin());

-- ── سجل النقاط ────────────────────────────────────────────────────────────
-- القراءة عامّة: هذا ما تبنى منه المزرعة المعروضة للجميع.
create policy ledger_read_all on points_ledger
  for select using (true);

-- لا insert مباشر لأي أحد. المنح يمرّ عبر award_points فقط (SECURITY
-- DEFINER) لأنه وحده يضمن ذرّية الحد اليومي وحجز خانة الحلزون. بدون هذا
-- القيد يستطيع مشرف أن يدرج صفًّا بإحداثيات من اختياره ويتجاوز حدّه.
create policy ledger_admin_write on points_ledger
  for all using (is_admin()) with check (is_admin());

-- ── أرشيف الفصول: المدير فقط ──────────────────────────────────────────────
create policy archives_admin_all on semester_archives
  for all using (is_admin()) with check (is_admin());

-- ── سجل التدقيق: المدير فقط يقرأ، ولا أحد يعدّل أو يحذف ──────────────────
create policy audit_read_admin on audit_log
  for select using (is_admin());

-- ── صلاحيات الجداول على مستوى GRANT ──────────────────────────────────────
-- RLS لا يعمل إلا إذا كان الدور يملك GRANT أصلًا. نمنح anon القراءة على ما
-- تحتاجه الصفحة العامة فقط، ولا نمنحه أي كتابة على أي جدول.
grant usage on schema public to anon, authenticated;

grant select on groups, semesters, students, points_ledger to anon, authenticated;
grant select on users, supervisor_groups, daily_limits to authenticated;
grant select on semester_archives, audit_log to authenticated;

grant insert, update, delete on groups, semesters, students, users,
  supervisor_groups, daily_limits, points_ledger, semester_archives to authenticated;

grant usage, select on sequence points_ledger_id_seq to authenticated;
grant usage, select on sequence audit_log_id_seq to authenticated;

-- ── العرض العام للمزرعة ───────────────────────────────────────────────────
-- security_invoker = true إلزامي: بدونه تُنفَّذ استعلامات العرض بصلاحيات
-- مالكه متجاوِزةً RLS بالكامل.
create view student_farms with (security_invoker = true) as
  select s.id                                as student_id,
         s.full_name,
         s.group_id,
         g.code                              as group_code,
         g.name_ar                           as group_name_ar,
         g.name_en                           as group_name_en,
         s.grade,
         sem.id                              as semester_id,
         coalesce(sum(l.points), 0)::integer  as total_points,
         count(l.id)::integer                as plant_count
    from students s
    join groups g on g.id = s.group_id
    cross join (select id from semesters where is_active) sem
    left join points_ledger l
           on l.student_id = s.id
          and l.semester_id = sem.id
          and l.revoked_at is null
   where s.is_active
   group by s.id, s.full_name, s.group_id, g.code, g.name_ar, g.name_en,
            s.grade, sem.id;

grant select on student_farms to anon, authenticated;
