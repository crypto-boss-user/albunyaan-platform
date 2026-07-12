-- 0009_pin_hardening.sql — WS3: parent-PIN brute-force hardening.
--
-- From the adversarial security review: the 4-digit parent PIN had no rate
-- limiting (the whole 10,000-value space is online-brute-forceable) and was
-- stored as an unsalted single SHA-256 (a 10k-entry table inverts any leaked
-- hash). This migration adds per-household failed-attempt tracking + lockout;
-- the hash upgrade to salted scrypt lives in application code (parental.ts),
-- which transparently rehashes legacy bare-SHA-256 pin_hash values to the new
-- salted format on the next successful verify.
--
-- Conventions unchanged: additive columns; RLS is already ON for households
-- (0006). Idempotent (IF NOT EXISTS) so a re-run is safe.

alter table households add column if not exists pin_failed_attempts integer not null default 0;
alter table households add column if not exists pin_locked_until timestamptz;

-- Atomic attempt reservation — verifyPin() calls this BEFORE checking the guess.
-- On serverless (Vercel) concurrent guesses each run in their own process, so an
-- app-side read-check-write counter would let a burst of N parallel requests all
-- see attempts<max and get N free tries; the row lock here serializes them.
-- Semantics: locked → not allowed; otherwise consume one attempt, and the
-- attempt that reaches the max sets pin_locked_until. A SUCCESSFUL verify
-- clears both fields in application code (parental.ts). Policy: 5 attempts,
-- 15-minute lock.
create or replace function public.reserve_pin_attempt(p_household_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_attempts integer;
  v_locked_until timestamptz;
begin
  select pin_failed_attempts, pin_locked_until
    into v_attempts, v_locked_until
    from households
   where id = p_household_id
     for update;

  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'missing');
  end if;

  if v_locked_until is not null and v_locked_until > now() then
    return jsonb_build_object('allowed', false, 'reason', 'locked', 'locked_until', v_locked_until);
  end if;

  -- An expired lock means the previous window is over — restart counting fresh.
  if v_locked_until is not null then
    v_attempts := 0;
  end if;

  v_attempts := v_attempts + 1;

  update households
     set pin_failed_attempts = v_attempts,
         pin_locked_until = case when v_attempts >= 5 then now() + interval '15 minutes' end
   where id = p_household_id;

  return jsonb_build_object('allowed', true, 'attempts', v_attempts);
end;
$$;

-- Only the server (service role) may drive the attempt counter: a direct anon/
-- authenticated caller could otherwise lock ANY household out (DoS) or reset
-- windows. Default EXECUTE goes to PUBLIC on create — take it back explicitly.
revoke execute on function public.reserve_pin_attempt(uuid) from public, anon, authenticated;
grant execute on function public.reserve_pin_attempt(uuid) to service_role;
