-- ============================================================
-- Henil Enterprise — Database Schema
-- 02. users
-- ============================================================
-- Extends Supabase Auth (auth.users) with the app-facing profile and
-- role used by Row Level Security. One row per authenticated user,
-- id shared 1:1 with auth.users.id. This table itself does not
-- implement authentication — Supabase Auth already handles sign-up,
-- sign-in, and password management; this just stores app metadata.

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  phone text,
  role user_role not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_role on public.users (role);
create index if not exists idx_users_is_active on public.users (is_active);

comment on table public.users is
  'App-facing profile for each Supabase Auth user (id = auth.users.id).';

-- ---------- Auto-create a users row whenever someone signs up ----------
-- SECURITY DEFINER is required so this can insert into public.users
-- even though it runs in the context of the newly created auth user,
-- who does not yet have an RLS-granted ability to insert their own row.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();
