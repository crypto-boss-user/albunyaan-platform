# Inloggen op het beheerdersdashboard — handleiding voor de founder (NL / EN)

STATUS: geschreven 2026-09-07 (sessie D deel 1b, B70). Account `info@albunyaan.tv` bestaat sinds 07-09 als beheerder (rol owner) in de
cloud-Supabase; er is géén wachtwoord — inloggen gaat via een e-maillink plus een authenticator-app. Schermafbeeldingen (1440 px) staan
in `ad1b-2026-09-07/` naast dit bestand. Het testaccount `admin-test` blijft bestaan voor de automatische tests (zie `docs/cutover-runbook.md`).

> ⚠️ **Eerst lezen — de link in de mail werkt nu nog niet.** Bij de meting van 07-09 verstuurt Supabase de mail wél (twee keer
> geaccepteerd, zie §Meting), maar de link in die mail wijst naar `http://localhost:3000`, omdat de **Site URL** in het Supabase-dashboard
> nog op de fabrieksinstelling staat. Dat is stap C uit `docs/founder-runbook.md` en kan alleen de founder doen (dashboard-login;
> het Management-token op deze Mac is verlopen). Doe eerst:
> 1. Supabase-dashboard → project `albunyaan-platform` → **Authentication → URL Configuration → Site URL** = de preview-URL hieronder
>    (later: `https://albunyaan.tv`).
> 2. Zelfde scherm → **Redirect URLs**: voeg `https://albunyaan-web-git-exit-phase-crypto-boss-users-projects.vercel.app/auth/confirm` toe.
> 3. **Authentication → Email Templates → Magic Link**: plak de inhoud van `supabase/templates/magic_link.html` uit de repo (de link
>    moet naar `/auth/confirm?token_hash=…` wijzen, niet naar de standaard Supabase-verify-link).
>
> Daarna opnieuw bij stap 2 beginnen en een **nieuwe** link aanvragen; oude mails zijn dan ongeldig.

## NL — in zes stappen

**Stap 1 — Open de preview.** Ga naar
`https://albunyaan-web-git-exit-phase-crypto-boss-users-projects.vercel.app/login`.
De preview is afgeschermd door Vercel: ingelogd in je Vercel-account kom je er direct in. Voor teamleden zonder Vercel-toegang hoort er een
bypass-code achter de link; die code staat in de Vercel-projectinstellingen (Deployment Protection) en deel je zelf — hij staat bewust
niet in dit document en niet in de repo. Je ziet het inlogscherm (afbeelding `01-login.png`).

**Stap 2 — Vul je e-mailadres in.** Typ `info@albunyaan.tv` en klik op **Email me a login link**. Je ziet daarna "Check your email"
(afbeelding `03-mail-melding.png`). Er is geen wachtwoord.

**Stap 3 — Klik de link in de mail.** Open de mailbox van info@ en klik op de knop in de mail van Albunyaan TV. Je komt op een pagina
"Almost there" met één knop **Continue to Albunyaan** (afbeelding `04-auth-confirm.png`) — klik die. (De extra klik is bewust: zo kan een
mailscanner de link niet per ongeluk opmaken.) De link werkt één keer en is een uur geldig; heb je meerdere mails, gebruik dan de nieuwste.

**Stap 4 — Koppel je authenticator-app (alleen de eerste keer).** Na "Continue" kom je op de pagina **Set up two-factor authentication**
met een QR-code en, daaronder, dezelfde sleutel als tekst. Open Google Authenticator, 1Password, Microsoft Authenticator of een vergelijkbare
app, kies "account toevoegen" en scan de QR-code (of typ de sleutel over). Bewaar deze koppeling: bij elke volgende login vraagt het
dashboard om een code uit deze app. Van deze pagina is geen schermafbeelding gemaakt: daarvoor had ik als jouw account moeten inloggen of een
extra account moeten aanmaken, en dat viel buiten de opdracht. De pagina ziet er verder uit als afbeelding `05-mfa-code.png`, met de QR-code erbij.

**Stap 5 — Voer de 6-cijferige code in.** Typ de code die de app toont in het vak en klik op **Verify & enter admin** (eerste keer) of
**Unlock admin** (elke volgende keer, afbeelding `05-mfa-code.png`). De code wisselt elke 30 seconden; is hij net verlopen, wacht dan op de volgende.

**Stap 6 — Je bent binnen.** Je ziet het dashboard "Admin console" met links het menu Content · People · Marketing en linksonder je
rol **owner** (afbeelding `06-admin-home.png`). Uitloggen: knop **Sign out** linksonder.

**Als de mail niet komt.**
1. Kijk in de map Ongewenst/Spam van info@ (de afzender is de standaard Supabase-mailer zolang stap B uit `docs/founder-runbook.md` — eigen
   afzender via Resend — nog niet is ingesteld).
2. Wacht een minuut en vraag hooguit één keer opnieuw aan: Supabase weigert een tweede aanvraag binnen 60 seconden ("Too many attempts") en
   verstuurt met de standaard-mailer maximaal 2 mails per uur.
