-- 0010: عند إنشاء حساب Auth جديد (من الخادم عبر service role)، أنشئ تلقائيًا
-- صفّه في public.users من raw_user_meta_data. يمرَّر full_name/role/share_pct
-- كـ user_metadata في استدعاء supabase.auth.admin.createUser من إجراء الخادم
-- (لا يمكن لمندوب إنشاء حسابات بنفسه — هذا محصور بالمشرف عبر service role).

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, full_name, phone, role, share_pct)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email, 'مستخدم جديد'),
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'role', 'rep'),
    coalesce((new.raw_user_meta_data->>'share_pct')::numeric, 50)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_handle_new_auth_user on auth.users;
create trigger trg_handle_new_auth_user
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
