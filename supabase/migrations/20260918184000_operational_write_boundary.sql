-- Melhoria 2: registros operacionais só entram pelo fluxo transacional validado.
do $$ declare t text; begin
  foreach t in array array['perceptions','analysis_sessions','ai_interpretations','classifications','corrections'] loop
    execute format('drop policy if exists "tenant insert %1$s" on public.%1$I', t);
    execute format('drop policy if exists "tenant update %1$s" on public.%1$I', t);
    execute format('drop policy if exists "tenant delete %1$s" on public.%1$I', t);
  end loop;
end $$;

create or replace function public.register_entity_evidence(p_perception_id uuid, p_entity_type text, p_field_name text, p_value text, p_evidence_state text)
returns uuid language plpgsql security definer set search_path=public as $$
declare n text; e uuid; target uuid; company uuid;
begin
 if p_value is null or trim(p_value)='' then return null; end if;
 select company_id into company from public.perceptions where id=p_perception_id;
 if company is null then raise exception 'perception_without_company'; end if;
 n:=public.normalize_entity_name(p_value);
 select id into e from public.entities where entity_type=p_entity_type and normalized_name=n and company_id=company;
 if e is null then select entity_id into e from public.entity_aliases where entity_type=p_entity_type and normalized_alias=n and company_id=company; end if;
 if e is not null then select consolidated_into into target from public.entities where id=e; if target is not null then e:=target; end if; end if;
 if e is null then insert into public.entities(entity_type,canonical_name,normalized_name,company_id) values(p_entity_type,trim(p_value),n,company) returning id into e; end if;
 insert into public.entity_evidence(entity_id,perception_id,field_name,extracted_value,evidence_state,company_id) values(e,p_perception_id,p_field_name,trim(p_value),p_evidence_state,company) on conflict(entity_id,perception_id,field_name) do nothing;
 return e;
end $$;

create or replace function public.persist_validated_perception(p_session_id uuid, p_classification jsonb, p_actor_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare s public.analysis_sessions%rowtype; pid uuid; field text; ai text; final text; state text; company uuid;
begin
 select * into s from public.analysis_sessions where id=p_session_id and consumed_at is null and expires_at>now() for update;
 if not found then raise exception 'analysis_session_unavailable'; end if;
 company:=s.company_id;
 if not exists(select 1 from public.company_members where company_id=company and user_id=p_actor_id) then raise exception 'company_not_authorized'; end if;
 if p_classification->>'tipo' not in ('reclamacao','sugestao','duvida','elogio','outro') or p_classification->>'categoria_problema' not in ('erro','lentidao','acesso','usabilidade','integracao','processo','informacao','outro') then raise exception 'invalid_classification'; end if;
 insert into public.perceptions(original_text,company_id) values(s.original_text,company) returning id into pid;
 insert into public.ai_interpretations(perception_id,prompt_version,raw_response,interpretation,company_id) values(pid,s.prompt_version,s.raw_response,s.proposed_interpretation->>'interpretation',company);
 insert into public.classifications(perception_id,tipo,processo,subprocesso,sistema,categoria_problema,company_id) values(pid,p_classification->>'tipo',nullif(p_classification->>'processo',''),nullif(p_classification->>'subprocesso',''),nullif(p_classification->>'sistema',''),p_classification->>'categoria_problema',company);
 foreach field in array array['tipo','processo','subprocesso','sistema','categoria_problema'] loop ai:=s.proposed_interpretation->'fields'->field->>'value'; final:=nullif(p_classification->>field,''); if ai is distinct from final then insert into public.corrections(perception_id,field,ai_value,final_value,company_id) values(pid,field,ai,final,company); end if; end loop;
 foreach field in array array['processo','subprocesso','sistema'] loop final:=nullif(p_classification->>field,''); if final is not null then state:=coalesce(s.proposed_interpretation->'fields'->field->>'evidence','observed'); if state not in ('observed','inferred','suggested') then state:='observed'; end if; perform public.register_entity_evidence(pid,field,field,final,state); end if; end loop;
 update public.analysis_sessions set consumed_at=now() where id=p_session_id; return pid;
end $$;

revoke all on function public.persist_validated_perception(uuid,jsonb,uuid) from anon, authenticated;
grant execute on function public.persist_validated_perception(uuid,jsonb,uuid) to service_role;
revoke all on function public.persist_validated_perception(uuid,jsonb) from anon, authenticated;
