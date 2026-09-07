/**
 * AD 2.3 (founder 2026-09-07, vraag 7): de 11 gemeten Uscreen-plannen als data in `plans` (0001) — naam, prijs, valuta, interval, proef,
 * Public/Private, volgorde, apps-badge. GEEN ledenkoppeling (subscriptions blijft leeg), GEEN stripe_price_id (betaalkoppeling volgt).
 * Bron: reference/admin-2026-09/plans-uscreen-2026-09-07.json (uit subscriptions-lijst.json, AD 0b). Idempotent: upsert op (source, external_id);
 * bestaande rijen worden niet verwijderd EN niet overschreven (ignoreDuplicates: een herdraai zet admin-bewerkingen niet terug op de meting — koude review I-3). Run: set -a; source ~/.albunyaan-cc/cloud.env; set +a; node worker/import-uscreen-plans.mjs
 * Sequentieel CLI-script zonder parallelle workers (geen spawnSync, geen npx).
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ontbreken (cloud.env)'); process.exit(2); }
const db = createClient(url, key, { auth: { persistSession: false } });
const bron = JSON.parse(readFileSync(new URL('../reference/admin-2026-09/plans-uscreen-2026-09-07.json', import.meta.url), 'utf8'));
const { count: voor } = await db.from('plans').select('id', { count: 'exact', head: true }).eq('source', 'uscreen');
let n = 0, geschreven = 0;
for (const p of bron.plannen) {
  const { data, error } = await db.from('plans').upsert({
    external_id: p.uscreen_id, source: 'uscreen', title: p.title, description: '', platform: p.platform, amount_cents: p.amount_cents, currency: p.currency,
    billing_period: p.billing_period, trial_days: p.trial_days, visibility: p.visibility,
    raw: { bron: 'AD 0b 2026-09-07', volgorde: p.volgorde, apps_badge: p.apps_badge, members_gemeten: p.members_gemeten, uscreen_id: p.uscreen_id },
  }, { onConflict: 'source,external_id', ignoreDuplicates: true }).select('id');
  if (error) { console.error('plans', p.title, error.message); process.exit(1); }
  n++;
  geschreven += (data ?? []).length; // met ignoreDuplicates komt een overgeslagen rij niet terug (adversarial N-5)
}
const { count: na } = await db.from('plans').select('id', { count: 'exact', head: true }).eq('source', 'uscreen');
console.log(`verwerkt: ${n} plannen, nieuw geschreven: ${geschreven} | uscreen-plannen in DB vóór: ${voor}, na: ${na} (bron: ${bron.plannen.length})`);
if ((na ?? 0) < bron.plannen.length) { console.error(`telling klopt niet: ${na} < ${bron.plannen.length}`); process.exit(1); }
