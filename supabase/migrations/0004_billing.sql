-- 0004_billing.sql — WS2 billing core: entitlements, vouchers, Stripe event inbox.
--
-- Purpose: the platform's OWN access model (replacing Uscreen's). `subscriptions`
-- (0001) stays as the imported/legacy record; `entitlements` is what the app
-- actually checks at watch time. Vouchers cover sponsor/dawah gift access with
-- an atomic, rate-limited redemption RPC.
--
-- Founder-pending: none in this file (plan/price mapping for the Stripe cohort
-- migration is WS-billing scope, tracked in 0008 migration state).
--
-- Conventions unchanged (0001): text + CHECK, never enums; money stays on plans
-- (cents); RLS ON, ZERO policies in this file — read policies arrive in 0006,
-- writes remain service-role/RPC only.

-- ── entitlements — the single source of "can this person watch?" ────────────

create table entitlements (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people (id) on delete cascade,
  plan_id uuid references plans (id),
  status text not null check (status in ('active', 'trialing', 'past_due', 'canceled', 'expired')),
  provider text not null check (provider in ('stripe', 'apple', 'google', 'voucher', 'legacy_free')),
  provider_ref text, -- stripe subscription id / store transaction ref / voucher redemption key
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One entitlement per external billing object (webhook upserts are idempotent).
create unique index entitlements_provider_ref_key
  on entitlements (provider, provider_ref) where provider_ref is not null;
create index entitlements_person_idx on entitlements (person_id);

-- ── vouchers ────────────────────────────────────────────────────────────────

create table vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  plan_id uuid references plans (id),
  duration_days integer not null,
  max_redemptions integer not null default 1,
  redemption_count integer not null default 0,
  status text not null default 'active' check (status in ('active', 'disabled', 'expired')),
  expires_at timestamptz,
  sponsor_label text, -- e.g. the masjid/sponsor that funded this batch
  created_at timestamptz not null default now()
);

create table voucher_redemptions (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references vouchers (id) on delete cascade,
  person_id uuid not null references people (id),
  entitlement_id uuid references entitlements (id),
  redeemed_at timestamptz not null default now(),
  unique (voucher_id, person_id) -- one redemption of a given voucher per person
);
create index voucher_redemptions_person_idx on voucher_redemptions (person_id);

-- Failed-attempt log feeding redeem_voucher()'s rate limit. Service-role/RPC
-- only — RLS ON, zero policies, and rows are written by the SECURITY DEFINER
-- function below.
create table voucher_attempts (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people (id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index voucher_attempts_rate_idx on voucher_attempts (person_id, attempted_at);

-- ── stripe event inbox (store-first, mirrors uscreen_events from 0001) ─────

create table stripe_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique, -- Stripe evt_… id = idempotency key
  type text,
  payload jsonb,
  status text not null default 'stored' check (status in ('stored', 'processed', 'failed')),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create index stripe_events_status_idx on stripe_events (status);

-- ── RLS: ON for every new table, ZERO policies in this file ────────────────
-- Read policies for entitlements/voucher_redemptions arrive in 0006.
-- vouchers / voucher_attempts / stripe_events stay service-role only forever.

alter table entitlements enable row level security;
alter table vouchers enable row level security;
alter table voucher_redemptions enable row level security;
alter table voucher_attempts enable row level security;
alter table stripe_events enable row level security;

-- ── redeem_voucher(code) — atomic, rate-limited redemption RPC ──────────────
--
-- Caller = the logged-in member (auth.uid() → people.auth_user_id). Flow:
--   1. resolve person (RAISE if none — can't attribute anything otherwise);
--   2. rate limit: ≥5 failed attempts in the last hour → RAISE;
--   3. lock the voucher row (FOR UPDATE) so concurrent redemptions serialize;
--   4. validate status + expiry + remaining redemptions + not-already-redeemed;
--   5. on success: increment count, insert entitlement (provider 'voucher',
--      period end = now() + duration_days) + redemption row; return entitlement id.
--
-- DELIBERATE: validation failures RETURN NULL instead of RAISE. A RAISE would
-- roll back the voucher_attempts insert (no autonomous transactions in PG), so
-- the rate limit would never accumulate. NULL result = "invalid or expired
-- code" to the app; we intentionally don't distinguish which check failed.
--
-- provider_ref is '<code>:<person_id>' — NOT the bare code, because the partial
-- unique index on (provider, provider_ref) would otherwise reject the second
-- redemption of any multi-redemption voucher.

create or replace function public.redeem_voucher(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person_id uuid;
  v_voucher vouchers%rowtype;
  v_recent_failures integer;
  v_entitlement_id uuid;
begin
  select id into v_person_id
    from people
   where auth_user_id = auth.uid();
  if v_person_id is null then
    raise exception 'redeem_voucher: no person is linked to the current user';
  end if;

  select count(*) into v_recent_failures
    from voucher_attempts
   where person_id = v_person_id
     and attempted_at > now() - interval '1 hour';
  if v_recent_failures >= 5 then
    raise exception 'redeem_voucher: too many attempts, try again later';
  end if;

  select * into v_voucher
    from vouchers
   where code = p_code
   for update;

  if v_voucher.id is null
     or v_voucher.status <> 'active'
     or (v_voucher.expires_at is not null and v_voucher.expires_at <= now())
     or v_voucher.redemption_count >= v_voucher.max_redemptions
     or exists (select 1 from voucher_redemptions
                 where voucher_id = v_voucher.id and person_id = v_person_id)
  then
    insert into voucher_attempts (person_id) values (v_person_id);
    return null; -- see header: RETURN, not RAISE, so the attempt row survives
  end if;

  update vouchers
     set redemption_count = redemption_count + 1
   where id = v_voucher.id;

  insert into entitlements (person_id, plan_id, status, provider, provider_ref, current_period_end)
  values (
    v_person_id,
    v_voucher.plan_id,
    'active',
    'voucher',
    v_voucher.code || ':' || v_person_id::text,
    now() + make_interval(days => v_voucher.duration_days)
  )
  returning id into v_entitlement_id;

  insert into voucher_redemptions (voucher_id, person_id, entitlement_id)
  values (v_voucher.id, v_person_id, v_entitlement_id);

  return v_entitlement_id;
end;
$$;

revoke all on function public.redeem_voucher(text) from public, anon;
grant execute on function public.redeem_voucher(text) to authenticated;
