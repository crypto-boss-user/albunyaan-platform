# AD-werklijst — eigen `/admin` ↔ Uscreen-admin (HEEFT / WIJKT AF / ONTBREEKT)

STATUS: opgesteld 2026-09-06 (AD 0 stap 3); **bijgewerkt 2026-09-06 na AD 1 deel 1 (stappen 1–5 gebouwd)** — zie §7 voor gedaan/open. Norm = `AD0-inventaris.md`. Eigen kant gemeten op `next start :3012` (productiebuild van
05-09, cloud-env, alleen lezen) én uit de code (`apps/web/app/admin/**`, `packages/core/src/data/admin-*.ts`, `apps/web/lib/admin.ts`).
Anoniem geven `/admin`, `/admin/videos`, `/admin/videos/<id>`, `/admin/members`, `/admin/members/<id>`, `/admin/vouchers`, `/admin/mfa`,
`/admin/mfa/enroll` alle **307 → /login**; `/admin/collections`, `/admin/categories`, `/admin/coupons` geven **404** (geen route). Een
ingelogde vergelijking was niet mogelijk (geen admin-account met TOTP in deze sessie) — de functionele kant hieronder komt uit de code.

**Wat de eigen admin nu is:** kopbalk met Videos · Vouchers · Members + Sign out (geen zijmenu, storefront-tokens Cairo/#447525);
dashboard met 3 kaarten + laatste 12 auditregels; `/admin/videos` (zoeken op titel, status-tabs All/Published/Draft/Scheduled/Live,
30 per pagina, kolommen Title/Status/Access/Age/Duration/Bunny, knop Publish/Unpublish); `/admin/videos/<id>` (Title, Short
description, Description als textarea, Status, Access, Age rating); `/admin/members` (zoeken ≥ 2 tekens, max 30, alleen lezen) +
detail (persoon, entitlements, household, profielen); `/admin/vouchers` (lijst 100, batch aanmaken, disable); `/admin/mfa` (TOTP,
aal2 verplicht). Gate: sessie → roster `platform_admins` → aal2 → rol (owner ⊃ admin ⊃ editor ⊃ support); data-laag service-role-only.

Oordelen: **HEEFT** = aanwezig en gelijk genoeg · **WIJKT AF** = aanwezig, andere vorm/velden · **ONTBREEKT** = niet aanwezig ·
**WACHT** = pas na kijkplatform- (KP), betaal- (BT), maildienst- (MD) of ledenmigratie-beslissing (LM); wordt nu eerlijk leeg/uitgeschakeld getoond.
Tier per `albunyaan-change-control`: T1 = UI/CRUD op content via de bestaande service-role-laag; **T2** zodra auth/RLS/leden/entitlements/geld
geraakt wordt; T3 = sends.

## §1 Raamwerk

| Element (Uscreen) | Eigen admin | Oordeel | Stap | Tier |
|---|---|---|---|---|
| Zijmenu 271 px met alle secties in Uscreen-volgorde (uitgesloten secties weglaten) | kopbalk met 3 links | WIJKT AF | AD 1 | T1 |
| Kopbalk: sidebar-toggle + breadcrumb | geen | ONTBREEKT | AD 1 | T1 |
| Tokens Inter / blauw `215 100% 50%` / kaarten / badges (§3 inventaris), apart van storefront | storefront-tokens | WIJKT AF | AD 1 | T1 |
| Elke sectie een route; niet-gebouwde sectie = gemeten kop + "Nog niet gebouwd — AD stap N" | 404 | ONTBREEKT | AD 1 | T1 |
| Admin-auth + MFA vóór elke pagina | requireAdmin (aal2) | HEEFT | — | (niet versoepelen) |
| Accountwisselaar / Changelog / Get help / Refer to Uscreen / factuurbanner | — | BUITEN SCOPE | — | — |

## §2 Content (bouwvolgorde 1)

| Handeling (Uscreen) | Eigen admin | Oordeel | Stap | Tier / wacht |
|---|---|---|---|---|
| Videos-lijst: thumbnail+duur, titel, statusbadge, Uploaded on, [⋯] | tabel Title/Status/Access/Age/Duration/Bunny | WIJKT AF | AD 2 | T1 |
| Zoeken op titel | ilike op titel | HEEFT | — | — |
| Status-filter als combobox; "More filters"; sorteerknop | status-tabs, geen sortering | WIJKT AF | AD 2 | T1 |
| Paginering "Showing 1–30 of N", paginanummers, Rows per page | Prev/Next + "Page x of y", 30 vast | WIJKT AF | AD 2 | T1 |
| Bulk-selectie per rij + bulkacties | geen | ONTBREEKT | AD 2 (selectie + publish/unpublish) | T1 |
| Upload videos (.mp4/.mov/.avi, Dropbox) | geen | WACHT KP | AD 2: knop aanwezig, uitgeschakeld "na kijkplatformkeuze" | — |
| Video-detail: Title, Description rich text + HTML, Short description ≤ 140 | textarea's | WIJKT AF | AD 2 | T1 |
| Thumbnails (1480×840) + Featured category | geen (thumbnail_url in DB) | WIJKT AF: cover-URL uit het archief tonen/kiezen, geen upload | AD 2 | T1 |
| Organize: categorie-chips, authors, custom filters | geen | ONTBREEKT | AD 2 (categorieën + filters; authors leeg) | T1 |
| SEO (page title, URL-slug, meta description) + Search keywords | geen (seo jsonb, slug) | ONTBREEKT | AD 2 | T1 |
| Visibility Unpublished/Published/Scheduled + expiration | Status draft/published/scheduled/live | WIJKT AF (naamgeving) | AD 2 | T1 |
| Access Gated / Free for all users | Access subscription/free | HEEFT (andere labels) | AD 2 | T1 |
| Subscription & Pricing (plannen, extra prijzen) | geen | WACHT BT | AD 2: alleen tonen wat de DB kent | T2 |
| Subtitles, Audio track, Preview/Trailer, Request download/Replace, View on website | geen (subtitle_tracks/audio_tracks jsonb) | WACHT KP (tonen als lijst, geen upload) | AD 2 | — |
| Age rating (eigen, niet in Uscreen) | aanwezig | EXTRA — behouden in detail (vraag 1 inventaris) | — | — |
| Collections-lijst (thumbnail, titel, status, created; zoeken; statusfilter; paginering 12) | geen route | ONTBREEKT | AD 2 | T1 |
| Collection-detail: About/SEO/keywords/organize zoals video | geen | ONTBREEKT | AD 2 | T1 |
| Playlist: volgorde slepen, video toevoegen/verwijderen, "Available for free", pin, Drip, dividers | geen (`collection_items.position`) | ONTBREEKT (slepen + toevoegen/verwijderen; Drip/divider = WACHT KP) | AD 2 | T1 |
| Add new collection (Uscreen: direct aanmaken) | geen | ONTBREEKT — eigen vorm: formulier eerst, dan aanmaken | AD 2 | T1 |
| Delete collection / Geo-blocking | geen | ONTBREEKT (delete met bevestiging) / geo = WACHT KP | AD 2 | T1 |
| Categories-lijst: slepen (volgorde), titel, telling, Add category | geen (`categories.position`) | ONTBREEKT | AD 2 | T1 |
| Category-edit: titel, positie, beschrijving, Sort content by, Randomize, Add content, tabel met slepen, image, SEO, delete | geen (`category_items.position`) | ONTBREEKT | AD 2 | T1 |
| Resources: lijst 107, upload | geen (`videos.resources` jsonb) | ONTBREEKT (lijst uit archief) / upload WACHT KP | AD 2 | T1 |
| Custom filters: 2 filters, opties, slepen, dialoog | geen (`filters`-tabel) | ONTBREEKT | AD 2 | T1 |
| Authors: leeg, New author-formulier | geen | ONTBREEKT — eerlijk leeg + formulier | AD 2 | T1 |

## §3 People (bouwvolgorde 2)

| Handeling (Uscreen) | Eigen admin | Oordeel | Stap | Tier / wacht |
|---|---|---|---|---|
| Lijst 3.051: naam+e-mail, Tags, Status, Lifetime, Creation date; paginering 25 | zoekresultaat max 30, geen lijst zonder zoekterm | WIJKT AF | AD 3 | T1 (lezen) |
| Zoeken op naam of e-mail | ilike e-mail/naam | HEEFT | — | — |
| Filters user type / status / tags, More filters | geen | ONTBREEKT (status uit subscriptions; tags bestaan niet) | AD 3 | T1 |
| Add member | geen | WACHT LM | AD 3: knop uitgeschakeld | T2 |
| Detail: Age, Country, Preferred Language, Private notes, Email, Display Name, Tags | persoon + entitlements + household | WIJKT AF: velden tonen zoals de DB ze kent (language, legacy_cohort), bewerken = T2 | AD 3 | T2 (bewerken) |
| Membership + Add membership, Lead source, UTM, Lifetime spent | entitlements/plans | WIJKT AF (alleen tonen) | AD 3 | T2 |
| Invoices, Emails, Activity, Watch history | geen | ONTBREEKT — WACHT BT/MD (eerlijk leeg) | AD 3 | — |
| Email Topic notifications (4 schakelaars) | geen | WACHT MD | AD 3 | — |
| Bundle access / Content access | geen | BUITEN SCOPE (bundles) / WACHT KP | — | — |
| Audiences · Tags · Comments | geen | alleen menunaam (B81) | AD 1 (route met "Nog niet gebouwd") | — |

## §4 Marketing (bouwvolgorde 3)

| Handeling (Uscreen) | Eigen admin | Oordeel | Stap | Tier / wacht |
|---|---|---|---|---|
| Hub met 3 groepen en kaarten | dashboard met 3 kaarten | WIJKT AF | AD 4 | T1 |
| Coupons-lijst: Coupon, Discount, Redeemed, Status, Expires; zoeken op code; 3 filters; Stats | vouchers: code, plan, days, max, count, status, expires, sponsor | WIJKT AF | AD 4 | T1 |
| New coupon: Code, Percentage/Fixed, description, Never/Expires on, No limit/Limit to, 3 usage rules, product-type | CreateVoucherForm (plan, duration, max, expires, sponsor, count) | WIJKT AF — velden naar Uscreen-vorm; Percentage/Fixed + product-type = WACHT BT (tonen, geen werking) | AD 4 | T1 (voucher-tabel) / T2 (geld) |
| Deactiveren | setVoucherStatus disabled | HEEFT | — | — |
| Landing pages: lijst 9 + Create a page | geen | ONTBREEKT — lijst uit SR 2b-export; page builder buiten scope | AD 4 (lijst) | T1 |
| Email capture, Email broadcasts, Automations | geen | WACHT MD (lijsten eerlijk leeg; broadcasts-geschiedenis 1 uit meting tonen?) | AD 4 | T3 bij sends |
| Push notifications (5 verzonden) | `send-push-notification.mjs` met manhaj-gate (buiten admin) | WIJKT AF — geschiedenis tonen, versturen blijft gated | AD 4 | T3 |
| Link in Bio, Giveaway, YouTube lead, Gifts, Subscription upsell, Abandoned cart | geen | ONTBREEKT — eerlijk leeg ("Nog niet gebouwd — AD 4"), bouw na BT/MD | AD 4 | — |
| Refer a friend · Try again for free · Bundles | — | BUITEN SCOPE (B81) | — | — |

## §5 Tellingen en bouwvolgorde

| Oordeel | Raamwerk | Content | People | Marketing | Totaal |
|---|---|---|---|---|---|
| HEEFT | 1 | 2 | 1 | 1 | **5** |
| WIJKT AF | 2 | 7 | 3 | 4 | **16** |
| ONTBREEKT | 2 | 13 | 2 | 3 | **20** |
| WACHT (KP/BT/MD/LM) | 0 | 4 (deels in andere rijen) | 4 | 3 | **11** |
| BUITEN SCOPE / naam | 1 | 0 | 2 | 1 | **4** |

Bouwvolgorde (SR-model, elk = één sessie-deel, per stap één commit + Playwright-structuurtest + screenshot 1440 naast het Uscreen-beeld):
1. **AD 1 raamwerk** (T1): admin-layout met zijmenu in Uscreen-volgorde, kopbalk/breadcrumb, admin-tokens (apart bestand, storefront-suite blijft groen), route per sectie met "Nog niet gebouwd — AD stap N". Test: menu-volgorde == `menu-inventaris.json`; elke route 307 → /login anoniem (200 ingelogd in de e2e-admin-gate-harness).
2. **AD 2 Content** (T1; tellingen met paginering): Videos-lijst + detail in Uscreen-vorm; Collections (lijst, detail, playlist-volgorde slepen, toevoegen/verwijderen); Categories (lijst met slepen, edit met content-volgorde en sortering); Resources-lijst; Custom filters; Authors leeg. Upload/subtitles/audio/preview/pricing = uitgeschakeld met reden.
3. **AD 3 People** (T1 lezen, T2 bewerken): lijst met de gemeten kolommen + filters, detail in Uscreen-vorm met DB-velden; bewerken/Add member/Add membership uitgeschakeld tot de ledenmigratie (LM).
4. **AD 4 Marketing** (T1 vouchers, T3 sends): hub, coupons in Uscreen-vorm op de vouchers-tabel, landing-pages-lijst, geschiedenis van broadcasts/push (alleen lezen), overige kaarten eerlijk leeg.

## §6 Teamsamenvatting

**NL.** Op 2026-09-06 is de Uscreen-admin gemeten (51 leesbeurten, 30 pagina's, 91 artefacten, kopie op de NAS). Het menu, de
lijsten, de formulieren en de stijl staan nu vast in `AD0-inventaris.md`. De eigen admin heeft al de beveiliging (login + TOTP),
een videolijst met zoeken en publiceren, een ledenzoeker en vouchers. Wat ontbreekt: het zijmenu en de Uscreen-look, collecties en
categorieën (inclusief volgorde slepen), resources, filters, de ledenlijst met kolommen en filters, en de marketing-secties.
Uploads, ondertitels, prijzen, e-mails en ledenbewerking wachten op de kijkplatform-, betaal-, mail- en ledenmigratie-beslissingen en
worden tot dan eerlijk leeg of uitgeschakeld getoond. Bouwvolgorde: raamwerk → Content → People → Marketing.

**EN.** On 2026-09-06 the Uscreen admin was measured read-only (51 page loads, 30 pages, 91 artefacts, copy on the NAS). Menu,
lists, forms and styling are recorded in `AD0-inventaris.md`. Our own admin already has the security gate (login + TOTP), a video
list with search and publish toggle, a member lookup and vouchers. Missing: the sidebar and Uscreen look, collections and
categories (including drag ordering), resources, custom filters, the member list with columns and filters, and the marketing
sections. Uploads, subtitles, pricing, e-mail and member editing wait for the playback-platform, payment, mail and member-migration
decisions and are shown honestly empty or disabled until then. Build order: framework → Content → People → Marketing.

## §7 Stand na AD 1 deel 1 (2026-09-06) — gedaan / open

**Gedaan (commits AD 1.1 `9ed99e7`, AD 1.2 `0bfdb59`, AD 1.3 `08e0758`, AD 1.4 `d6615e3`, AD 1.5 `3c77c59`):**
raamwerk (zijmenu, kopbalk, tokens, 21 routes); Videos lijst + detail (alle rijen van §2 behalve WACHT); Collections lijst/nieuw/detail/
playlist-volgorde/toevoegen/verwijderen/delete; Categories lijst met slepen/nieuw/edit/content-volgorde/sortering/add/delete; Resources-lijst;
Custom filters als data + beheer + per-video toewijzing; Authors leeg; People lijst + detail (alleen lezen) met filters; Marketing hub;
Coupons op vouchers in Uscreen-vorm (aanmaken met eigen code, deactiveren, filters); Landing pages lijst + detail (instellingen + tekst).
Tests: 11 admin-structuurtests (Playwright, admin-test), storefront-suite ongewijzigd groen.

**Open (bewust, met reden op de pagina):** upload/replace/subtitles/audio/preview (kijkplatform); pricing/plannen, coupon-percentage/
producttypes, invoices (betaalbeslissing); e-mail/push/automations (maildienst); ledenbewerking, Add member/membership (ledenmigratie, T2);
Drip/dividers; category description/image/SEO en collection page title/meta (geen kolommen); Authors-formulier (tabel leeg); page builder
(buiten scope); 10 Marketing-kaarten als placeholder. Teamvragen: `AD1-teamreview.md`.

## §8 Home (AD 0b, meting 2026-09-07 — bouwvolgorde AD 2.1)

| Handeling (Uscreen) | Eigen admin | Oordeel | Stap | Tier / wacht |
|---|---|---|---|---|
| Welkomstkop + blok "Last 30-day performance" met 3 tegels | `/admin` dashboard: 3 navigatiekaarten + Recent activity | WIJKT AF | AD 2.1 | T1 |
| Tegel Gross Revenue (30 d) + View more | geen | WACHT BT — tegel tonen met label VOORBEELD (B84) | AD 2.1 | — |
| Tegel Sign Ups (30 d) + View more | geen (`people.signup_at` bestaat) | ONTBREEKT — telling uit `people` (paginering/count) | AD 2.1 | T1 |
| Tegel Video Views (30 d) + View more | geen (`watch_progress` alleen eigen platform) | WACHT KP — tegel VOORBEELD tot kijkplatform | AD 2.1 | — |
| Membership+-upsell | — | BUITEN SCOPE (Uscreen-reclame) | — | — |
| Recent activity (eigen, niet in Uscreen) | aanwezig | EXTRA — behouden onder de tegels (vraag 5 inventaris) | — | — |

## §9 Settings (AD 0b — bouwvolgorde AD 2.2)

| Handeling (Uscreen) | Eigen admin | Oordeel | Stap | Tier / wacht |
|---|---|---|---|---|
| Hub met 3 groepen en 14 kaarten (titel + uitlegregel) | geen Settings-route | ONTBREEKT | AD 2.2 | T1 |
| General settings (SR 2b: store name, contact, valuta …) | geen (waarden staan in code/env) | ONTBREEKT — alleen tonen wat de app kent, niet bewerkbaar | AD 2.2 | T1 |
| Domain settings (SR 2b) | Vercel/DNS buiten de app | WACHT (DNS = founder, B61) — tekstkaart | AD 2.2 | — |
| Checkout: Stripe/PayPal koppelen, tax, localized pricing, donations, cover fees, BNPL | geen | WACHT BT — kaarten met status "wacht op betaalbeslissing" | AD 2.2 | — |
| Snippets (SR 2b: CSS/head/checkout-code) | geen | ONTBREEKT — WACHT (storefront-code is de repo; alleen tonen) | AD 2.2 | — |
| User fields (3 tekstvelden bij checkout) | geen signup | WACHT LM — velden tonen, uitgeschakeld | AD 2.2 | — |
| Marketing email settings: afzender, custom domain, topics (3 systeem) | Resend (contactformulier) / Brevo (marketing) buiten admin | WACHT MD — afzender/domein alleen tonen (Resend-DNS staat) | AD 2.2 | — |
| Email templates (SR 2b: 22 sjablonen) | Supabase-templates in `supabase/templates/` (2) | WIJKT AF — lijst tonen, bewerken WACHT MD | AD 2.2 | — |
| Calendar push templates (9 rijen) | geen | WACHT KP/MD — tabel als tekst | AD 2.2 | — |
| Video comments: view/post-toegang + aan/uit | `video_comments`-tabel (0 rijen), geen instelling | ONTBREEKT — 2 comboboxen + radio als instelling (tabel `content_overrides`/nieuw) | AD 2.2 | T1; T2 als storefront het leest |
| Exported files (lijst exports, 6 p.) | geen exports | ONTBREEKT — lege lijst met de kolommen; export zelf per sectie later | AD 2.2 | T1 |
| Webhooks (URL/Event/Status/Last delivery/Created; 2 actief naar int.albunyaan.tv) | geen | WACHT LM/BT — lijst tonen (de 2 bestaande als tekst), aanmaken uit | AD 2.2 | — |
| Integrations (13 kaarten; GA/Facebook/Mailchimp gekoppeld; Zapier-sleutel) | geen (5 zaps gaan uit bij cutover, founder-runbook) | WACHT MD — kaarten eerlijk "niet gekoppeld"; nooit sleutels tonen | AD 2.2 | — |
| Security: captcha, device limit 7, DRM | Supabase-auth (magic link + TOTP admin) | WIJKT AF — captcha n.v.t. (magic link), device limit/DRM WACHT KP | AD 2.2 | — |
| Geo-Blocking (0 landen) | geen | WACHT KP — schakelaar uit met reden | AD 2.2 | — |
| Website builder (Themes/Preferences/Pages) | storefront = repo | BUITEN SCOPE (founder 07-09) | — | — |

## §10 Subscriptions (AD 0b — bouwvolgorde AD 2.3, beheer zonder betaalkoppeling)

| Handeling (Uscreen) | Eigen admin | Oordeel | Stap | Tier / wacht |
|---|---|---|---|---|
| Lijst 11 plannen: Plan (+ apps-badge), Visibility, In trial, Members, Content, Price, Billing; zoeken | geen route; `plans`-tabel 0 rijen | ONTBREEKT — lijst op `plans` (title/platform/visibility/amount_cents/billing_period/trial_days); import van de 11 = vraag 7 | AD 2.3 | T1 |
| Performance overview (members, on trial, MRR) + See breakdown | geen (`subscriptions` 0 rijen) | WACHT BT/LM — tegels VOORBEELD | AD 2.3 | — |
| New plan / Edit: naam, beschrijving rich text, afbeelding 995×560, billing period, prijs + 4 valuta | geen | ONTBREEKT — formulier op `plans`-kolommen (naam, beschrijving, interval, prijs, zichtbaarheid); valuta/Change price WACHT BT | AD 2.3 | T2 (raakt entitlement-model) |
| Free trial, Pausing, Reduce cancellation churn (schakelaars) | `plans.trial_days` | WIJKT AF — trial als getal; pausing/churn WACHT BT | AD 2.3 | — |
| Visibility Public/Private | `plans.visibility` | HEEFT (kolom) — UI ONTBREEKT | AD 2.3 | T1 |
| Content per plan (Manage content, Remove all, telling videos/collections/live) | `entitlements` (0 rijen) | WACHT BT/KP — telling tonen zodra entitlements gevuld | AD 2.3 | — |
| Members-link per plan → People-filter | People-lijst zonder planfilter | ONTBREEKT — filter op plan zodra `subscriptions` gevuld | AD 3/LM | — |

## §11 Sales (AD 0b — bouwvolgorde AD 2.4, beheer zonder betaalkoppeling)

| Handeling (Uscreen) | Eigen admin | Oordeel | Stap | Tier / wacht |
|---|---|---|---|---|
| Invoices-lijst 3.134: Invoice, User, Created, Status, Paid at, Coupon, Total; paginering 25 | geen (geen facturentabel; `stripe_events` 0) | WACHT BT — lege lijst met de kolommen en de tekst "facturen komen uit de betaalkoppeling" | AD 2.4 | — |
| Filters All Statuses / sortering / More Filters / zoeken | geen | WACHT BT | AD 2.4 | — |
| Export CSV | geen | WACHT BT | AD 2.4 | — |
| Factuurdetail | geen | WACHT BT | AD 2.4 | — |
| Totaalregel "N invoices • Total €" | geen | WACHT BT | AD 2.4 | — |

## §12 Analytics (AD 0b — bouwvolgorde AD 2.5; Omni-embed bij Uscreen, eigen tegels bij ons)

| Pagina (Uscreen) | Eigen bron | Oordeel | Stap | Tier / wacht |
|---|---|---|---|---|
| Overview: Net Sales, Active Users %, MRR, Watch Time, Active Subscriptions, Net Growth; periode + vergelijk | `people`, `subscriptions` (0), `watch_progress` | WIJKT AF — tegels met echte tellingen waar de DB ze heeft, VOORBEELD-label voor de rest; periode-keuze 30 d/vorige periode | AD 2.5 | T1 |
| Content: Views, Viewers, Watch Time, Most Popular; tabs Videos/Live/Collections/Calendar/Authors | `watch_progress` (eigen platform) | WACHT KP — structuur + VOORBEELD | AD 2.5 | — |
| People: Users (Total/Members/One-time/Leads), Members by Subscription Status, Active Members by Activity Status | `people` (3.051 met lead/member-type), `subscriptions` (0) | WIJKT AF — Users-tegel echt (lead 1.462 / member 1.589 gemeten), statusverdeling WACHT LM | AD 2.5 | T1 |
| Sales: Gross/Net/Number of Sales, grafieken, Sales/Coupon Report, Net Sales by Customer, Payouts | geen | WACHT BT — kop + filters als structuur, VOORBEELD | AD 2.5 | — |
| Subscriptions: In Trial, Active, Via API, Migrated, MRR; tabs Trials/New/Engagement/Churn/MRR/Benchmarks | `subscriptions` (0) | WACHT LM/BT — structuur + VOORBEELD | AD 2.5 | — |
| Marketing: kaart per tool met kerncijfer | vouchers (redemptions = `voucher_redemptions`), broadcasts/push-geschiedenis | WIJKT AF — Coupons-kaart echt, rest eerlijk leeg | AD 2.5 | T1 |
| Community · Advanced | — | alleen menunaam (founder 07-09) | — | — |
| Export | Uscreen: geen | n.v.t. | — | — |

## §13 Tellingen AD 0b en bouwvolgorde AD 2

| Oordeel | Home | Settings | Subscriptions | Sales | Analytics | Totaal AD 0b |
|---|---|---|---|---|---|---|
| HEEFT | 0 | 0 | 1 (kolom) | 0 | 0 | **1** |
| WIJKT AF | 1 | 2 | 1 | 0 | 3 | **7** |
| ONTBREEKT | 1 | 5 | 3 | 0 | 0 | **9** |
| WACHT (KP/BT/MD/LM/DNS) | 2 | 9 | 3 | 5 | 3 | **22** |
| BUITEN SCOPE / naam / extra | 2 | 1 | 0 | 0 | 2 | **5** |

Bouwvolgorde AD 2 (founder 2026-09-07; elk = één sessie-deel, één commit met Review-log, Playwright-structuurtest, screenshot 1440 naast het Uscreen-beeld):
1. **AD 2.1 Home** (T1): tegelblok "Last 30-day performance" in Uscreen-vorm; Sign Ups echt uit `people`, Gross Revenue en Video Views als VOORBEELD gelabeld; Recent activity eronder.
2. **AD 2.2 Settings** (T1): hub met 3 groepen/14 kaarten in Uscreen-vorm; subpagina's als gemeten (velden/schakelaars/knoppen), werking alleen waar de eigen stack het kent (video comments, exported files leeg, user fields uit); geheime waarden nooit tonen; Website builder weg.
3. **AD 2.3 Subscriptions** (T1 lijst, T2 formulier): lijst + edit/new op `plans`; betaalvelden (valuta, pausing, churn, Manage content) uitgeschakeld met reden; performance-tegels VOORBEELD.
4. **AD 2.4 Sales** (T1): Invoices-pagina met kolommen, filters en Export CSV uitgeschakeld "wacht op betaalkoppeling"; lege lijst met totaalregel 0.
5. **AD 2.5 Analytics** (T1): 6 pagina's met de gemeten tegels/filters/tabs; echte tellingen uit de DB waar mogelijk (People, Coupons), rest VOORBEELD; Community/Advanced als menunaam.

## §14 Stand na AD 2 (2026-09-07, sessie D deel 2) — gedaan / open

**Gedaan (commits AD 2.1 `c5e5038`, AD 2.2 `7024687`, AD 2.3 `17e548a`, AD 2.4 `aab30cb`, AD 2.5 `f50c408`, AD 2.6 `48fafb3`):**
§8 Home: tegelblok in Uscreen-vorm (Sign Ups echt, Gross Revenue/Video Views VOORBEELD), Recent activity behouden, zijmenu compleet (B84).
§9 Settings: hub 14 kaarten + Team; alle rijen "ONTBREEKT" gebouwd (hub, General tonen + opslaan, Video comments-instelling, Exported files leeg);
"WIJKT AF"/"WACHT" als kaart met velden en reden (Checkout, Domain, Snippets, User fields, Marketing email, Email templates, Calendar push,
Webhooks, Integrations, Security, Geo-Blocking); opslaan via `admin_settings` (0014). §10 Subscriptions: lijst + new/edit op `plans`, 11 plannen
geïmporteerd (vraag 7), Visibility-UI, trial als getal; WACHT-rijen (valuta, pausing, churn, content, Members-link) uitgeschakeld met reden.
§11 Sales: lege Invoices-lijst met kolommen/filters/export uit (vraag 8). §12 Analytics: 6 eigen pagina's; People en Coupons echt, Content-tellingen
echt, rest leeg met reden (geen VOORBEELD, vraag 5). Inloglink: beheerder → /admin. Tests: 20 storefront + 20 admin = 40 (Playwright, `--workers=2`, eindrun 40/40).

**Open (bewust, met reden op de pagina):** alle BT-rijen (betaalbeslissing: Stripe/PayPal, valuta, invoices, MRR/sales-analytics, plan-content),
KP-rijen (kijkplatform: views/watch time, DRM, device-limit-afdwinging, geo-blocking-afdwinging, plan-image), MD-rijen (mail: domein, topics,
templates, broadcasts), LM-rijen (ledenmigratie: subscriptions-tegels, Members per plan, activiteitsstatus live), DNS (founder). Teamvragen:
`AD2-teamreview.md` (16). Nazorg als aparte T0-commits: `workers: 2` in de Playwright-config; strengere opruimhulp; oude `vouchers/CreateVoucherForm.tsx`
en `searchMembers()` (AD 1-vraag 10).
