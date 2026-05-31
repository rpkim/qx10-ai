-- User tier quotas (apply after db/quota-migration.sql)
-- free: DAILY_QUERY_LIMIT (default 80) | premium/admin: PREMIUM_DAILY_QUERY_LIMIT (default 200)

alter table public.users
  add column if not exists tier text not null default 'free';

alter table public.users drop constraint if exists users_tier_check;
alter table public.users
  add constraint users_tier_check
  check (tier in ('free', 'premium', 'admin'));

create index if not exists users_tier_idx on public.users (tier);

-- Replace quota RPC to resolve limit from tier
drop function if exists public.fn_try_consume_daily_query(text, text, text, text, text, bigint, integer);

create or replace function public.fn_try_consume_daily_query(
  p_sub text,
  p_email text,
  p_keyword text,
  p_goal text,
  p_model text,
  p_ts bigint,
  p_default_limit integer,
  p_premium_limit integer
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
  v_tier text;
  v_user_day text;
begin
  select daily_query_count, query_quota_day, status, tier
    into v_count, v_user_day, v_status, v_tier
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
      'daily_limit', case
        when coalesce(v_tier, 'free') in ('premium', 'admin') then p_premium_limit
        else p_default_limit
      end
    );
  end if;

  if v_user_day is distinct from v_day then
    v_count := 0;
    v_user_day := v_day;
  end if;

  v_limit := case
    when coalesce(v_tier, 'free') in ('premium', 'admin') then p_premium_limit
    else p_default_limit
  end;

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

revoke all on function public.fn_try_consume_daily_query(text, text, text, text, text, bigint, integer, integer) from public;
grant execute on function public.fn_try_consume_daily_query(text, text, text, text, text, bigint, integer, integer) to service_role;
