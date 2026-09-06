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

Go to **People › All** (`/admin/people`; the old `/admin/members` link redirects there — AD 1.4,
2026-09-06) and search by name or email, or filter by user type / status. Click into a row to see
the Uscreen-style detail: **About** (language, email, display name), **Profile** (Lead/Member,
membership plan and status from the Uscreen export, lead source, UTM source, lifetime spent),
**Activity**, and the platform's own **Household** block (parental PIN, kid profiles). Editing
members is read-only until the member migration (T2).

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

## "Is this video already archived?" — the archive status page

**https://albunyaan-archief-status.vercel.app** — open it, paste an albunyaan.tv link,
a title or a video number, and it tells you where that video stands. No login, no NAS
access, no terminal. The same page also sits in the archive folder on the NAS itself as
`_ARCHIEF-STATUS.html` if you'd rather double-click it there.

It refreshes every hour on its own. Anyone with the link can open it, so treat it as
internal — it lists every title and its archive status, and it's blocked from search
engines but not password-protected.

Four possible answers:

| | What it means | Do something? |
|---|---|---|
| ✅ **Staat op de NAS** | Archived and verified, with the date | No |
| ⏳ **Komt nog** | Simply not its turn yet — shows queue position and an ETA from the measured rate | No |
| 🔁 **Vertraagd** | Fetching it stalled; it goes back in the queue automatically and usually arrives on a later attempt | Only if it's still blue after a few days |
| ⛔ **Niet opgehaald** | Uscreen returns an error (usually a 404 — the source is gone) | Yes, report it |

The one thing worth knowing: the archive does **not** work through the categories one by
one. It does everything members can see first, then the rest, in source order. So a
half-filled folder on the NAS is normal until the whole run is done — that's what ⏳ means,
and it is not a fault.

## What's not here yet

- No bulk actions (e.g. publish 50 videos at once) — one video at a time.
- No way to upload a brand-new video from `/admin` — that's still a separate,
  founder/technical-side process (upload to the viewing platform + a database row —
  note: the Bunny account was stopped on 2 Sep 2026 by team decision; the successor
  platform is chosen at cutover, filled from the NAS archive).
- No Dutch/Arabic-specific translation fields — see "translate a title" above, it's
  one shared title field for now.
- No in-admin refund/cancel button — see above, use Stripe directly.

If something you need isn't listed here, that's a real gap worth flagging — not a
case of "it must be hidden somewhere," the admin console is intentionally small and
grows as real day-to-day needs come up.
