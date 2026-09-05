-- 0009: مخزن المرفقات (Supabase Storage) — القسم 7.3
-- الحاوية خاصة (public=false)، والوصول للملف مربوط بنفس صلاحيات الطلب:
-- نخزّن الملفات تحت المسار attachments/<order_id>/<file>، ونتحقق من ملكية
-- الطلب (rep_id = auth.uid()) أو أن المستخدم مشرف.

insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 10485760) -- 10MB
on conflict (id) do nothing;

create or replace function public.storage_order_id_from_path(object_name text)
returns uuid
language sql
immutable
as $$
  select nullif(split_part(object_name, '/', 1), '')::uuid;
$$;

drop policy if exists attachments_storage_select on storage.objects;
create policy attachments_storage_select on storage.objects
  for select using (
    bucket_id = 'attachments'
    and (
      public.is_admin()
      or exists (
        select 1 from public.orders o
        where o.id = public.storage_order_id_from_path(name)
          and o.rep_id = auth.uid()
      )
    )
  );

drop policy if exists attachments_storage_insert on storage.objects;
create policy attachments_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'attachments'
    and (
      public.is_admin()
      or exists (
        select 1 from public.orders o
        where o.id = public.storage_order_id_from_path(name)
          and o.rep_id = auth.uid()
      )
    )
  );

drop policy if exists attachments_storage_delete on storage.objects;
create policy attachments_storage_delete on storage.objects
  for delete using (bucket_id = 'attachments' and public.is_admin());
