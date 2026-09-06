# AD 1 — Teamreview admin-raamwerk + Content + People + Marketing-kern (NL / EN)

STATUS: gebouwd 2026-09-06 (sessie D deel 1), branch `exit-phase`, preview-pad `/admin` (login + TOTP vereist; teamleden zonder
adminaccount zien 404 — dat is de gate). Norm = `AD0-inventaris.md` (meting van 2026-09-06). Schermafbeeldingen 1440 px per stap in
`var/admin-referentie/ad1/stap-N/` (lokaal + NAS-kopie), telkens naast het gemeten Uscreen-beeld (`uscreen-*.png`).
Tests: `apps/web/tests/admin-*.spec.ts` (Playwright, ingelogd via het test-adminaccount `admin-test`, zie `docs/cutover-runbook.md`).

## NL

### Wat er staat (per sectie: preview-pad · Uscreen-beeld · wat wel/niet)

| Sectie | Preview-pad | Uscreen-beeld | Gebouwd | Bewust leeg/uitgeschakeld (met reden op de pagina) |
|---|---|---|---|---|
| Raamwerk (AD 1.1) | `/admin` | `stap-1/uscreen-content-videos-lijst`, `uscreen-marketing-hub` | zijmenu Content ▸ Videos·Collections·Resources·Categories·Custom Filters·Authors / People ▸ All / Marketing, in Uscreen-volgorde en -namen; kopbalk met breadcrumb en werkende Toggle Sidebar; admin-tokens (Inter, blauw) apart van de storefront; elke route achter login + TOTP | uitgesloten secties (B81) staan niet in het menu |
| Content › Videos (AD 1.2) | `/admin/videos`, `/admin/videos/<id>` | `stap-2/uscreen-content-videos-lijst`, `uscreen-content-video-detail` | lijst met thumbnail+duur, titel, Status (Published/Unpublished/Scheduled), Age, Uploaded on, ⋯-menu, zoeken, statusfilter, sortering, bulk publish/unpublish, "Showing 1–30 of N", Rows per page; detail met About (titel, beschrijving HTML, short description ≤ 140), Thumbnails (cover-URL uit het archief), Organize (categorieën, custom filters Type/Subject), SEO, Visibility, Access + Age rating | Upload/Replace (na kijkplatformkeuze), Subscription & Pricing (betaalbeslissing), Subtitles/Audio/Preview (kijkplatform), Authors (leeg) |
| Content › Collections (AD 1.3) | `/admin/collections`, `/admin/collections/new`, `/admin/collections/<id>` | `stap-3/uscreen-content-collections-lijst`, `uscreen-content-collection-detail` | lijst (afgeleide status, filter, zoeken, 12/pagina), aanmaken via formulier, detail met titel/beschrijving/cover-URL/categorieën, playlist met slepen (of ▲▼) + Save order, Add video (zoeker), verwijderen uit playlist, Delete collection met bevestiging | Drip/dividers, Access/Pricing/Preview per collectie (beslissingen), page title/meta (geen kolom) |
| Content › Categories (AD 1.3) | `/admin/categories`, `/admin/categories/new`, `/admin/categories/<id>` | `stap-3/uscreen-content-categories-lijst`, `uscreen-content-category-edit` | lijst met slepen (site-nav-volgorde) + telling, aanmaken, edit met titel/positie/Sort content by, Manage content met slepen, Add content (video's + collecties), verwijderen, Delete category met bevestiging | description/image/SEO-title (geen kolommen), Randomize content |
| Content › Resources (AD 1.3) | `/admin/resources` | `stap-3/uscreen-content-resources-lijst` | lijst uit `videos.resources` (76 video's), zoeken, 12/pagina | Upload resources (kijkplatform) |
| Content › Custom Filters (AD 1.3) | `/admin/custom-filters` | `stap-3/uscreen-content-custom-filters` | de 2 gemeten filters + 14 opties als DB-data (seed), Create a filter, opties toevoegen/verwijderen, filter verwijderen; Type/Subject per video op het videodetail | slepen van filters (pas zinvol bij > 2) |
| Content › Authors (AD 1.3) | `/admin/authors` | `stap-3/uscreen-content-authors` | "No authors yet" zoals gemeten | New author (tabel bestaat, 0 rijen; formulier na founder-ja) |
| People › All (AD 1.4) | `/admin/people`, `/admin/people/<id>` (oude `/admin/members` verwijst door) | `stap-4/uscreen-people-lijst`, `uscreen-people-detail` | lijst met naam/e-mail, Tags, Status, Lifetime, Creation date, filters user type/status, 25/pagina; detail met About, Profile (Lead/Member, membership, lead source, UTM, lifetime), Activity, Household — alles alleen lezen | Add member / Save / Add membership (ledenmigratie, T2), Invoices/Emails/Watch history (beslissingen), Tags-filter (0 tags in de export) |
| Marketing (AD 1.1/1.5) | `/admin/marketing` | `stap-1/uscreen-marketing-hub` | hub met 12 kaarten in 2 groepen | Refer a friend, Try again for free (B81) |
| Marketing › Coupons (AD 1.5) | `/admin/marketing/coupons`, `/admin/marketing/coupons/new` (oude `/admin/vouchers` verwijst door) | `stap-5/uscreen-marketing-coupons`, `uscreen-marketing-coupon-new` | lijst Coupon·Discount·Redeemed·Status·Expires, zoeken op code, filter expirations, Deactivate met bevestiging; New coupon met Code (eigen, hoofdletters), 100 % off, description, Never/Expires on, No limit/Limit to, Subscription | Percentage/Fixed, usage rules, Bundle/Content-producten, Stats (betaalbeslissing) |
| Marketing › Landing pages (AD 1.5) | `/admin/marketing/landing-pages`, `/admin/marketing/landing-pages/<id>` | `stap-5/uscreen-marketing-landing-pages` | de 9 gemeten pagina's met instellingen (SR 2b) en inhoud als tekst (SR 2a) | Create a page / Edit in builder (page builder buiten scope) |
| Marketing › overige 10 kaarten | `/admin/marketing/<kaart>` | — | route + gemeten kop + "Nog niet gebouwd — AD stap 5" | wachten op mail-/betaalbeslissing |

### Ja/nee-vragen voor het team (advies = standaard)

1. **Uploaded on** toont nu de importdatum (`created_at`, 7 aug 2026 voor bijna alles) onder de Uscreen-kop. Akkoord tot de Uscreen-uploaddatums geïmporteerd zijn? (advies: ja, met deze kanttekening)
2. **Age-kolom** blijft in de videolijst (niet in Uscreen), zoals de founder besliste. Akkoord? (advies: ja)
3. **Collections-status** is afgeleid (Published = ≥ 1 gepubliceerde aflevering). Akkoord, of wil het team een eigen collectiestatus (kolom, T2)? (advies: afgeleid laten)
4. **Categories › Videos-telling** telt items in de categorie (video's + collecties); Channels Live telt 0 (live-kanalen zitten niet in de DB). Akkoord? (advies: ja)
5. **Category position** kan op twee manieren (veld in edit én slepen in de lijst); Uscreen schuift de rest op bij het veld. Slepen als enige weg maken? (advies: ja, veld alleen tonen)
6. **Delete-knoppen** zijn zichtbaar voor de editor-rol maar de actie eist admin (404 bij klik). Verbergen voor editors? (advies: ja, in AD 2)
7. **Authors**: de tabel bestaat (leeg); formulier "New author" bouwen? (advies: nee tot er authors zijn)
8. **People-telling** is 2.928 (DB) tegenover 3.051 in Uscreen; 123 mensen sinds de export niet in de DB. Her-export bij de ledenmigratie? (advies: ja)
9. **Coupons** = vouchers (100 % off, N dagen). Akkoord dat percentage/vast bedrag en producttypes wachten op de betaalbeslissing? (advies: ja)
10. **Oude mint-formulier** (`vouchers/CreateVoucherForm.tsx`) en `searchMembers()` zijn nu ongebruikt. Verwijderen? (advies: ja, aparte T0-commit)
11. **Screenshots** in `var/` tonen het adres van het test-adminaccount in de zijbalk (bij People gemaskeerd). Acceptabel voor de NAS-kopie? (advies: ja; het is geen lid)

### Aannames (gemarkeerd, aanpasbaar)

- Storefront-kop/-voet worden op admin-pagina's verborgen met een CSS-`:has()`-regel in plaats van een route-groep-verhuizing van alle storefront-routes (kleinere diff; storefront ongewijzigd, suite groen).
- Nieuwe collectie/categorie via een formulier vóór het aanmaken (Uscreen maakt direct aan — B83).
- Categorie-plaatsingen komen bovenaan (min − 1), playlist-items achteraan (max + 1), zoals Uscreen toont.
- Statusnamen exact Uscreen: `draft` = Unpublished; `live` blijft een eigen status.

## EN

### What is there

Framework in the Uscreen look (sidebar in Uscreen order and names for the in-scope sections, top bar with breadcrumb, own admin tokens),
Content › Videos (list + detail with the measured fields; upload disabled until the playback-platform decision), Collections
(list, create, detail with drag-ordered playlist, add/remove videos, categories, delete), Categories (drag order, edit with content
order/sorting/add content/delete), Resources (read-only list), Custom Filters (the 2 measured filters + 14 options as data, per-video
Type/Subject), Authors (empty as measured), People › All (read-only list + detail in the Uscreen form from the Uscreen export data),
Marketing hub, Coupons (on the vouchers table in the Uscreen coupon form: create with own code, deactivate), Landing pages (the 9
measured pages with settings and text). Everything sits behind the existing admin login + TOTP; nothing was loosened; the data layer
stays service-role-only; no new RLS policies; every write is audited.

### Yes/no questions (advice = default)

1. "Uploaded on" currently shows the import date until Uscreen upload dates are imported — OK? (advice: yes)
2. Keep the Age column in the video list (not in Uscreen)? (advice: yes)
3. Collection status is derived (≥ 1 published episode) — keep derived? (advice: yes)
4. Category item counts count videos + collections; Channels Live counts 0 — OK? (advice: yes)
5. Make drag-ordering the only way to change category position? (advice: yes)
6. Hide delete buttons for the editor role? (advice: yes, in AD 2)
7. Build the "New author" form now (table exists, 0 rows)? (advice: no)
8. Re-export people at the member migration (2,928 in DB vs 3,051 in Uscreen)? (advice: yes)
9. Coupons = vouchers (100 % off for N days); percentage/fixed and product types wait for the payment decision — OK? (advice: yes)
10. Remove the now-unused old voucher form and `searchMembers()`? (advice: yes, separate T0 commit)
11. Screenshots on the NAS show the test-admin address in the sidebar (masked on People) — acceptable? (advice: yes)

### How to review

Open `/admin` on the preview (admin account + TOTP required), walk the sidebar top to bottom, compare each page with the Uscreen
image next to it in `var/admin-referentie/ad1/stap-N/`, and answer the questions above with yes/no. Anything disabled shows its
reason on the page; nothing on these pages writes to Uscreen.
