# AD 0 — Inventaris Uscreen-admin (werkstroom AD, admin-pariteit)

STATUS: gemeten 2026-09-06 (sessie D, deel 0), branch `exit-phase`. **Deze meting is de norm voor AD 1–AD 4, niet het geheugen.**
Bron: `app.uscreen.tv/manage/*` via de twin Chrome (:9333, founder-sessie), alleen lezen, één pagina per keer, ≥ 1,8 s tussen
loads, 1440×900. Scripts: `~/projects/_scratch/ad0-scripts-2026-09-06/` (verkenning, fase A/B1/B2, stijl, ledendetail,
verwijder-drafts). Artefacten: licht in `reference/admin-2026-09/ad0-2026-09-06/` (tekst/JSON, manifest, fouten.log, menu,
stijltokens), zwaar in `var/admin-referentie/ad0-2026-09-06/` (PNG 1440 fullPage + HTML, gitignored), kopie op de NAS
`/volume1/Albunyaan/admin-referentie/ad0-2026-09-06/` (naast `archief-originelen/`, nooit erin). Wat SR 2b al vastlegde (thema,
snippets, DEPRECATED-pagina's, landing-page-instellingen, e-mailsjablonen, apps) is **niet** opnieuw gemeten — zie
`reference/storefront-2026-09/sr2b-2026-09-04/admin/`.

**Scope (founder 2026-09-06, §5 B81):** meten = Content (Videos, Collections, Resources, Categories, Custom Filters, Authors),
People (alleen "All" + één detail), Marketing (alle kaarten behalve Bundles, Refer to Uscreen, Refer a friend, Try again for free).
Alleen als menunaam: Home, Live Streaming, Calendar, Audiences/Tags/Comments, Community, Subscriptions, Bundles, Sales, Website,
Analytics, Mobile & TV apps, Settings, Refer to Uscreen, Changelog, Get help. Landing pages: alleen de lijstpagina (instellingen +
inhoud = SR 2b).

**Privacy (§5 B82):** ledenlijst = kolomnamen + telling (rijen gezwart in het screenshot, HTML niet bewaard); één ledendetail met
persoonsvelden gezwart (invoerwaarden, naam, e-mail, initialen), HTML en tekst niet bewaard. Elke pagina waarvan de tekst een
e-mailadres bevat krijgt dezelfde behandeling (fail-closed). De banner-link `billing.uscreen.tv/p/session?secret=…` is in elke
HTML/JSON gezwart.

**Incident (§5 B83, gemeld en hersteld):** de knoppen "Add new collection" en "Add category" maken bij Uscreen **direct** een
record aan (geen formulier vooraf): draft-collectie 4339003 en draft-categorie 297367 ontstonden bij het "alleen openen". Met
expliciet founder-ja (2026-09-06) via ⋯ → Delete verwijderd; controle: beide Not Found, storefront 404, telling 25 categorieën,
collectielijst ongewijzigd (eerste rij 4320470, 59 pagina's). Regel voortaan: bij Uscreen nooit op aanmaak-knoppen klikken; een
formulier wordt alleen gemeten als het een eigen `/new`-URL of dialoog is (Authors, Custom filters, Coupons).

## §1 Menu-inventaris (volledig, 2026-09-06)

Zijmenu links (271 px, wit, Inter). Hoofditems in deze volgorde; ▸ = inklapbare groep.

| # | Sectie | URL | Subsecties (naam → URL) | AD-scope |
|---|---|---|---|---|
| 1 | Home | `/manage/home` | — (3 tegels 30 dagen: Gross Revenue, Sign Ups, Video Views; Membership+-banner) | naam |
| 2 | Content ▸ | `/manage/videos` | Videos `/manage/videos` · Live Streaming `/manage/contents/live_events` · Collections `/manage/contents/collections` · Calendar `/manage/contents/calendar` · Resources `/manage/resources` · Categories `/manage/categories` · Custom Filters `/manage/catalog-filters` · Authors `/manage/authors` | meten (Live Streaming, Calendar = naam) |
| 3 | People ▸ | `/manage/people` | All `/manage/people` · Audiences `/manage/people/audiences` · Tags `/manage/people/tags` · Comments `/manage/people/video_comments` | meten (alleen All) |
| 4 | Community ▸ | `/manage/community/settings` | Settings · Challenges `/manage/community/challenges` · Badges `/manage/community/badges` (niet gelanceerd: "Launch your community") | naam |
| 5 | Subscriptions | `/manage/subscription_plans` | — (plannenlijst: Plan/Visibility/In trial/Members/Content/Price/Billing; 591 total members, €487.92 MRR) | naam |
| 6 | Bundles | `/manage/bundles` | — (leeg: "Create your first bundle") | naam |
| 7 | Sales | `/manage/sales/invoices` | Invoices (Export CSV, statusfilter, 126 pagina's) | naam |
| 8 | Marketing | `/manage/marketings` | hub met 15 kaarten in 3 groepen, zie §2.3 | meten |
| 9 | Website ▸ | `https://app.uscreen.tv/bullet/website` (oude admin) | Themes · Preferences · Pages · Impersonate (SR 2b) | naam |
| 10 | Analytics ▸ | `/manage/analytics/overview` | Overview · Content · People · Community · Sales · Subscriptions · Marketing · Advanced | naam |
| 11 | Mobile & TV apps | `/manage/apps` | — (iOS/Android/TV-kaarten, Customization, Preferences) | naam |
| onder | Changelog (badge 4) · Refer to Uscreen `/manage/store_referrals` · Get help · Settings `/manage/settings` · accountwisselaar (FI fitrahmedia) | | | naam |

Kopbalk per pagina: sidebar-toggle + breadcrumb (`Content › Videos › Details`), rechts soms "Give feedback". Boven alles de rode
banner "You have an unpaid invoice…" (accountstatus, niet nabouwen).

## §2 Scope-pagina's: lijsten, kolommen, handelingen, formulieren

Notatie: **[bulk]** = selectievakje per rij + kopvakje; **[sleep]** = drag-handle; **[⋯]** = rijmenu; **⚠ aanmaak** = knop maakt
direct een record aan. Aantallen zijn de getoonde tellingen op 2026-09-06.

### §2.1 Content

**Videos — `/manage/videos` — 16.025 videos (15.619 zonder free preview).**
Lijst: kopregel "16025 videos | Status | Uploaded on"; rij = [bulk] · thumbnail met duur-badge · titel (link → `/manage/videos/<id>/details`) ·
statusbadge (Published groen / Unpublished rood) · Uploaded on (datum) · [⋯]. Zoekveld "Search…", combobox Status, "More filters ›",
sorteerknop (⇅-icoon). Paginering onderaan: "Showing 1–30 of 16025 videos · Previous 1 2 … 535 Next · Rows per page 30". Kop: paginamenu ⋯ +
primaire knop **Upload videos** → inline paneel "You can upload .mp4, .mov, or .avi files" + "Import from Dropbox" (bestandskiezer; niet
geopend). Info-banner met bulkactie "Enable free previews for all videos" / "I'll do it later".
Detail `/manage/videos/<id>/details` (één pagina, geen tabs; kop = titel · ⋯ · **Save changes** [uit tot wijziging]):
- Links: **About** (Title; Description rich text: Text Style/Bold/Italic/Underline/strike/lists/align/link/color/line height/direction + HTML-schakelaar; Short description ≤ 140) · **Thumbnails** (Horizontal 1480×840, Featured category ›) · **Organize** (Categories als chips, "+ Add new category", "Manage categories"; Authors "Add authors"; Custom filters Type/Subject combobox, "Manage filters") · **SEO** (Website page title, Website URL `/programs/<slug>`, Meta description ≤ 170) · **Search keywords** (chips + Add) · **Resources** (Select resources…, Manage resources).
- Rechts: **Video** (speler, Request download, Replace, View on website) · **Visibility** radio Unpublished/Published/Scheduled + "Add expiration date" · **Access** radio Gated / Free for all users + "Advanced settings" · **Subscription & Pricing** (plannen multiselect "11 items selected", Additional pricing options) · Music playlist: Apps (Uscreen-upsell) · **Subtitles and captions** (.VTT/.SRT ≤ 3 MB; rij "EN English (auto-generated)" [⋯]) · **Audio track** (.M4A/.MP3/.WAV ≤ 70 MB; "EN Default") · **Preview** radio Free preview (Duration combobox "30 seconds (recommended)", Start time mm:ss) / Trailer / None.

**Collections — `/manage/contents/collections` — 59 pagina's × 12 (DB: 686).**
Lijst: kop "Collections | Status | Created"; rij = [bulk] · thumbnail · titel (link → `/manage/contents/collections/<id>/details`) · statusbadge · datum.
Zoekveld, combobox Status. Kop: **Add new collection** ⚠ aanmaak (springt direct naar een "Draft Collection", Unpublished). Paginering Previous 1 2 … 59 Next.
Detail: zelfde opbouw als video-detail zonder Video-kaart, plus **Playlist and drip settings**: rijen [sleep] · thumbnail · titel · checkbox "Available for free" · pin-naar-boven · "Drip" · verwijder; knoppen **Add video**, **Add divider**. Preview: Trailer/None. Paginamenu ⋯: View on website · Geo-blocking · Delete collection (bevestigingsdialoog: "The videos inside it will not be deleted").

**Resources — `/manage/resources` — 107 resources, 9 pagina's × 12.**
Lijst: naam · type · grootte (APK/PDF/JPG/XAPK) · Uploaded on; zoekveld; kop **Upload resources**; paginering. Geen detailroute gezien (rij-acties niet geopend).

**Categories — `/manage/categories` — 25 categories ("Categories in browse").**
Lijst: rij = [sleep] "Reorder <naam>" · titel (link → `/manage/categories/<id>/edit`) · kolom **Videos** (telling: Channels Live 29, Welcome 10, New on Albunyaan 145, Anasheed 21, Age 0-2 132, Age 2-4 218, Age 5-9 322, Age 10-16 166, Age 16+ 68, Handicrafts 7, Children's Programs 11, Essential Knowledge Kids 137, Arabic for Kids 87, Ramadaan 22, New releases (Featured) 16, Dhul-Hidjah 15, Nederlands 17, English 62, Arabic for non-native 8, Arabic Language Sciences 8, Be Conscious 13, Essential Knowledge Parents 13, Documentary 62, Protect Your Child 8, Apps 73). Zoekveld; kop **Add category** ⚠ aanmaak ("Draft Category 1", positie 26). "Learn more about Categories".
Edit: kop titel · ⋯ (More actions: Delete category, met "cannot be restored"-dialoog) · Save changes. **About**: Category title, Category position (number, ▲▼), Category description (rich text). **Manage content**: "Sort content by" combobox Manual / Newest first / Oldest first / Title A→Z / Title Z→A / Popular (7 days) / Popular (30 days); **Randomize content**; **Add content**; tabel CONTENT · PUBLISHED DATE · STATUS met [sleep] per rij (item = Video of Collection). **Image** (Upload image 1480×840, View on website). **SEO** Title 0/60, URL `/categories/<slug>`, Meta description 0/170.

**Custom filters — `/manage/catalog-filters` — 2 filters.**
Type (Series - مسلسلات, Movies - أفلام, Apps - تطبيقات, Live - بث مباشر) · Subject (Creed, Qor'aan, Fiqh, Biography, Doaa & adkhaar, Arabic language, Entertainment, Anasheed, Other, History). Per filter [sleep] "Drag to reorder" + "More options"; "Preview"; **Add filter** → dialoog "Create a filter": Filter name *, Filter options (rijen met Remove, "Add option"), Cancel/Save. Autosave-indicator "Changes saved".

**Authors — `/manage/authors` — 0 ("No authors yet").**
**New author** → `/manage/authors/new`: Name *, Bio (rich text), Author image 740×740, SEO (Advanced): Meta title 0/60, Custom URL handle `albunyaan.tv/authors/`, Meta description 170; Save.

### §2.2 People

**All — `/manage/people` — 3.051 people, 123 pagina's × 25.**
Kop: "Add member", "Give feedback". Filters: zoekveld "Search by name or email", comboboxen Filter by user type / Filter by status / Filter by tags, "More filters". Kolommen: (avatar-initialen + naam + e-mail) · **Tags** · **Status** (— / Active) · **Lifetime** (€) · **Creation date**. Rijen gezwart (B82). Paginering Previous 1 2 … 123 Next.
Detail `/manage/people/<id>` (kop naam · ⋯ · "Changes saved"): **About** Age, Country of residence, Preferred Language, Private notes ("Only visible to admins"), Email, Display Name, Tags (+). **Invoices**, **Emails**, **Activity** (tabel Activity/Date, "View all activity"). Rechts: avatar, naam, badge Lead/Member, "Created <datum> · No payment information"; **Membership** "+ Add membership", Lead source, UTM source, Lifetime spent; **Email Topic notifications** (News, Promotions, Content announcements, Community Updates: Yes/No); **Watch history** (12 maanden, link Analytics); **Bundle access** (Select bundles, Manage bundles); **Content access** (Select content, Manage videos). Audiences/Tags/Comments niet geopend.

### §2.3 Marketing

Hub `/manage/marketings`: **Generate leads** — Website landing pages · Giveaway funnels · YouTube lead generator · Refer a friend (naam) · Link in Bio (Beta) · Email capture; **Nurture audience** — Automations · Email broadcasts · Push notifications · Coupons · Gifts · Subscription upsell · Abandoned cart; **Win-back** — Try again for free (naam).

| Pagina | URL | Stand | Lijst/kolommen | Handelingen |
|---|---|---|---|---|
| Landing pages | `/manage/marketings/landing_pages` | 9 pagina's (Sign in form, 5× Checkout-varianten, ideeVideosmiss, Checkout *OLD*, Q&A) | naamlijst | **Create a page** (page builder = buiten scope; instellingen/inhoud in SR 2b) |
| Giveaway funnels | `/manage/marketings/giveaway_funnels` | leeg | — | New giveaway, Learn more |
| YouTube lead generator | `/manage/marketings/youtube_funnels` | leeg | — | New lead generator, Learn more |
| Link in Bio (Beta) | `/manage/link-in-bio` | Draft, 4 items | tabs Content / Design / Preview; profielfoto 800×800, Display name 100, Bio 300, Social links, Items [sleep] met zichtbaarheidsschakelaar/Edit/Delete, "Show referrals" | Copy link, Publish, Save changes, Add |
| Email capture | `/manage/marketings/email_captures` | 1 formulier (0 e-mails) | Form name · Emails collected · Created at; zoekveld | New email capture |
| Automations | `/manage/marketings/automations` | leeg | — | Create automation, Learn more |
| Email broadcasts | `/manage/marketings/email_broadcasts` | 1 (Sent, 59 ontvangers, 53 % geopend) | Name · Delivery date · Status · Publish on web · Recipients · Opened · Clicked; zoekveld; combobox All statuses | New broadcast |
| Push notifications | `/manage/marketings/push_notifications` | 5 verzonden (196–3.025 ontvangers) | Title · Status · Recipients · Sent on | New notification |
| Coupons | `/manage/marketings/coupons` | 4 (FREEACCESS 100 % actief 138×; JAARABBO, DARALHUDAA23 3/1000, MOBYACCESS €35 verlopen) | Coupon · Discount · Redeemed · Status · Expires; zoekveld "Search by coupon code"; comboboxen All discount types / All products / All expirations; link Stats | **New coupon** → `/coupons/new` |
| Coupon-formulier | `/manage/marketings/coupons/new` | — | **Coupon details**: Code (onveranderbaar na opslaan), Discount Percentage/Fixed + waarde, Coupon description (alleen admins). **Redemption limits**: Never expires / Expires on; No limit / Limit to. **Usage rules**: Allow multiple uses per user · Allow for plan changes · Personalize codes when sent in emails. **Content**: All products / Subscription / Bundle / Content. | Save |
| Gifts | `/manage/marketings/gifts` | leeg ("No gifts") | — | Settings, Learn more |
| Subscription upsell | `/manage/marketings/subscription_upsells` | leeg | — | New offer, Learn more |
| Abandoned cart | `/manage/marketings/abandoned_carts` | leeg | — | New offer |

## §3 Stijltokens (gemeten op `/manage/videos`, `stijl-tokens.json`)

Font **Inter** (ui-sans-serif fallback), body 16 px/24 px, menu-items 14 px/20 px weight 500. Zijmenu 271 px, wit, tekst
`rgb(52,66,86)`, actief item achtergrond `rgb(225,231,239)` radius 6 px padding 8 px, rand `rgb(236,239,244)`. Primaire knop
`rgb(0,106,255)` op `rgb(240,245,255)`, 14 px 500, radius 6 px, padding 8×16. CSS-variabelen (HSL, shadcn-stijl): primary
`215 100% 50%`, primary-foreground `219 100% 97%`, foreground `229 84% 5%`, background `0 0% 100%`, muted `210 40% 98%`,
muted-foreground `215 16% 47%`, border `218 27% 94%`, accent `219 100% 97%`, destructive `6 50% 49%`, secondary `210 40% 96%`,
sidebar-foreground `215 25% 27%`, sidebar-accent/border `214 32% 91%`. Statusbadges: Published groen, Unpublished rood.
Kaarten wit met 1 px rand en radius, twee kolommen (≈ 2:1) op detailpagina's; paginakop = titel links, ⋯ + primaire knop rechts.
**Tokens voor de eigen admin apart houden van de storefront-tokens (Cairo/#447525)** — de storefront verandert niet.

## §4 Artefacten en tellingen

| Meting | Waarde |
|---|---|
| Uscreen-loads (alleen lezen) | verkenning 1 · fase A 10 · B1 7 · B2 25 · ledendetail 1 · stijl 1 · verwijder-drafts 6 = **51**, 429 = **0**, STOP-signalen 0 |
| Scope-pagina's gepland / gelukt / mislukt | 23 gepland + 5 formulieren + 2 eerste-rij = 30 cellen; **30 gelukt**, 0 mislukt; 1 opnieuw (ledendetail, PII) |
| Manifest | 91 regels (28 HTML, 30 PNG, 30 tekst, 3 meta: menu-inventaris, loads, stijl-tokens); lokaal sha256+bytes 91/91; NAS 91/91 gelijk, 0 afwijkend (`~/projects/_scratch/ad0-2026-09-06-nas-verificatie.txt`) |
| Menu | 11 hoofditems + 5 onderaan; subsecties Content 8, People 4, Community 3, Analytics 8, Website 4 (SR 2b) |
| Itemtellingen | videos 16.025 · collections 59 p. (686 DB) · resources 107 · categories 25 · custom filters 2 · authors 0 · people 3.051 · landing pages 9 · coupons 4 · broadcasts 1 · push 5 · email captures 1 · gifts/upsell/abandoned/automations/giveaway/youtube 0 |
| fouten.log | 14 regels: 9 nota's (formulieren geopend, PII-maskering) + incident (2) + upload-knop + banner-zwarting + heropname ledendetail |

## §5 Vragen en nota's voor de founder

1. Uscreen toont per video geen Age/Access-kolom in de lijst; de eigen `/admin/videos` wel (Age rating, Bunny). Behouden als extra kolom of 1:1 weglaten? (standaardaanname AD 2: 1:1 = weglaten, age rating blijft in het detail).
2. Statussen: Uscreen kent Unpublished/Published/Scheduled; de DB kent draft/published/scheduled/live. Voorstel: "draft" tonen als "Unpublished"; "live" blijft een eigen status (Live is buiten scope).
3. Custom filters bestaan in de DB (`filters`-tabel) — bevestigen dat AD 2 ze beheert (2 filters, 14 opties).
4. Email capture "Created at Sep 6, 2026" — er lijkt vandaag een formulier aangemaakt (0 e-mails); niet door deze sessie (alleen lezen; geen New-knop geraakt). Ter controle.
