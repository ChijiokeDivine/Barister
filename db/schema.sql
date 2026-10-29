-- Barister account database (PostgreSQL / Supabase).
-- Safe to run repeatedly: every object is created only if it does not exist.

-- Application accounts. Email is stored as entered but compared case-insensitively
-- through the unique index below, which is what sign-in/sign-up lookups use.
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists users_email_lower_key on users (lower(email));

-- Server-side sessions. The browser only ever holds a random opaque token; the
-- table stores its SHA-256 hash, so a database leak cannot be replayed as a login.
create table if not exists sessions (
  token_hash text primary key,
  user_id uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists sessions_user_id_idx on sessions (user_id);
create index if not exists sessions_expires_at_idx on sessions (expires_at);
