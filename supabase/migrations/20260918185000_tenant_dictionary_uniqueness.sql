-- Melhoria 3: vocabulário idêntico é permitido em empresas distintas.
alter table public.entities drop constraint if exists entities_entity_type_normalized_name_key;
alter table public.entity_aliases drop constraint if exists entity_aliases_entity_type_normalized_alias_key;
alter table public.entities add constraint entities_company_type_normalized_name_key unique (company_id, entity_type, normalized_name);
alter table public.entity_aliases add constraint entity_aliases_company_type_normalized_alias_key unique (company_id, entity_type, normalized_alias);

create index if not exists entities_company_lookup_idx on public.entities(company_id, entity_type, normalized_name);
create index if not exists entity_aliases_company_lookup_idx on public.entity_aliases(company_id, entity_type, normalized_alias);

create or replace function public.consolidate_entities(p_source_id uuid, p_target_id uuid, p_actor_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_source public.entities%rowtype; v_target public.entities%rowtype;
begin
 select * into v_source from public.entities where id=p_source_id for update;
 select * into v_target from public.entities where id=p_target_id for update;
 if v_source.id is null or v_target.id is null or v_source.id=v_target.id or v_source.entity_type<>v_target.entity_type or v_target.governance_status='consolidated' or v_source.company_id<>v_target.company_id then raise exception 'invalid_consolidation'; end if;
 if not exists(select 1 from public.company_members where company_id=v_source.company_id and user_id=p_actor_id and role='admin') then raise exception 'company_admin_required'; end if;
 delete from public.entity_evidence s using public.entity_evidence t where s.entity_id=p_source_id and t.entity_id=p_target_id and s.perception_id=t.perception_id and s.field_name=t.field_name;
 update public.entity_evidence set entity_id=p_target_id where entity_id=p_source_id;
 update public.entities set governance_status='consolidated', consolidated_into=p_target_id, updated_at=now() where id=p_source_id;
 insert into public.entity_aliases(entity_id,entity_type,alias,normalized_alias,company_id)
 values(p_target_id,v_source.entity_type,v_source.canonical_name,public.normalize_entity_name(v_source.canonical_name),v_target.company_id)
 on conflict(company_id,entity_type,normalized_alias) do nothing;
 insert into public.entity_governance_events(entity_id,action,actor_id,target_entity_id) values(p_source_id,'consolidated',p_actor_id,p_target_id);
end $$;

revoke all on function public.consolidate_entities(uuid,uuid,uuid) from anon, authenticated;
grant execute on function public.consolidate_entities(uuid,uuid,uuid) to service_role;
