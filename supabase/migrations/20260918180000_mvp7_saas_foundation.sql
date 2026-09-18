create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);
create table if not exists public.operational_units (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(company_id, name)
);
insert into public.companies(name) values ('Organização inicial') on conflict (name) do nothing;

alter table public.perceptions add column if not exists company_id uuid references public.companies(id);
alter table public.analysis_sessions add column if not exists company_id uuid references public.companies(id);
alter table public.entities add column if not exists company_id uuid references public.companies(id);
alter table public.entity_aliases add column if not exists company_id uuid references public.companies(id);
alter table public.entity_evidence add column if not exists company_id uuid references public.companies(id);
alter table public.knowledge_suggestions add column if not exists company_id uuid references public.companies(id);
alter table public.entity_relations add column if not exists company_id uuid references public.companies(id);
alter table public.taxonomy_refinements add column if not exists company_id uuid references public.companies(id);
alter table public.perception_embeddings add column if not exists company_id uuid references public.companies(id);

do $$ declare v_company uuid := (select id from public.companies where name = 'Organização inicial'); begin
  update public.perceptions set company_id=v_company where company_id is null;
  update public.analysis_sessions set company_id=v_company where company_id is null;
  update public.entities set company_id=v_company where company_id is null;
  update public.entity_aliases set company_id=v_company where company_id is null;
  update public.entity_evidence set company_id=v_company where company_id is null;
  update public.knowledge_suggestions set company_id=v_company where company_id is null;
  update public.entity_relations set company_id=v_company where company_id is null;
  update public.taxonomy_refinements set company_id=v_company where company_id is null;
  update public.perception_embeddings set company_id=v_company where company_id is null;
end $$;

alter table public.perceptions alter column company_id set not null;
alter table public.analysis_sessions alter column company_id set not null;
alter table public.entities alter column company_id set not null;
alter table public.entity_aliases alter column company_id set not null;
alter table public.entity_evidence alter column company_id set not null;
alter table public.knowledge_suggestions alter column company_id set not null;
alter table public.entity_relations alter column company_id set not null;
alter table public.taxonomy_refinements alter column company_id set not null;
alter table public.perception_embeddings alter column company_id set not null;

create or replace function public.is_company_member(p_company_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.company_members where company_id=p_company_id and user_id=auth.uid())
$$;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.operational_units enable row level security;
create policy "members view companies" on public.companies for select to authenticated using (public.is_company_member(id));
create policy "members view membership" on public.company_members for select to authenticated using (user_id=auth.uid() or public.is_company_member(company_id));
create policy "members view units" on public.operational_units for select to authenticated using (public.is_company_member(company_id));

do $$ declare t text; begin
 foreach t in array array['perceptions','analysis_sessions','entities','entity_aliases','entity_evidence','knowledge_suggestions','entity_relations','taxonomy_refinements','perception_embeddings'] loop
  execute format('create policy "tenant select %1$s" on public.%1$I for select to authenticated using (public.is_company_member(company_id))',t);
 end loop;
end $$;
