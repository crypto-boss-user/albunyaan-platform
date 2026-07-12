-- 0003_identity.sql — WS2 identity wiring: link people ⇄ auth.users, admin roster.
--
-- Purpose: native signups (Supabase Auth) attach to the existing `people` table
-- (the audience liberated from Uscreen in 0001) instead of creating a parallel
-- user store. A minimal AFTER INSERT trigger on auth.users links-or-creates the
-- person row; the app creates households lazily via ensureHousehold(), NOT here.
--
-- Founder-pending: none in this file. (Catalog visibility rule lands in 0006.)
--
-- Conventions unchanged (0001): text + CHECK, never enums; RLS ON zero policies
-- = deny-by-default; timestamptz everywhere.

-- ── people ⇄ auth.users link ────────────────────────────────────────────────

alter table people add column auth_user_id uuid unique references auth.users (id) on delete set null;

-- Supports the trigger's lower(email) match (imports already normalize, but the
-- expression index makes the lookup shape explicit and fast either way).
create index people_email_lower_idx on people (lower(email));

-- ── households: ownership (nullable — the existing demo household keeps working) ──

alter table households add column owner_person_id uuid references people (id);
create index households_owner_person_idx on households (owner_person_id);

-- ── platform admins (service-role managed roster; checked server-side only) ──

create table platform_admins (
  auth_user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'admin' check (role in ('owner', 'editor', 'support', 'admin')),
  note text,
  created_at timestamptz not null default now()
);

alter table platform_admins enable row level security;
-- Intentionally NO policies: service-role only. Never expose the admin roster.

-- ── signup trigger: link-or-create the person row ───────────────────────────
--
-- Kept deliberately minimal and NON-FAILING: any error is swallowed (with a
-- warning) so a people-table conflict can NEVER block an auth signup. The app
-- can reconcile an unlinked person later. No household is created here — the
-- app does that lazily (ensureHousehold).
--
-- Note: people.external_id is NOT NULL + unique(source, external_id) (0001),
-- so native inserts use the auth user id as external_id — stable and unique.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(new.email, '')));
begin
  if v_email = '' then
    return new; -- nothing to link (phone/anonymous signup)
  end if;

  update public.people
     set auth_user_id = new.id,
         updated_at   = now()
   where lower(email) = v_email
     and auth_user_id is null;

  if not found then
    -- Only insert when no person carries this email at all (a person already
    -- linked to another auth user is left untouched — reconcile out-of-band).
    if not exists (select 1 from public.people where lower(email) = v_email) then
      insert into public.people (external_id, source, email, auth_user_id, signup_at)
      values (new.id::text, 'native', v_email, new.id, now());
    end if;
  end if;

  return new;
exception when others then
  -- Never block signup: log and move on.
  raise warning 'handle_new_user: could not link person for auth user % (%)', new.id, sqlerrm;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
