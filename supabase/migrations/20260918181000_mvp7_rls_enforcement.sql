-- MVP7 RLS enforcement: torna as funcoes e politicas tenant-aware
-- Esta migration complementa 20260918180000_mvp7_saas_foundation.sql que apenas criou SELECT policies

-- 1) Politicas de escrita tenant-aware (INSERT/UPDATE) para tabelas operacionais
do $$ declare t text; begin
 foreach t in array array['perceptions','analysis_sessions','entities','entity_aliases','entity_evidence','knowledge_suggestions','entity_relations','taxonomy_refinements','perception_embeddings'] loop
  -- INSERT: permite inserir apenas na propria empresa
  execute format('drop policy if exists "tenant insert %1$s" on public.%1$I', t);
  execute format('create policy "tenant insert %1$s" on public.%1$I for insert to authenticated with check (public.is_company_member(company_id))', t);
  -- UPDATE: so pode atualizar linhas da propria empresa
  execute format('drop policy if exists "tenant update %1$s" on public.%1$I', t);
  execute format('create policy "tenant update %1$s" on public.%1$I for update to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id))', t);
  -- DELETE: se necessario, mesma regra (nao usado mas para completude)
  execute format('drop policy if exists "tenant delete %1$s" on public.%1$I', t);
  execute format('create policy "tenant delete %1$s" on public.%1$I for delete to authenticated using (public.is_company_member(company_id))', t);
 end loop;
end $$;

