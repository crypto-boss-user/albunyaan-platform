# Founder Runbook — Cloud Auth, Email & Billing Setup

**Status:** action items for the founder — everything here needs a login/click only you can do (dashboard access, identity verification, or a real-world contact). Data as of 2026-07-12, verified live against the production Supabase project (`hfqdewsybdoxlmjkjoie`) via the Management API.
**Why this doc exists:** the security review found that the cloud project is still running on **stock Supabase Auth defaults** — no custom SMTP, default email templates, `localhost:3000` as the Site URL, and a 2-email/hour rate limit. None of that throws an error anywhere in the code (a "silent-failure trap" — see [security-findings-report.md](./security-findings-report.md)), so it will only surface as a real problem once real members try to log in. Steps A–C fix that, in order.

## TL;DR checklist

- [ ] **A.** Add 3 DNS records at one.com for `albunyaan.tv` (Resend)
- [ ] **B.** Verify the domain in Resend, then flip Supabase to Resend's SMTP
- [ ] **C.** Supabase Auth dashboard: paste both email templates, set Site URL, add redirect URLs, **raise the 2/hr email rate limit**
- [ ] **D.** Finish Stripe identity verification → tell me → I pull the audit key
- [ ] **E.** Get IPTV source stream URLs for the 29 live channels
- [ ] **F.** Upgrade Supabase to Pro
- [ ] **G.** Trigger the Uscreen **Leads** CSV export (People is already done)
- [ ] **H.** Zapier — nothing to decide; just keep the 5 zaps running until cutover (details below)
- [ ] **I.** Confirm the legal operator entity name — "Stichting alAsr" vs "Stichting Tarbiyah Consultancy" (details below, not urgent)

Steps A → B → C are sequenced (each depends on the previous). D–I are independent — do them whenever.

---

## A. DNS records at one.com

Domain `albunyaan.tv` was added in Resend on 2026-07-12 (region eu-west-1), status "waiting for these records". Log into the one.com DNS panel for `albunyaan.tv` and add:

| # | Type | Host/Name | Value | Priority | TTL |
|---|------|-----------|-------|----------|-----|
| 1 | TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDX/juKUxP5gKXURFjUeAbkYYUXZOOcwJEsbgkMH63zjxMPyl6GelslpakQl+STZ7noweLoAr7VMbbLOQvynkPLZGWTFIBHQpWuiZ6ANnYFmhyUpG/2OgU4NST6mRPQpyoJNyTuU1rsFqhPLBz/9suihEwHhHSHzwxa3/m/SsRtWQIDAQAB` | — | Auto/3600 |
| 2 | MX | `send` | `feedback-smtp.eu-west-1.amazonses.com` | 10 | Auto/3600 |
| 3 | TXT | `send` | `v=spf1 include:amazonses.com ~all` | — | Auto/3600 |

**Do NOT touch** the existing root records — root SPF (Outlook + one.com) and the `brevo-code` TXT record stay as-is. These 3 new records live on the `resend._domainkey` and `send` subdomains, so there's no conflict; incoming mail (Outlook) is untouched — "Enable Receiving" is deliberately left OFF in Resend.

## B. Verify Resend, then flip Supabase to custom SMTP

1. Once the DNS records have propagated (usually under an hour, can take longer), go to **resend.com/domains** → `albunyaan.tv` → click **Verify**.
2. Once verified, go to the **Supabase dashboard** → this project → **Project Settings → Authentication → SMTP Settings** → toggle on **"Enable Custom SMTP"** and fill in:
   - **Host:** `smtp.resend.com`
   - **Port:** `465` (SSL) — or `587` if the dashboard prefers STARTTLS
   - **Username:** `resend`
   - **Password:** the Resend API key — it's in `~/.albunyaan-cc/resend.env` (`RESEND_API_KEY`, sending-only scope). Don't paste it anywhere outside the Supabase dashboard field.
   - **Sender email:** something on `@albunyaan.tv`, e.g. `no-reply@albunyaan.tv`
   - **Sender name:** `Albunyaan TV`
3. Send yourself a test reset/magic-link email from the dashboard's test button to confirm it lands (check spam once).

**Why this matters:** right now there is no custom SMTP configured at all — every auth email goes through Supabase's own shared mailer, which is exactly why its rate limit sits at a stingy default. Once Resend is the sender, that default is yours to raise (step C).

## C. Supabase Auth dashboard config

All under **Authentication** in the Supabase dashboard for this project. Do this *after* B (some of it, like the rate limit, is only safe to raise once you're not sharing Supabase's mailer capacity).

1. **Email Templates → Magic Link** — replace the body with the contents of `supabase/templates/magic_link.html` in the repo. This is the scanner-proof version (verification only fires on an explicit button click, not on link-preview/prefetch) — the dashboard does **not** read that file automatically, it has to be pasted in by hand.
2. **Email Templates → Change Email Address** — same thing, paste in `supabase/templates/email_change.html`.
3. Leave **"Secure email change"** (double-confirm) switched **ON** — verified on as of this write-up. The account-takeover protection on email changes depends on it staying on; don't turn it off even temporarily.
4. **URL Configuration → Site URL** — currently `http://localhost:3000`. Change it to the real production domain once you have one (e.g. `https://albunyaan.tv` or the Vercel URL, whichever goes live first).
5. **URL Configuration → Redirect URLs** — currently empty. Add the production domain's `/auth/confirm` path (and any staging/preview domain you want logins to work on).
6. **Rate Limits → "Rate limit for sending emails"** — currently **2 per hour**. This is the one that will actually break something: at 2/hr, activating the ~600 migrating members would take roughly 300 hours. Raise it to match your activation-wave pace (a few hundred/hour is reasonable) — only do this after custom SMTP (step B) is live, since Supabase's own mailer has that low ceiling on purpose.

