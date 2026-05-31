-- Daily signup cap + waitlist (apply after db/schema.sql and quota migrations)

create table if not exists public.waitlist (
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

create unique index if not exists waitlist_email_idx on public.waitlist (lower(email));
create index if not exists waitlist_status_created_idx on public.waitlist (status, created_at desc);

alter table public.waitlist enable row level security;
