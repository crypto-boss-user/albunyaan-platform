import type { NextConfig } from 'next';

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
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://hfqdewsybdoxlmjkjoie.supabase.co https://*.uscreencdn.com",
  "media-src 'self' blob:",
  'frame-src https://iframe.mediadelivery.net',
  "connect-src 'self' https://hfqdewsybdoxlmjkjoie.supabase.co",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
].join('; ');

const nextConfig: NextConfig = {
  transpilePackages: ['@albunyaan/core'],
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

export default nextConfig;
