import SettingsForm from '../../../../components/admin/SettingsForm';
import { KnopUit } from '../../../../components/admin/Veld';
import { requireAdmin } from '../../../../lib/admin';
import bron from '../../../../../../reference/admin-2026-09/settings-ad2.json';
import { REDEN } from '../spec';

export const dynamic = 'force-dynamic';

/** Settings › Integrations (settings-integrations.json): 4 groepen, 14 kaarten; eerlijk "Not connected" (de 5 zaps gaan bij de cutover uit); sleutels nooit tonen. */
export default async function IntegrationsPage() {
  await requireAdmin();
  return (
    <SettingsForm kop="Integrations">
      <p className="ad-help mb-4">Eigen platform: geen koppelingen actief. Stand bij Uscreen (07-09) staat per kaart; API-sleutels worden nooit getoond.</p>
      {bron.integrations.map((g) => (
        <section key={g.groep} className="mb-8" data-integration-group={g.groep}>
          <h2 className="mb-3 text-[16px] font-semibold">{g.groep}</h2>
          <div className="grid grid-cols-3 gap-4">
            {g.kaarten.map((k) => (
              <div key={k.naam} className="ad-card flex flex-col p-5" data-integration={k.naam}>
                <span className="font-semibold">{k.naam}</span>
                <span className="ad-badge ad-badge-muted mt-1 self-start">Not connected</span>
                <p className="ad-help mb-3 mt-2 flex-1">{k.tekst} <span className="italic">Uscreen: {k.uscreen}.</span></p>
                <KnopUit label={k.uscreen === 'Request access' ? 'Request access' : 'Connect'} reden={REDEN.mail} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </SettingsForm>
  );
}
