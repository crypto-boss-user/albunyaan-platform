import { redirect } from 'next/navigation';
import { getPublicWebPlans, type PlanRow } from '@albunyaan/core/data';
import { getAuthUser } from '../../lib/session';
import { checkoutAction } from './actions';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Word lid — Albunyaan TV' };

const ERRORS: Record<string, string> = {
  consent:
    'Je moet eerst akkoord gaan met directe levering (het vinkje hieronder) voordat we je naar de betaalpagina kunnen sturen.',
  plan: 'Dat abonnement bestaat niet (meer) — kies hieronder opnieuw.',
  checkout:
    'De betaalpagina kon niet worden geopend. Probeer het zo nog eens; als het blijft misgaan, neem contact met ons op.',
};

function formatEur(cents: number): string {
  return (cents / 100).toLocaleString('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

function periodLabel(plan: PlanRow): string {
  return plan.billing_period === 'yearly' ? 'per jaar' : 'per maand';
}

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect('/login?next=/join');

  const [{ error }, plans] = await Promise.all([
    searchParams,
    getPublicWebPlans().catch(() => [] as PlanRow[]),
  ]);
  const errorText = ERRORS[error ?? ''] ?? null;

  // Annual first = primary (getPublicWebPlans orders by amount desc already).
  const yearly = plans.find((p) => p.billing_period === 'yearly') ?? null;
  const monthly = plans.find((p) => p.billing_period === 'monthly') ?? null;
  const ordered = [yearly, monthly].filter((p): p is PlanRow => p !== null);

  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-8 py-16">
      <p className="section-label">Lidmaatschap</p>
      <h1 className="text-3xl font-extrabold tracking-tight mt-2 mb-3">Word lid van Albunyaan TV</h1>
      <p className="text-[15px] text-ink-secondary mb-10 max-w-xl">
        Eén lidmaatschap, het hele aanbod — voor het hele gezin. Opzeggen kan op elk moment,
        zonder kleine lettertjes.
      </p>

      {errorText && (
        <p className="mb-8 rounded-xl px-4 py-3 text-[13px] font-medium bg-red-50 text-red-800" role="alert">
          {errorText}
        </p>
      )}

      {ordered.length === 0 ? (
        <section className="card-elevated rounded-2xl p-8">
          <h2 className="font-bold text-lg mb-1">Prijzen worden geladen</h2>
          <p className="text-[14px] text-ink-secondary">
            De betalingsomgeving wordt nog ingericht (setup pending). Kom binnenkort terug — je
            account is al klaar, in sha&rsquo; Allah.
          </p>
        </section>
      ) : (
        <form action={checkoutAction}>
          <div className="grid sm:grid-cols-2 gap-5 mb-8">
            {ordered.map((plan) => {
              const primary = plan.billing_period === 'yearly';
              return (
                <section
                  key={plan.id}
                  className={`card-elevated rounded-2xl p-7 flex flex-col ${
                    primary ? 'border-2 border-brand' : 'border border-black/5'
                  }`}
                >
                  {primary && monthly && (
                    <p className="text-[12px] font-semibold text-brand mb-2">
                      2 maanden gratis t.o.v. maandelijks
                    </p>
                  )}
                  <h2 className="font-bold text-lg">{plan.title}</h2>
                  <p className="mt-2 mb-1">
                    <span className="text-3xl font-extrabold tracking-tight">{formatEur(plan.amount_cents)}</span>
                    <span className="text-[13px] text-ink-secondary"> {periodLabel(plan)}</span>
                  </p>
                  <p className="text-[13px] text-ink-secondary mb-6">
                    {plan.billing_period === 'yearly'
                      ? 'Jaarlijkse betaling, maandelijks opzegbaar tegen einde van de periode.'
                      : 'Maandelijkse betaling, op elk moment opzegbaar.'}
                  </p>
                  <button
                    type="submit"
                    name="plan_id"
                    value={plan.id}
                    className={`mt-auto w-full px-6 py-3 rounded-full text-[14px] font-semibold transition ${
                      primary
                        ? 'bg-brand hover:bg-brand-light text-white'
                        : 'border border-black/10 text-ink-secondary hover:border-brand hover:text-brand'
                    }`}
                  >
                    {primary ? 'Kies jaarlijks' : 'Kies maandelijks'}
                  </button>
                </section>
              );
            })}
          </div>

          {/* EU consumer consent — REQUIRED, and re-checked server-side. */}
          <label className="flex items-start gap-3 card-elevated rounded-2xl p-5 cursor-pointer">
            <input type="checkbox" name="consent" required className="mt-1 h-4 w-4 accent-[var(--color-brand)]" />
            <span className="text-[13px] text-ink-secondary leading-relaxed">
              Ik ga akkoord met directe levering en doe afstand van mijn 14-dagen herroepingsrecht
              voor digitale inhoud. Zie ook onze{' '}
              <a href="/terms" className="underline hover:text-brand">
                algemene voorwaarden
              </a>
              .
            </span>
          </label>

          <p className="mt-6 text-[12px] text-ink-muted leading-relaxed">
            Betalen kan met iDEAL of creditcard via Stripe. Verlengingen lopen automatisch; je kunt
            je lidmaatschap altijd beheren of opzeggen via je accountpagina.
          </p>
        </form>
      )}
    </div>
  );
}
