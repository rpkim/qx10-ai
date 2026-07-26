-- Workspace tables only (run if analytics tables already exist).
-- Safe to re-run: uses IF NOT EXISTS.

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
