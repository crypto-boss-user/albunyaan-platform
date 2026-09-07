import SettingsForm from '../../../../components/admin/SettingsForm';
import { KnopUit } from '../../../../components/admin/Veld';
import { requireAdmin } from '../../../../lib/admin';
import bron from '../../../../../../reference/admin-2026-09/settings-ad2.json';
import { REDEN } from '../spec';

export const dynamic = 'force-dynamic';

/** Settings › Webhooks (settings-webhooks.json): Create webhook; tabel URL · Event · Status · Last delivery · Created; de 2 Uscreen-webhooks (int.albunyaan.tv) als tekst — ze gaan bij de cutover uit (founder-runbook). */
export default async function WebhooksPage() {
  await requireAdmin();
  return (
    <SettingsForm kop="Webhooks" extra={<KnopUit label="Create webhook" reden={`${REDEN.leden} / ${REDEN.betaal}`} primair />}>
      <p className="ad-help mb-4">Gemeten bij Uscreen (07-09), alleen ter referentie: de eigen admin verstuurt nog geen webhooks.</p>
      <div className="ad-card">
        <table className="ad-table" data-webhooks>
          <thead><tr><th>URL</th><th>Event</th><th>Status</th><th>Last delivery</th><th>Created</th></tr></thead>
          <tbody>
            {bron.webhooks.map((w) => (
              <tr key={w.url}><td className="font-mono text-[12px]">{w.url}</td><td>{w.event}</td><td><span className="ad-badge ad-badge-muted">Uscreen: {w.status}</span></td><td>{w.last_delivery}</td><td>{w.created}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </SettingsForm>
  );
}
