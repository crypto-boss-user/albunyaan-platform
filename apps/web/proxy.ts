/**
 * Next 16 proxy (the artist formerly known as middleware.ts — Next 16 renamed
 * the convention; both filenames load, `proxy.ts` is the current one).
 *
 * Its ONLY job is @supabase/ssr session refresh: exchange an expired access
 * token for a fresh one and re-set the auth cookies on both the forwarded
 * request and the response. There is deliberately NO auth gating here — route
 * protection is per-page, server-side (see /account, /profiles, /parents).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return response; // unconfigured env: pass through, pages will surface the error

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Touching getUser() is what triggers the token refresh when needed.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Skip static assets — session refresh only matters for pages/actions.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)'],
};
