/**
 * GET /api/health — liveness + DB reachability for uptime monitoring.
 * Returns { ok, db, time }; db=true iff a trivial categories read succeeds.
 * Never echoes env values or raw error internals.
 */
import { createServiceClient } from '@albunyaan/core/data';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const time = new Date().toISOString();
  let db = false;
  try {
    const client = createServiceClient();
    const { error } = await client.from('categories').select('id').limit(1);
    db = !error;
  } catch {
    db = false; // missing env / unreachable DB — report status only, leak nothing
  }
  return Response.json({ ok: db, db, time }, { status: db ? 200 : 503 });
}
