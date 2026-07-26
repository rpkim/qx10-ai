-- Article Studio drafts (run if workspace tables already exist).
-- Safe to re-run: uses IF NOT EXISTS.

create table if not exists public.article_drafts (
  user_sub text not null references public.users (sub) on delete cascade,
  keyword text not null,
  draft jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_sub, keyword)
);

alter table public.article_drafts enable row level security;
