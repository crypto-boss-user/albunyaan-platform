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

## Vercel notes

- Add both Stripe vars as **server-side** env vars (plain, not `NEXT_PUBLIC_`),
  scope Production (live key) and optionally Preview (test key).
- **Deployment Protection**: if Vercel Authentication / Password Protection is
  on, Stripe's webhook deliveries to `/api/stripe/webhook` bounce off the auth
  wall with 401. Configure **Protection Bypass for Automation** (Project →
  Settings → Deployment Protection), and register the webhook URL with the
  bypass query parameter, e.g.
  `https://<domain>/api/stripe/webhook?x-vercel-protection-bypass=<token>` —
  or exempt the production domain from protection entirely.
- Webhook events to subscribe: `checkout.session.completed`,
  `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.

## Related workers (same Stripe key, sourced from `~/.albunyaan-cc/stripe.env`)

- `worker/stripe-setup.ts` — one-time product/price bootstrap + `plans` upsert (`--dry-run` first).
- `worker/reconcile-stripe.ts` — drift check Stripe ↔ entitlements (`--fix` to repair).
