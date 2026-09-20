-- Fase 2: limite transacional por usuário e por Edge Function.
create table if not exists public.edge_function_rate_limits (
  scope text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  primary key (scope, user_id)
);

alter table public.edge_function_rate_limits enable row level security;

create or replace function public.consume_edge_rate_limit(
  p_scope text,
  p_user_id uuid,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare current_window public.edge_function_rate_limits%rowtype;
begin
  if p_scope !~ '^[a-z0-9-]{1,80}$' or p_user_id is null or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid_rate_limit_parameters';
  end if;

  insert into public.edge_function_rate_limits(scope, user_id, request_count)
  values (p_scope, p_user_id, 0)
  on conflict (scope, user_id) do nothing;

  select * into current_window
  from public.edge_function_rate_limits
  where scope = p_scope and user_id = p_user_id
  for update;

  if current_window.window_started_at + make_interval(secs => p_window_seconds) <= now() then
    update public.edge_function_rate_limits
    set window_started_at = now(), request_count = 1
    where scope = p_scope and user_id = p_user_id;
    return query select true, 0;
  elsif current_window.request_count >= p_limit then
    return query select false, greatest(1, ceil(extract(epoch from current_window.window_started_at + make_interval(secs => p_window_seconds) - now()))::integer);
  end if;

  update public.edge_function_rate_limits
  set request_count = request_count + 1
  where scope = p_scope and user_id = p_user_id;
  return query select true, 0;
end;
$$;

revoke all on table public.edge_function_rate_limits from anon, authenticated;
revoke all on function public.consume_edge_rate_limit(text, uuid, integer, integer) from anon, authenticated;
grant execute on function public.consume_edge_rate_limit(text, uuid, integer, integer) to service_role;
