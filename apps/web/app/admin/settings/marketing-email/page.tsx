import { getAdminSettings } from '@albunyaan/core/data';
import SettingsForm from '../../../../components/admin/SettingsForm';
import { KnopUit, Sectie, Veld } from '../../../../components/admin/Veld';
import { hasRole, requireAdmin } from '../../../../lib/admin';
import { DEFAULTS, REDEN, SECTIES } from '../spec';

export const dynamic = 'force-dynamic';

/** Settings › Marketing email settings (settings-marketing-email.json): Sender information (From name, From email), Custom email domain (Connect), Email topics (3 systeemtopics, max 10, Create new topic). */
const TOPICS = [
  { naam: 'News', gebruik: 'Email broadcasts (default), Automations (default)' },
  { naam: 'Promotions', gebruik: 'Abandoned cart, Reduce churn, Try again for free, Subscription upsell, Giveaway funnels' },
  { naam: 'Content announcements', gebruik: 'Content release notifications, Drip emails' },
];

export default async function MarketingEmailPage() {
  const { admin } = await requireAdmin();
  const rolUit = hasRole(admin.role, 'admin') ? undefined : 'opslaan vereist de admin-rol'; // koude review AD 2.2 I-2: Save uit als de action zou weigeren
  const s = await getAdminSettings(SECTIES.marketing_email.velden.map((v) => v.key));
  const v = (k: string) => (s[k] ?? DEFAULTS[k]) as string;
  return (
    <SettingsForm kop="Marketing email settings" section="marketing_email" uitgeschakeld={rolUit}>
      <Sectie kop="Sender information" tekst="Configure the name and email address used for outgoing emails.">
        <Veld label="From name" name="marketing_email.from_name" value={v('marketing_email.from_name')} />
        <Veld label="From email" name="marketing_email.from_email" value={v('marketing_email.from_email')} help="@albunyaan.tv (Resend-DNS staat; Uscreen gebruikte @no-reply.uscreen.io). Verzenden zelf volgt de mailbeslissing." />
      </Sectie>
      <Sectie kop="Custom email domain" tekst="Send emails from your own domain instead of the default Uscreen domain. Click Connect to display your configuration options.">
        <div className="flex items-center gap-3">
          <input className="ad-input !w-72" placeholder="yourdomain.com" defaultValue="albunyaan.tv" disabled title={REDEN.mail} aria-label="Custom email domain" />
          <KnopUit label="Connect" reden={REDEN.mail} />
        </div>
      </Sectie>
      <Sectie kop="Email topics" tekst="Help your customers receive only the emails they care about by defining specific topics. You may create up to ten topics.">
        <table className="ad-table mb-4" data-email-topics>
          <thead><tr><th>Topic</th><th>Type</th><th>Used by</th></tr></thead>
          <tbody>
            {TOPICS.map((t) => (
              <tr key={t.naam}><td>{t.naam}</td><td><span className="ad-badge ad-badge-muted">System</span></td><td>{t.gebruik}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center gap-3">
          <input className="ad-input !w-72" placeholder="Enter new email topic" aria-label="Enter new email topic" disabled title={REDEN.mail} />
          <KnopUit label="Create new topic" reden={REDEN.mail} />
        </div>
      </Sectie>
    </SettingsForm>
  );
}
