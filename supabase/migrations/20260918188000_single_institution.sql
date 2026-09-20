-- Converte o produto para uma única instituição.
-- Os dados e acessos fora de "Organização inicial", incluindo "Empresa B", são descartados.

do $$
declare institution_id uuid;
begin
  select id into institution_id from public.companies where name = 'Organização inicial';
  if institution_id is null then raise exception 'institution_not_found'; end if;

  create table if not exists public.user_roles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    role text not null check (role in ('member', 'admin')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  insert into public.user_roles(user_id, role)
  select user_id, case when bool_or(role = 'admin') then 'admin' else 'member' end
  from public.company_members where company_id = institution_id
  group by user_id
  on conflict (user_id) do update set role = excluded.role, updated_at = now();

  -- Remove primeiro as referências que foram criadas sem ON DELETE CASCADE.
  delete from public.entity_governance_events where entity_id in (select id from public.entities where company_id <> institution_id)
    or target_entity_id in (select id from public.entities where company_id <> institution_id);
  delete from public.entity_relations where company_id <> institution_id;
  delete from public.entity_aliases where company_id <> institution_id;
  delete from public.entity_evidence where company_id <> institution_id;
  delete from public.perception_embeddings where company_id <> institution_id;
  delete from public.corrections where company_id <> institution_id;
  delete from public.ai_interpretations where company_id <> institution_id;
  delete from public.classifications where company_id <> institution_id;
  delete from public.perceptions where company_id <> institution_id;
  delete from public.analysis_sessions where company_id <> institution_id;
  delete from public.knowledge_suggestions where company_id <> institution_id;
  delete from public.taxonomy_refinements where company_id <> institution_id;
  update public.entities set governance_status = 'candidate', consolidated_into = null where company_id <> institution_id and consolidated_into is not null;
  delete from public.entities where company_id <> institution_id;
  -- Agora a empresa descartada não possui mais referências.
  delete from public.companies where id <> institution_id;
end $$;

alter table public.user_roles enable row level security;
create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.user_roles where user_id = auth.uid()
$$;
create or replace function public.is_institution_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = auth.uid())
$$;
create or replace function public.is_institution_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')
$$;
create policy "users read own role" on public.user_roles for select to authenticated using (user_id = auth.uid());

-- Remove objetos que dependem da chave de empresa antes de remover a modelagem multiempresa.
drop view if exists public.recurrence_summary;
drop view if exists public.recurrence_daily;
drop view if exists public.dictionary_entity_summary;
drop function if exists public.unembedded_perceptions(integer);
drop function if exists public.semantic_neighbors(extensions.vector, real, integer);
drop function if exists public.semantic_similar_pairs(real, integer);
drop function if exists public.operational_anomalies();
drop function if exists public.persist_validated_perception(uuid, jsonb, uuid);
drop function if exists public.persist_validated_perception(uuid, jsonb);
drop function if exists public.register_entity_evidence(uuid, text, text, text, text);
drop function if exists public.consolidate_entities(uuid, uuid, uuid);
drop function if exists public.review_knowledge_suggestion(uuid, boolean, uuid, text);

do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
           where schemaname = 'public' and tablename in (
             'perceptions','analysis_sessions','ai_interpretations','classifications','corrections',
             'entities','entity_aliases','entity_evidence','knowledge_suggestions','entity_relations',
             'taxonomy_refinements','perception_embeddings','entity_governance_events',
             'companies','company_members','operational_units','user_active_companies')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

alter table public.perceptions drop column if exists company_id;
alter table public.analysis_sessions drop column if exists company_id;
alter table public.ai_interpretations drop column if exists company_id;
alter table public.classifications drop column if exists company_id;
alter table public.corrections drop column if exists company_id;
alter table public.entities drop column if exists company_id;
alter table public.entity_aliases drop column if exists company_id;
alter table public.entity_evidence drop column if exists company_id;
alter table public.knowledge_suggestions drop column if exists company_id;
alter table public.entity_relations drop column if exists company_id;
alter table public.taxonomy_refinements drop column if exists company_id;
alter table public.perception_embeddings drop column if exists company_id;
drop table if exists public.user_active_companies;
drop table if exists public.operational_units;
drop table if exists public.company_members;
drop table if exists public.companies;
drop function if exists public.resolve_active_company(uuid);
drop function if exists public.is_company_member(uuid);
drop function if exists public.is_company_admin(uuid);

