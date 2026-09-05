-- 0002: العملاء + دالة تطبيع الأسماء (name_normalized)

-- تطبيع اسم العميل: NFKC، إزالة التشكيل، توحيد الهمزات/التاء المربوطة،
-- توحيد الفواصل، ضغط المسافات، وإزالة الأرقام اللاحقة.
-- يطابق منطق src/lib/normalize.ts (normalizeClientName) لضمان اتساق النتيجة
-- بين التطبيق وقاعدة البيانات.
create or replace function public.normalize_client_name(raw text)
returns text
language plpgsql
immutable
as $$
declare
  s text;
begin
  if raw is null then
    return '';
  end if;

  s := normalize(raw, nfkc);

  -- إزالة رموز اتجاه النص الخفية (RLM/LRM وما شابه)
  s := regexp_replace(s, '[‎‏‪-‮]', '', 'g');

  -- إزالة حركات التشكيل العربية
  s := regexp_replace(s, '[ً-ٰۖ-ۭ]', '', 'g');

  -- توحيد الهمزات والألف المقصورة والتاء المربوطة
  s := translate(s, 'أإآاىةؤئ', 'اااايهوي');

  -- توحيد الفواصل الشائعة إلى مسافة
  s := regexp_replace(s, '[.:،,]', ' ', 'g');

  -- ضغط المسافات
  s := btrim(regexp_replace(s, '\s+', ' ', 'g'));

  -- إزالة الأرقام اللاحقة في نهاية الاسم
  s := btrim(regexp_replace(s, '\s*\d+$', ''));

  return s;
end;
$$;

create table if not exists public.clients (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  name_normalized  text not null,
  phone            text,
  city             text,
  vat_number       text,
  owner_id         uuid references public.users(id),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on column public.clients.owner_id is 'المندوب المسؤول عن العميل. يمكن أن يكون فارغًا لعملاء غير مُسندين (يديرهم المشرف فقط).';

-- منع تكرار العميل بنفس الاسم المطبَّع (يمنع "حذوه" و"أ.خالد : حذوه" كسجلين منفصلين لو كانا متطابقين فعليًا بعد التطبيع)
create unique index if not exists uq_clients_name_normalized on public.clients (name_normalized);

create index if not exists idx_clients_owner on public.clients(owner_id);

create or replace function public.set_client_normalized_name()
returns trigger
language plpgsql
as $$
begin
  new.name := normalize(new.name, nfkc);
  new.name_normalized := public.normalize_client_name(new.name);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_clients_normalize on public.clients;
create trigger trg_clients_normalize
  before insert or update on public.clients
  for each row execute function public.set_client_normalized_name();
