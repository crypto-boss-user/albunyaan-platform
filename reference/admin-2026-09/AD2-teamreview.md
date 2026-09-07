# AD 2 — Teamreview Home + Settings + Subscriptions + Sales + Analytics + inloglink (NL / EN)

STATUS: gebouwd 2026-09-07 (sessie D deel 2), branch `exit-phase`, preview-pad `/admin` (login + TOTP vereist; teamleden zonder
adminaccount zien 404 — dat is de gate). Norm = `AD0-inventaris.md` §2.4–§2.8 (meting AD 0b van 2026-09-07) + SR 2b voor General/Domain/
Email templates/Snippets. Founder-antwoorden 2026-09-07 op inventaris-vragen 5–8 zijn de opdracht (VOORBEELD alleen op Home; Settings
compleet met settings-tabel; 11 plannen als data; Sales als lege lijst; Analytics als eigen pagina's zonder voorbeeldcijfers).
Schermafbeeldingen 1440 px per stap in `var/admin-referentie/ad2/stap-N/` (lokaal, gitignored), telkens naast het gemeten Uscreen-beeld
(`uscreen-*.png`). Tests: `apps/web/tests/admin-{home,settings,subscriptions,sales,analytics,inloglink}.spec.ts` (Playwright, admin-test).
Commits: AD 2.1 `c5e5038` · AD 2.2 `7024687` · AD 2.3 `17e548a` · AD 2.4 `aab30cb` · AD 2.5 `f50c408` · AD 2.6 `48fafb3`.

## NL

### Wat er staat (per sectie: preview-pad · Uscreen-beeld · wat wel/niet)

| Sectie | Preview-pad | Uscreen-beeld | Gebouwd | Bewust leeg/uitgeschakeld (met reden op de pagina) |
|---|---|---|---|---|
| Home (AD 2.1) | `/admin` | `stap-1/uscreen-home` | kopbalk "Welcome, <naam>.", blok "Last 30-day performance": Gross Revenue (VOORBEELD 841.02 EUR) · Sign Ups (echt: aanmeldingen ≤ 30 d) · Video Views (VOORBEELD 44,455), elk met View more; Recent activity (audit-log) eronder; zijmenu nu Home · Content · People · Subscriptions · Sales · Marketing · Analytics (6) · Settings (ondergroep) | VOORBEELD-label + tooltip "echte cijfers na betaal-/kijkplatformkoppeling"; Membership+-upsell niet nagebouwd |
| Settings (AD 2.2) | `/admin/settings` + 16 subpagina's | `stap-2/uscreen-settings-hub`, `uscreen-settings-checkout` | hub 3 groepen/14 kaarten (+ eigen kaart Team); General (store name, time zone, locale, adres, ToS-URL, maintenance), Snippets (3 velden), User fields (3), Marketing email (afzender), Video comments (view/post/aan-uit), Security (max devices), Geo-Blocking (lijst) — opslaan werkt via `admin_settings` (0014) met audit; Domain, Checkout (+ Localized Pricing), Email templates (21), Calendar push (9), Exported files (leeg), Webhooks (2 als tekst), Integrations (14 kaarten), Team (platform_admins) alleen tonen | Stripe/PayPal/tax/BNPL/valuta: uit "tot de betaalbeslissing"; DNS/domein = founder; mail-domein/topics/templates = mailbeslissing; captcha n.v.t. (magic link), DRM/device-afdwinging = kijkplatform; Team toevoegen/verwijderen = T2; secrets nooit getoond |
| Subscriptions (AD 2.3) | `/admin/subscriptions`, `/new`, `/<id>/edit` | `stap-3/uscreen-subscriptions-lijst`, `uscreen-subscriptions-plan-edit` | de 11 Uscreen-plannen als data in `plans` (naam, prijs, EUR, interval, proef, Public/Private, volgorde, apps-badge); lijst met de gemeten kolommen, zoeken, New plan; edit/new met alle gemeten velden; ⋯ → Delete (fail-closed op subscriptions/entitlements/vouchers/Stripe) | Performance overview leeg met reden; Members/In trial/Content per plan leeg (ledenmigratie/betaal); valuta's, Change price, Pausing, Reduce churn, Manage content: uit "koppeling aan betaalprovider volgt"; Image: kijkplatform |
| Sales › Invoices (AD 2.4) | `/admin/sales` → `/admin/sales/invoices` | `stap-4/uscreen-sales-invoices-lijst` | kop, kolommen Invoice · User · Created · Status · Paid at · Coupon · Total, filters en Export CSV zichtbaar, totaalregel "0 invoices • Total: €0.00" | alles uit "tot de betaalbeslissing"; geen voorbeeldrijen; factuurdetail niet gebouwd |
| Analytics (AD 2.5) | `/admin/analytics/{overview,content,people,sales,subscriptions,marketing}` | `stap-5/uscreen-analytics-*` | eigen pagina's met de gemeten tegels/tabs/filters/blokken; echt: People Total/Members/Leads + statusverdelingen (Uscreen-export in people.raw), sign-ups per periode (werkend periode-filter), Content-tabs met catalogus-tellingen, Coupons › Redemptions; Net Growth toont de aanmeldingen als regel | Net Sales/MRR/Gross/Payouts (betaal), Views/Viewers/Watch Time/Most Popular/Audience (kijkplatform), subscriptions-tegels (ledenmigratie), Email Broadcasts (mail); Community/Advanced niet (menunaam); geen export (Uscreen ook niet) |
| Inloglink (AD 2.6) | `/auth/confirm` → `/admin` | — | beheerder landt na de magic link op /admin (MFA-stap volgt automatisch); leden blijven naar /account | — |

### Ja/nee-vragen voor het team (advies = standaard)

1. **"Welcome, <naam>"** gebruikt het e-mailadres vóór de @ (Uscreen toont de accountnaam "fitrahmedia"). Naam uit `platform_admins.note` of vaste winkelnaam? (advies: note-veld vullen per beheerder)
2. **Home-tegels Gross Revenue / Video Views** dragen de meetwaarden van 07-09 als VOORBEELD. Zo laten tot de koppelingen, of de waarde weglaten en alleen het label tonen? (advies: zo laten)
3. **Settings › Snippets** worden bewaard maar door de storefront niet gelezen (de storefront is de repo). Akkoord dat injectie pas na een owner-/CSP-besluit komt? (advies: ja)
4. **Settings › Security › Max devices** (7) en **Geo-Blocking** (vrije tekst, geen landenlijst) worden bewaard maar niet afgedwongen tot het kijkplatform. Akkoord? (advies: ja; landenlijst bij afdwingen)
5. **Team-kaart** (eigen, niet in Uscreen) toont beheerders-e-mails voor admin/owner. Behouden? (advies: ja)
6. **Plannen-import** is niet-overschrijvend (een herdraai zet admin-bewerkingen niet terug). De twee aannames — plan 78091 "Connected to apps" als platform `web`, en `raw.members_gemeten` (ledentelling 07-09) in de rij — zijn dus alleen handmatig te corrigeren. Akkoord, of `members_gemeten` uit `raw` halen? (advies: akkoord; het zijn totalen)
7. **`raw` van de 2 publieke plannen** is anoniem leesbaar via de bestaande 0006-policy (totalen, geen PII). Accepteren tot de betaalbeslissing? (advies: ja)
8. **Subscriptions-lijst** toont geen "koopbaar"-kenmerk (Stripe-koppeling); na `stripe-setup` staan 2 native plannen naast de 2 publieke Uscreen-plannen. Kolom "Provider" toevoegen bij de betaalbeslissing? (advies: ja, dan)
9. **Rijmenu ⋯ → Delete** en de **proefdagen-invoer** bij Free trial zijn niet gemeten (Uscreen: menu niet geopend, B83). Behouden? (advies: ja)
10. **€0-plannen** zijn toegestaan in het formulier. Blokkeren? (advies: toestaan, gratis plan = mogelijk)
11. **Pausing** stond bij het gemeten plan aan; hier uit met reden "koppeling volgt". Akkoord? (advies: ja)
12. **Net Growth** (Analytics › Overview) is leeg met reden; de aanmeldingen staan als regel eronder. Liever de aanmeldingen als waarde met eigen titel? (advies: leeg laten tot churn/reactivatie bestaan)
13. **Analytics-tellingen** die niet periode-gebonden zijn (Coupons-redemptions, catalogus) staan onder een werkend periode-select met de tekst "totaal over alle tijd". Akkoord? (advies: ja)
14. **Analytics-prestatie**: 26 tellingen per pagina-load (exact, service-role). Akkoord tot na AD 2, dan per pagina beperken? (advies: ja)
15. **Test-hulp** `verwijderTestRijenWaar` beschermt op een tekstpatroon (pre-existing sinds AD 1). Strenger maken (alleen eigen ids)? (advies: ja, aparte T0-commit)
16. **Playwright-suite** is alleen stabiel met `--workers=2` tegen `next start` (4 workers → timeouts in /search, /categories en de videos-detailflow). `workers: 2` vastleggen in `playwright.config.ts`? (advies: ja, aparte T0-commit)

### Aannames (gemarkeerd, aanpasbaar)

- Video comments-instelling staat in Settings (Uscreen: onder People), breadcrumb "Settings › Video comments".
- Settings-velden zonder werking in de eigen stack worden bewaard in `admin_settings` en gelabeld "alleen bewaard"; betaal-/secret-velden hebben geen opslaanpad (whitelist per sectie).
- People-statusverdeling = de Uscreen-export (stand exportdatum): Active = active + new + reactivated + pending_cancellation; In Trial/Paused = 0 (geen rijen).
- Sales-filters tonen alleen de gemeten comboboxlabels (de opties zijn bij Uscreen niet geopend, B83).
- Marketing-analytics default = "anytime" (gemeten); Overview/Content/People 30 dagen, Sales 8 weken, Subscriptions 12 maanden (gemeten).

## EN

### What is there

Home in the Uscreen form (three 30-day tiles: Sign Ups real, Gross Revenue and Video Views labelled SAMPLE until the payment/video-platform
links exist), the full sidebar (Home, Content, People, Subscriptions, Sales, Marketing, Analytics ×6, Settings), a Settings hub with all 14
measured cards plus a Team card (saving works through the new `admin_settings` table; payment, DNS, mail and video-platform fields are
visible but disabled with the reason), Subscriptions with the 11 Uscreen plans imported as data (no member link, no payment link) and a
working New/Edit/Delete plan flow, Sales › Invoices as an empty list with the measured columns and filters, Analytics as six native pages with
the measured tiles/tabs/filters and real counts where the database has them (people, sign-ups per period, catalogue, coupon redemptions),
and a login link that sends admins to `/admin`.

### Yes/no questions (advice = default)

1. "Welcome, <name>" uses the e-mail local part; fill `platform_admins.note` per admin instead? (advice: yes)
2. Keep the measured sample values on the two Home tiles until the links exist? (advice: yes)
3. Snippets are stored but not injected into the storefront until an owner/CSP decision? (advice: yes)
4. Max devices and Geo-Blocking stored but not enforced until the video platform? (advice: yes)
5. Keep the extra Team card (admin e-mails visible to admin/owner)? (advice: yes)
6. Plan import is non-overwriting; two assumptions (plan 78091 → platform `web`; `raw.members_gemeten`) need manual correction. Accept? (advice: yes)
7. `raw` of the 2 public plans is anonymously readable (totals only). Accept until the payment decision? (advice: yes)
8. Add a "Provider" column to the plan list at the payment decision? (advice: yes, then)
9. Keep the unmeasured row menu Delete and trial-days input? (advice: yes)
10. Allow €0 plans? (advice: yes)
11. Pausing shown off (measured on) with the reason "link follows"? (advice: yes)
12. Net Growth empty with the sign-ups as a line, until churn/reactivation exist? (advice: yes)
13. Non-period counts under a working period filter, labelled "all-time total"? (advice: yes)
14. 26 exact counts per Analytics page load acceptable until after AD 2? (advice: yes)
15. Tighten the test cleanup helper to own ids only (separate T0 commit)? (advice: yes)
16. Pin `workers: 2` in the Playwright config (separate T0 commit)? (advice: yes)

### How to review

Log in on the preview with an admin account (magic link → `/admin` → TOTP), walk the sidebar top to bottom, and compare each page with
the `uscreen-*.png` next to it in `var/admin-referentie/ad2/stap-N/`. Everything disabled carries its reason in a tooltip or a line of text.