alter table public.entities drop constraint if exists entities_company_type_normalized_name_key;
alter table public.entity_aliases drop constraint if exists entity_aliases_company_type_normalized_alias_key;
alter table public.entities add constraint entities_entity_type_normalized_name_key unique (entity_type, normalized_name);
alter table public.entity_aliases add constraint entity_aliases_entity_type_normalized_alias_key unique (entity_type, normalized_alias);
drop index if exists public.entities_company_lookup_idx;
drop index if exists public.entity_aliases_company_lookup_idx;

-- Leitura é institucional; escritas operacionais continuam restritas ao fluxo transacional.
create policy "institution reads perceptions" on public.perceptions for select to authenticated using (public.is_institution_member());
create policy "institution reads sessions" on public.analysis_sessions for select to authenticated using (public.is_institution_member());
create policy "institution reads interpretations" on public.ai_interpretations for select to authenticated using (public.is_institution_member());
create policy "institution reads classifications" on public.classifications for select to authenticated using (public.is_institution_member());
create policy "institution reads corrections" on public.corrections for select to authenticated using (public.is_institution_member());
create policy "institution reads embeddings" on public.perception_embeddings for select to authenticated using (public.is_institution_member());
do $$ declare t text; begin
  foreach t in array array['entities','entity_aliases','entity_evidence','knowledge_suggestions','entity_relations','taxonomy_refinements'] loop
    execute format('create policy "institution reads %1$s" on public.%1$I for select to authenticated using (public.is_institution_member())', t);
    execute format('create policy "institution admins insert %1$s" on public.%1$I for insert to authenticated with check (public.is_institution_admin())', t);
    execute format('create policy "institution admins update %1$s" on public.%1$I for update to authenticated using (public.is_institution_admin()) with check (public.is_institution_admin())', t);
    execute format('create policy "institution admins delete %1$s" on public.%1$I for delete to authenticated using (public.is_institution_admin())', t);
  end loop;
end $$;
create policy "institution admins read governance events" on public.entity_governance_events for select to authenticated using (public.is_institution_admin());

create or replace view public.dictionary_entity_summary with (security_invoker = true) as
select e.id, e.entity_type, e.canonical_name, e.governance_status, e.consolidated_into, e.created_at, e.updated_at, e.homologated_at, e.rejected_at,
  count(ev.id)::integer as evidence_count, count(distinct ev.perception_id)::integer as perception_count, max(ev.created_at) as last_evidence_at
from public.entities e left join public.entity_evidence ev on ev.entity_id = e.id group by e.id;
create or replace view public.recurrence_summary with (security_invoker = true) as
select c.sistema, c.processo, c.subprocesso, c.categoria_problema, count(*)::integer as occurrences, min(p.created_at) as first_seen_at, max(p.created_at) as last_seen_at
from public.classifications c join public.perceptions p on p.id = c.perception_id group by c.sistema, c.processo, c.subprocesso, c.categoria_problema;
create or replace view public.recurrence_daily with (security_invoker = true) as
select date_trunc('day', p.created_at)::date as occurrence_date, c.sistema, c.processo, c.categoria_problema, count(*)::integer as occurrences
from public.classifications c join public.perceptions p on p.id = c.perception_id group by date_trunc('day', p.created_at)::date, c.sistema, c.processo, c.categoria_problema;

create or replace function public.register_entity_evidence(p_perception_id uuid, p_entity_type text, p_field_name text, p_value text, p_evidence_state text)
returns uuid language plpgsql security definer set search_path = public as $$
declare n text; e uuid; target uuid;
begin
  if p_value is null or trim(p_value) = '' then return null; end if;
  n := public.normalize_entity_name(p_value);
  select id into e from public.entities where entity_type = p_entity_type and normalized_name = n;
  if e is null then select entity_id into e from public.entity_aliases where entity_type = p_entity_type and normalized_alias = n; end if;
  if e is not null then select consolidated_into into target from public.entities where id = e; if target is not null then e := target; end if; end if;
  if e is null then insert into public.entities(entity_type, canonical_name, normalized_name) values(p_entity_type, trim(p_value), n) returning id into e; end if;
  insert into public.entity_evidence(entity_id, perception_id, field_name, extracted_value, evidence_state) values(e, p_perception_id, p_field_name, trim(p_value), p_evidence_state) on conflict(entity_id, perception_id, field_name) do nothing;
  return e;
