# نشر سبّاق — Supabase + Vercel

دليل بالخطوات من صفر إلى موقع يعمل. الوقت المتوقّع: ٢٠–٣٠ دقيقة.

---

## ١. إنشاء مشروع Supabase

1. افتح [supabase.com/dashboard](https://supabase.com/dashboard) ← **New project**
2. الاسم: `sabbaq` · كلمة مرور قاعدة البيانات: احفظها في مكان آمن
3. **المنطقة (Region)** — مهمّة للأداء: اختر الأقرب لمدرستك.
   للخليج: `eu-central-1 (Frankfurt)` عادةً الأفضل اتصالًا.
   **اكتب المنطقة التي اخترتها** — ستطابقها في Vercel بالخطوة ٤.

انتظر حتى ينتهي التجهيز (~دقيقتان).

---

## ٢. تركيب قاعدة البيانات

من لوحة Supabase ← **SQL Editor** ← **New query**.

نفّذ الملفات الأربعة **بهذا الترتيب**، كل ملف في استعلام منفصل، واضغط
`Run` بعد كل واحد وتأكّد من نجاحه قبل الانتقال للذي بعده:

| # | الملف | ما يفعله |
|---|---|---|
| ١ | `supabase/migrations/0001_schema.sql` | ٩ جداول + الفهارس + القيود |
| ٢ | `supabase/migrations/0002_functions.sql` | الخوارزمية الحلزونية، `award_points`، إدارة الفصول |
| ٣ | `supabase/migrations/0003_rls.sql` | ٢٠ سياسة عزل + العرض العام `student_farms` |
| ٤ | `supabase/migrations/0004_seed.sql` | المجموعات السبع، الحدود، الفصل الأول، trigger المصادقة |

> **الترتيب ليس اختياريًا.** الملف ٢ يحتاج الأنواع المعرّفة في ١، والملف ٣
> يحتاج الدوال المعرّفة في ٢.

**تحقّق سريع** — نفّذ هذا وتأكّد أن كل سطر يُرجع `t`:

```sql
select
  (select count(*) from groups)              = 7  as groups_ok,
  (select count(*) from daily_limits)        = 2  as limits_ok,
  (select count(*) from semesters where is_active) = 1 as semester_ok,
  to_regprocedure('award_points(uuid,point_tier)') is not null as rpc_ok,
  (select x = 0 and y = 0 from spiral_coord(0))   as spiral_ok;
```

---

## ٣. إنشاء حساب المدير

**Authentication** ← **Users** ← **Add user** ← *Create new user*:

- البريد وكلمة المرور: كما تريد (سجّلهما)
- **Auto Confirm User**: مفعّل ✅ (بدونه لن يستطيع الدخول)

ثم افتح المستخدم ← **User Metadata** ← والصق:

```json
{ "full_name_ar": "اسم المدير", "role": "admin" }
```

> إن أنشأت الحساب **قبل** تنفيذ الملف `0004_seed.sql` فلن يُنشأ صفّه في
> `public.users` لأن الـ trigger لم يكن موجودًا بعد. أصلحه بهذا:
>
> ```sql
> insert into public.users (id, full_name_ar, role)
> select id, coalesce(raw_user_meta_data->>'full_name_ar', email), 'admin'
>   from auth.users
>  on conflict (id) do update set role = 'admin';
> ```

**التقط مفاتيح المشروع** من **Project Settings** ← **API**:

| المفتاح | أين تجده |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` / `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` — **سرّي، خادمي فقط** |

> مفتاح `service_role` يتجاوز كل سياسات العزل. لا تضعه في أي متغيّر يبدأ
> بـ `NEXT_PUBLIC_`، ولا تلصقه في أي ملف داخل المستودع.

---

## ٤. النشر على Vercel

1. [vercel.com/new](https://vercel.com/new) ← استورد مستودع GitHub
2. **Root Directory** ← اضغط *Edit* ← اختر **`sabbaq`**

   > هذه أهمّ خطوة. المستودع يحتوي مشروعًا آخر في جذره، وبدون ضبط هذا
   > الحقل سيبني Vercel المشروع الخطأ.

3. **Framework Preset**: Next.js (يُكتشف تلقائيًا)
4. **Environment Variables** — أضِف الثلاثة من الخطوة ٣:

   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   ```

   طبّقها على البيئات الثلاث (Production / Preview / Development).

5. **Deploy**

### مطابقة المنطقة

`vercel.json` يضبط `"regions": ["fra1"]` (فرانكفورت). إن اخترت منطقة أخرى
لـ Supabase في الخطوة ١، عدّل القيمة لتطابقها — كل منح نقاط يمرّ من دالة
Vercel إلى قاعدة البيانات، والمنطقتان المتباعدتان تضيفان تأخيرًا ملموسًا
وقت ذروة نهاية اليوم.

| منطقة Supabase | قيمة `regions` |
|---|---|
| eu-central-1 (Frankfurt) | `fra1` |
| eu-west-2 (London) | `lhr1` |
| ap-south-1 (Mumbai) | `bom1` |
| ap-southeast-1 (Singapore) | `sin1` |
| us-east-1 (N. Virginia) | `iad1` |

---

## ٥. التحقّق بعد النشر

### فحص تمهيدي آلي

```bash
cd sabbaq
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... npm run preflight
```

يتأكّد من: وصول القاعدة، المجموعات السبع، وجود فصل نشط، ضبط الحدين،
عمل `spiral_coord`، وقابلية `student_farms` للقراءة العامة.

### بيانات تجريبية (موصى به)

لتجربة الرحلة كاملة قبل إدخال طلاب حقيقيين، نفّذ في SQL Editor:

```
supabase/seed/demo.sql
```

يُنشئ ٤٢ طالبًا في المجموعات السبع بمزارع متفاوتة النمو (من فارغة إلى فصل
كامل)، وينسب النقاط لحساب المدير. لحذفها لاحقًا:

```sql
delete from students where full_name like '[تجريبي]%';
```

### فحص يدوي — الرحلة كاملة

| # | الخطوة | المتوقّع |
|---|---|---|
| ١ | افتح `/` | شبكة المجموعات السبع + مربّع بحث |
| ٢ | ابحث عن طالب واختره | تُفتح `/farm/<id>` والمزرعة تُرسَم مؤطَّرة |
| ٣ | اسحب المزرعة وكبّرها | حركة سلسة، السياج يحيط بها |
| ٤ | افتح `/tv` | تدوير تلقائي بين المتميّزين |
| ٥ | افتح `/supervisor` بمتصفّح خفي | تحويل إلى `/login` |
| ٦ | ادخل بحساب المدير | لوحة المشرف تظهر |
| ٧ | اختر طالبًا واضغط `+50` | إشعار نجاح وارتفاع رصيده |
| ٨ | افتح مزرعة ذلك الطالب بمتصفّح خفي | النبتة الحمراء الجديدة موجودة |
| ٩ | `/admin` ← الحدود ← اضبط حدًّا صغيرًا | يُحفظ فورًا |
| ١٠ | أنشئ مشرف مجموعة وادخل بحسابه | يرى مجموعاته فقط، والأزرار تُعطَّل عند الحد |

الخطوتان ٧ و٨ معًا هما الاختبار الحقيقي: المنح يكتب في قاعدة البيانات
والقراءة العامة تعرضه بلا حساب.

---

## مشاكل شائعة

| العرض | السبب والحل |
|---|---|
| صفحة «سبّاق غير مهيّأ بعد» | متغيّر بيئة ناقص أو خطأ حرف في اسمه. الوسيط يسمّي الناقص بالاسم. أضِفه في Vercel ثم **أعد النشر** — المتغيّرات لا تُطبَّق على نشر قائم. |
| بناء Vercel يفشل أو ينشر مشروعًا غريبًا | **Root Directory** غير مضبوط على `sabbaq`. |
| الدخول يقول «بيانات غير صحيحة» والحساب موجود | *Auto Confirm User* لم يكن مفعّلًا. فعّله من Authentication ← Users. |
| الدخول ينجح ثم «حسابك غير مرتبط بدور» | لا صفّ في `public.users`. نفّذ استعلام الإصلاح في الخطوة ٣. |
| منح النقاط يفشل بـ `NO_ACTIVE_SEMESTER` | لا فصل نشط. أنشئه من `/admin/semesters` أو: `insert into semesters (name_ar, name_en, start_date, end_date, is_active) values ('الفصل الأول','Semester 1', current_date, current_date + 90, true);` |
| المزرعة فارغة والطالب له نقاط | نقاطه في فصل غير النشط. `student_farms` تعرض الفصل النشط وحده. |
| المزرعة صفحة زرقاء بلا نبتات | WebGL معطّل في المتصفح، أو تعجيل الرسوم مطفأ على جهاز العرض. |

---

## ملاحظات تشغيلية

- **التخزين المؤقت**: المزرعة ٣٠ ثانية، الصفحة العامة ٦٠، ووضع الشاشات
  يُعيد الجلب كل ٥ دقائق من المتصفح. منح النقاط يُبطل تخزين مزرعة الطالب
  فورًا، فلا انتظار.
- **شاشات المدرسة**: افتح `/tv` بملء الشاشة. الرابط ثابت ولا يحتاج حسابًا،
  واللغة محفوظة في كوكي لسنة فيبقى إعداد الشاشة كما ضُبط.
- **النسخ الاحتياطي**: الخطة المجانية في Supabase تحفظ نسخًا يوميًا لسبعة
  أيام. سجل النقاط هو المصدر الوحيد للحقيقة — لا شيء آخر يُعاد بناؤه منه.
- **قبل نهاية الفصل**: أرشِف من `/admin/semesters` قبل أي تصفير. الأرشفة
  تحفظ لقطة جاهزة للتقارير؛ التصفير بدونها يُبقي السجل الخام فقط.
