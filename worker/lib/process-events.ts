/**
 * Uscreen webhook event processor — PRD §6 ("store first, interpret later").
 *
 * The Edge Function (supabase/functions/uscreen-webhook) only STORES deliveries
 * into `uscreen_events`. This processor interprets stored events onto
 * people/subscriptions through the same driver-agnostic db.ts interface.
 *
 * Idempotency: keyed on delivery_id via the uscreen_events row status —
 * an event already 'processed'/'unhandled' is never applied twice.
 *
 * ⚠️ Exact Uscreen event-type names + payload schemas are a Phase 0 open
 * question (PRD §9 Q3). The canonical names below are normalized generously
 * (see normalizeEventType) and anything unrecognized is stored 'unhandled',
 * NEVER dropped.
 */
import type { Db, DbRow } from './db.ts';
import { normalizeEmail, isValidEmail } from './email.ts';

const SOURCE = 'uscreen';

export interface UscreenEventInput {
  delivery_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  received_at?: string;
}

export interface ProcessEventsSummary {
  received: number;
  processed: number;
  unhandled: number;
  duplicates: number; // delivery ids already processed — skipped, no double-apply
  failed: { delivery_id: string; error: string }[];
}

/** Map raw Uscreen event names onto our canonical trio; null = unhandled. */
export function normalizeEventType(raw: string): 'signup' | 'payment' | 'cancellation' | null {
  const t = raw.toLowerCase();
  if (/(signup|sign_up|user[._-]?created|customer[._-]?created)/.test(t)) return 'signup';
  if (/(payment|invoice[._-]?paid|charge[._-]?succeeded)/.test(t)) return 'payment';
  if (/(cancel)/.test(t)) return 'cancellation';
  return null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Pull the Uscreen user/customer id out of the payload's usual spots. */
function extractExternalId(payload: Record<string, unknown>): string | null {
  const user = (payload.user ?? payload.customer ?? payload) as Record<string, unknown>;
  const id = user.id ?? user.user_id ?? payload.user_id ?? payload.customer_id;
  return id == null ? null : String(id);
}

function extractEmail(payload: Record<string, unknown>): string | null {
  const user = (payload.user ?? payload.customer ?? payload) as Record<string, unknown>;
  const email = str(user.email ?? payload.email);
  if (!email) return null;
  const normalized = normalizeEmail(email);
  return isValidEmail(normalized) ? normalized : null;
}

export async function processEvents(events: UscreenEventInput[], db: Db): Promise<ProcessEventsSummary> {
  const summary: ProcessEventsSummary = { received: events.length, processed: 0, unhandled: 0, duplicates: 0, failed: [] };

  for (const event of events) {
    // Idempotency gate — delivery id already applied? Never double-process.
    const existing = await db.get('uscreen_events', { delivery_id: event.delivery_id });
    if (existing && (existing.status === 'processed' || existing.status === 'unhandled')) {
      summary.duplicates += 1;
      continue;
    }

    const eventRow: DbRow = {
      delivery_id: event.delivery_id,
      event_type: event.event_type,
      external_id: extractExternalId(event.payload),
      payload: event.payload, // raw payload always kept
      received_at: event.received_at ?? new Date().toISOString(),
      status: 'stored',
      processed_at: null,
    };

    try {
      const kind = normalizeEventType(event.event_type);
      if (kind === null) {
        eventRow.status = 'unhandled'; // stored, never dropped
        summary.unhandled += 1;
      } else {
        await applyEvent(kind, event.payload, db);
        eventRow.status = 'processed';
        eventRow.processed_at = new Date().toISOString();
        summary.processed += 1;
      }
    } catch (err) {
      eventRow.status = 'failed';
      eventRow.processed_at = null;
      summary.failed.push({ delivery_id: event.delivery_id, error: String(err) });
    }

    await db.upsert('uscreen_events', [eventRow], ['delivery_id']);
  }

  await db.flush();
  return summary;
}

async function applyEvent(kind: 'signup' | 'payment' | 'cancellation', payload: Record<string, unknown>, db: Db): Promise<void> {
  const externalId = extractExternalId(payload);
  if (!externalId) throw new Error(`no user/customer id in ${kind} payload — cannot link to people`);

  if (kind === 'signup') {
    const email = extractEmail(payload);
    if (!email) throw new Error('signup payload has no valid email — refusing to insert a person without one');
    const user = (payload.user ?? payload.customer ?? payload) as Record<string, unknown>;
    await db.upsert('people', [{
      source: SOURCE,
      external_id: externalId,
      email,
      full_name: str(user.name) ?? str(user.full_name),
      signup_at: str(payload.created_at) ?? new Date().toISOString(),
      raw: payload,
    }]);
    await db.upsert('subscriptions', [{
      source: SOURCE,
      external_id: externalId, // same person-id key as the CSV importer
      plan_title: str((payload as any).plan?.title) ?? str(payload.plan_title),
      status: 'active',
      started_at: str(payload.created_at) ?? new Date().toISOString(),
      raw: payload,
    }]);
    return;
  }

  if (kind === 'payment') {
    await db.upsert('subscriptions', [{
      source: SOURCE,
      external_id: externalId,
      status: 'active',
      current_period_end: str(payload.next_invoice_date) ?? str(payload.current_period_end),
      raw: payload,
    }]);
    return;
  }

  // cancellation → mark status + date on the linked subscription (column-subset upsert:
  // started_at / plan_title from the original import are preserved by the merge semantics).
  await db.upsert('subscriptions', [{
    source: SOURCE,
    external_id: externalId,
    status: 'canceled',
    canceled_at: str(payload.canceled_at) ?? new Date().toISOString(),
    raw: payload,
  }]);
}
