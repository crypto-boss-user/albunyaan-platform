# AD-werklijst — eigen `/admin` ↔ Uscreen-admin (HEEFT / WIJKT AF / ONTBREEKT)

STATUS: opgesteld 2026-09-06 (AD 0 stap 3). Norm = `AD0-inventaris.md`. Eigen kant gemeten op `next start :3012` (productiebuild van
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