## D. Stripe identity verification

There's a "Verification required" modal already open in the Chrome tab from the earlier restricted-key creation attempt (security key or email verification). Finish that whenever convenient, then tell me — I'll pull the restricted **read** key into `~/.albunyaan-cc/stripe.env` and run the audit (`worker/stripe-audit.ts`) to match Uscreen subscribers against Stripe customers. A separate restricted **write** key will be needed later for live checkout/webhooks — nothing to do about that now.

## E. IPTV source URLs

For the 29 live channels (full list in `infra/live-relay/CHANNELS-INVENTORY.md`), the actual video source streams are **not** in Uscreen anywhere — Uscreen only has the RTMP ingest endpoint that something on your side pushes into. Ask your IPTV provider/ustaadh for the source stream URLs for each channel so the relay kit can pull from them instead of pushing to Uscreen.

## F. Supabase Pro upgrade

Whenever convenient — a dashboard billing action, needed before public launch (current free-tier limits).

## G. Uscreen Leads CSV export

People CSV is done (2,926 rows imported, verified clean). The **Leads** export is still outstanding — trigger it the same way (Uscreen admin → Export), it'll arrive async at `info@fitrahmedia.nl`; forward it or drop the file in `worker/fixtures/` when it lands.

## H. Zapier — RESOLVED (keep until cutover, then cancel)

**You asked: do we still need Zapier once we're on Stripe?** Short answer: **no, not on the new platform** — but keep the 5 zaps running until cutover.

Today, web members pay through our own Stripe flow and 5 Zapier zaps bridge payment → Uscreen access (2 monthly + 2 yearly grant-zaps for old/new subscriptions, plus 1 cancellation zap). On the new platform, our own Stripe webhook does exactly what the grant-zaps do (payment → access), minus Zapier and minus Uscreen; and the Stripe Billing Portal lets members cancel themselves (fixing today's "members can barely cancel" problem).

**What to do:**
- **Now → cutover:** leave all 5 zaps untouched. They keep the *old* site's members in sync. In parallel we register our platform's own Stripe webhook endpoint — Stripe delivers to multiple endpoints at once, so the zaps and our webhook run side by side without interfering.
- **At cutover:** switch the 5 zaps off, then cancel the Zapier subscription (nothing else uses it — Brevo marketing runs from our own machine).

Nothing for you to decide here anymore — just don't turn the zaps off early. (The `uscreen-webhook` Edge Function we deployed stays as an optional receiver for Apple/Google IAP member changes, which aren't in Stripe; nightly scrape-diff is the fallback there.)

Full reasoning + the migration redesign this unlocked: `docs/../plan another-important-note-or-proud-kernighan.md` and the WS8 section of the master plan.

## I. Legal operator entity name — needs your confirmation (not urgent)

The drafted `/terms` and `/privacy` pages (already live on the new platform) name **Stichting alAsr** as the operator, per the original task brief. But the live Uscreen-hosted Terms & Privacy pages (`albunyaan.tv/pages/servicevoorwaarden` and `/privacybeleid`) both name **Stichting Tarbiyah Consultancy** instead — verified by reading the live pages directly, word for word, on 2026-07-12.

The live `/pages/dawah` page (also just ported to the new platform, see below) adds a clue: it lists **Tarbiyah Consultancy** as one of two separate foundations Albunyaan *donates to* — alongside **Stichting Al-Istiqaamah** — describing it as an independent educational non-profit with its own publications, not as "us." That suggests the Uscreen ToS/Privacy pages naming Tarbiyah Consultancy as the *operator* may simply be old/wrong copy (possibly copy-pasted from an early draft, or a mix-up between "who runs the site" and "who the site donates to"), rather than a genuine former legal name of the platform.

**Before publishing the new `/terms` and `/privacy` pages for real** (they currently carry a visible "Draft — not yet reviewed" banner), confirm which is correct: is Stichting alAsr the right operating entity, and is Tarbiyah Consultancy purely a beneficiary foundation with no operational relationship to the site itself? Also worth flagging to whoever manages the live Uscreen pages either way, since the current live Privacy Policy also cites the defunct 1998 UK Data Protection Act instead of GDPR/AVG, claims data is "stored in the United States," and mentions discontinued "Google Checkout" — none of that reflects how the site actually runs today.

## Also done this session: About us, Dawah, Q&A now have real content

`reference/real-site-ia.json` (captured 2026-07-05) listed "About us" and "Dawah" in the site's nav, but by 2026-07-12 they'd been removed from the live header/footer — the pages still exist at `albunyaan.tv/pages/about-us` and `/pages/dawah`, just unlinked. Their real text (plus the live `/pages/qa`) has now been ported verbatim into the new platform's `/about-us`, `/dawah`, and `/qa` pages, replacing the "coming soon" placeholders. Nothing needed from you here — just flagging in case you intentionally unlinked those two pages on the old site and don't want them surfaced on the new one; if so, say so and they can go back to a stub or be dropped from the nav.