3. Komt er dan nog niets: meld het in de sessie, met het tijdstip van de aanvraag. Vraag geen link aan voor andere adressen — alleen info@ is beheerder.

## EN — six steps

**Step 1 — Open the preview.** Go to
`https://albunyaan-web-git-exit-phase-crypto-boss-users-projects.vercel.app/login`.
The preview is protected by Vercel: signed in to your Vercel account you get straight in. Team members without Vercel access need the bypass
code appended to the link; it lives in the Vercel project settings (Deployment Protection) and you share it yourself — deliberately not in
this document or the repo. You see the login screen (`01-login.png`).

**Step 2 — Enter your email address.** Type `info@albunyaan.tv` and click **Email me a login link**. You then see "Check your email"
(`03-mail-melding.png`). There is no password.

**Step 3 — Click the link in the email.** Open the info@ mailbox and click the button in the Albunyaan TV email. You land on a page
"Almost there" with a single button **Continue to Albunyaan** (`04-auth-confirm.png`) — click it. (The extra click is deliberate so an email
scanner cannot burn the link.) The link works once and expires after an hour; with several emails, use the newest.

**Step 4 — Link your authenticator app (first time only).** After "Continue" you reach **Set up two-factor authentication** with a QR code
and the same key as text below it. Open Google Authenticator, 1Password, Microsoft Authenticator or similar, choose "add account" and scan
the QR code (or type the key). Keep this: every later login asks for a code from this app. No screenshot was taken of this page: it would
have required logging in as your account or creating an extra account, both outside the brief. Apart from the QR code it looks like `05-mfa-code.png`.

**Step 5 — Enter the 6-digit code.** Type the code from the app and click **Verify & enter admin** (first time) or **Unlock admin**
(every later time, `05-mfa-code.png`). The code changes every 30 seconds; if it just expired, wait for the next one.

**Step 6 — You are in.** You see the "Admin console" dashboard with the menu Content · People · Marketing on the left and your role
**owner** bottom-left (`06-admin-home.png`). Sign out: **Sign out** button bottom-left.

**If the email does not arrive.** Check the Junk/Spam folder of info@ first (the sender is Supabase's default mailer until step B of
`docs/founder-runbook.md` — own sender via Resend — is configured). Wait a minute and request at most once more: Supabase rejects a second
request within 60 seconds ("Too many attempts") and the default mailer sends at most 2 emails per hour. Still nothing: report it in the
session with the time of the request. Do not request links for other addresses — only info@ is an administrator.

**Before reading step 1 (EN version of the warning above):** the link in today's emails points to `http://localhost:3000` because the
Supabase **Site URL** is still the factory default. Only the founder can fix this (dashboard login; the Management token on this Mac has
expired): Authentication → URL Configuration → Site URL = the preview URL; Redirect URLs += `<preview>/auth/confirm`; Email Templates →
Magic Link = `supabase/templates/magic_link.html`. Then request a fresh link — older emails become invalid.

## Meting 2026-09-07 (wat bewezen is en wat niet)

| Onderdeel | Gemeten | Bewijs |
|---|---|---|
| Rooktest hook | `git commit -m "x"` geweigerd vóór git draaide | sessielog |
| Vóór | auth-users 1 (alleen admin-test), `platform_admins` 1, geen `people`-rij voor info@ | GoTrue admin-API + REST count=exact |
| Toevoegen | auth-user info@ (e-mail bevestigd, geen wachtwoordveld, 0 factors) + `platform_admins` owner | HTTP 200 / 201 |
| Na | auth-users 2, `platform_admins` 2 (= vóór + 1), 1 `people`-rij source `native` via de bestaande signup-trigger (0003) | idem |
| Maildienst | code: `signInWithOtp` → Supabase-mailer (geen eigen Resend-route voor de login-mail; `lib/resend.ts` dient alleen het contactformulier); SMTP-instelling niet leesbaar (Management-token 401) | `app/auth/actions.ts` |
| Afzenderdomein | Resend-DNS voor `albunyaan.tv` staat (DKIM `resend._domainkey` TXT, MX `send` → amazonses eu-west-1, SPF `send`); verificatiestatus bij Resend niet leesbaar (API-key is send-only) | `dig` |
| Site URL | `http://localhost:3000` (fabrieksinstelling) → link in de mail werkt niet buiten deze Mac | `generate_link` redirect_to |
| Mail geaccepteerd | ja: `recovery_sent_at` 08:19:46Z (aanvraag 1) en 08:21:29Z (aanvraag 3, app-status "sent"); aanvraag 2 binnen 60 s → 429 "Too many attempts" | GoTrue admin-API + `ad1b-flow.json` |
| Aankomst mail | **niet gemeten** — info@ is een Outlook-mailbox, niet zichtbaar vanaf deze Mac | — |
| Flow na de klik | bewezen met admin-test op de preview: `/auth/confirm` → Continue → `/admin` → `/admin/mfa` (step-up); `/admin/mfa/enroll` met bestaande factor → `/admin/mfa`; TOTP → `/admin` "Admin console" | `ad1b-flow.json` deel B |
| Onbewezen | de klik van de founder zelf (en dus de eerste QR-koppeling van info@) | — |
