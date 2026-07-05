/**
 * Server-only Supabase client (service role).
 *
 * Phase-1 schema has RLS ON with ZERO policies (deny-by-default), so the ONLY
 * access path is the service role — used from Next.js server components /
 * server actions and workers. NEVER import this from client components; the
 * `@albunyaan/core/data` subpath must stay out of browser bundles.
 * Before any real deploy, Phase 3 adds proper policies + anon reads.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function createServiceClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — write apps/web/.env.local (or worker/.env) from `supabase status`.',
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
