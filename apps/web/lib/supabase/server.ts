/**
 * Request-scoped Supabase client for MEMBER auth (anon key + the caller's own
 * session cookies). Server-only — import from server components / server
 * actions / route handlers exclusively.
 *
 * This client is for AUTH (who is the visitor?). Data reads/writes stay on the
 * service-role client in @albunyaan/core/data — do not swap one for the other.
 */
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function getServerSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL / SUPABASE_ANON_KEY missing — write apps/web/.env.development.local from `supabase status` (local) or the project env (cloud).',
    );
  }
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component render — cookies are read-only there.
          // Harmless: proxy.ts (updateSession) refreshes tokens for every request.
        }
      },
    },
  });
}

/**
 * Session-less auth client for OUTBOUND OTP requests (signInWithOtp).
 *
 * Deliberately NOT the ssr client: @supabase/ssr hardcodes flowType 'pkce',
 * which makes GoTrue mint `pkce_…` token hashes bound to a code-verifier on
 * the requesting device. Our magic links are TOKEN_HASH based and must survive
 * cross-device clicks + scanner prefetch, so the request goes out with the
 * implicit flow → plain one-time token hash, verifiable from any browser.
 */
export function getOtpRequestClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL / SUPABASE_ANON_KEY missing — write apps/web/.env.development.local from `supabase status` (local) or the project env (cloud).',
    );
  }
  return createClient(url, key, {
    auth: {
      flowType: 'implicit',
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