end $$;
create or replace function public.persist_validated_perception(p_session_id uuid, p_classification jsonb, p_actor_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare s public.analysis_sessions%rowtype; pid uuid; field text; ai text; final text; state text;
begin
  if not exists(select 1 from public.user_roles where user_id = p_actor_id) then raise exception 'institution_access_required'; end if;
  select * into s from public.analysis_sessions where id = p_session_id and consumed_at is null and expires_at > now() for update;
  if not found then raise exception 'analysis_session_unavailable'; end if;
  if p_classification->>'tipo' not in ('reclamacao','sugestao','duvida','elogio','outro') or p_classification->>'categoria_problema' not in ('erro','lentidao','acesso','usabilidade','integracao','processo','informacao','outro') then raise exception 'invalid_classification'; end if;
  insert into public.perceptions(original_text) values(s.original_text) returning id into pid;
  insert into public.ai_interpretations(perception_id,prompt_version,raw_response,interpretation) values(pid,s.prompt_version,s.raw_response,s.proposed_interpretation->>'interpretation');
  insert into public.classifications(perception_id,tipo,processo,subprocesso,sistema,categoria_problema) values(pid,p_classification->>'tipo',nullif(p_classification->>'processo',''),nullif(p_classification->>'subprocesso',''),nullif(p_classification->>'sistema',''),p_classification->>'categoria_problema');
  foreach field in array array['tipo','processo','subprocesso','sistema','categoria_problema'] loop ai:=s.proposed_interpretation->'fields'->field->>'value'; final:=nullif(p_classification->>field,''); if ai is distinct from final then insert into public.corrections(perception_id,field,ai_value,final_value) values(pid,field,ai,final); end if; end loop;
  foreach field in array array['processo','subprocesso','sistema'] loop final:=nullif(p_classification->>field,''); if final is not null then state:=coalesce(s.proposed_interpretation->'fields'->field->>'evidence','observed'); if state not in ('observed','inferred','suggested') then state := 'observed'; end if; perform public.register_entity_evidence(pid,field,field,final,state); end if; end loop;
  update public.analysis_sessions set consumed_at=now() where id=p_session_id; return pid;
end $$;
create or replace function public.consolidate_entities(p_source_id uuid, p_target_id uuid, p_actor_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s public.entities%rowtype; t public.entities%rowtype;
begin
  if not exists(select 1 from public.user_roles where user_id=p_actor_id and role='admin') then raise exception 'institution_admin_required'; end if;
  select * into s from public.entities where id=p_source_id for update; select * into t from public.entities where id=p_target_id for update;
  if s.id is null or t.id is null or s.id=t.id or s.entity_type<>t.entity_type or t.governance_status='consolidated' then raise exception 'invalid_consolidation'; end if;
  delete from public.entity_evidence a using public.entity_evidence b where a.entity_id=p_source_id and b.entity_id=p_target_id and a.perception_id=b.perception_id and a.field_name=b.field_name;
  update public.entity_evidence set entity_id=p_target_id where entity_id=p_source_id;
  update public.entities set governance_status='consolidated', consolidated_into=p_target_id, updated_at=now() where id=p_source_id;
  insert into public.entity_aliases(entity_id,entity_type,alias,normalized_alias) values(p_target_id,s.entity_type,s.canonical_name,public.normalize_entity_name(s.canonical_name)) on conflict(entity_type,normalized_alias) do nothing;
  insert into public.entity_governance_events(entity_id,action,actor_id,target_entity_id) values(p_source_id,'consolidated',p_actor_id,p_target_id);
end $$;
create or replace function public.review_knowledge_suggestion(p_suggestion_id uuid, p_approved boolean, p_actor_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare s public.knowledge_suggestions%rowtype; a uuid; b uuid;
begin
  if not exists(select 1 from public.user_roles where user_id=p_actor_id and role='admin') then raise exception 'institution_admin_required'; end if;
  select * into s from public.knowledge_suggestions where id=p_suggestion_id and status='pending' for update; if not found then raise exception 'suggestion_unavailable'; end if;
  if not p_approved then update public.knowledge_suggestions set status='rejected',reviewed_at=now(),reviewed_by=p_actor_id,review_note=p_note where id=p_suggestion_id; return; end if;
  if s.suggestion_type='discover' then a:=(s.proposal->>'entity_id')::uuid; update public.entities set governance_status='homologated',homologated_at=now(),rejected_at=null,updated_at=now() where id=a; if not found then raise exception 'suggestion_entity_missing'; end if; insert into public.entity_governance_events(entity_id,action,actor_id,details) values(a,'homologated',p_actor_id,jsonb_build_object('suggestion_id',p_suggestion_id));
  elsif s.suggestion_type='group' then perform public.consolidate_entities((s.proposal->>'source_entity_id')::uuid,(s.proposal->>'target_entity_id')::uuid,p_actor_id);
  elsif s.suggestion_type='relate' then a:=(s.proposal->>'source_entity_id')::uuid; b:=(s.proposal->>'target_entity_id')::uuid; insert into public.entity_relations(source_entity_id,target_entity_id,evidence_count,approved_by) values(a,b,coalesce((s.proposal->>'evidence_count')::integer,0),p_actor_id) on conflict(source_entity_id,target_entity_id,relation_type) do update set evidence_count=greatest(public.entity_relations.evidence_count,excluded.evidence_count);
  elsif s.suggestion_type='refine' then insert into public.taxonomy_refinements(parent_category,proposed_category,rationale,evidence,approved_by) values(s.proposal->>'parent_category',s.proposal->>'proposed_category',s.proposal->>'rationale',s.evidence,p_actor_id) on conflict(parent_category,proposed_category) do nothing;
  else raise exception 'unsupported_suggestion'; end if;
  update public.knowledge_suggestions set status='approved',reviewed_at=now(),reviewed_by=p_actor_id,review_note=p_note where id=p_suggestion_id;
end $$;

create or replace function public.unembedded_perceptions(p_limit integer default 20) returns table(perception_id uuid, original_text text) language sql stable security definer set search_path=public as $$ select p.id,p.original_text from public.perceptions p left join public.perception_embeddings e on e.perception_id=p.id where e.perception_id is null order by p.created_at limit least(greatest(p_limit,1),50) $$;
create or replace function public.semantic_neighbors(p_embedding extensions.vector(768), p_threshold real default 0.78, p_limit integer default 20) returns table(perception_id uuid, original_text text, similarity real, created_at timestamptz) language sql stable security definer set search_path=public,extensions as $$ select e.perception_id,p.original_text,(1-(e.embedding <=> p_embedding))::real,p.created_at from public.perception_embeddings e join public.perceptions p on p.id=e.perception_id where 1-(e.embedding <=> p_embedding)>=p_threshold order by e.embedding <=> p_embedding limit least(greatest(p_limit,1),50) $$;
create or replace function public.semantic_similar_pairs(p_threshold real default 0.84,p_limit integer default 100) returns table(source_perception_id uuid,target_perception_id uuid,source_text text,target_text text,similarity real) language sql stable security definer set search_path=public,extensions as $$ select a.perception_id,b.perception_id,pa.original_text,pb.original_text,(1-(a.embedding <=> b.embedding))::real from public.perception_embeddings a join public.perception_embeddings b on a.perception_id<b.perception_id join public.perceptions pa on pa.id=a.perception_id join public.perceptions pb on pb.id=b.perception_id where 1-(a.embedding <=> b.embedding)>=p_threshold order by a.embedding <=> b.embedding limit least(greatest(p_limit,1),200) $$;
create or replace function public.operational_anomalies() returns table(sistema text,processo text,categoria_problema text,recent_occurrences integer,prior_daily_average numeric,growth_ratio numeric) language sql stable security definer set search_path=public as $$ with counts as (select c.sistema,c.processo,c.categoria_problema,count(*) filter(where p.created_at>=now()-interval '7 days')::integer recent_count,count(*) filter(where p.created_at>=now()-interval '37 days' and p.created_at<now()-interval '7 days')::numeric/30 prior_daily_average from public.classifications c join public.perceptions p on p.id=c.perception_id group by c.sistema,c.processo,c.categoria_problema) select sistema,processo,categoria_problema,recent_count,prior_daily_average,case when prior_daily_average=0 then null else round(recent_count/(prior_daily_average*7),2) end from counts where recent_count>=2 and (prior_daily_average=0 or recent_count/greatest(prior_daily_average*7,1)>=2) order by recent_count desc $$;

revoke all on function public.persist_validated_perception(uuid,jsonb,uuid) from anon,authenticated;
grant execute on function public.persist_validated_perception(uuid,jsonb,uuid) to service_role;
revoke all on function public.consolidate_entities(uuid,uuid,uuid) from anon,authenticated;
grant execute on function public.consolidate_entities(uuid,uuid,uuid) to service_role;
revoke all on function public.review_knowledge_suggestion(uuid,boolean,uuid,text) from anon,authenticated;
grant execute on function public.review_knowledge_suggestion(uuid,boolean,uuid,text) to service_role;
