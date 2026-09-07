-- 0014_admin_settings.sql — AD 2.2 (werkstroom AD, admin-pariteit): instellingen van de eigen admin als key/value.
--
-- WHY: de Uscreen-admin heeft een Settings-hub met 14 kaarten (AD0-inventaris §2.8, gemeten 2026-09-07). Founder 2026-09-07 (vraag 6):
-- alle kaarten met alle gemeten velden; "opslaan werkt via een settings-tabel". Deze tabel is die plek. Velden die de eigen stack
-- (nog) niet leest, worden hier alleen bewaard; betalings-/Stripe-/PayPal-velden blijven uitgeschakeld tot de betaalbeslissing en
-- geheime waarden komen hier NOOIT in (sleutels blijven in env/Vercel).
--
-- Conventies ongewijzigd (0001): text + CHECK, geen enums; RLS ON met NUL policies = service-role-only; timestamptz.

create table admin_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_.]{1,80}$'),
  value jsonb not null default 'null'::jsonb,
  updated_by uuid, -- auth user van de beheerder die het laatst opsloeg (nullable: seed/worker)
  updated_at timestamptz not null default now()
);

alter table admin_settings enable row level security;
-- Intentionally NO policies: service-role written, service-role read (apps/web server actions achter requireAdmin()).
