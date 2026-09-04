# SR 3 — vergelijk albunyaan.tv (Uscreen) ↔ `apps/web` → werklijst (2026-09-04)

Norm: **B13 = 1:1 Albunyaan-huisstijl zoals leden die op albunyaan.tv zien** (uiterlijk én structuur); enige bewuste afwijking =
`dir=rtl` (B33). Bronnen: SR 0-rapport (structuur, Weglot, assets), SR 2a (486 bestanden, anoniem, 3 talen × 2 formaten),
SR 2b (thema-JSON, snippets, 35 blokpanelen, 21 e-mailsjablonen, founder-twin 78 cellen), SR 3a (eigen app 108 cellen,
`reference/storefront-2026-09/eigen-app/`, 60 cellen ONTBREEKT), plus code (`apps/web`, `packages/core/src/tokens.ts`).
Oordelen: **HEEFT** (gelijk) · **WIJKT AF** (wat precies) · **ONTBREEKT** · **BUITEN SCOPE** (community, bundels, mobile/TV-apps-
sectie, refer-to-Uscreen — benoemd, niet bouwen) · **TWIJFEL** (vraag aan de founder, §5). Elke regel heeft een bron.
Afkortingen: US = Uscreen-storefront, EI = eigen app; SR2a/SR2b/SR3a = tekstextract/JSON in `reference/storefront-2026-09/…`.

## §1 Tellingen per oordeel per pagina

| pagina (US → EI) | HEEFT | WIJKT AF | ONTBREEKT | BUITEN SCOPE | TWIJFEL | totaal |
|---|---|---|---|---|---|---|
| Homepage `/` → `/` | 3 | 6 | 9 | 1 | 1 | 20 |
| Catalog `/catalog` → `/catalog` | 3 | 3 | 2 | 0 | 0 | 8 |
| Search `/catalog/search` → `/search` | 1 | 2 | 0 | 0 | 0 | 3 |
| Categorie `category-Age 5-9` → `age-5-9-114960` | 3 | 2 | 1 | 0 | 0 | 6 |
| Categorie `category-channels` → `channels-live-128768` | 2 | 0 | 1 | 0 | 1 | 4 |
| Programma `collection-my-words-ar` → `my-words-ar-1692483` | 3 | 3 | 3 | 0 | 1 | 10 |
| Afleveringspagina (type 8) → `/watch/01-1696848` | 0 | 1 | 3 | 0 | 0 | 4 |
| Live-kanaal `programs/rawdah` → — | 0 | 0 | 1 | 0 | 1 | 2 |
| About us | 2 | 3 | 1 | 0 | 0 | 6 |
| Contact | 1 | 2 | 0 | 0 | 1 | 4 |
| Coupon | 0 | 2 | 2 | 0 | 0 | 4 |
| Dawah | 3 | 3 | 1 | 0 | 0 | 7 |
| Downloads → `/download-app` | 1 | 2 | 1 | 0 | 1 | 5 |
| Q&A | 1 | 3 | 0 | 0 | 0 | 4 |
| Servicevoorwaarden → `/terms` | 1 | 2 | 0 | 0 | 1 | 4 |
| Privacybeleid → `/privacy` | 1 | 2 | 0 | 0 | 1 | 4 |
| Sign in `/sign_in` → `/login` | 2 | 2 | 0 | 0 | 0 | 4 |
| Sign up: `/join` + `/pages/form` → `/join` | 0 | 2 | 1 | 0 | 1 | 4 |
| new-payment (Pricing) | 0 | 0 | 1 | 0 | 1 | 2 |
| Language prefs | 0 | 0 | 1 | 0 | 1 | 2 |
| for-creative-souls-159 | 0 | 0 | 0 | 1 | 1 | 2 |
| Checkout ×6 (checkout, *OLD*, egp, mad, sar, idr) | 0 | 0 | 6 | 0 | 2 | 8 |
| **Globaal** (§3: header, footer, taal, logo/favicon, font, kleur, mobiel, RTL, live-kanalen, e-mails, titels) | 6 | 12 | 8 | 3 | 3 | 32 |
| **Totaal** | **33** | **52** | **42** | **5** | **17** | **149** |

Lezing: 33 van 149 elementen zijn gelijk (22 %). De grootste massa zit in **WIJKT AF** (huisstijl: font, logo, hero, kleuren-
schema; teksten; taal-laag) en **ONTBREEKT** (homepage-blokken, mobiele navigatie, Contact-dropdown, live-kanalen, checkout/
aanmeldflow — dat laatste bewust tot de betaalbeslissing).

## §2 Per pagina: elemententabel

### Homepage (`/` → `/`) — US: 13 blokken (SR2b `thema/pages/index.json`); EI: hero + statistiekstrook + 5 catalogusrijen (SR3a)

