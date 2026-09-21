-- ════════════════════════════════════════════════════════════════════════
-- سبّاق — البيانات الأولية: المجموعات السبع، الحدود، الفصل الأول
-- ════════════════════════════════════════════════════════════════════════

insert into groups (id, code, name_ar, name_en, stage_ar, stage_en, sort_order) values
  (1, 'qabas',   'قبس',   'Qabas',   'الصفوف الأول والثاني',  'Grades 1-2',   1),
  (2, 'majd1',   'مجد ١', 'Majd 1',  'الصفوف الثالث والرابع', 'Grades 3-4',   2),
  (3, 'majd2',   'مجد ٢', 'Majd 2',  'الصفوف الثالث والرابع', 'Grades 3-4',   3),
  (4, 'basil1',  'باسل ١','Basil 1', 'الصفوف الخامس والسادس', 'Grades 5-6',   4),
  (5, 'basil2',  'باسل ٢','Basil 2', 'الصفوف الخامس والسادس', 'Grades 5-6',   5),
  (6, 'sumou',   'سمو',   'Sumou',   'المرحلة المتوسطة',      'Middle school', 6),
  (7, 'tamayoz', 'تميز',  'Tamayoz', 'المرحلة الثانوية',      'High school',   7)
on conflict (id) do nothing;

-- الحدود الافتراضية. المدير يعدّلها من لوحته فورًا بعد التركيب.
insert into daily_limits (role, points_perday) values
  ('group_supervisor',     200),
  ('committee_supervisor', 500)
on conflict (role) do nothing;

-- الفصل الأول: ٩٠ يومًا من تاريخ التركيب
insert into semesters (name_ar, name_en, start_date, end_date, is_active)
select 'الفصل الأول', 'Semester 1', current_date, current_date + 90, true
where not exists (select 1 from semesters);

-- ── إنشاء صف users تلقائيًا لكل حساب auth جديد ────────────────────────────
-- المدير يُنشئ حسابات المشرفين عبر Supabase Auth مع user_metadata:
--   { "full_name_ar": "سعد الغامدي", "role": "group_supervisor" }
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, full_name_ar, full_name_en, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name_ar', new.email),
    new.raw_user_meta_data->>'full_name_en',
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'group_supervisor')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();
