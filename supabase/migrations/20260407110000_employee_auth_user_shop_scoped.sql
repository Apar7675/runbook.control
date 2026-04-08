begin;

alter table public.employees
  drop constraint if exists employees_auth_user_id_key;

drop index if exists public.employees_auth_user_id_key;

create unique index if not exists employees_shop_auth_unique
  on public.employees (shop_id, auth_user_id)
  where auth_user_id is not null;

commit;
