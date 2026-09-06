import Link from 'next/link';
import { requireAdmin } from '../../../lib/admin';
import { MARKETING_HUB } from '../menu';

export const dynamic = 'force-dynamic';

/** Marketing-hub in Uscreen-vorm (AD 1.1): groepen met kaarten (AD0-inventaris §2.3), minus Refer a friend / Try again for free (B81). */
export default async function MarketingHubPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-[1120px]">
      <h1 className="mb-6 text-[20px] font-semibold leading-7">Marketing</h1>
      {MARKETING_HUB.map((g) => (
        <section key={g.groep} className="mb-8">
          <h2 className="mb-3 text-[16px] font-semibold">{g.groep}</h2>
          <div className="grid grid-cols-3 gap-4">
            {g.kaarten.map((k) => (
              <Link key={k.href} href={k.href} className="ad-card block p-5 hover:shadow-sm" data-marketing-card>
                <span className="block font-semibold">{k.naam}{k.naam === 'Link in Bio' && <span className="ml-2 ad-badge-beta">Beta</span>}</span>
                <span className="mt-1 block text-[13px] leading-5" style={{ color: 'var(--ad-muted-fg)' }}>{k.tekst}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
