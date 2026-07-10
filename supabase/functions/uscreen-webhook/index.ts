/**
 * Supabase Edge Function: POST /uscreen-webhook — PRD §6.
 *
 * STORE FIRST, INTERPRET LATER. This function's only job is to land every
 * delivery in `uscreen_events` with the raw payload intact. Interpretation
 * (people/subscriptions updates) is worker/lib/process-events.ts, run
 * separately — a processor bug can never lose a delivery.
 *
 *   • idempotent on delivery id: unique(delivery_id) — a redelivery returns
 *     200 {duplicate:true}, no second row.
 *   • unrecognized event types are stored with status 'unhandled', NEVER dropped.
 *   • shared-secret check: set USCREEN_WEBHOOK_SECRET (supabase secrets set) and
 *     register the endpoint with ?secret=<value> (or send x-webhook-secret header).
 *     Unset secret = accept-but-log-loudly (store-first: a config miss must never
 *     drop deliveries); set-but-mismatched = 401.
 *
 * Deno runtime (Supabase Edge). Deploy is a Phase-0-gated step; this file is
 * offline infrastructure until a Supabase project exists.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Keep in sync with worker/lib/process-events.ts normalizeEventType().
const KNOWN_EVENT_PATTERN = /(signup|sign_up|user[._-]?created|customer[._-]?created|payment|invoice[._-]?paid|charge[._-]?succeeded|cancel)/i;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Delivery id: Uscreen's own id when present, else a stable hash of the raw body. */
async function deliveryIdOf(payload: Record<string, unknown>, rawBody: string): Promise<string> {
  const explicit = payload.delivery_id ?? payload.webhook_id ?? payload.event_id ?? payload.id;
  if (explicit != null && String(explicit).trim() !== '') return String(explicit);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawBody));
  return 'sha256:' + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function extractExternalId(payload: Record<string, unknown>): string | null {
  const user = (payload.user ?? payload.customer ?? payload) as Record<string, unknown>;
  const id = user.id ?? user.user_id ?? payload.user_id ?? payload.customer_id;
  return id == null ? null : String(id);
}

/** Timing-safe shared-secret check (compares SHA-256 digests, so lengths never leak). */
async function secretMatches(req: Request): Promise<boolean> {
  const expected = Deno.env.get('USCREEN_WEBHOOK_SECRET');
  if (!expected) {
    console.error('uscreen-webhook: USCREEN_WEBHOOK_SECRET unset — accepting UNVERIFIED delivery');
    return true; // store-first: never drop deliveries over a config miss
  }
  const given = req.headers.get('x-webhook-secret') ?? new URL(req.url).searchParams.get('secret') ?? '';
  const digest = async (s: string) =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const [a, b] = await Promise.all([digest(given), digest(expected)]);
  return a.every((v, i) => v === b[i]);
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  if (!(await secretMatches(req))) {
    console.error('uscreen-webhook: secret mismatch', { ip: req.headers.get('x-forwarded-for') });
    return json(401, { error: 'unauthorized' });
  }

  const rawBody = await req.text();
  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawBody);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    payload = parsed;
  } catch {
    // Shape validation is our only gate until a signing secret is confirmed —
    // log the source and reject. (Rejected bodies are not deliveries; nothing to store.)
    console.error('uscreen-webhook: non-JSON body rejected', { ip: req.headers.get('x-forwarded-for') });
    return json(400, { error: 'body must be a JSON object' });
  }

  const eventType = String(payload.event_type ?? payload.event ?? payload.type ?? '').trim();
  if (!eventType) {
    console.error('uscreen-webhook: missing event type', { ip: req.headers.get('x-forwarded-for') });
    return json(400, { error: 'missing event_type/event/type field' });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // service role — uscreen_events is RLS deny-by-default
  );

  const row = {
    delivery_id: await deliveryIdOf(payload, rawBody),
    event_type: eventType,
    external_id: extractExternalId(payload),
    payload, // raw, always
    status: KNOWN_EVENT_PATTERN.test(eventType) ? 'stored' : 'unhandled',
    received_at: new Date().toISOString(),
  };

  // Store-first insert; unique(delivery_id) makes redelivery a no-op.
  const { error } = await supabase.from('uscreen_events').insert(row);
  if (error) {
    if (error.code === '23505') return json(200, { ok: true, duplicate: true, delivery_id: row.delivery_id });
    console.error('uscreen-webhook: insert failed', error, { ip: req.headers.get('x-forwarded-for') });
    return json(500, { error: 'store failed — Uscreen should retry this delivery' });
  }
  return json(200, { ok: true, delivery_id: row.delivery_id, status: row.status });
});
