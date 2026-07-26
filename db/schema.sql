-- Qx10.lol — Supabase analytics schema (apply via Supabase SQL editor).
-- All tables are server-write-only via the service role key. Row-level
-- security is enabled with no policies so anon/auth keys cannot read or
-- write — the service role bypasses RLS, which is what the app uses.

create table if not exists public.users (
  sub text primary key,
  email text not null,
  name text,
  picture text,
  created_at bigint not null,
  last_seen_at bigint not null,
  sign_in_count integer not null default 0,
  search_count integer not null default 0,
  consent_at bigint,
  consent_version text
);

create index if not exists users_last_seen_idx on public.users (last_seen_at desc);
create index if not exists users_created_at_idx on public.users (created_at desc);
create index if not exists users_search_count_idx on public.users (search_count desc);

create table if not exists public.events (
  id bigserial primary key,
  type text not null check (type in ('signin', 'search', 'consent')),
  sub text not null references public.users (sub) on delete cascade,
  email text not null,
  ts bigint not null,
  -- type-specific fields kept flat for trivial admin queries
  keyword text,
  goal text,
  surface text,
  consent_version text,
  name text,
  picture text
);

create index if not exists events_ts_idx on public.events (ts desc);
create index if not exists events_type_ts_idx on public.events (type, ts desc);
create index if not exists events_sub_ts_idx on public.events (sub, ts desc);

create table if not exists public.keyword_counts (
  keyword text primary key,
  count integer not null default 0
);

create index if not exists keyword_counts_count_idx on public.keyword_counts (count desc);

-- Lock anon/auth roles out. The service role used by the server bypasses RLS.
alter table public.users enable row level security;
alter table public.events enable row level security;
alter table public.keyword_counts enable row level security;

-- Atomic search increment: bump user counts and keyword counter in one call.
create or replace function public.fn_record_search(
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
  insert into public.events (type, sub, email, keyword, goal, surface, ts)
  values ('search', p_sub, p_email, p_keyword, p_goal, p_surface, p_ts);

  update public.users
     set search_count = coalesce(search_count, 0) + 1,
         last_seen_at = greatest(coalesce(last_seen_at, 0), p_ts)
   where sub = p_sub;

  if p_keyword_lower is not null and length(p_keyword_lower) > 0 then
    insert into public.keyword_counts (keyword, count)
    values (p_keyword_lower, 1)
    on conflict (keyword)
    do update set count = public.keyword_counts.count + 1;
  end if;
end;
$$;

revoke all on function public.fn_record_search(text, text, text, text, text, text, bigint) from public;
grant execute on function public.fn_record_search(text, text, text, text, text, text, bigint) to service_role;

-- ── Workspace persistence (per signed-in user) ─────────────────────────────

create table if not exists public.workspaces (
  user_sub text not null references public.users (sub) on delete cascade,
  keyword text not null,
  goal text not null,
  context text,
  snapshot jsonb not null,
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_sub, keyword)
);

create index if not exists workspaces_user_updated_idx
  on public.workspaces (user_sub, updated_at desc);

create table if not exists public.dashboard_layouts (
  user_sub text not null references public.users (sub) on delete cascade,
  keyword text not null,
  layout jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_sub, keyword)
);

create table if not exists public.article_drafts (
  user_sub text not null references public.users (sub) on delete cascade,
  keyword text not null,
  draft jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_sub, keyword)
);

create table if not exists public.user_prefs (
  user_sub text primary key references public.users (sub) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;
alter table public.dashboard_layouts enable row level security;
alter table public.article_drafts enable row level security;
alter table public.user_prefs enable row level security;
