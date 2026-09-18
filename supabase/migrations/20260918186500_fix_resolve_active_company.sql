-- Fix resolve_active_company: min(uuid) nao existe, usar array_agg
create or replace function public.resolve_active_company(p_user_id uuid)
returns uuid language plpgsql stable security definer set search_path=public as $$
declare c uuid; n integer;
begin
 select company_id into c from public.user_active_companies where user_id=p_user_id;
 if c is not null and exists(select 1 from public.company_members where user_id=p_user_id and company_id=c) then return c; end if;
 select count(*), (array_agg(company_id))[1] into n,c from public.company_members where user_id=p_user_id;
 if n=1 then return c; end if;
 return null;
end $$;