| element | oordeel | wat precies | bron |
|---|---|---|---|
| Header-blok | HEEFT | zie §3 header (met afwijkingen daar) | SR2b index blok 1 |
| Hero banner: beeld | WIJKT AF | US fotocollage `hero-banner-albunyaan` 2880×1280 (+ mobiel 900×1600, AR-variant via Weglot-CSS); EI donkergroene gradient zonder beeld | SR2b blok 2 (imgs), `assets-bronnen.md`, SR3a png |
| Hero: kop | WIJKT AF | US h1 "I want to protect my Islamic identity" + subkop "Through watching safe and filtered content…"; EI Arabische regel + "AN ISLAMIC MULTIMEDIA PLATFORM — A NON-COMMERCIAL DA'WAH INITIATIVE" | SR2a home EN koppen; SR3a home |
| Hero: knop | WIJKT AF | US één knop "Sign up!" → Join Page, links uitgelijnd; EI twee knoppen "Watch Here" + "Parental controls", gecentreerd | SR2b blok 2 velden; SR3a |
| Statistiekstrook (15984 / 686 / 3 / 100 %) | WIJKT AF | bestaat niet op US; EI-toevoeging | SR3a home |
| Text block "Islamic Identity" + knop "Android app not working? Click here" (→ /programs/…) | ONTBREEKT | | SR2b blok 3; SR2a koppen |
| Image and text "Watch unlimited series, movies, and programs on your phone, tablet, laptop, and TV." (apparaten-beeld) | ONTBREEKT | | SR2b blok 4 |
| Image and text "Learning Arabic" (diagram) | ONTBREEKT | | SR2b blok 5 |
| Image and text "Ongoing reward (sadaqah jaariyah)" (foto) | ONTBREEKT | | SR2b blok 6 |
| Custom code (diagram "Abonnee → Multimedia Platform → Entertainment/Opvoeding", NL) | ONTBREEKT | | SR2b blok 7; SR2a png |
| Video and text ×3: "Review teacher (NL)", "Review teenager (NL)", "Review parent (NL)" (video's) | ONTBREEKT | speler = poster tot kijkplatformkeuze (founder-regel) | SR2b blok 8–10 |
| Text block "Ready to start watching?" + "Sign up now!" | ONTBREEKT | | SR2b blok 11 |
| Mobile apps-blok (telefoon in handen; App Store/Google Play leeg in paneel) | BUITEN SCOPE / TWIJFEL 1 | apps-sectie; zie §5.1 | SR2b blok 12 |
| Catalogusrijen "Fresh from the library" (5 rijen) | WIJKT AF | bestaan niet op de US-homepage (US toont geen catalogus op home); EI-toevoeging | SR3a home koppen |
| Paginatitel/SEO | WIJKT AF | US "Albunyaan TV" + Page Settings-beschrijving "The Islamic media platform that focuses on parenting…"; EI "Albunyaan TV — Safe Islamic Streaming for the Whole Family" | SR2b index pageSettings; SR3a |
| Footer-blok | HEEFT | zie §3 footer (met afwijkingen daar) | SR2b blok 13 |
| Volgorde blokken | ONTBREEKT | US-volgorde (13) is de norm; EI heeft 3 van de 13 (header, hero, footer) | SR2b |
| Mobiel (390): hero-beeld | ONTBREEKT | US mobiele banner 900×1600; EI gradient | SR2b blok 2; SR3a 390 png |
| Mobiel (390): hamburger | ONTBREEKT | zie §3 mobiel | SR2a/SR3a 390 |
| Weglot-wisselaar in header | HEEFT (positie) | EI heeft een wisselaar op dezelfde plek; werking wijkt af (§3) | SR3a |

### Catalog (`/catalog` → `/catalog`)

| element | oordeel | wat precies | bron |
|---|---|---|---|
| Rijen per categorie met kaarten-carrousel + "See All" | HEEFT | beide: horizontale rijen met poster-kaarten en See All | SR2a catalog; `CatalogRow.tsx` |
| Aantal/volgorde rijen | WIJKT AF | US 16 rijen zichtbaar (h1 per rij; 256–466 programma-links met lazy paginering); EI 6 rijen (Welcome to Albunyaan, Age 0-2, Nederlands, English, Be Conscious, Apps) — geen "Channels Live" eerst, geen featured "New releases" (Preferences: featured category = New releases, sidebar) | SR2a catalog EN; SR2b `F-preferences.json`; SR3a catalog |
| Zoekveld op de cataloguspagina | WIJKT AF | US zoekveld bovenaan catalog; EI zoekveld in de header (alle pagina's) | SR2a png `clone-rtl-ar` vs SR2a catalog; `SiteHeader.tsx:67` |
| Filters-knop | ONTBREEKT | US "Filters" (catalog_filters-frame, custom filters in admin `/manage/catalog-filters`); EI geen | SR2a catalog frames |
| Kaartstijl (poster 16:9, duur/slotje-badge) | HEEFT | beide tonen duur en slot-badge | SR2a png; SR3a png |
| Kop per rij | HEEFT | rijtitel + See All | idem |
| Continue Watching / My Library (ingelogd) | ONTBREEKT (niet vergelijkbaar anoniem) | US Preferences: My Library aan, Continue Watching aan | SR2b `F-preferences.json` |
| Lazy paginering | WIJKT AF | US `categories_page_2/3`; EI [te meten] | SR2a frames |

### Search (`/catalog/search` → `/search`)

| element | oordeel | wat precies | bron |
|---|---|---|---|
| Zoekpagina bestaat | HEEFT | | SR2a/SR3a |
| Startweergave | WIJKT AF | US toont direct 80 programma's (raster) + filters; EI leeg tot er een zoekterm is (2 secties) | SR2a search; SR3a search |
| Resultaatweergave met term | WIJKT AF ([te meten]) | niet gemeten met term (SR 2c/SR 4-test) | — |

### Categorie `category-Age 5-9` → `/categories/age-5-9-114960`

| element | oordeel | wat precies | bron |
|---|---|---|---|
| Route + slug-mapping | HEEFT | `docs/redirect-map.md` matcht 17/18 categorieën; Age 0-4 ongematcht (redirect-map) | redirect-map |
| h1 "العمر - Age 5-9" | HEEFT | identiek | SR2a/SR3a |
| Raster van programma-kaarten | HEEFT | | idem |
| Aantal items | WIJKT AF | US 80 (1440) / 120 (390) met lazy paginering; EI 30 | SR2a/SR3a linktelling |
| Filters (category_filters-frame) | ONTBREEKT | | SR2a frames |
| Paginatitel | WIJKT AF | US "Age 5-9"; EI generieke sitetitel | SR2a/SR3a title |

### Categorie `category-channels` → `/categories/channels-live-128768`

| element | oordeel | wat precies | bron |
|---|---|---|---|
| Route + h1 "Channels Live 📡" | HEEFT | | SR3a |
| Rasterindeling | HEEFT | | |
| 29 live-kanalen | ONTBREEKT | US 29 programma's (SR 0 punt h); EI 0 — geen live-collecties/-video's in de DB | SR2a channels; SR3a; DB-query 2026-09-04 |
| Wat te doen met live-kanalen | TWIJFEL 5 | §5.5 | |

### Programma `collection-my-words-ar` → `/programs/my-words-ar-1692483`

| element | oordeel | wat precies | bron |
|---|---|---|---|
| Titel "My Words \| (AR)" | HEEFT | | SR2a/SR3a |
| Afleveringslijst | HEEFT | US "18 VIDEO'S" playlist (sidebar-positie per Preferences); EI "Episodes"-lijst | SR2b founder-twin programmapagina; SR3a |
| Spelerplek met poster | HEEFT | EI "Player placeholder — real streams land with the media migration"; norm: poster tot kijkplatformkeuze | `programs/[slug]/page.tsx:73` |
| Label "COLLECTION" + "Start watching" + categorie-tags (Arabic for Kids, Age 0-2, Age 2-4) | ONTBREEKT | | SR2b `programmapagina-ingelogd-2.json` |
| Favorieten + Delen (Facebook/LinkedIn/Pinterest…) | ONTBREEKT | favorieten = ingelogd (T2); delen = anoniem | idem |
| Trailer-frame, resources-frame | ONTBREEKT | leeg op US (0 kinderen) — lage prioriteit | idem |
| Indeling | WIJKT AF | US speler links + playlist rechts (sidebar); EI grid 1.2fr/1fr met placeholder | SR2b preferences; `programs/[slug]/page.tsx:130` |
| Placeholder-tekst in speler | WIJKT AF | developer-tekst zichtbaar voor bezoekers | SR3a |
| Paginatitel | WIJKT AF | US "My Words \| (AR)"; EI generieke sitetitel | |
| Afleveringen tellen | TWIJFEL (te meten) | EI toont "Episodes" maar 0 programma-/watch-links in de extract → aantal/links [te meten] in SR 4-test | SR3a program extract |

### Afleveringspagina type 8 (`?cid=2696154&permalink=01-80f683` → `/watch/01-1696848`)

| element | oordeel | wat precies | bron |
|---|---|---|---|
| Route | WIJKT AF | US: zelfde collectie-URL met `cid`; EI: `/watch/<slug>` → 307 → `/programs/01-1696848` | SR2b storefront; SR3a video |
| Pagina rendert | ONTBREEKT (bug) | EI eindigt in **404 "This page could not be found."** (anoniem) | SR3a `video-my-words__*` |
| Speler + afleveringslijst + beschrijving | ONTBREEKT (niet meetbaar door 404) | US: speler (4 elementen), playlist, titel; norm speler = poster | SR2b video-my-words |
| Ingelogde variant | ONTBREEKT (niet vergelijkbaar) | productie heeft geen accounts (§6 punt 30) | |

### Live-kanaal `programs/rawdah` → —

| element | oordeel | wat precies | bron |
|---|---|---|---|
| Kanaalpagina "Rawdah TV Live" | ONTBREEKT | geen data in EI (0 live-items) | SR3a fouten.log |
| Aanpak | TWIJFEL 5 | §5.5 | |

### About us (`/pages/about-us` → `/about-us`) — US: Header · Text block (links, wide, knop "Start free trial") · Footer

| element | oordeel | wat precies | bron |
|---|---|---|---|
| Pagina + tekstblok | HEEFT | beide één tekstpagina | SR2b about-us; SR3a |
| Tekst | HEEFT (te verifiëren woord-voor-woord) | EI "In 2011, the idea emerged among a group of knowledge-seeking students…" = US-tekst (SR2a about-us HTML) — woordvergelijking in SR 4-test | SR2a/SR3a html |
| Kop | WIJKT AF | US h3 "About us" (kleiner, in tekstblok); EI eyebrow "About" + h1 | SR2a koppen; SR3a |
| Uitlijning/breedte | WIJKT AF | US links/wide; EI gecentreerde kolom | SR2b velden; SR3a png |
| Knop "Start free trial" | ONTBREEKT | | SR2b about-us blok |
| Paginatitel | WIJKT AF | US "Albunyaan"; EI "About us — Albunyaan TV" | |

### Contact (`/pages/contact` → `/contact`) — US: DEPRECATED admin-pagina (261 tekens inhoud)

| element | oordeel | wat precies | bron |
|---|---|---|---|
| Pagina bestaat, in footer + Contact▾ | HEEFT | | SR2a nav/footer |
| Inhoud | WIJKT AF | US 261 tekens (`pages/V1-43392-contact-page-content.html`, embed/kort); EI "Get in touch" + formulier (naam/e-mail/bericht, Resend) | SR2b V1 contact; SR3a |
| Kop | WIJKT AF | US geen kop; EI h1 "Get in touch" | |
| Wat US precies toont (embed?) | TWIJFEL 7 | §5.7 | |

### Coupon (`/pages/coupon` → `/coupon`) — US: Text block (center) · Video and text (knop "Join now") · Custom code

| element | oordeel | wat precies | bron |
|---|---|---|---|
| Anoniem bereikbaar | WIJKT AF | US publiek; **EI leidt om naar `/login`** | SR3a coupon eind-url |
| Koppen "Coupon كوبونات" / "شرح كيفية تفعيل الكوبون How to activate the coupon" | ONTBREEKT | | SR2a coupon koppen |
| Video-blok + knop "Join now" + custom code | ONTBREEKT | | SR2b coupon |
| Knop "Start free trial" | WIJKT AF | US-CTA; EI geen (achter login) | |

### Dawah (`/pages/dawah` → `/dawah`) — US: Text block · Image and text ×2 · Text block (knoppen "Invest in these projects" → Stripe-donate, "Start your free trial")

| element | oordeel | wat precies | bron |
|---|---|---|---|
| Koppen "Dawah projects", "Stichting Al-Istiqaamah", "Tarbiyah Consultancy" | HEEFT | identiek (h3 vs h1/h2) | SR2a/SR3a |
| Twee stichtingen als beeld+tekst | HEEFT | | SR2b dawah blokken 3–4 |
| Structuur 4 blokken | HEEFT | | |
| Extra EI-teksten "Appointment with the King", "The Mercy of Islaam for Non-Muslims" | WIJKT AF | niet in US-blokken → [te meten] of dit US-tekst is of EI-toevoeging (SR 4-woordvergelijking) | `dawah/page.tsx` |
| Knoppen "Invest in these projects" (→ donate.stripe.com) ×2 en "Start your free trial" ×2 | ONTBREEKT | | SR2b dawah velden |
| Uitlijning (links/wide; beeld links) | WIJKT AF | | SR2b |
| Kopniveau | WIJKT AF | h3 → h1/h2 | |

### Downloads (`/pages/downloads` → `/download-app`) — US: Text block (center) "جميع روابط منصة البنيان" + Custom code (store-knoppen) + "Start free trial"

| element | oordeel | wat precies | bron |
|---|---|---|---|
| Pagina + menu-item | HEEFT | | |
| Tekst | WIJKT AF | US: Arabische kop "alle links van het Albunyaan-platform" + winkelknoppen; EI: "We're building new iOS, Android and TV apps… not available to download yet" | SR2a/SR3a |
| Menulabel | WIJKT AF | US "Download apps"; EI "Download app" | SR2a nav; `SiteHeader.tsx:14` |
| Store-knoppen (custom code) | ONTBREEKT | | SR2b downloads |
| Scope | TWIJFEL 1 | apps-sectie buiten scope vs statische pagina in het menu | §5.1 |

### Q&A (`/pages/qa` → `/qa`) — US: landing page (page builder #52371) "Frequently Asked Questions" + "Who are we?"

| element | oordeel | wat precies | bron |
|---|---|---|---|
| Pagina + FAQ-lijst | HEEFT | EI heeft FAQ-items (o.a. "How can I login?") | SR3a qa |
| Koppen | WIJKT AF | US h2 "Frequently Asked Questions" + "Who are we?"; EI h1 "Q&A" + intro | SR2a/SR3a |
| Vragen/antwoorden 1:1 | WIJKT AF ([te meten]) | woordvergelijking SR2a-HTML vs `qa/page.tsx` in SR 4-test | |
| "Who are we?"-blok | WIJKT AF | niet als apart blok in EI | |

### Servicevoorwaarden (`/pages/servicevoorwaarden` → `/terms`) en Privacybeleid (`/pages/privacybeleid` → `/privacy`)

| element | oordeel | wat precisely | bron |
|---|---|---|---|
| Pagina's + footer-links | HEEFT | | |
| Taal en inhoud | WIJKT AF | US: Engelse teksten "Terms & Conditions" (31.629 tekens, met interne notitie "PLEASE DO NOT EDIT THIS PAGE…") en "Privacy Policy" (8.707); EI: Nederlandse, voor het nieuwe platform opgestelde teksten (11 secties elk) | SR2b `pages/V1-*-page-content.html`; SR3a |
| Kopstructuur | WIJKT AF | US platte tekst zonder h-koppen; EI h1 + 11 h2 | |
| Welke tekst is de norm | TWIJFEL 8 | §5.8 | |

### Sign in (`/sign_in` → `/login`)

| element | oordeel | wat precies | bron |
|---|---|---|---|
| Inlogpagina met e-mail/wachtwoord | HEEFT | | SR2a sign_in; SR3a login |
| Kop | WIJKT AF | US "Welcome back!"; EI "Log in" | |
| reCAPTCHA v3 op het formulier | WIJKT AF | US laadt reCAPTCHA-script (feature-flag); EI niet — beveiligingskeuze, geen huisstijl | SR2a zacht signaal |
| Header/footer eromheen | HEEFT | | |

### Sign up (`/join` en `/pages/form` → `/join`)

| element | oordeel | wat precies | bron |
|---|---|---|---|
| Aanmeldknop in header | WIJKT AF | US "Sign up" → `/pages/form` (lead-formulier "Sign in form", landing page #341732) → na succes checkout; EI "Sign up" → `/join`, dat anoniem **omleidt naar `/login?next=/join`** | SR2a nav; SR3a join |
| Lead-formulier (e-mail-capture, Uscreen "Email capture") | ONTBREEKT | | SR2b landing-pages 01 |
| Flow formulier → checkout binnen 2 min (sessionStorage-gate) | WIJKT AF / TWIJFEL 2 | §5.2 | SR2b head-code |
| Bouwscope | — | B16/B36: buiten bouwscope tot de betaalbeslissing | §5 plan |

### new-payment (Pricing-blok) · Language prefs · for-creative-souls-159 · Checkout ×6

| pagina | oordeel | wat precies | bron |
|---|---|---|---|
| new-payment | ONTBREEKT + TWIJFEL 9 | US: Header · Pricing · Custom code · Footer (h3 "Prices", h1 "Coupon"); EI geen route; B37: kandidaat-archief | SR2b new-payment; §5 B37 |
| Language prefs | ONTBREEKT + TWIJFEL 10 | US DEPRECATED admin-pagina, 503 tekens ("Yo…"), load-event komt nooit; EI geen route — taal via wisselaar | SR2b V1; SR 0 |
| for-creative-souls-159 | BUITEN SCOPE (B38: bouwen nee) + TWIJFEL 4 | inactieve landing page, publiek 200 | SR2b landing 06 |
| checkout, *OLD*, egp, mad, sar, idr | ONTBREEKT (B16: buiten bouwscope tot betaalbeslissing) + TWIJFEL 2/4/11 | US: 6 landing pages achter lead gate + valuta-redirect (EG/SA/MA/ID via ipinfo); *OLD* inactief maar publiek | SR2b storefront gate-cellen; head-code |

## §3 Globale elementen

| element | oordeel | wat precies | bron |
|---|---|---|---|
| **Menu-items** | WIJKT AF | US 8 zichtbare items: Home · Videos · **Contact▾** (Contact, About us, Dawah) · Q&A · Coupon · Download apps; EI 7 plat: Home · Videos · About us · Dawah · Q&A · Coupon · Download app | SR2a home menu; `SiteHeader.tsx:8-14` |
| Contact▾-dropdown | ONTBREEKT | About us en Dawah horen in de dropdown; Contact-item ontbreekt in EI-menu | SR2a dropdown-items |
| Volgorde | WIJKT AF | US: Contact▾ op positie 3; EI: About us/Dawah op 3–4 | |
| "Download apps" | WIJKT AF | EI "Download app" | |
| Log in / Sign up-knoppen | HEEFT | beide rechts: Log in (secundair) + Sign up (primair groen); doelen wijken af (Sign up → form vs /join) | SR2a; SR3a |
| Zoekveld in header | WIJKT AF | EI-toevoeging (US: zoeken op catalog/search) | `SiteHeader.tsx:66-70` |
| **Footer-links** | HEEFT | Videos · Q&A · Contact · Donate · Terms of service · Privacy policy — identiek (Donate: US extern Stripe-link, EI `/donate`-pagina → WIJKT AF in doel) | SR2a footer; `SiteFooter.tsx` |
| Footer: app-badges App Store / Google Play | ONTBREEKT (TWIJFEL 1) | US-links `apps.apple.com/nl/app/albunyaan-tv/id1666119687`, `play.google.com/…tv.uscreen.albunyaan2` | SR2b index Footer-paneel |
| Footer: social-iconen Instagram / Facebook / YouTube | ONTBREEKT | `instagram.com/albunyaantv`, `facebook.com/albunyaan`, `m.youtube.com/@albunyaan` | SR2b Footer-paneel |
| Footer: logo + copyright | WIJKT AF | US Arabisch logo + "© Albunyaan 2026"; EI Latijns woordmerk + tagline "An Islamic multimedia platform — non-commercial da'wah" + "© Albunyaan 2026 — a non-profit sadaqah jaariyah…" + dev-regel "Local parity build — content shadow-seeded…" | SR2b; SR3a footer-tekst |
| **Taalwisselaar** | WIJKT AF | US: Weglot (EN→AR/NL, vertaalt menu/footer/h1; h3-blokken en "Download apps" blijven Engels = norm B34; "by Weglot"-link zichtbaar); EI: eigen wisselaar (🌐 English/العربية/Nederlands, cookie `albn_lang`) **zonder vertalingen** — AR en NL tonen Engels. B32: Weglot ook op het nieuwe platform | SR 0 punt a; SR3a home ar/nl |
| **RTL** | WIJKT AF (bewust, B33) | US: `lang=ar`, `dir` blijft ltr, spiegeling via thema-CSS; EI: `dir=rtl` — beeld: beide spiegelen header/inhoud; EI spiegelt óók de catalogusrijen en knoppen (Uscreen-beeld: logo rechts, menu rechts, hero-tekst rechts) | SR2a home ar png; SR3a home ar png; `layout.tsx:24` |
| AR-banner | ONTBREEKT | US laadt AR-specifieke hero via Weglot-CSS (`support.albunyaan.tv/…/البنيان-صفحة-الواجهة.jpg`, gekopieerd in assets) | `weglot-instellingen.md`; `assets-bronnen.md` |
| **Logo** | WIJKT AF | US Arabisch woordmerk-PNG "البنيان ALBUNYAAN TV" 385×313 (header + footer); EI Latijns "AlbunyaanTV" tekst + play-glyph (`src/signature`) | SR2b `theme-customization.json`; SR3a png |
| **Favicon** | ONTBREEKT | US 48×48 PNG; EI geen icon/favicon-bestand in `apps/web` | SR2b; `ls apps/web/app/icon*` |
| **Lettertype** | WIJKT AF | US Cairo (kop én broodtekst, Google Fonts 400–700); EI Inter (+ Playfair via tokens) — computed `Inter` op h1/body | SR2b theme JSON; `tokens.ts:36-39`; SR3a fonts |
| **Kleuren** | WIJKT AF | primaire kleur **#447525 = HEEFT** (`tokens.ts:8`, knop rgb(68,117,37)); US kleurschema **Light** (witte achtergrond, geen donkere secties); EI: donkere hero-gradient (#0c1a08…), off-white body #fafaf8, donkere footer (#091406) — schema wijkt af | SR2b; `globals.css:5-17,29`; SR3a kleuren |
| Knopstijl | HEEFT (globaal) | beide: groene afgeronde primaire knop, witte secundaire met rand | SR2a/SR3a png |
| **Mobiel (390)** | ONTBREEKT | US: hamburger (`#habmurger_button`) met alle 11 menulinks + Log in/Sign up; EI: geen navigatie en geen hamburger onder 1024 px — alleen logo, wisselaar, Sign up (geen Log in) | SR2a home 390; SR3a home 390; `SiteHeader.tsx:52` |
| Mobiel: hero | WIJKT AF | US mobiele banner 900×1600 met tekst erover; EI gradient | SR2b blok 2 |
| **Live-kanalen (29)** | ONTBREEKT | US categorie "Channels Live 📡" met 29 programma's (live-badge); EI 0 | SR 0 punt h; SR3a |
| **E-mailsjablonen** | ONTBREEKT (B29 open — alleen geïnventariseerd) | US 21 transactionele sjablonen (Welcome, Invite, Trial ×2, Charge, Renewal, Cancelled, Paused ×2, Overdue, Failed, Order, Rental, Live event, Refund, Account deletion, Referral ×2, New video, Cancelled immediately, App-to-web); EI: Resend alleen voor het contactformulier (`lib/resend.ts`), Supabase-auth-sjablonen `magic_link.html`, `email_change.html` → 0 van 21 ledenmails | SR2b `email-templates/`; `apps/web/lib/resend.ts`; `supabase/templates/` |
| Paginatitels/meta | WIJKT AF | US korte titels ("Albunyaan TV", "Albunyaan \| Catalog", "Age 5-9", "My Words \| (AR)"); EI "… — Albunyaan TV" of generieke sitetitel op categorie/programma | SR2a/SR3a titles |
| Community, bundels, mobile/TV-apps-sectie, refer-to-Uscreen | BUITEN SCOPE | §4 | |
| Dev-artefacten in EI | WIJKT AF | Next.js "1 Issue"-badge (dev-modus, verdwijnt in productie), footer-regel "Local parity build…", speler-placeholder-tekst | SR3a png |
| Eigen extra's zonder US-tegenhanger | TWIJFEL 6 | statistiekstrook, "Parental controls"/profielen/PIN, catalogusrijen op home, `/donate`-pagina, zoekveld in header | SR3a; routes |
| hCaptcha/reCAPTCHA op formulieren | WIJKT AF (beveiliging, geen huisstijl) | US reCAPTCHA v3 op sign_in; EI geen | SR2a |

## §4 Buiten scope (benoemd, niet bouwen — founder-lijst §3.3)

1. **Community** — US: community uit (`/community/challenges/widgets` → 403; comments definitief gesloten, T8). Niets te bouwen.
2. **Bundels** — US admin-sectie "Bundles" (`/manage/bundles`); niet op de storefront gemeten. Niet bouwen.
3. **Mobile & TV-apps-sectie** — US admin "Mobile & TV apps"; op de storefront: homepage-blok "Mobile apps", footer-badges, pagina "Download apps". → **TWIJFEL 1** (welk deel telt als "sectie" en welk als statische pagina).
4. **Refer to Uscreen** — admin-only (`/manage/store_referrals`); niet op de storefront. Niets te bouwen.
5. **for-creative-souls-159** — B38: vastleggen ja, bouwen nee.

## §5 Twijfelgevallen (genummerd, met advies)

1. **"Download apps"-pagina en het homepage-blok "Mobile apps" + footer-badges.** Buiten scope (apps-sectie) of meenemen als statische pagina? *Advies:* de **pagina** en het **menu-item** meenemen (structuur-pariteit: 8 menu-items), met de tekst van US; de **store-links** pas activeren als de nieuwe apps er zijn (nu: tekst "in ontwikkeling" zoals EI al heeft, of de bestaande Uscreen-app-links tot de cutover — founderkeuze). Het homepage-blok "Mobile apps" als beeld meenemen (het is een foto), knoppen leeg laten zoals US zelf doet.
2. **Lead gate** (formulier → checkout binnen 2 min via sessionStorage, plus valuta-redirect per land). Nabouwen bij de betaalbeslissing? *Advies:* nee, niet 1:1 — het is een marketing-hack in de head code, geen huisstijl; bij de betaalbeslissing (B16) een eigen aanmeld→betaal-flow ontwerpen; wél de e-mail-capture (lead) als functie noteren.
3. **"by Weglot"-link in de wisselaar.** *Advies:* overnemen zoals gemeten (B32: Weglot blijft tot na cutover; de link hoort bij het gratis/standaard-widget); verdwijnt vanzelf als een betaald plan of eigen i18n komt.
4. **Twee inactieve maar publieke landing pages** (Checkout *OLD*, ideeVideosmiss). *Advies:* niet bouwen; bij cutover geen redirect (404 laten) — bevestigen.
5. **Live-kanalen (29).** EI heeft geen live-data; founder-regel "geen nieuwe data-imports nu". *Advies:* de categorie-pagina en de 29 **kaarten** (titel, kanaal-badge "LIVE", poster) als metadata-import plannen bij de kijkplatformkeuze (stream-URL's zijn platformafhankelijk); tot dan de categorie tonen met de tekst "live kanalen volgen".
6. **Eigen extra's** (statistiekstrook, catalogusrijen op home, "Parental controls"/profielen/PIN, `/donate`-pagina, zoekveld in header). B13 = 1:1 → in principe weg of verplaatst. *Advies:* strook en home-catalogusrijen weg (US-home is een verkooppagina); zoekveld terug naar catalog/search zoals US; **parental controls behouden maar niet in de hero** (productbeslissing, geen US-tegenhanger — founder); `/donate` behouden als doel van de footer-link "Donate" (US linkt extern naar Stripe).
7. **Contact-pagina van US** is 261 tekens (DEPRECATED admin-pagina) — vermoedelijk een embed of korte tekst; EI heeft een formulier. Welke is de norm? *Advies:* EI-formulier houden (functioneel beter), tekst van US overnemen; founder bevestigt.
8. **Servicevoorwaarden/Privacy:** US Engels (met interne notitie erin), EI Nederlands en nieuw opgesteld. *Advies:* EI-teksten houden (juridisch voor het nieuwe platform), maar in het Engels aanbieden zoals US en via Weglot vertalen; US-teksten als bijlage bewaren (staan in SR2b).
9. **new-payment (Pricing-blok).** B37: kandidaat-archief. *Advies:* archief; prijzen komen in de betaalflow.
10. **Language prefs.** 503 tekens ("Yo…"), kapotte pagina. *Advies:* niet bouwen; bij cutover 301 naar `/`.
11. **Valuta-checkouts (EGP/SAR/MAD/IDR) en de geo-vraag** (vanaf dit IP redirect naar IDR i.p.v. EGP). *Advies:* SR 2c vanaf NL-IP meten; bouwen hoort bij de betaalbeslissing.
12. **RTL-spiegeling van catalogusrijen** (EI spiegelt rijen en "See All"; US-catalogus niet gemeten in AR met inhoud). *Advies:* SR 4-test met beeldvergelijk AR-catalogus; B33 blijft (dir=rtl).
13. **Coupon achter login** in EI. *Advies:* pagina publiek maken zoals US (tekst + uitleg), inwisselen zelf mag ingelogd blijven (T2).
14. **Afleveringspagina 404** (`/watch/<slug>` → `/programs/<video-slug>` → 404). Bug of bewuste route-verandering? *Advies:* als bug behandelen in SR 4 (T1 routing; T2 zodra entitlement/playback erbij komt).
15. **Woord-voor-woord-vergelijking** van About us, Dawah, Q&A, Downloads (EI-teksten lijken deels van US te komen, deels nieuw). *Advies:* in SR 4 per pagina een tekst-diff als test (SR2a-HTML als bron).
16. **Titels/SEO:** US Page Settings (titel "Albunyaan TV", beschrijving "The Islamic media platform that focuses on parenting…"). *Advies:* overnemen (T1, copy).
17. **Weglot-inlog** (B32, collega) blokkeert de vertaal-laag in SR 4-item 6.

## §6 Voorgestelde bouwvolgorde voor SR 4 (na RV 2 én team-akkoord op deze lijst)

| # | item | tier | Playwright-structuurtest (bewijs) | afhankelijkheid |
|---|---|---|---|---|
| 1 | **Tokenwissel** (B13): Cairo als kop- en broodtekstfont; kleurschema Light (witte achtergrond, geen donkere hero/footer-gradient); primaire kleur #447525 blijft | T1 | computed `font-family` van h1/body begint met "Cairo"; `--color-brand` = #447525; body background = #ffffff; geen `gradient-hero` op home | na RV 2 |
| 2 | **Logo + favicon**: Arabisch woordmerk-PNG (assets, 385×313) in header en footer; favicon 48×48 | T1 | `header img[alt*=Albunyaan]` src bevat `logo-albunyaan`; `link[rel=icon]` aanwezig en 200 | 1 |
| 3 | **Header-menu**: 8 items in US-volgorde met Contact▾-dropdown (Contact, About us, Dawah), "Download apps", Log in + Sign up; zoekveld uit de header (→ catalog) | T1 | menu-teksten in volgorde == ["Home","Videos","Contact","Q&A","Coupon","Download apps"]; dropdown bevat 3 links; knoppen Log in/Sign up aanwezig | 1 |
| 4 | **Mobiele navigatie** (< 1024 px): hamburger met alle items + Log in/Sign up | T1 | viewport 390: hamburger zichtbaar; na klik 11 links zichtbaar | 3 |
| 5 | **Footer**: logo, 6 links, app-badges (2), social-iconen (3), "© Albunyaan 2026"; dev-regel weg | T1 | footer telt 6 tekstlinks + 5 icoonlinks met de US-doelen; geen tekst "Local parity build" | 2 |
| 6 | **Weglot-laag** (B32): script + EN/AR/NL, eigen wisselaar koppelen of vervangen; `dir=rtl` behouden (B33); AR-banner via de eigen assets i.p.v. support.albunyaan.tv | T1 | na `Weglot.switchTo('ar')`: `html[lang=ar]`, menutekst Arabisch, `dir=rtl`; NL: h1 "Ik wil mijn islamitische identiteit beschermen" | **Weglot-inlog via collega (B32)** |
| 7 | **Homepage-blokken** in US-volgorde: hero (foto-banner + mobiele banner, h1/subkop/knop "Sign up!"), Text block, Image-and-text ×3, diagram, Video-and-text ×3 (poster), Text block CTA, Mobile apps-beeld (§5.1); statistiekstrook en home-catalogusrijen weg (§5.6) | T1 | sectie-koppen in documentvolgorde == SR2b-blokkenlijst (13); h1-tekst == US; hero-img src == hero-banner-bestand | 1, 2, §5.1/§5.6 |
| 8 | **Statische pagina's 1:1**: About us, Dawah, Downloads (§5.1), Q&A, Contact (§5.7), Coupon publiek (§5.13) — teksten/koppen/knoppen uit SR2a-HTML en SR2b-panelen; paginatitels (§5.16) | T1 (Coupon-inwisselen T2) | per pagina: koppen == US-koppen; tekst-diff (genormaliseerd) == 0 verschillen; `/coupon` anoniem 200 | 1 |
| 9 | **Catalog**: Channels Live eerst, featured "New releases", alle categorie-rijen, zoekveld + Filters op de pagina; search-startweergave met raster | T1 | eerste rij-titel == "Channels Live 📡"; aantal rijen == aantal categorieën met inhoud; `form[role=search]` op /catalog; Filters-knop aanwezig | 1 |
| 10 | **Categoriepagina**: volledig aantal items (lazy/paginering), filters, paginatitel | T1 | linktelling Age 5-9 ≥ 80; title == "Age 5-9" | 9 |
| 11 | **Programma- en afleveringspagina**: COLLECTION-label, "Start watching", categorie-tags, share, N video's, playlist in sidebar, speler = poster; `/watch`-404 fixen (§5.14) | T1 routing/UI; **T2** zodra favorieten/entitlement/playback | `/programs/<slug>`: h1, playlist ≥ 1 item, poster-element; `/watch/<slug>` → 200 met speler-plek | 9; T2 na policies |
| 12 | **Live-kanalen** (§5.5): categorie + 29 kaarten als metadata | T2 (data-import = founderbesluit) | categorie channels-live telt 29 kaarten met LIVE-badge | kijkplatformkeuze |
| 13 | **Legal-teksten** (§5.8) en RTL-beeldtest catalogus (§5.12) | T1 | tekst-diff; AR-screenshot-structuurtest (logo rechts, menu rechts) | 6 |
| 14 | **Aanmelden/lead/checkout/pricing** (§5.2, §5.9, §5.11) | T3 (betaal, publiek) | — | betaalbeslissing (B16) |
| 15 | **E-mailsjablonen** (21, B29) | T3 (sends) | — | B29 + maildienst (§7 T9) |

Elke stap: één commit + de test groen in de commit-tekst, `pnpm build` groen, teller "N van 15" (SR 4-regels §3.3).

## §7 Niet vergelijkbaar en waarom

- **Ingelogde pagina's** (account, library, continue watching, favorieten, afleveringspagina met stream): productie heeft geen accounts (§6 punt 30); US-kant alleen via impersonatie gezien (SR 2b).
- **Afleveringspagina EI**: 404 → inhoud niet meetbaar (§5.14).
- **Speler**: US speelt (Mux/Uscreen), EI poster tot kijkplatformkeuze — bewust, geen delta.
- **Checkout/pricing/lead-flow**: US achter lead gate + valuta-redirect; EI geen routes (B16) — pas bij de betaalbeslissing.
- **Live-kanalen**: geen data in EI (§5.5).
- **Teksten woord-voor-woord** (About us, Dawah, Q&A, Downloads, Coupon): alleen koppen vergeleken; diff volgt als SR 4-test (§5.15).
- **AR-catalogus/-programmapagina's**: US in AR alleen als home/menu/footer gemeten met inhoud (Weglot sluit videotitels uit van vertaling — 24 excluded blocks); beeldvergelijk in SR 4.
- **Geo-varianten**: alleen vanuit EG-IP gemeten (SR 2c open).
- **Mobiele UA**: EI wél met mobiele emulatie (Playwright), US-twin alleen viewport; US-anoniem (SR 2a) wél met emulatie — vergelijking 390 op basis van SR 2a.
- **Blokteksten achter "Edit Content"** (US-editor): niet geopend; gerenderde tekst uit SR 2a-HTML gebruikt.
