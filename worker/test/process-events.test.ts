import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb } from '../lib/db.ts';
import { processEvents, type UscreenEventInput } from '../lib/process-events.ts';

const EVENTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'events');

function loadFixture(name: string): UscreenEventInput {
  return JSON.parse(fs.readFileSync(path.join(EVENTS_DIR, name), 'utf8'));
}

function tmpOut(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'phase1-events-'));
}

describe('process-events (PRD §6: store first, interpret later)', () => {
  it('signup inserts a person + active subscription', async () => {
    const out = tmpOut();
    const db = createDb({ driver: 'jsonl', outDir: out });
    const s = await processEvents([loadFixture('signup.json')], db);

    expect(s).toMatchObject({ processed: 1, unhandled: 0, duplicates: 0, failed: [] });
    const person = await db.get('people', { source: 'uscreen', external_id: '20990001' });
    expect(person).toMatchObject({ email: 'new.subscriber@example.org', full_name: 'New Subscriber' });
    const sub = await db.get('subscriptions', { source: 'uscreen', external_id: '20990001' });
    expect(sub).toMatchObject({ status: 'active' });
    const event = await db.get('uscreen_events', { delivery_id: 'dlv-signup-001' });
    expect(event).toMatchObject({ status: 'processed' });
    expect(event?.payload).toBeTruthy(); // raw payload always kept
  });

  it('cancellation marks the subscription canceled, preserving import-time fields', async () => {
    const out = tmpOut();
    const db = createDb({ driver: 'jsonl', outDir: out });
    await processEvents([loadFixture('signup.json')], db);
    const s = await processEvents([loadFixture('cancellation.json')], db);

    expect(s.processed).toBe(1);
    const sub = await db.get('subscriptions', { source: 'uscreen', external_id: '20990001' });
    expect(sub).toMatchObject({ status: 'canceled', canceled_at: '2026-07-04T21:15:00Z' });
    expect(sub?.started_at).toBeTruthy(); // column-subset upsert: signup fields survive
  });

  it('payment updates current_period_end', async () => {
    const db = createDb({ driver: 'jsonl', outDir: tmpOut() });
    await processEvents([loadFixture('signup.json')], db);
    await processEvents([loadFixture('payment.json')], db);
    const sub = await db.get('subscriptions', { source: 'uscreen', external_id: '20990001' });
    expect(sub).toMatchObject({ status: 'active', current_period_end: '2026-08-04T21:00:00Z' });
  });

  it('unknown event type → stored as unhandled, never dropped, nothing applied', async () => {
    const out = tmpOut();
    const db = createDb({ driver: 'jsonl', outDir: out });
    const s = await processEvents([loadFixture('unknown-type.json')], db);

    expect(s).toMatchObject({ processed: 0, unhandled: 1 });
    const event = await db.get('uscreen_events', { delivery_id: 'dlv-mystery-001' });
    expect(event).toMatchObject({ status: 'unhandled', event_type: 'storefront.theme_updated' });
    expect(await db.count('people')).toBe(0); // nothing interpreted
  });

  it('duplicate delivery id → no double-processing (same batch AND redelivery)', async () => {
    const db = createDb({ driver: 'jsonl', outDir: tmpOut() });
    const signup = loadFixture('signup.json');

    const s1 = await processEvents([signup, signup], db); // duplicate inside one batch
    expect(s1).toMatchObject({ processed: 1, duplicates: 1 });

    const s2 = await processEvents([signup], db); // redelivery in a later run
    expect(s2).toMatchObject({ processed: 0, duplicates: 1 });

    expect(await db.count('people')).toBe(1);
    expect(await db.count('subscriptions')).toBe(1);
    expect(await db.count('uscreen_events')).toBe(1);
  });

  it('unlinkable payload → failed status with the error recorded, delivery still stored', async () => {
    const db = createDb({ driver: 'jsonl', outDir: tmpOut() });
    const s = await processEvents(
      [{ delivery_id: 'dlv-broken-001', event_type: 'user.signup', payload: { note: 'no user object at all' } }],
      db,
    );
    expect(s.failed).toHaveLength(1);
    const event = await db.get('uscreen_events', { delivery_id: 'dlv-broken-001' });
    expect(event).toMatchObject({ status: 'failed' }); // stored + flagged, never silently dropped
  });
});
