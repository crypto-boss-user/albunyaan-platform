import { notFound } from 'next/navigation';
import { getMemberDetail, isEntitlementActive } from '@albunyaan/core/data';
import { requireAdmin } from '../../../../lib/admin';
import { fmtDate, initials } from '../../../../components/admin/format';

export const dynamic = 'force-dynamic';

/**
 * People › All › detail in de Uscreen-vorm (AD 1.4; norm AD0-inventaris §2.2): About (Age, Country of residence, Preferred Language,
 * Private notes, Email, Display Name, Tags) · Invoices · Emails · Activity; rechts profiel/Lead-Member · Membership · Lead source ·
 * UTM source · Lifetime spent · Email Topic notifications · Watch history · Bundle/Content access. ALLEEN LEZEN: bewerken van leden
 * is T2 en wacht op de ledenmigratie; velden die de DB niet kent staan eerlijk leeg met de reden.
 */
function Veld({ label, value, wacht }: { label: string; value?: string | null; wacht?: string }) {
  return (
    <div className="mb-4">
      <p className="ad-label">{label}</p>
      <p className="ad-input" style={{ color: value ? 'var(--ad-fg)' : 'var(--ad-muted-fg)' }}>{value || (wacht ? `— (${wacht})` : '—')}</p>
    </div>
  );
}
function Kaart({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="ad-card p-6" data-card={title}><h2 className="mb-3 text-[16px] font-semibold">{title}</h2>{children}</section>;
}

export default async function AdminPersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const detail = await getMemberDetail(id);
  if (!detail) notFound();
  const { person, entitlements, household, profiles } = detail;
  const raw = person.raw ?? {};
  const naam = person.full_name ?? person.email;
  const isLead = (raw.Status ?? 'lead') === 'lead';
  const hasAccess = entitlements.some((e) => isEntitlementActive(e));
  const LM = 'wacht op de ledenmigratie';

  return (
    <div className="mx-auto max-w-[1120px]" data-person-detail>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="truncate text-[20px] font-semibold leading-7">{naam}</h1>
        <div className="flex items-center gap-3">
          <span className="ad-help">Bewerken van leden: {LM} (T2)</span>
          <button type="button" className="ad-btn ad-btn-primary" disabled title={`Save changes — ${LM}`}>Save changes</button>
        </div>
      </div>
      <div className="grid gap-6" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="flex flex-col gap-6">
          <Kaart title="About">
            <Veld label="Age" wacht="niet in de DB" />
            <Veld label="Country of residence" wacht="niet in de DB" />
            <Veld label="Preferred Language" value={person.language} />
            <Veld label="Private notes" wacht="niet in de DB" />
            <Veld label="Email" value={person.email} />
            <Veld label="Display Name" value={person.full_name} />
            <Veld label="Tags" value={raw.Tags || null} wacht="geen tags in de export" />
          </Kaart>
          <Kaart title="Invoices"><p className="ad-help">No invoices found. (facturen: wacht op de betaalbeslissing)</p></Kaart>
          <Kaart title="Emails"><p className="ad-help">No emails found. (e-mailgeschiedenis: wacht op de maildienst)</p></Kaart>
          <Kaart title="Activity">
            <table className="ad-table"><thead><tr><th>Activity</th><th>Date</th></tr></thead>
              <tbody>
                <tr><td>Registered in{raw['Creation Source'] ? ` (${raw['Creation Source']})` : ''}</td><td style={{ color: 'var(--ad-muted-fg)' }}>{fmtDate(person.signup_at ?? person.created_at)}</td></tr>
                {person.auth_user_id && <tr><td>Account linked to login</td><td style={{ color: 'var(--ad-muted-fg)' }}>—</td></tr>}
              </tbody>
            </table>
            <p className="ad-help mt-2">View all activity: kijkgeschiedenis wacht op het kijkplatform.</p>
          </Kaart>
        </div>
        <div className="flex flex-col gap-6">
          <Kaart title="Profile">
            <div className="mb-3 flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full text-[13px] font-semibold" style={{ background: 'var(--ad-accent)', color: 'var(--ad-primary)' }}>{initials(person.full_name, person.email)}</span>
              <span><span className="block font-semibold">{naam}</span><span className="ad-badge ad-badge-muted">{isLead ? 'Lead' : 'Member'}</span></span>
            </div>
            <p className="ad-help">Created {fmtDate(person.signup_at ?? person.created_at)} · {person.stripe_customer_id ? 'Stripe customer' : 'No payment information'}</p>
            <div className="mt-3 rounded p-3" style={{ background: 'var(--ad-muted)' }}>
              <p className="ad-help">Membership</p>
              <p className="mb-2">{raw['Subscription Plan'] || '—'}{raw.Status ? ` · ${raw.Status}` : ''}{raw['Next invoice date'] ? ` · next invoice ${raw['Next invoice date']}` : ''}</p>
              <button type="button" className="ad-btn ad-btn-outline !h-8" disabled title={`Add membership — ${LM}`}>+ Add membership</button>
              <p className="ad-help mt-3">Lead source</p><p className="mb-2">{raw['Lead Source'] || 'Not available'}</p>
              <p className="ad-help">UTM source</p><p className="mb-2">{raw['UTM Source'] || 'Not available'}</p>
              <p className="ad-help">Lifetime spent</p><p>{raw.Lifetime ?? '—'}</p>
            </div>
            {entitlements.length > 0 && (
              <p className="ad-help mt-3">Entitlements (eigen platform): {entitlements.map((e) => `${e.status} · ${e.provider}`).join(', ')}{hasAccess ? ' — has access' : ''}</p>
            )}
          </Kaart>
          <Kaart title="Email Topic notifications">
            <p>Email Marketing & News Opt-In: <span className="ad-badge ad-badge-muted">{raw['Email Marketing & News Opt-In'] || '—'}</span></p>
            <p className="ad-help mt-2">Per onderwerp (News, Promotions, Content announcements, Community Updates): wacht op de maildienst.</p>
          </Kaart>
          <Kaart title="Watch history"><p className="ad-help">No history: kijkgeschiedenis wacht op het kijkplatform.</p></Kaart>
          <Kaart title="Household (eigen platform)">
            {!household ? <p className="ad-help">No household set up yet.</p> : (
              <p className="text-[13px]">PIN set: {household.pin_hash ? 'Yes' : 'No'} · {profiles.length} profile(s): {profiles.map((p) => `${p.name} (${p.kind})`).join(', ') || '—'}</p>
            )}
          </Kaart>
          <Kaart title="Content access"><p className="ad-help">Grant access to specific contents: wacht op de betaal-/kijkplatformbeslissing. Bundle access: buiten scope (B81).</p></Kaart>
        </div>
      </div>
    </div>
  );
}
