import Link from 'next/link';
import { requireAdmin } from '../../../lib/admin';
import { SETTINGS_HUB } from './spec';

export const dynamic = 'force-dynamic';

/** Settings-hub in de Uscreen-vorm (AD 2.2; norm AD0-inventaris §2.8): 3 groepen, 14 kaarten (titel + uitlegregel) + eigen kaart Team. */
export default async function SettingsHubPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-[1120px]" data-settings-hub>
      <h1 className="mb-6 text-[20px] font-semibold leading-7">Settings</h1>
      {SETTINGS_HUB.map((g) => (
        <section key={g.groep} className="mb-8">
          <h2 className="mb-3 text-[16px] font-semibold">{g.groep}</h2>
          <div className="grid grid-cols-3 gap-4">
            {g.kaarten.map((k) => (
              <Link key={k.href} href={k.href} className="ad-card block p-5 hover:shadow-sm" data-settings-card={k.naam} data-extra={k.extra ? 'true' : undefined}>
                <span className="block font-semibold">{k.naam}{k.extra && <span className="ml-2 ad-badge-beta">Eigen</span>}</span>
                <span className="mt-1 block text-[13px] leading-5" style={{ color: 'var(--ad-muted-fg)' }}>{k.tekst}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
