-- Melhoria 4: empresa ativa explícita por usuário.
create table if not exists public.user_active_companies (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  updated_at timestamptz not null default now()
);
alter table public.user_active_companies enable row level security;
create policy "users read own active company" on public.user_active_companies for select to authenticated using (user_id=auth.uid());

create or replace function public.resolve_active_company(p_user_id uuid)
returns uuid language plpgsql stable security definer set search_path=public as $$
declare c uuid; n integer;
begin
 select company_id into c from public.user_active_companies where user_id=p_user_id;
 if c is not null and exists(select 1 from public.company_members where user_id=p_user_id and company_id=c) then return c; end if;
 select count(*), min(company_id) into n,c from public.company_members where user_id=p_user_id;
 if n=1 then return c; end if;
 return null;
end $$;
revoke all on function public.resolve_active_company(uuid) from anon, authenticated;
grant execute on function public.resolve_active_company(uuid) to service_role;
