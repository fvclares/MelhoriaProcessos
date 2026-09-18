create table if not exists public.mvp0_call_audits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  model text not null,
  latency_ms integer not null check (latency_ms >= 0),
  outcome text not null check (outcome in ('success', 'invalid_ai_response', 'provider_error', 'request_error')),
  response_valid boolean not null default false,
  error_code text
);

alter table public.mvp0_call_audits enable row level security;

-- Não há políticas: esta tabela é gravada apenas pela Edge Function usando a service role.
