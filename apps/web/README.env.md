# apps/web — environment variables

Names and provenance only. **Never commit values.** Local values live in
`apps/web/.env.local` / `.env.development.local`; deployed values live in the
Vercel project env.

## Supabase (existing, WS3)

| Name | What | Needed in |
| --- | --- | --- |
| `SUPABASE_URL` | Project URL — `supabase status` (local) or the cloud project settings | local dev, Vercel (all envs) |
| `SUPABASE_ANON_KEY` | Anon key (member auth client) — same sources | local dev, Vercel (all envs) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (data layer bypasses RLS) — same sources. Server-only, never `NEXT_PUBLIC_` | local dev, Vercel (all envs) |

## Stripe (WS4 billing — keys arrive with the founder)

| Name | What | Needed in |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Secret API key (`sk_test_…` for testing, `sk_live_…` for production) from the foundation's Stripe dashboard → Developers → API keys. Used by checkout (`/join`), the billing portal (`/account`) and the webhook route. Server-only. | local dev (only when testing billing), Vercel Production + Preview (test key on Preview) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret (`whsec_…`) of the webhook endpoint pointing at `/api/stripe/webhook`. Per-endpoint: the dashboard endpoint, a `stripe listen` local session, and any preview endpoint each have their OWN secret. | wherever that endpoint's deliveries land (Vercel Production; local only with `stripe listen`) |

Until both are set: the app builds and runs; `/join` renders and fails checkout
with a clear error; `/api/stripe/webhook` answers 500 "stripe not configured".

## Monitoring (Sentry + Plausible — staged code, not live yet)

All three are inert by design until their env var is set — no account, no
code change needed to enable later, just add the value in Vercel and redeploy.
See `docs/founder-runbook.md` item J for the founder-side account setup.

| Name | What | Needed in |
| --- | --- | --- |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry project DSN (client + edge error reporting). Without it, `Sentry.init()` is a documented no-op — zero network calls. | Vercel Production + Preview, once the founder creates the Sentry project |
| `SENTRY_DSN` | Same DSN, server-side (Node runtime config). Usually identical value to the `NEXT_PUBLIC_` one. | same |
| `SENTRY_ORG` / `SENTRY_PROJECT` | Org/project slugs from the Sentry dashboard URL — only used for source-map upload metadata. | Vercel (build time), optional until source maps matter |
| `SENTRY_AUTH_TOKEN` | Sentry auth token (Settings → Auth Tokens, `project:releases` scope) — enables source-map upload during build so stack traces show real code instead of minified bundles. Without it the build just skips upload with one notice, no failure. | Vercel (build time secret), optional |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | The domain registered in Plausible (e.g. `albunyaan.tv`) — adds the tracking script to every page. Cookieless, no PII, no API key needed for basic pageviews. | Vercel Production, once the founder adds the site in Plausible |

**UptimeRobot needs no code at all** — point a free monitor at the existing
`/api/health` endpoint (already built + e2e-tested, returns 200). Just an
account + one monitor config, no env var, no deploy.

## Site URL (canonical redirect origin)

| Name | What | Needed in |
| --- | --- | --- |
| `SITE_URL` | Canonical public origin (e.g. `https://albunyaan.tv`, no trailing slash) used to build Stripe checkout/portal redirect URLs. When unset the code falls back to request headers (fine locally), but on a proxied/self-hosted deploy a spoofed `Host` header could turn a post-payment redirect into an attacker-controlled URL — so **set this in Vercel**. | Vercel Production + Preview (recommended); optional locally |

## Vercel notes

- Add both Stripe vars as **server-side** env vars (plain, not `NEXT_PUBLIC_`),
  scope Production (live key) and optionally Preview (test key).
- **Deployment Protection**: if Vercel Authentication / Password Protection is
  on, Stripe's webhook deliveries to `/api/stripe/webhook` bounce off the auth
  wall with 401. Configure **Protection Bypass for Automation** (Project →
  Settings → Deployment Protection). Prefer exempting the production domain
  from protection entirely; if you must use the bypass token, send it as the
  **`x-vercel-protection-bypass` HTTP header** on the Stripe endpoint (Stripe
  dashboard → the webhook → add header), **not** as a URL query parameter — a
  token in the URL leaks into Stripe's delivery logs and anywhere the endpoint
  URL is stored, and it grants access to every protected deployment.
- Webhook events to subscribe (keep in sync with `HANDLED_STRIPE_EVENTS` in
  `apps/web/lib/stripe-apply.ts`): `checkout.session.completed`,
  `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`,
  `charge.dispute.created`, `charge.dispute.funds_withdrawn`. The dispute
  events drive SEPA/iDEAL chargeback clawback — if they aren't subscribed, a
  charged-back member keeps access silently.

## Related workers (same Stripe key, sourced from `~/.albunyaan-cc/stripe.env`)

- `worker/stripe-setup.ts` — one-time product/price bootstrap + `plans` upsert (`--dry-run` first).
- `worker/reconcile-stripe.ts` — drift check Stripe ↔ entitlements (`--fix` to repair).