-- 2) Atualiza register_entity_evidence para ser tenant-aware (company_id obrigatorio)
create or replace function public.register_entity_evidence(
  p_perception_id uuid,
  p_entity_type text,
  p_field_name text,
  p_value text,
  p_evidence_state text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_normalized text;
  v_entity_id uuid;
  v_consolidated_into uuid;
  v_company uuid;
begin
  if p_value is null or trim(p_value) = '' then return null; end if;
  v_normalized := public.normalize_entity_name(p_value);
  -- resolve company da percepcao (fonte da verdade)
  select company_id into v_company from public.perceptions where id = p_perception_id;
  if v_company is null then raise exception 'perception_without_company'; end if;
  -- verifica que quem chama pertence a empresa (RLS ou check explicito)
  if not public.is_company_member(v_company) then raise exception 'company_not_authorized'; end if;

  select e.id into v_entity_id from public.entities e
  where e.entity_type = p_entity_type and e.normalized_name = v_normalized and e.company_id = v_company;

  if v_entity_id is null then
    select a.entity_id into v_entity_id from public.entity_aliases a
    where a.entity_type = p_entity_type and a.normalized_alias = v_normalized and a.company_id = v_company;
  end if;

  if v_entity_id is not null then
    select consolidated_into into v_consolidated_into from public.entities where id = v_entity_id;
    if v_consolidated_into is not null then v_entity_id := v_consolidated_into; end if;
  end if;

  if v_entity_id is null then
    insert into public.entities (entity_type, canonical_name, normalized_name, company_id)
    values (p_entity_type, trim(p_value), v_normalized, v_company)
    returning id into v_entity_id;
  end if;

  insert into public.entity_evidence (entity_id, perception_id, field_name, extracted_value, evidence_state, company_id)
  values (v_entity_id, p_perception_id, p_field_name, trim(p_value), p_evidence_state, v_company)
  on conflict (entity_id, perception_id, field_name) do nothing;
  return v_entity_id;
end;
$$;

-- 3) Atualiza persist_validated_perception para herdar company_id da sessao
create or replace function public.persist_validated_perception(p_session_id uuid, p_classification jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.analysis_sessions%rowtype;
  v_perception_id uuid;
  v_field text;
  v_ai_value text;
  v_final_value text;
  v_state text;
  v_company uuid;
begin
  select * into v_session from public.analysis_sessions where id = p_session_id and consumed_at is null and expires_at > now() for update;
  if not found then raise exception 'analysis_session_unavailable'; end if;
  v_company := v_session.company_id;
  if v_company is null then raise exception 'session_without_company'; end if;
  if not public.is_company_member(v_company) then raise exception 'company_not_authorized'; end if;
  if p_classification->>'tipo' not in ('reclamacao', 'sugestao', 'duvida', 'elogio', 'outro') or p_classification->>'categoria_problema' not in ('erro', 'lentidao', 'acesso', 'usabilidade', 'integracao', 'processo', 'informacao', 'outro') then raise exception 'invalid_classification'; end if;

  insert into public.perceptions (original_text, company_id) values (v_session.original_text, v_company) returning id into v_perception_id;
  insert into public.ai_interpretations (perception_id, prompt_version, raw_response, interpretation) values (v_perception_id, v_session.prompt_version, v_session.raw_response, v_session.proposed_interpretation->>'interpretation');
  insert into public.classifications (perception_id, tipo, processo, subprocesso, sistema, categoria_problema) values (v_perception_id, p_classification->>'tipo', nullif(p_classification->>'processo', ''), nullif(p_classification->>'subprocesso', ''), nullif(p_classification->>'sistema', ''), p_classification->>'categoria_problema');

  foreach v_field in array array['tipo', 'processo', 'subprocesso', 'sistema', 'categoria_problema'] loop
    v_ai_value := v_session.proposed_interpretation->'fields'->v_field->>'value'; v_final_value := nullif(p_classification->>v_field, '');
    if v_ai_value is distinct from v_final_value then insert into public.corrections (perception_id, field, ai_value, final_value) values (v_perception_id, v_field, v_ai_value, v_final_value); end if;
  end loop;

  foreach v_field in array array['processo', 'subprocesso', 'sistema'] loop
    v_final_value := nullif(p_classification->>v_field, '');
    if v_final_value is not null then
      v_state := coalesce(v_session.proposed_interpretation->'fields'->v_field->>'evidence', 'observed');
      if v_state not in ('observed', 'inferred', 'suggested') then v_state := 'observed'; end if;
      perform public.register_entity_evidence(v_perception_id, v_field, v_field, v_final_value, v_state);
    end if;
  end loop;

  update public.analysis_sessions set consumed_at = now() where id = p_session_id;
  return v_perception_id;
end;
$$;

-- 4) Atualiza consolidate_entities para checar mesma empresa
create or replace function public.consolidate_entities(p_source_id uuid, p_target_id uuid, p_actor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.entities%rowtype;
  v_target public.entities%rowtype;
begin
  select * into v_source from public.entities where id = p_source_id for update;
  select * into v_target from public.entities where id = p_target_id for update;
  if v_source.id is null or v_target.id is null or v_source.id = v_target.id or v_source.entity_type <> v_target.entity_type or v_target.governance_status = 'consolidated' then
    raise exception 'invalid_consolidation';
  end if;
  if v_source.company_id <> v_target.company_id then raise exception 'cross_company_consolidation'; end if;
  if not public.is_company_member(v_source.company_id) then raise exception 'company_not_authorized'; end if;

  delete from public.entity_evidence source_evidence
  using public.entity_evidence target_evidence
  where source_evidence.entity_id = p_source_id
    and target_evidence.entity_id = p_target_id
    and source_evidence.perception_id = target_evidence.perception_id
    and source_evidence.field_name = target_evidence.field_name;
  update public.entity_evidence set entity_id = p_target_id where entity_id = p_source_id;
  update public.entities set governance_status = 'consolidated', consolidated_into = p_target_id, updated_at = now() where id = p_source_id;
  insert into public.entity_aliases (entity_id, entity_type, alias, normalized_alias, company_id)
  values (p_target_id, v_source.entity_type, v_source.canonical_name, public.normalize_entity_name(v_source.canonical_name), v_target.company_id)
  on conflict (entity_type, normalized_alias) do nothing;
  insert into public.entity_governance_events (entity_id, action, actor_id, target_entity_id)
  values (p_source_id, 'consolidated', p_actor_id, p_target_id);
end;
$$;

-- 5) Atualiza review_knowledge_suggestion para checar empresa da sugestao
create or replace function public.review_knowledge_suggestion(p_suggestion_id uuid, p_approved boolean, p_actor_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suggestion public.knowledge_suggestions%rowtype;
  v_entity_id uuid;
  v_source_id uuid;
  v_target_id uuid;
begin
  select * into v_suggestion from public.knowledge_suggestions where id = p_suggestion_id and status = 'pending' for update;
  if not found then raise exception 'suggestion_unavailable'; end if;
  if not public.is_company_member(v_suggestion.company_id) then raise exception 'company_not_authorized'; end if;

  if not p_approved then
    update public.knowledge_suggestions set status = 'rejected', reviewed_at = now(), reviewed_by = p_actor_id, review_note = p_note where id = p_suggestion_id;
    return;
  end if;

  if v_suggestion.suggestion_type = 'discover' then
    v_entity_id := (v_suggestion.proposal->>'entity_id')::uuid;
    -- garante que entidade pertence a mesma empresa da sugestao
    perform 1 from public.entities where id = v_entity_id and company_id = v_suggestion.company_id;
    if not found then raise exception 'suggestion_entity_missing'; end if;
    update public.entities set governance_status = 'homologated', homologated_at = now(), rejected_at = null, updated_at = now() where id = v_entity_id;
    insert into public.entity_governance_events (entity_id, action, actor_id, details) values (v_entity_id, 'homologated', p_actor_id, jsonb_build_object('suggestion_id', p_suggestion_id));
  elsif v_suggestion.suggestion_type = 'group' then
    v_source_id := (v_suggestion.proposal->>'source_entity_id')::uuid;
    v_target_id := (v_suggestion.proposal->>'target_entity_id')::uuid;
    perform public.consolidate_entities(v_source_id, v_target_id, p_actor_id);
  elsif v_suggestion.suggestion_type = 'relate' then
    v_source_id := (v_suggestion.proposal->>'source_entity_id')::uuid;
    v_target_id := (v_suggestion.proposal->>'target_entity_id')::uuid;
    -- checa mesma empresa
    perform 1 from public.entities where id = v_source_id and company_id = v_suggestion.company_id;
    if not found then raise exception 'suggestion_entity_missing'; end if;
    perform 1 from public.entities where id = v_target_id and company_id = v_suggestion.company_id;
    if not found then raise exception 'suggestion_entity_missing'; end if;
    insert into public.entity_relations (source_entity_id, target_entity_id, evidence_count, approved_by, company_id)
    values (v_source_id, v_target_id, coalesce((v_suggestion.proposal->>'evidence_count')::integer, 0), p_actor_id, v_suggestion.company_id)
    on conflict (source_entity_id, target_entity_id, relation_type) do update set evidence_count = greatest(public.entity_relations.evidence_count, excluded.evidence_count);
  elsif v_suggestion.suggestion_type = 'refine' then
    insert into public.taxonomy_refinements (parent_category, proposed_category, rationale, evidence, approved_by, company_id)
    values (v_suggestion.proposal->>'parent_category', v_suggestion.proposal->>'proposed_category', v_suggestion.proposal->>'rationale', v_suggestion.evidence, p_actor_id, v_suggestion.company_id)
    on conflict (parent_category, proposed_category) do nothing;
  else
    raise exception 'unsupported_suggestion';
  end if;
  update public.knowledge_suggestions set status = 'approved', reviewed_at = now(), reviewed_by = p_actor_id, review_note = p_note where id = p_suggestion_id;
end;
$$;

-- 6) Torna funcoes semanticas tenant-aware (filtragem por company via is_company_member)
create or replace function public.unembedded_perceptions(p_limit integer default 20)
returns table (perception_id uuid, original_text text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.original_text
  from public.perceptions p
  left join public.perception_embeddings e on e.perception_id = p.id
  where e.perception_id is null and public.is_company_member(p.company_id)
  order by p.created_at
  limit least(greatest(p_limit, 1), 50)
$$;

create or replace function public.semantic_neighbors(p_embedding extensions.vector(768), p_threshold real default 0.78, p_limit integer default 20)
returns table (perception_id uuid, original_text text, similarity real, created_at timestamptz)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select e.perception_id, p.original_text, (1 - (e.embedding <=> p_embedding))::real as similarity, p.created_at
  from public.perception_embeddings e
  join public.perceptions p on p.id = e.perception_id
  where 1 - (e.embedding <=> p_embedding) >= p_threshold and public.is_company_member(e.company_id) and public.is_company_member(p.company_id)
  order by e.embedding <=> p_embedding
  limit least(greatest(p_limit, 1), 50)
$$;

create or replace function public.semantic_similar_pairs(p_threshold real default 0.84, p_limit integer default 100)
returns table (source_perception_id uuid, target_perception_id uuid, source_text text, target_text text, similarity real)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select a.perception_id, b.perception_id, pa.original_text, pb.original_text, (1 - (a.embedding <=> b.embedding))::real as similarity
  from public.perception_embeddings a
  join public.perception_embeddings b on a.perception_id < b.perception_id and a.company_id = b.company_id
  join public.perceptions pa on pa.id = a.perception_id
  join public.perceptions pb on pb.id = b.perception_id
  where 1 - (a.embedding <=> b.embedding) >= p_threshold and public.is_company_member(a.company_id)
  order by a.embedding <=> b.embedding
  limit least(greatest(p_limit, 1), 200)
$$;

create or replace function public.operational_anomalies()
returns table (sistema text, processo text, categoria_problema text, recent_occurrences integer, prior_daily_average numeric, growth_ratio numeric)
language sql
stable
security definer
set search_path = public
as $$
  with counts as (
    select c.sistema, c.processo, c.categoria_problema,
      count(*) filter (where p.created_at >= now() - interval '7 days')::integer as recent_count,
      count(*) filter (where p.created_at >= now() - interval '37 days' and p.created_at < now() - interval '7 days')::numeric / 30 as prior_daily_average
    from public.classifications c join public.perceptions p on p.id = c.perception_id
    where public.is_company_member(p.company_id)
    group by c.sistema, c.processo, c.categoria_problema
  )
  select sistema, processo, categoria_problema, recent_count, prior_daily_average,
    case when prior_daily_average = 0 then null else round(recent_count / (prior_daily_average * 7), 2) end
  from counts
  where recent_count >= 2 and (prior_daily_average = 0 or recent_count / greatest(prior_daily_average * 7, 1) >= 2)
  order by recent_count desc
$$;

revoke all on function public.unembedded_perceptions(integer) from public;
revoke all on function public.semantic_neighbors(extensions.vector, real, integer) from public;
revoke all on function public.semantic_similar_pairs(real, integer) from public;
revoke all on function public.operational_anomalies() from public;

-- 7) Views ja sao security_invoker e respeitam RLS via is_company_member; nada a alterar

revoke all on function public.register_entity_evidence(uuid, text, text, text, text) from public;
revoke all on function public.persist_validated_perception(uuid, jsonb) from public;
revoke all on function public.consolidate_entities(uuid, uuid, uuid) from public;
revoke all on function public.review_knowledge_suggestion(uuid, boolean, uuid, text) from public;
