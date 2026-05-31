-- Daily AI query quota (apply after db/schema.sql)
-- Tracks workspace /api/workspace/query runs per user per UTC day.

alter table public.users
  add column if not exists daily_query_count integer not null default 0,
  add column if not exists query_quota_day text,
  add column if not exists daily_query_limit integer,
  add column if not exists status text not null default 'active';

alter table public.events drop constraint if exists events_type_check;
alter table public.events
  add constraint events_type_check
  check (type in ('signin', 'search', 'consent', 'query'));

create index if not exists users_daily_query_count_idx
  on public.users (daily_query_count desc);

create or replace function public.fn_try_consume_daily_query(
  p_sub text,
  p_email text,
  p_keyword text,
  p_goal text,
  p_model text,
  p_ts bigint,
  p_default_limit integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day text := to_char(to_timestamp(p_ts / 1000.0) at time zone 'UTC', 'YYYY-MM-DD');
  v_count integer;
  v_limit integer;
  v_status text;
  v_user_day text;
begin
  select daily_query_count, query_quota_day, daily_query_limit, status
    into v_count, v_user_day, v_limit, v_status
    from public.users
   where sub = p_sub
   for update;

  if not found then
    return jsonb_build_object('allowed', false, 'code', 'USER_NOT_FOUND');
  end if;

  if v_status is distinct from 'active' then
    return jsonb_build_object(
      'allowed', false,
      'code', 'SUSPENDED',
      'daily_count', coalesce(v_count, 0),
      'daily_limit', coalesce(v_limit, p_default_limit)
    );
  end if;

  if v_user_day is distinct from v_day then
    v_count := 0;
    v_user_day := v_day;
  end if;

  v_limit := coalesce(v_limit, p_default_limit);

  if v_count >= v_limit then
    return jsonb_build_object(
      'allowed', false,
      'code', 'DAILY_QUOTA_EXCEEDED',
      'daily_count', v_count,
      'daily_limit', v_limit
    );
  end if;

  v_count := v_count + 1;

  update public.users
     set daily_query_count = v_count,
         query_quota_day = v_user_day,
         last_seen_at = greatest(coalesce(last_seen_at, 0), p_ts)
   where sub = p_sub;

  insert into public.events (type, sub, email, keyword, goal, surface, ts)
  values ('query', p_sub, p_email, p_keyword, p_goal, p_model, p_ts);

  return jsonb_build_object(
    'allowed', true,
    'daily_count', v_count,
    'daily_limit', v_limit
  );
end;
$$;

revoke all on function public.fn_try_consume_daily_query(text, text, text, text, text, bigint, integer) from public;
grant execute on function public.fn_try_consume_daily_query(text, text, text, text, text, bigint, integer) to service_role;
