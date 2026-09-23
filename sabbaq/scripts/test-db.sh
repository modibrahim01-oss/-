#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# اختبارات العزل على Postgres حقيقي.
#
# تُنشئ قاعدة مؤقتة، تطبّق ملفات الترحيل بالترتيب فوق محاكاة بيئة Supabase،
# ثم تشغّل اختبارات RLS. الفشل يوقف السكربت بمخرَج غير صفري.
#
# التشغيل:  npm run test:db
# متغيّرات:  PGHOST PGPORT PGUSER (الافتراضي: مقبس محلي)
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail

DB="${SABBAQ_TEST_DB:-sabbaq_test}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "▸ إعادة إنشاء قاعدة الاختبار: $DB"
psql -q -tAc "drop database if exists ${DB};" postgres
psql -q -tAc "create database ${DB};" postgres

echo "▸ تطبيق محاكاة Supabase وملفات الترحيل"
for f in \
  "$HERE/supabase/tests/00_supabase_shim.sql" \
  "$HERE/supabase/migrations/0001_schema.sql" \
  "$HERE/supabase/migrations/0002_functions.sql" \
  "$HERE/supabase/migrations/0003_rls.sql" \
  "$HERE/supabase/migrations/0004_seed.sql" \
  "$HERE/supabase/migrations/0005_quadrant_layout.sql" \
  "$HERE/supabase/migrations/0006_undo_and_compact.sql"
do
  printf '  · %s\n' "$(basename "$f")"
  psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$f"
done

echo "▸ تشغيل اختبارات العزل"
# نرفع مستوى الرسائل لتظهر أسطر PASS، ونعتمد على ON_ERROR_STOP لإيقاف أي فشل
psql -d "$DB" -v ON_ERROR_STOP=1 \
     -c "set client_min_messages='notice';" \
     -f "$HERE/supabase/tests/01_rls_test.sql" 2>&1 \
  | sed -n 's/.*NOTICE:  \(PASS\|FAIL\)  /  \1  /p'

echo ""
echo "▸ التحقّق من البيانات التجريبية"
# البذر يحتاج حساب مدير — ننشئه عبر نفس مسار الإنتاج: trigger على auth.users
# ينشئ الصف بأدنى دور، ثم يُرقّى بـ SQL. الـ trigger يتجاهل الدور في
# user_metadata عن قصد، وإلا لرقّى أي زائر نفسه بمفتاح المتصفح العام.
psql -q -d "$DB" -v ON_ERROR_STOP=1 -c "
insert into auth.users (id, email, raw_user_meta_data) values
  ('99999999-9999-9999-9999-999999999999','seed-admin@test',
   '{\"full_name_ar\":\"مدير البذر\"}')
on conflict (id) do nothing;
update users set role = 'admin'
 where id = '99999999-9999-9999-9999-999999999999';"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$HERE/supabase/seed/demo.sql" > /dev/null

# البذر يكتب في points_ledger مباشرة، فلا بد أن يتطابق مع ما تحسبه الدالة —
# وأن يبقى next_slot_index صحيحًا وإلا صادم أول منح حقيقي خانةً محجوزة
# كل توكيد مقصور على طلاب البذر وعلى الفصل النشط. الملف السابق يُغلق فصلًا
# ويصفّر العدّادات، فطلابه يحملون صفوفًا من فصل سابق بعدّاد صفر — وهو سلوك
# صحيح يفسد أي مقارنة غير مقيّدة بالفصل.
psql -q -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
do $$
declare
  v_sem uuid;
  v_s   uuid;
  v_n   integer;
  v_r   jsonb;
begin
  select id into v_sem from semesters where is_active;

  perform assert((select count(*) from students where full_name like '[تجريبي]%') = 42,
    'seed: 42 demo students');

  perform assert((select count(*) from students s
    left join (select student_id, count(*) c from points_ledger
                where semester_id = v_sem group by student_id) l
      on l.student_id = s.id
    where s.full_name like '[تجريبي]%'
      and s.next_slot_index <> coalesce(l.c, 0)) = 0,
    'seed: next_slot_index matches each farm''s plant count');

  -- التكرار يُقاس لكل (طالب، فصل): نفس الخانة في فصلين مختلفين مشروعة
  perform assert((select count(*) from (
      select l.student_id from points_ledger l
        join students s on s.id = l.student_id
       where s.full_name like '[تجريبي]%'
       group by l.student_id, l.semester_id, l.grid_x, l.grid_y
      having count(*) > 1) d) = 0,
    'seed: no two plants share a coordinate within a semester');

  -- كل نبتة في موضعها من ترتيبها داخل فئتها — لا أرقام مخترعة في البذر
  perform assert((select count(*) from (
      select l.grid_x, l.grid_y, l.tier,
             (row_number() over (partition by l.student_id, l.semester_id, l.tier
                                 order by l.slot_index) - 1)::integer as rnk
        from points_ledger l
        join students s on s.id = l.student_id
       where s.full_name like '[تجريبي]%') r,
      lateral quadrant_coord(r.tier, r.rnk) q
     where r.grid_x <> q.x or r.grid_y <> q.y) = 0,
    'seed: every coordinate matches quadrant_coord');

  perform assert((select count(*) from points_ledger l
      join students s on s.id = l.student_id
     where s.full_name like '[تجريبي]%'
       and l.points <> tier_points(l.tier)) = 0,
    'seed: points match their tier');

  perform assert((select count(*) from students s
     where s.full_name like '[تجريبي]%' and s.next_slot_index = 0) = 2,
    'seed: two farms left empty for the empty-state path');

  -- منح حقيقي فوق أكبر مزرعة مبذورة: الحالة التي يكشفها عدّاد خاطئ
  select s.id, s.next_slot_index into v_s, v_n
    from students s
    join (select student_id, count(*) c from points_ledger
           where semester_id = v_sem group by student_id) l on l.student_id = s.id
   where s.full_name like '[تجريبي]%'
   order by l.c desc limit 1;

  perform set_config('request.jwt.claim.sub',
    '99999999-9999-9999-9999-999999999999', true);
  v_r := award_points(v_s, 'red');
  perform assert((v_r->>'slot_index')::int = v_n,
    'seed: a real award continues the slot sequence instead of colliding');
  perform assert((v_r->>'grid_x')::int < 0 and (v_r->>'grid_y')::int < 0,
    'seed: a real red award lands in the red quadrant');
end;
$$;
SQL

echo ""
echo "▸ تحديث ملف تكافؤ التخطيط (SQL ↔ TypeScript)"
mkdir -p "$HERE/tests/fixtures"
psql -d "$DB" -tAF, \
  -c "select t, n, x, y
        from unnest(enum_range(null::point_tier)) t,
             generate_series(0, 999) n,
             lateral quadrant_coord(t, n)
       order by t, n;" \
  > "$HERE/tests/fixtures/sql-quadrant.csv"
printf '  · %s صف\n' "$(wc -l < "$HERE/tests/fixtures/sql-quadrant.csv" | tr -d ' ')"

echo ""
echo "✓ اختبارات قاعدة البيانات نجحت"
