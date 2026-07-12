# Team Handbook — Day-to-Day Admin (no CLI needed)

Everything here is done from a browser at `/admin` on the live site. No terminal, no
database access, no code. If a task isn't listed here, it isn't self-serve yet — ask
the founder or whoever's doing the technical work.

## Logging in

1. Go to `/admin`. If you're not logged in, you'll land on `/login` first — log in the
   normal way (email → magic link).
2. First time only: `/admin` will send you to an authenticator (TOTP) enrollment page —
   scan the QR code with an authenticator app (Google Authenticator, 1Password, etc.)
   and enter the 6-digit code it shows you. This only happens once per browser/device.
3. Every visit after that, you may be asked for a fresh 6-digit code (a "step-up") —
   this is deliberate, admin actions need a second factor every session.
4. If you're not on the admin list at all, you'll just get a normal "page not found" —
   ask whoever manages the platform to add your account to `platform_admins`.

The dashboard (`/admin`) has 3 sections and a log of recent admin activity at the
bottom (who did what, when — every action below is recorded there automatically).

## Publishing / unpublishing a video

Go to **Videos** (`/admin/videos`). Search by title, or filter by status.

Click into any video to open its edit page. You can change:
- **Title** — the display name shown on the site.
- **Short description** / **Description** — the blurb shown on the card / the program page.
- **Status** — `Draft` (hidden from everyone), `Published` (live on the site),
  `Scheduled`, or `Live channel` (for the 24/7 streams, not a normal video).
- **Access** — `Subscription` (members only) or `Free` (anyone can watch, no login).
- **Age rating** — `All ages`, `7+`, `13+`, `16+`. Setting this marks the video as
  human-reviewed (as opposed to a machine guess), which matters for the parental
  controls further down the line.

Click **Save changes**. That's it — no publish button separate from Status; setting
Status to `Published` *is* publishing it.

**"Translate a title"** — there's no separate language field yet (that's planned but
not built). If a title is wrong, garbled, or in the wrong language, just edit the
**Title** field directly and save — same form as above.

## Minting a voucher (free access code)

Go to **Vouchers** (`/admin/vouchers`). Fill in the **Mint vouchers** form at the top:

- **Duration (days)** — how long the access lasts once redeemed (default 365).
- **How many codes** — mint a batch at once (e.g. 20 codes for a masjid campaign).
- **Max redemptions** — leave at 1 unless you deliberately want one shared code
  usable by more than one person.
- **Expires** (optional) — a deadline after which an unredeemed code stops working.
- **Sponsor label** (optional) — free text, e.g. "Masjid An-Noor Ramadan batch" —
  purely for your own records, members never see it.

Click **Mint vouchers**. The new codes appear immediately in a green box, and in the
table below. Give the code(s) to whoever should redeem them — they enter it on the
site themselves (self-serve redemption, not something you do on their behalf).

To **revoke** a code that hasn't been used yet (wrong batch, mistake, etc.), find it
in the table and click **Disable**. This only blocks *future* redemptions — if
someone already redeemed it, disabling the code does not take away their access.

## Looking up a member

Go to **Members** (`/admin/members`) and search by email or name. Click into a result
to see:
- **Account** — internal ID, whether they've ever logged in, Stripe customer ID.
- **Entitlements** — their subscription/membership status, plan, price, and renewal date.
- **Household** — whether they've set a parental PIN, and their kid profiles.

This page is **read-only by design** — you can look someone up to answer a support
question ("do I have access?", "when does my plan renew?"), but you cannot change
their billing, refund them, or grant/revoke access from here. That's deliberate: it
keeps support staff from being able to silently rewrite someone's billing.

**Cancel / refund a member** — this is **not** a button in `/admin` today. Two paths,
depending on the situation:
- **They want to cancel their own subscription**: they can do this themselves from
  `/account` on the site (Stripe's self-serve billing portal) — no admin needed.
- **You need to cancel or refund on their behalf** (a support case, a mistake, a
  goodwill refund): this is done directly in the **Stripe dashboard** — search for
  their email under Customers, and cancel/refund from there. If in doubt, ask whoever
  handles Stripe before refunding.
- **Granting free access instead of a refund**: mint them a voucher (above) — often
  simpler than a Stripe refund for a goodwill gesture.

## What's not here yet

- No bulk actions (e.g. publish 50 videos at once) — one video at a time.
- No way to upload a brand-new video from `/admin` — that's still a separate,
  founder/technical-side process (Bunny upload + a database row).
- No Dutch/Arabic-specific translation fields — see "translate a title" above, it's
  one shared title field for now.
- No in-admin refund/cancel button — see above, use Stripe directly.

If something you need isn't listed here, that's a real gap worth flagging — not a
case of "it must be hidden somewhere," the admin console is intentionally small and
grows as real day-to-day needs come up.
