-- Fix MVP7: adiciona company_id faltante e politicas para classifications/ai_interpretations/corrections
-- A fundacao original nao incluiu classifications, que e usada em recurrence_summary

-- Adiciona company_id a classifications e ai_interpretations/corrections se ainda nao existir
alter table public.classifications add column if not exists company_id uuid references public.companies(id);
alter table public.ai_interpretations add column if not exists company_id uuid references public.companies(id);
alter table public.corrections add column if not exists company_id uuid references public.companies(id);

-- Preenche a partir das percepcoes (fonte da verdade)
do $$ declare v_company uuid; begin
  -- classifications: usa company da percepcao
  update public.classifications c set company_id = p.company_id
  from public.perceptions p where p.id = c.perception_id and c.company_id is null;
  -- ai_interpretations
  update public.ai_interpretations a set company_id = p.company_id
  from public.perceptions p where p.id = a.perception_id and a.company_id is null;
  -- corrections
  update public.corrections co set company_id = p.company_id
  from public.perceptions p where p.id = co.perception_id and co.company_id is null;
end $$;

-- Torna not null onde possivel (se ainda houver null, mantem nullable para nao quebrar, mas tenta)
-- Nao forca NOT NULL se ainda houver dados sem empresa (deve estar tudo preenchido agora)
do $$ begin
  perform 1 from public.classifications where company_id is null;
  if not found then alter table public.classifications alter column company_id set not null; end if;
  perform 1 from public.ai_interpretations where company_id is null;
  if not found then alter table public.ai_interpretations alter column company_id set not null; end if;
  perform 1 from public.corrections where company_id is null;
  if not found then alter table public.corrections alter column company_id set not null; end if;
end $$;

-- Habilita RLS onde ainda nao esta (classifications ja tem, mas garante)
alter table public.classifications enable row level security;
alter table public.ai_interpretations enable row level security;
alter table public.corrections enable row level security;

-- Politicas tenant para classifications/ai_interpretations/corrections (via company_id direto)
do $$ begin
  execute 'drop policy if exists "tenant select classifications" on public.classifications';
  execute 'create policy "tenant select classifications" on public.classifications for select to authenticated using (public.is_company_member(company_id))';
  execute 'drop policy if exists "tenant insert classifications" on public.classifications';
  execute 'create policy "tenant insert classifications" on public.classifications for insert to authenticated with check (public.is_company_member(company_id))';
  execute 'drop policy if exists "tenant select ai_interpretations" on public.ai_interpretations';
  execute 'create policy "tenant select ai_interpretations" on public.ai_interpretations for select to authenticated using (public.is_company_member(company_id))';
  execute 'drop policy if exists "tenant insert ai_interpretations" on public.ai_interpretations';
  execute 'create policy "tenant insert ai_interpretations" on public.ai_interpretations for insert to authenticated with check (public.is_company_member(company_id))';
  execute 'drop policy if exists "tenant select corrections" on public.corrections';
  execute 'create policy "tenant select corrections" on public.corrections for select to authenticated using (public.is_company_member(company_id))';
  execute 'drop policy if exists "tenant insert corrections" on public.corrections';
  execute 'create policy "tenant insert corrections" on public.corrections for insert to authenticated with check (public.is_company_member(company_id))';
end $$;

-- Atualiza persist_validated_perception para preencher company_id nas tabelas auxiliares
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
  insert into public.ai_interpretations (perception_id, prompt_version, raw_response, interpretation, company_id) values (v_perception_id, v_session.prompt_version, v_session.raw_response, v_session.proposed_interpretation->>'interpretation', v_company);
  insert into public.classifications (perception_id, tipo, processo, subprocesso, sistema, categoria_problema, company_id) values (v_perception_id, p_classification->>'tipo', nullif(p_classification->>'processo', ''), nullif(p_classification->>'subprocesso', ''), nullif(p_classification->>'sistema', ''), p_classification->>'categoria_problema', v_company);

  foreach v_field in array array['tipo', 'processo', 'subprocesso', 'sistema', 'categoria_problema'] loop
    v_ai_value := v_session.proposed_interpretation->'fields'->v_field->>'value'; v_final_value := nullif(p_classification->>v_field, '');
    if v_ai_value is distinct from v_final_value then insert into public.corrections (perception_id, field, ai_value, final_value, company_id) values (v_perception_id, v_field, v_ai_value, v_final_value, v_company); end if;
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
