-- ════════════════════════════════════════════════════════════════════════
-- بيانات تجريبية — للتحقّق من الرحلة كاملة بعد النشر
--
-- ينشئ ٤٢ طالبًا في المجموعات السبع بمزارع متفاوتة النمو: من طالب لم يُمنَح
-- بعد، إلى طالب بفصل كامل من النقاط. يتيح تجربة البحث والمزرعة ووضع الشاشات
-- ولوحة المدير قبل إدخال أي طالب حقيقي.
--
-- التشغيل: الصق الملف في Supabase ← SQL Editor ← Run
-- الحذف:   delete from students where full_name like '[تجريبي]%';
--
-- كل الأسماء مبدوءة بـ «[تجريبي]» ليُمكن حذفها دفعة واحدة بلا لبس.
-- ════════════════════════════════════════════════════════════════════════

set client_min_messages = notice;

do $$
declare
  v_admin    uuid;
  v_semester uuid;
  v_student  uuid;
  v_plants   integer;
  v_tier     point_tier;
  v_x        integer;
  v_y        integer;
  v_rank     jsonb;
  v_names    text[] := array[
    'محمد الأحمد','عبدالله الغامدي','يوسف السبيعي','خالد القحطاني',
    'راكان العتيبي','ماجد الشمري','سالم الدوسري','فهد الحربي',
    'نورة السالم','ريم القحطاني','لينا الحربي','سارة العتيبي',
    'دانة الشمري','هند الدوسري','جواهر السبيعي','أمل الغامدي',
    'تركي الزهراني','بندر المالكي','سعود البقمي','ناصر الشهري',
    'عمر الجهني','زياد العمري','أنس الخالدي','وليد الرشيدي',
    'مشاري الفيفي','طلال العسيري','بدر المطيري','صالح الحازمي',
    'شهد الزهراني','رغد المالكي','بشاير البقمي','منال الشهري',
    'عبير الجهني','لمى العمري','رنا الخالدي','غادة الرشيدي',
    'إبراهيم الفيفي','حسن العسيري','مهند المطيري','ياسر الحازمي',
    'أسماء النعيمي','جنى الصاعدي'
  ];
  v_grades   text[] := array['الأول','الثاني','الثالث','الرابع','الخامس',
                             'السادس','السابع','الثامن','التاسع','العاشر'];
  v_group    smallint;
  i          integer;
  j          integer;
  rnd        double precision;
begin
  -- ── المتطلّبات ──
  select id into v_admin from users where role = 'admin' and is_active limit 1;
  if v_admin is null then
    raise exception
      'لا يوجد حساب مدير. أنشئه أولًا (الخطوة ٣ في docs/deployment.md) ثم أعد تشغيل هذا الملف.';
  end if;

  select id into v_semester from semesters where is_active;
  if v_semester is null then
    raise exception
      'لا يوجد فصل نشط. نفّذ 0004_seed.sql أو أنشئ فصلًا من /admin/semesters.';
  end if;

  -- ── الطلاب ──
  -- الطلاب موزّعون على المجموعات السبع بالتساوي، والصف يتبع مرحلة المجموعة
  for i in 1 .. array_length(v_names, 1) loop
    v_group := ((i - 1) % 7) + 1;

    insert into students (full_name, group_id, grade)
    values (
      '[تجريبي] ' || v_names[i],
      v_group,
      v_grades[least(array_length(v_grades, 1), greatest(1, v_group + ((i % 3))))]
    )
    returning id into v_student;

    -- ── المزرعة ──
    -- تدرّج مقصود: أول طالبين بلا نقاط (لاختبار الحالة الفارغة)، ثم نموّ
    -- متزايد. السقف ~٢٨٠ نبتة ≈ ثلاث مِنَح يوميًا على مدى ٩٠ يومًا، وهو
    -- أعلى ما يبلغه طالب متميّز فعلًا — لا رقم مبالَغ فيه يُضلّل عن الأداء.
    v_plants := case
      when i <= 2 then 0
      when i <= 6 then 3 + i
      else floor(10 + (i - 6) * 7.5)::integer
    end;

    -- ترتيب كل نبتة داخل فئتها هو ما يحدّد موضعها، كما في award_points
    v_rank := '{"green":0,"yellow":0,"purple":0,"red":0}';

    for j in 0 .. v_plants - 1 loop
      -- توزيع واقعي: الأخضر هو الغالب والأحمر نادر
      rnd := (j * 7919 + i * 104729) % 1000 / 1000.0;
      v_tier := case
        when rnd < 0.50 then 'green'
        when rnd < 0.80 then 'yellow'
        when rnd < 0.95 then 'purple'
        else 'red'
      end::point_tier;

      -- الإحداثيات من نفس الدالة التي يستخدمها award_points، فالمزارع
      -- التجريبية مبنيّة بالقاعدة ذاتها لا بأرقام مخترعة
      select q.x, q.y into v_x, v_y
        from quadrant_coord(v_tier, (v_rank->>v_tier::text)::integer) q;
      v_rank := jsonb_set(v_rank, array[v_tier::text],
                          to_jsonb((v_rank->>v_tier::text)::integer + 1));

      insert into points_ledger (
        student_id, supervisor_id, semester_id, points, tier,
        slot_index, grid_x, grid_y, awarded_at
      ) values (
        v_student, v_admin, v_semester, tier_points(v_tier), v_tier,
        j, v_x, v_y,
        -- نوزّع التواريخ على الأسبوعين الماضيين ليبدو السجل طبيعيًا
        now() - ((v_plants - j) * interval '20 minutes')
      );
    end loop;

    -- العدّاد يجب أن يطابق عدد النبتات، وإلا صادم أول منح حقيقي خانةً محجوزة
    update students set next_slot_index = v_plants where id = v_student;
  end loop;

  raise notice 'تمّ: % طالبًا تجريبيًا، % نبتة إجمالًا',
    array_length(v_names, 1),
    (select count(*) from points_ledger l
      join students s on s.id = l.student_id
     where s.full_name like '[تجريبي]%');
end;
$$;

-- ملخّص سريع للمراجعة
select g.name_ar                       as "المجموعة",
       count(distinct s.id)            as "الطلاب",
       coalesce(sum(l.points), 0)      as "النقاط",
       count(l.id)                     as "النبتات"
  from students s
  join groups g on g.id = s.group_id
  left join points_ledger l on l.student_id = s.id and l.revoked_at is null
 where s.full_name like '[تجريبي]%'
 group by g.name_ar, g.sort_order
 order by g.sort_order;
