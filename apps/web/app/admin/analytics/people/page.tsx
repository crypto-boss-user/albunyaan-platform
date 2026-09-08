import { getAnalyticsCounts } from '@albunyaan/core/data';
import { requireAdmin } from '../../../../lib/admin';
import { ANALYTICS, AnalyticsShell, Blok, REDEN, Tegel, periode } from '../shell';

export const dynamic = 'force-dynamic';

/**
 * Analytics › People (analytics-people.json): Users (Total · Members · One-time Buyers · Leads); Members by Subscription Status (In Trial · Active ·
 * Paused · On Hold · Churned); Active Members by Activity Status (New · Reactivated · Upgraded · Downgraded · Pending Pausing · Pending Cancellation);
 * tabs Overview/Audience. Echte tellingen uit `people` (Status uit de Uscreen-export in people.raw, stand van de export); One-time Buyers = leeg.
 */
export default async function AnalyticsPeoplePage({ searchParams }: { searchParams: Promise<{ period?: string; tab?: string }> }) {
  await requireAdmin();
  const { period, tab } = await searchParams;
  const per = periode(period, '30d');
  const c = await getAnalyticsCounts(per.since, per.prevSince, per.tot);
  const p = ANALYTICS.people;
  const s = c.people.byStatus;
  const actief = p.tabs.includes(tab ?? '') ? tab! : p.tabs[0];
  const actieveLeden = s.active + s.new + s.reactivated + s.pending_cancellation;
  const subStatus: Record<string, number> = { 'In Trial': s.trialing, Active: actieveLeden, Paused: s.paused, 'On Hold': s.on_hold, Churned: s.churned };
  // Upgraded/Downgraded/Pending Pausing worden niet gemeten: de Uscreen-export kent die statussen niet
  // (STATUSSEN in admin-stats.ts). Ze stonden hardcoded op 0, wat een gemeten nul suggereerde terwijl er
  // niets geteld is — null toont een lege tegel met reden, zoals elders (Codex-review 2026-09-07 C-1).
  const actStatus: Record<string, number | null> = { New: s.new, Reactivated: s.reactivated, Upgraded: null, Downgraded: null, 'Pending Pausing': null, 'Pending Cancellation': s.pending_cancellation };
  const pct = (n: number, tot: number) => (tot ? `${((100 * n) / tot).toFixed(1)}%` : '0.0%');
  // Noemer van "Active Members by Activity Status" = ALLE actieve leden (B61-standaardantwoord op Codex-vraag C-i, T-5):
  // New/Reactivated/Pending Cancellation zijn een aandeel binnen actief. De vorige noemer (som van de gemeten
  // activiteitsstatussen, koude review I-2) toonde bij 90 gewone + 10 nieuwe leden "New: 100%". Het team kan dit terugdraaien.
  const actTotaal = actieveLeden;
  const users: Record<string, number | null> = { Total: c.people.total, Members: c.people.members, 'One-time Buyers': null, Leads: c.people.leads };
  return (
    <AnalyticsShell pagina="people" pad="/admin/analytics/people" periodeKey={per.key} tab={actief}>
      {actief === 'Overview' ? (
        <>
          <Blok titel="Users">
            <div className="mt-3 grid grid-cols-4 gap-4" data-users>
              {p.users.map((u) => <Tegel key={u} titel={u} waarde={users[u]} reden={REDEN.betaal} sub="uit people (Uscreen-export + eigen aanmeldingen)" />)}
            </div>
            <p className="ad-help mt-3">Sign-ups in de gekozen periode: {c.signups.period} (vorige periode {c.signups.previous}).</p>
          </Blok>
          <Blok titel="Members by Subscription Status">
            <ul className="mt-3 grid grid-cols-5 gap-3" data-subscription-status>
              {p.subscription_status.map((k) => <li key={k} className="rounded-md p-3" style={{ border: '1px solid var(--ad-border)' }} data-status={k}><span className="block text-[18px] font-semibold">{subStatus[k].toLocaleString('en-US')}</span><span className="ad-help">{k} • {pct(subStatus[k], c.people.members)}</span></li>)}
            </ul>
            <p className="ad-help mt-2">Stand van de Uscreen-export in people.raw (status op exportdatum); live status volgt {REDEN.leden}.</p>
          </Blok>
          <Blok titel="Active Members by Activity Status">
            <ul className="mt-3 grid grid-cols-6 gap-3" data-activity-status>
              {p.activity_status.map((k) => <li key={k} className="rounded-md p-3" style={{ border: '1px solid var(--ad-border)' }} data-status={k}><span className="block text-[18px] font-semibold">{actStatus[k] === null ? '—' : actStatus[k]!.toLocaleString('en-US')}</span><span className="ad-help">{k} • {actStatus[k] === null ? `niet gemeten — ${REDEN.leden}` : pct(actStatus[k]!, actTotaal)}</span></li>)}
            </ul>
          </Blok>
        </>
      ) : (
        <Blok titel="Audience" reden={`Doelgroepprofiel (land, apparaat, tags): ${REDEN.kijkplatform}.`} />
      )}
    </AnalyticsShell>
  );
}
