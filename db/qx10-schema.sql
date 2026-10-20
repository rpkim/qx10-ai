-- Qx10 tables on a shared Postgres database (Neon).
-- Names are prefixed so they do not collide with another app's public.users
-- and similar tables. Safe to re-run.

create table if not exists public.qx10_users (
  sub text primary key,
  email text not null,
  name text,
  picture text,
  created_at bigint not null,
  last_seen_at bigint not null,
  sign_in_count integer not null default 0,
  search_count integer not null default 0,
  consent_at bigint,
  consent_version text,
  daily_query_count integer not null default 0,
  query_quota_day text,
  daily_query_limit integer,
  status text not null default 'active',
  tier text not null default 'free'
);

alter table public.qx10_users drop constraint if exists qx10_users_tier_check;
alter table public.qx10_users
  add constraint qx10_users_tier_check
  check (tier in ('free', 'premium', 'admin'));

create index if not exists qx10_users_last_seen_idx on public.qx10_users (last_seen_at desc);
create index if not exists qx10_users_created_at_idx on public.qx10_users (created_at desc);
create index if not exists qx10_users_search_count_idx on public.qx10_users (search_count desc);
create index if not exists qx10_users_daily_query_count_idx on public.qx10_users (daily_query_count desc);
create index if not exists qx10_users_tier_idx on public.qx10_users (tier);

create table if not exists public.qx10_events (
  id bigserial primary key,
  type text not null,
  sub text not null references public.qx10_users (sub) on delete cascade,
  email text not null,
  ts bigint not null,
  keyword text,
  goal text,
  surface text,
  consent_version text,
  name text,
  picture text
);

alter table public.qx10_events drop constraint if exists qx10_events_type_check;
alter table public.qx10_events
  add constraint qx10_events_type_check
  check (type in ('signin', 'search', 'consent', 'query'));

create index if not exists qx10_events_ts_idx on public.qx10_events (ts desc);
create index if not exists qx10_events_type_ts_idx on public.qx10_events (type, ts desc);
create index if not exists qx10_events_sub_ts_idx on public.qx10_events (sub, ts desc);

create table if not exists public.qx10_keyword_counts (
  keyword text primary key,
  count integer not null default 0
);

create index if not exists qx10_keyword_counts_count_idx on public.qx10_keyword_counts (count desc);

create table if not exists public.qx10_workspaces (
  user_sub text not null references public.qx10_users (sub) on delete cascade,
  keyword text not null,
  goal text not null,
  context text,
  snapshot jsonb not null,
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_sub, keyword)
);

create index if not exists qx10_workspaces_user_updated_idx
  on public.qx10_workspaces (user_sub, updated_at desc);

create table if not exists public.qx10_dashboard_layouts (
  user_sub text not null references public.qx10_users (sub) on delete cascade,
  keyword text not null,
  layout jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_sub, keyword)
);

create table if not exists public.qx10_article_drafts (
  user_sub text not null references public.qx10_users (sub) on delete cascade,
  keyword text not null,
  draft jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_sub, keyword)
);

create table if not exists public.qx10_user_prefs (
  user_sub text primary key references public.qx10_users (sub) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.qx10_waitlist (
  id bigserial primary key,
  sub text,
  email text not null,
  name text,
  picture text,
  status text not null default 'pending'
    check (status in ('pending', 'invited', 'joined')),
  created_at bigint not null,
  invited_at bigint,
  invited_by text,
  invite_token_hash text,
  invite_expires_at bigint
);

create unique index if not exists qx10_waitlist_email_idx on public.qx10_waitlist (lower(email));
create index if not exists qx10_waitlist_status_created_idx on public.qx10_waitlist (status, created_at desc);

create or replace function public.qx10_fn_record_search(
  p_sub text,
  p_email text,
  p_keyword text,
  p_keyword_lower text,
  p_goal text,
  p_surface text,
  p_ts bigint
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.qx10_events (type, sub, email, keyword, goal, surface, ts)
  values ('search', p_sub, p_email, p_keyword, p_goal, p_surface, p_ts);

  update public.qx10_users
     set search_count = coalesce(search_count, 0) + 1,
         last_seen_at = greatest(coalesce(last_seen_at, 0), p_ts)
   where sub = p_sub;

  if p_keyword_lower is not null and length(p_keyword_lower) > 0 then
    insert into public.qx10_keyword_counts (keyword, count)
    values (p_keyword_lower, 1)
    on conflict (keyword)
    do update set count = public.qx10_keyword_counts.count + 1;
  end if;
end;
$$;

create or replace function public.qx10_fn_try_consume_daily_query(
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
    from public.qx10_users
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

  update public.qx10_users
     set daily_query_count = v_count,
         query_quota_day = v_user_day,
         last_seen_at = greatest(coalesce(last_seen_at, 0), p_ts)
   where sub = p_sub;

  insert into public.qx10_events (type, sub, email, keyword, goal, surface, ts)
  values ('query', p_sub, p_email, p_keyword, p_goal, p_model, p_ts);

  return jsonb_build_object(
    'allowed', true,
    'daily_count', v_count,
    'daily_limit', v_limit
  );
end;
$$;
