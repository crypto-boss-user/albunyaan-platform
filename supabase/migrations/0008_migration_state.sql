-- 0008_migration_state.sql — WS2: billing-cutover bookkeeping (Uscreen → Stripe).
--
-- Purpose: the paying/free/IAP cohorts (people.legacy_cohort, 0001) move in
-- controlled batches. Every batch and every person-level item is tracked here
-- so a cutover run is resumable, auditable and — item by item — roll-back-able.
-- Workers write these rows with the service role; nothing client-facing.
--
-- Founder-pending: batch timing + plan/price mapping are WS-billing decisions;
-- this migration only provides the state machine.
--
-- Conventions unchanged: text + CHECK, never enums; RLS ON, zero policies.

create table billing_migration_batches (
  id uuid primary key default gen_random_uuid(),
  cohort text not null check (cohort in ('uscreen_paying', 'uscreen_free_api', 'uscreen_iap')),
  status text not null default 'planned'
    check (status in ('planned', 'dry_run_ok', 'executing', 'done', 'aborted')),
  notes text,
  created_by text, -- operator name / script id (no auth linkage needed)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index billing_migration_batches_status_idx on billing_migration_batches (status);

create table billing_migration_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references billing_migration_batches (id) on delete cascade,
  person_id uuid not null references people (id),
  stripe_customer_id text,          -- snapshot at planning time (people row may change)
  uscreen_period_end timestamptz,   -- anchor: new sub must start when Uscreen coverage ends
  planned_price_id text,            -- Stripe price the item should land on
  new_stripe_subscription_id text,  -- filled once created
  status text not null default 'planned'
    check (status in ('planned', 'precheck_failed', 'created', 'verified', 'failed', 'rolled_back')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, person_id)
);
create index billing_migration_items_batch_idx on billing_migration_items (batch_id, status);
create index billing_migration_items_person_idx on billing_migration_items (person_id);

alter table billing_migration_batches enable row level security;
alter table billing_migration_items enable row level security;
-- Intentionally NO policies: service-role only, like all migration bookkeeping.
