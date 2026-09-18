-- Melhoria 1: somente administradores podem alterar conhecimento governado.
create or replace function public.is_company_admin(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members
    where company_id = p_company_id and user_id = auth.uid() and role = 'admin'
  )
$$;

do $$ declare t text; begin
  foreach t in array array['entities','entity_aliases','entity_evidence','knowledge_suggestions','entity_relations','taxonomy_refinements'] loop
    execute format('drop policy if exists "tenant insert %1$s" on public.%1$I', t);
    execute format('drop policy if exists "tenant update %1$s" on public.%1$I', t);
    execute format('drop policy if exists "tenant delete %1$s" on public.%1$I', t);
    execute format('create policy "admin insert %1$s" on public.%1$I for insert to authenticated with check (public.is_company_admin(company_id))', t);
    execute format('create policy "admin update %1$s" on public.%1$I for update to authenticated using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id))', t);
    execute format('create policy "admin delete %1$s" on public.%1$I for delete to authenticated using (public.is_company_admin(company_id))', t);
  end loop;
end $$;

drop policy if exists "admin reads governance events" on public.entity_governance_events;
create policy "admin reads governance events" on public.entity_governance_events for select to authenticated using (
  exists (select 1 from public.entities e where e.id = entity_id and public.is_company_admin(e.company_id))
);

create or replace function public.consolidate_entities(p_source_id uuid, p_target_id uuid, p_actor_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_source public.entities%rowtype; v_target public.entities%rowtype;
begin
  select * into v_source from public.entities where id=p_source_id for update;
  select * into v_target from public.entities where id=p_target_id for update;
  if v_source.id is null or v_target.id is null or v_source.id=v_target.id or v_source.entity_type<>v_target.entity_type or v_target.governance_status='consolidated' or v_source.company_id<>v_target.company_id then raise exception 'invalid_consolidation'; end if;
  if not exists (select 1 from public.company_members where company_id=v_source.company_id and user_id=p_actor_id and role='admin') then raise exception 'company_admin_required'; end if;
  delete from public.entity_evidence s using public.entity_evidence t where s.entity_id=p_source_id and t.entity_id=p_target_id and s.perception_id=t.perception_id and s.field_name=t.field_name;
  update public.entity_evidence set entity_id=p_target_id where entity_id=p_source_id;
  update public.entities set governance_status='consolidated', consolidated_into=p_target_id, updated_at=now() where id=p_source_id;
  insert into public.entity_aliases(entity_id,entity_type,alias,normalized_alias,company_id) values(p_target_id,v_source.entity_type,v_source.canonical_name,public.normalize_entity_name(v_source.canonical_name),v_target.company_id) on conflict (entity_type,normalized_alias) do nothing;
  insert into public.entity_governance_events(entity_id,action,actor_id,target_entity_id) values(p_source_id,'consolidated',p_actor_id,p_target_id);
end $$;

revoke all on function public.consolidate_entities(uuid, uuid, uuid) from anon, authenticated;
grant execute on function public.consolidate_entities(uuid, uuid, uuid) to service_role;
revoke all on function public.review_knowledge_suggestion(uuid, boolean, uuid, text) from anon, authenticated;
grant execute on function public.review_knowledge_suggestion(uuid, boolean, uuid, text) to service_role;

create or replace function public.review_knowledge_suggestion(p_suggestion_id uuid, p_approved boolean, p_actor_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare s public.knowledge_suggestions%rowtype; a uuid; b uuid; c uuid;
begin
 select * into s from public.knowledge_suggestions where id=p_suggestion_id and status='pending' for update;
 if not found then raise exception 'suggestion_unavailable'; end if;
 if not exists(select 1 from public.company_members where company_id=s.company_id and user_id=p_actor_id and role='admin') then raise exception 'company_admin_required'; end if;
 if not p_approved then update public.knowledge_suggestions set status='rejected',reviewed_at=now(),reviewed_by=p_actor_id,review_note=p_note where id=p_suggestion_id; return; end if;
 if s.suggestion_type='discover' then
  a:=(s.proposal->>'entity_id')::uuid; update public.entities set governance_status='homologated',homologated_at=now(),rejected_at=null,updated_at=now() where id=a and company_id=s.company_id;
  if not found then raise exception 'suggestion_entity_missing'; end if;
  insert into public.entity_governance_events(entity_id,action,actor_id,details) values(a,'homologated',p_actor_id,jsonb_build_object('suggestion_id',p_suggestion_id));
 elsif s.suggestion_type='group' then perform public.consolidate_entities((s.proposal->>'source_entity_id')::uuid,(s.proposal->>'target_entity_id')::uuid,p_actor_id);
 elsif s.suggestion_type='relate' then
  a:=(s.proposal->>'source_entity_id')::uuid; b:=(s.proposal->>'target_entity_id')::uuid;
  if not exists(select 1 from public.entities where id=a and company_id=s.company_id) or not exists(select 1 from public.entities where id=b and company_id=s.company_id) then raise exception 'suggestion_entity_missing'; end if;
  insert into public.entity_relations(source_entity_id,target_entity_id,evidence_count,approved_by,company_id) values(a,b,coalesce((s.proposal->>'evidence_count')::integer,0),p_actor_id,s.company_id) on conflict(source_entity_id,target_entity_id,relation_type) do update set evidence_count=greatest(public.entity_relations.evidence_count,excluded.evidence_count);
 elsif s.suggestion_type='refine' then
  insert into public.taxonomy_refinements(parent_category,proposed_category,rationale,evidence,approved_by,company_id) values(s.proposal->>'parent_category',s.proposal->>'proposed_category',s.proposal->>'rationale',s.evidence,p_actor_id,s.company_id) on conflict(parent_category,proposed_category) do nothing;
 else raise exception 'unsupported_suggestion'; end if;
 update public.knowledge_suggestions set status='approved',reviewed_at=now(),reviewed_by=p_actor_id,review_note=p_note where id=p_suggestion_id;
end $$;
