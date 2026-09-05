-- 0005: سجل التدقيق — يُملأ حصرًا عبر Postgres trigger، وليس بكود التطبيق،
-- حتى لا يمكن تجاوزه (إلزامي في القسم 5 من الوثيقة).

create table if not exists public.audit_log (
  id           bigserial primary key,
  table_name   text not null,
  record_id    uuid not null,
  action       text not null check (action in ('insert', 'update', 'delete')),
  changed_by   uuid references public.users(id),
  changed_at   timestamptz not null default now(),
  old_values   jsonb,
  new_values   jsonb
);

create index if not exists idx_audit_log_table_record on public.audit_log(table_name, record_id);
create index if not exists idx_audit_log_changed_by on public.audit_log(changed_by);
create index if not exists idx_audit_log_changed_at on public.audit_log(changed_at);

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (table_name, record_id, action, changed_by, new_values)
    values (tg_table_name, new.id, 'insert', auth.uid(), to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_log (table_name, record_id, action, changed_by, old_values, new_values)
    values (tg_table_name, new.id, 'update', auth.uid(), to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (table_name, record_id, action, changed_by, old_values)
    values (tg_table_name, old.id, 'delete', auth.uid(), to_jsonb(old));
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_audit_orders on public.orders;
create trigger trg_audit_orders
  after insert or update or delete on public.orders
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_payments on public.payments;
create trigger trg_audit_payments
  after insert or update or delete on public.payments
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_withdrawals on public.withdrawals;
create trigger trg_audit_withdrawals
  after insert or update or delete on public.withdrawals
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_clients on public.clients;
create trigger trg_audit_clients
  after insert or update or delete on public.clients
  for each row execute function public.audit_row_change();
