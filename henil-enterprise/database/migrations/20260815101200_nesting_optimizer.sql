-- ============================================================
-- Henil Enterprise — Database Schema
-- 30. Nesting Optimizer: jobs, parts, results
-- ============================================================
-- Lives inside the Artwork Vault (reuses the 'artwork' RBAC module —
-- no new module added). A nesting job is the sheet/material setup
-- plus an unlimited list of parts to cut from it; the results of the
-- most recent calculation are stored on the job itself (recalculating
-- replaces them — this is a working tool, not a historical ledger of
-- every run).

create table if not exists public.nesting_jobs (
  id uuid primary key default gen_random_uuid(),
  job_code text not null unique,
  job_name text not null,
  client_id uuid references public.clients (id) on delete set null,
  material text,
  thickness text,
  sheet_width numeric(10, 2) not null,
  sheet_height numeric(10, 2) not null,
  kerf numeric(6, 2) not null default 0,
  spacing numeric(6, 2) not null default 0,
  edge_margin numeric(6, 2) not null default 0,
  allow_rotation boolean not null default true,
  notes text,

  -- Latest computed result, replaced wholesale on recalculate.
  result_computed_at timestamptz,
  result_sheets_required integer,
  result_total_requested integer,
  result_total_placed integer,
  result_utilization_pct numeric(5, 2),
  result_waste_area numeric(14, 2),
  result_placements jsonb not null default '[]',
  result_unplaced jsonb not null default '[]',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_nesting_jobs_sheet_width check (sheet_width > 0),
  constraint chk_nesting_jobs_sheet_height check (sheet_height > 0),
  constraint chk_nesting_jobs_kerf check (kerf >= 0),
  constraint chk_nesting_jobs_spacing check (spacing >= 0),
  constraint chk_nesting_jobs_edge_margin check (edge_margin >= 0)
);

create index if not exists idx_nesting_jobs_client_id on public.nesting_jobs (client_id);

comment on table public.nesting_jobs is 'Sheet/material setup for a cutting job, plus the most recent nesting calculation result.';

create table if not exists public.nesting_parts (
  id uuid primary key default gen_random_uuid(),
  nesting_job_id uuid not null references public.nesting_jobs (id) on delete cascade,
  artwork_id uuid references public.artworks (id) on delete set null,
  part_name text not null,
  width numeric(10, 2) not null,
  height numeric(10, 2) not null,
  quantity integer not null default 1,
  allow_rotation boolean,
  sort_order integer not null default 0,

  constraint chk_nesting_parts_width check (width > 0),
  constraint chk_nesting_parts_height check (height > 0),
  constraint chk_nesting_parts_quantity check (quantity > 0)
);

create index if not exists idx_nesting_parts_job_id on public.nesting_parts (nesting_job_id, sort_order);
create index if not exists idx_nesting_parts_artwork_id on public.nesting_parts (artwork_id);

comment on table public.nesting_parts is 'One row per distinct part shape in a nesting job — no cap on how many rows a job can have. allow_rotation is nullable: null means "use the job default".';

create trigger set_updated_at_nesting_jobs
  before update on public.nesting_jobs
  for each row execute function public.set_updated_at();

create sequence if not exists public.nesting_job_code_seq;

create or replace function public.set_nesting_job_code()
returns trigger
language plpgsql
as $$
begin
  if new.job_code is null or new.job_code = '' then
    new.job_code := 'JOB-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.nesting_job_code_seq')::text, 3, '0');
  end if;
  return new;
end;
$$;

create trigger trg_set_nesting_job_code
  before insert on public.nesting_jobs
  for each row execute function public.set_nesting_job_code();

-- ---------- RLS: reuses the 'artwork' module, same as Artwork Vault ----------
alter table public.nesting_jobs enable row level security;
alter table public.nesting_parts enable row level security;

drop policy if exists nesting_jobs_select on public.nesting_jobs;
drop policy if exists nesting_jobs_insert on public.nesting_jobs;
drop policy if exists nesting_jobs_update on public.nesting_jobs;
drop policy if exists nesting_jobs_delete on public.nesting_jobs;

create policy nesting_jobs_select on public.nesting_jobs for select using (public.has_module_access('artwork'));
create policy nesting_jobs_insert on public.nesting_jobs for insert with check (public.has_module_access('artwork'));
create policy nesting_jobs_update on public.nesting_jobs for update using (public.has_module_access('artwork')) with check (public.has_module_access('artwork'));
create policy nesting_jobs_delete on public.nesting_jobs for delete using (public.can_delete_module('artwork'));

drop policy if exists nesting_parts_select on public.nesting_parts;
drop policy if exists nesting_parts_insert on public.nesting_parts;
drop policy if exists nesting_parts_update on public.nesting_parts;
drop policy if exists nesting_parts_delete on public.nesting_parts;

create policy nesting_parts_select on public.nesting_parts for select using (public.has_module_access('artwork'));
create policy nesting_parts_insert on public.nesting_parts for insert with check (public.has_module_access('artwork'));
create policy nesting_parts_update on public.nesting_parts for update using (public.has_module_access('artwork')) with check (public.has_module_access('artwork'));
create policy nesting_parts_delete on public.nesting_parts for delete using (public.can_delete_module('artwork'));
