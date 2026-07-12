-- 0010_email_change_throttle.sql — WS3 Gap #5: cooldown stamp for login-email
-- change requests. changeEmailAction refuses a new request within its cooldown
-- (the policy lives in app code; only the stamp lives here), so a stolen
-- session cannot email-bomb arbitrary addresses or spam takeover-attempt
-- confirmations. Additive; RLS on people is already deny-by-default (0006).
-- Idempotent (IF NOT EXISTS) so a re-run is safe.

alter table people add column if not exists email_change_requested_at timestamptz;
