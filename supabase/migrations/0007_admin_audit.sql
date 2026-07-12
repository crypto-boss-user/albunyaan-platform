-- 0007_admin_audit.sql — WS2: admin action audit trail + age-rating provenance.
--
-- Purpose: (a) every admin mutation (via server actions using the service role)
-- gets a before/after audit row; (b) videos record HOW their age_rating was
-- assigned so batch-classified ratings can be reviewed by a human later.
--
-- Founder-pending: none. (Batch classification itself is a later workstream;
-- 'batch_classified' is reserved for it.)
--
-- Conventions unchanged: text + CHECK, never enums; RLS ON, zero policies —
-- the audit log is written AND read by the service role only.

create table admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_auth_user_id uuid, -- nullable: system/worker actions have no auth user
  action text not null,    -- e.g. 'video.update', 'voucher.create'
  entity text,             -- table / domain object name
  entity_id text,          -- id of the affected row (text: uuids or external ids)
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_log_entity_idx on admin_audit_log (entity, entity_id);

alter table admin_audit_log enable row level security;
-- Intentionally NO policies: service-role written, service-role read.

-- ── age-rating provenance ───────────────────────────────────────────────────
-- 0002 added age_rating with default 'all'; nothing has rated anything yet, so
-- every existing row is honestly 'unrated'. NOT granted to anon/authenticated
-- (0006 column grants are explicit) — this is an editorial/admin field.

alter table videos add column age_rating_source text not null default 'unrated'
  check (age_rating_source in ('unrated', 'human', 'batch_classified'));
