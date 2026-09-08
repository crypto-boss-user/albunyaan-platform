import type { NextConfig } from 'next';
import path from 'node:path';
import { withSentryConfig } from '@sentry/nextjs';

/**
 * Security headers (WS5a). CSP notes:
 *  - script-src/style-src need 'unsafe-inline' for Next.js inline runtime
 *    scripts and Tailwind/inline style attributes.
 *  - img-src: Supabase storage hosts the mirrored posters; *.uscreencdn.com
 *    covers legacy thumbs still referenced from raw imports.
 *  - frame-src: Bunny Stream player iframe (iframe.mediadelivery.net).
 *  - media-src blob:: HLS playback via MSE uses blob: URLs.
 *  - connect-src: Supabase (auth/magic-link + REST) from the browser.
 *  - form-action allows Stripe's hosted checkout AND billing-portal hosts:
 *    Chrome enforces form-action across a form submission's redirect chain, so
 *    a no-JS POST that server-redirects to checkout/billing.stripe.com is
 *    blocked without them.
 *  - frame-ancestors 'none': nothing may embed us (clickjacking).
 *  - Sentry/Plausible allowances only get added when their env var is set —
 *    keeps the policy minimal until each monitoring tool is actually wired
 *    up (see docs/founder-runbook.md item J).
 */
const SENTRY_ENABLED = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);
const PLAUSIBLE_ENABLED = Boolean(process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN);

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${PLAUSIBLE_ENABLED ? ' https://plausible.io' : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://hfqdewsybdoxlmjkjoie.supabase.co https://*.uscreencdn.com",
  "media-src 'self' blob:",
  'frame-src https://iframe.mediadelivery.net',
  `connect-src 'self' https://hfqdewsybdoxlmjkjoie.supabase.co${SENTRY_ENABLED ? ' https://*.sentry.io' : ''}${PLAUSIBLE_ENABLED ? ' https://plausible.io' : ''}`,
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
].join('; ');

const nextConfig: NextConfig = {
  transpilePackages: ['@albunyaan/core'],
  // Turbopack koos zonder deze regel /Users/<user> als workspace-root (een verdwaalde ~/package-lock.json
  // wint van pnpm-workspace.yaml) en compileerde `/` in `next dev` dan nooit af: "○ Compiling / ..." zonder
  // antwoord, CPU ~100 s actief en daarna 0 % — gemeten 3× (T-testronde 2026-09-08, tokens + home-blokken
  // 3/3 rood op het configpad). Met de monorepo-root als root: `/` koud in 23 s. Productie (`next build`) had
  // hier geen last van.
  turbopack: { root: path.resolve(__dirname, '..', '..') },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: CSP },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Production semantics; harmless on localhost (browsers ignore HSTS over http).
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

// withSentryConfig itself is safe to apply unconditionally — without
// SENTRY_AUTH_TOKEN it just skips source-map upload (prints one notice),
// no build failure and no runtime effect.
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  webpack: { treeshake: { removeDebugLogging: true } },
  // Source maps only upload when SENTRY_AUTH_TOKEN is present (CI/Vercel
  // secret, not committed) — see docs/founder-runbook.md item J.
});
