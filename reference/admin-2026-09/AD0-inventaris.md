# AD 0 — Inventaris Uscreen-admin (werkstroom AD, admin-pariteit)

STATUS: gemeten 2026-09-06 (sessie D, deel 0) + **AD 0b 2026-09-07 (deel 0b: Home, Subscriptions, Sales, Analytics, Settings — §2.4–§2.8, B84)**, branch `exit-phase`. **Deze meting is de norm voor AD 1–AD 4, niet het geheugen.**
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
| 1 | Home | `/manage/home` | — (3 tegels 30 dagen: Gross Revenue, Sign Ups, Video Views; Membership+-banner) | **meten (AD 0b, §2.4)** |
| 2 | Content ▸ | `/manage/videos` | Videos `/manage/videos` · Live Streaming `/manage/contents/live_events` · Collections `/manage/contents/collections` · Calendar `/manage/contents/calendar` · Resources `/manage/resources` · Categories `/manage/categories` · Custom Filters `/manage/catalog-filters` · Authors `/manage/authors` | meten (Live Streaming, Calendar = naam) |
| 3 | People ▸ | `/manage/people` | All `/manage/people` · Audiences `/manage/people/audiences` · Tags `/manage/people/tags` · Comments `/manage/people/video_comments` | meten (alleen All) |
| 4 | Community ▸ | `/manage/community/settings` | Settings · Challenges `/manage/community/challenges` · Badges `/manage/community/badges` (niet gelanceerd: "Launch your community") | naam |
| 5 | Subscriptions | `/manage/subscription_plans` | — (plannenlijst: Plan/Visibility/In trial/Members/Content/Price/Billing; 591 total members, €487.92 MRR) | **meten (AD 0b, §2.5)** |
| 6 | Bundles | `/manage/bundles` | — (leeg: "Create your first bundle") | naam |
| 7 | Sales | `/manage/sales/invoices` | Invoices (Export CSV, statusfilter, 126 pagina's) | **meten (AD 0b, §2.6)** |
| 8 | Marketing | `/manage/marketings` | hub met 15 kaarten in 3 groepen, zie §2.3 | meten |
| 9 | Website ▸ | `https://app.uscreen.tv/bullet/website` (oude admin) | Themes · Preferences · Pages · Impersonate (SR 2b) | naam |
| 10 | Analytics ▸ | `/manage/analytics/overview` | Overview · Content · People · Community · Sales · Subscriptions · Marketing · Advanced | **meten 6 (AD 0b, §2.7; Community/Advanced = naam)** |
| 11 | Mobile & TV apps | `/manage/apps` | — (iOS/Android/TV-kaarten, Customization, Preferences) | naam |
| onder | Changelog (badge 4) · Refer to Uscreen `/manage/store_referrals` · Get help · Settings `/manage/settings` · accountwisselaar (FI fitrahmedia) | | | naam; **Settings = meten (AD 0b, §2.8)** |

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

### §2.4 Home (AD 0b, 2026-09-07) — `/manage/home`

Kop "Welcome, fitrahmedia." · blok **Last 30-day performance** met drie tegels, elk met link "View more": **Gross Revenue** (841.02 EUR → oude
admin `bullet/analytics/embedded/sales`), **Sign Ups** (65 → `bullet/community/people`), **Video Views** (44,455 → `bullet/analytics/embedded/contents`).
Geen periode-keuze (vast: laatste 30 dagen). Daaronder de Uscreen-upsell "Grow your membership with coaching… Membership+" met knop **Go to
Membership+** (niet nabouwen). Geen velden, geen tabellen. **Cijfers = VOORBEELD** (meetwaarden 07-09; B84: in de eigen admin als voorbeeld gelabeld
tot betaal-/kijkplatformkoppeling).

### §2.5 Subscriptions (AD 0b) — `/manage/subscription_plans` — 11 plannen (2 Public, 9 Private)

Kop: **New plan** → `/manage/subscription_plans/new` (formulier-URL, maakt niets aan — gecontroleerd: na de meting nog 11 plannen). Blok **Performance
overview** + "See breakdown" (→ Omni-embed subscriptions): 592 total members (−1.82 % this month) · 0 on trial (0.00 %) · €487.92 MRR (+2.51 %).
Zoekveld "Search". Tabel: **Plan** (naam + badge "Connected to Android TV / iOS / Android / apps") · **Visibility** (Public/Private) · **In trial** ·
**Members** (link → `/manage/people?access_offer_ids=<id>`) · **Content** (6.714 / 6.719) · **Price** · **Billing** (Monthly/Annual). Rijen (naam ·
zichtbaarheid · leden · prijs · interval): AlbunyaanTV | Sadaqah Jaariyah · Public · 70 · €65.00 · Annual; idem · Public · 141 · €6.50 · Monthly;
(Android TV) year · Private · – · €65.00 · Annual; (Android TV) month · Private · – · €6.50 · Monthly; (iOS) year · Private · 18 · €64.99 · Annual;
(iOS) month · Private · 32 · €6.49 · Monthly; (APPS) month · Private · 13 · €6.50; (APPS) year · Private · 8 · €65.00; (APPS- INACTIVE) Early Bird
Monthly · Private · – · €3.50; Invest in your hereafter! month · Private · 71 · €6.50 · Monthly; idem year · Private · 239 · €65.00 · Annual. Proefperiode:
geen enkel plan "In trial". Geen subsecties in het zijmenu.
**Edit** `/manage/subscription_plans/<id>/edit` (kop "Edit plan" · Preview · Save [uit tot wijziging]; één pagina, geen tabs): **Plan name** · **Description**
(rich text: Text Style Heading 1–4/Body/Small/Quote, Align, Direction) · **Image** 995×560 · **Billing period** combobox Monthly / 3 months / 6 months /
Annual · **Price** EUR + "Change price" en AUD/CAD/GBP/USD (5 number-velden) + "Manage currencies" · **Free trial** schakelaar ("Customers can try your
content before committing", Preview) · **Pausing** schakelaar (pauze ≤ 3 maanden, "Manage paused members") · **Reduce cancellation churn** schakelaar →
Discount percentage (%) + Deal duration (billing periods) · **Visibility** radio Public ("Visible to those who visit your store") / Private ("Hidden from
your website. Available via apps or direct link") · **Content**: "Manage content", "Remove all", lijst van collecties met videotelling; telling "This plan has
6009 videos, 682 collections and 28 live events". **New** `/new`: zelfde velden, "No content added yet".

### §2.6 Sales (AD 0b) — `/manage/sales/invoices` — enige subsectie **Invoices**: 3.134 facturen, 126 pagina's × 25, Total €30,478.81

Kop: **Export CSV**. Filters: combobox **All Statuses** · sorteer-combobox **Created (newest first)** · **More Filters** · zoekveld "Search…". Kolommen:
**Invoice** (#nummer, link → `/manage/invoices/<id>`) · **User** (naam, link → people) · **Created** · **Status** (Paid …) · **Paid at** · **Coupon** ·
**Total**. Paginering "Previous · Page 1 of 126 · Next". Rijen en factuurnummers gezwart (B82 + founder 07-09). Detail `/manage/invoices/<id>`: kop
"Invoice #…", geen knoppen; inhoud = persoonsgebonden factuurgegevens → alleen structuur bewaard (47 tekstknopen gezwart), velden niet vastgelegd.

### §2.7 Analytics (AD 0b) — Omni-embed (`omni.uscreen.tv/dashboards/<naam>` in een iframe; 6 van 8 gemeten, Community/Advanced = naam)

Elke pagina: kop met de sectienaam; de inhoud is een ingebedde Omni-dashboard (eigen scroll). Gemeenschappelijk per tegel: ⓘ-uitleg, "Tile options",
"Copy Query ID"; bovenaan "Re-run"; onderaan "Learn more about … Analytics | Analytics Playbook" en "Generated <datum>". **Export-knoppen: geen**
(alleen Copy Query ID). Cijfers hieronder = VOORBEELD 07-09.

| Pagina | Periode-/filterkeuzes | Tegels (KPI) | Grafieken / tabellen / tabs |
|---|---|---|---|
| Overview | Date Range "in the past 30 days" (past/between/on the day/in the month…), Compare to Previous Period, Timeframe Date/Week/Month/Quarter/Year | Net Sales €454.02 (+12 %) · Engagement: Active Users 39 % · MRR €487.92 · Watch Time 4,821 h · Active Subscriptions 592 · Net Growth −11 (New 15 / Reactivated 0 / Churn 26) | "✨ AI Insights"-tekst; grafiek Subscriptions (acquisities/reactivaties/churn) |
| Content | Date Range 30 d, Compare to Previous Month, User Tags, Group Subscription | Views 44,908 · Viewers 289 · Watch Time 4,821 h | tabel **Most Popular** (Content · Views; Basmah TV Live 689, Rawdah TV Live 270, …); tabs Overview · Videos · Live Streaming · Collections · Calendar · Organize (Authors); kaarten Benchmarks › / Trends › / Audience › |
| People | Visible on People Page (is true), User Created At (anytime), Tags (+2) | Users: 3,051 Total · 1,589 Members · 2 One-time Buyers · 1,462 Leads | **Members by Subscription Status** (In Trial 0 · Active 582 · Paused 0 · On Hold 3 · Churned 1,004); **Active Members by Activity Status** (New 32 · Reactivated 1 · Upgraded 0 · Downgraded 0 · Pending Pausing 0 · Pending Cancellation 8); tabs Overview · Audience |
| Sales | Time Frame Day/Week/Month/Quarter/Year, Payment Date "past 8 weeks", Product Type (+8), Payment Provider, Product Title, Billing interval, Is Refunded, Is Discounted, Is Free Sale, Coupon Code, Group Subscription | Gross Sales 1,690 € · Net Sales 845 € · Number of Sales 147 ("See location breakdown ›") | tabs Sales · Payouts; grafieken Net Sales & Growth Rate Over Time (Net sales/Discount/Balance applied), Earnings Over Time, Fees Over Time, Net Sales by Product Type; tabellen Sales Report, Coupon Report, **Net Sales by Customer** (persoonsgebonden) |
| Subscriptions | Time frame, Date range "past 12 months", Billing interval (+6) | In Trial 0 · Active Subscriptions 586 · Active Subscriptions Created Via API 293 · Active Subscriptions From Migrated Users 0 · Current MRR 487.92 EUR | tabs Overview · Trials · New · Engagement · Churn · MRR · Benchmarks; grafieken Active Subscribers by Origin, Paused Subscriptions by Status, Starting Active & Growth Rate, New & Churned Subscriptions; HubSpot-banner "Turn more trials into members" |
| Marketing | Date Range (anytime) | per tool een kaart in 3 groepen (Generate Leads / Nurture Audience / Win-back): Email Broadcasts (Emails Delivered 0, open rate ∅) · Coupons (Redemptions 157) · Gifts (Gifts Redeemed 0) · YouTube Lead Generator, Subscription Upsell, Refer a Friend, Abandoned Cart, Giveaway Funnels, Automations, Try Again for Free, Reduce Churn ("Try it now!") | — |

### §2.8 Settings (AD 0b) — `/manage/settings` hub: 3 groepen, 14 kaarten (Website builder = buiten scope; General, Domain, Email templates, Snippets = SR 2b, niet opnieuw)

Hub: **Storefront setup** (General settings · Domain settings · Checkout · Snippets · User fields) · **Communication** (Marketing email settings · Email
templates · Calendar push templates · Video comments) · **Integration & security** (Exported files · Webhooks · Integrations · Security · Geo-Blocking).
Elke kaart = titel + één regel uitleg, link naar de subpagina. Geheime waarden zijn gezwart (veldnaam wel, waarde niet).

| Pagina | URL | Velden / schakelaars | Knoppen | Stand 07-09 |
|---|---|---|---|---|
| Checkout | `/manage/settings/checkout` | **Connect your payment provider**: Stripe (Connected, Account ID gezwart) · PayPal (wallet) · Legacy PayPal (Connected, e-mail gezwart). **Level up your checkout**: Automatic tax collection · Localized pricing (Connected) · Donations · Cover my fees · Buy now, pay later (Connected: Klarna/Afterpay/Affirm) | Disconnect · Connect · Get started · Preview · Edit · Disable · Learn more | Stripe + legacy PayPal gekoppeld; localized pricing en BNPL aan |
| Checkout › Localized Pricing | `/manage/settings/checkout/localized_pricing` | tabel Products · Base price (EUR) · AUD · CAD · GBP · USD (number-velden per plan, 5 plannen × 4 valuta); zoekveld "Search by product" | Add currency · Save | 4 extra valuta, waarden 0.00 |
| Integrations | `/manage/settings/integrations` | **Automation & AI**: Zapier (sleutelveld, gezwart, kopieerknop) · Delphi. **Media**: Popular music providers (Request access). **Marketing & analytics**: Mailchimp (Action required) · Drip · Google analytics (Connected) · Google tag manager · Facebook (Connected) · Linkedin · TikTok · X. **Affiliate & revenue**: Rewardful · Refersion · Profitwell by paddle | Connect · Manage connection (⋯) · Request access · Learn more | GA + Facebook-pixel + Mailchimp gekoppeld |
| Security | `/manage/settings/security` | **Captcha for end users** Enabled ("Contact us to disable") · **Device session limits** Enabled, combobox Max devices per member = 7, "Use subscription plan overrides →", "Remove limit" · **DRM** Beta ("Contact us to enable") | Contact us to disable/enable · Remove limit | captcha aan, 7 apparaten, DRM uit |
| Geo-Blocking | `/manage/settings/geo-blocking` | combobox "Search and add a country…", **Block all**; "No countries are currently blocked." | Save [uit] | 0 landen |
| Marketing email settings | `/manage/settings/marketing-email` | **Sender information**: From name · From email (@no-reply.uscreen.io) · **Custom email domain** (veld yourdomain.com, Connect [uit]) · **Email topics** (max 10): News (System; broadcasts/automations) · Promotions (System) · Content announcements (System); "Create new topic" [uit] | Save · Connect · Create new topic | standaard-afzender, 3 systeemtopics |
| Webhooks | `/manage/settings/webhooks` | tabel URL · Event · Status · Last delivery · Created; 2 webhooks: `int.albunyaan.tv/delete_user.php` (User updated, Active) · `int.albunyaan.tv/cancellation_webhook.php` (Access canceled, Active) | Create webhook | 2 actief, laatste levering 6 sep 2026 |
| User fields | `/manage/settings/custom-user-fields` | User Field 1/2/3 (tekst; placeholders "How did you hear about us?" / "Where are you located?" / "T-shirt size?") | Save [uit] | leeg |
| Calendar push templates | `/manage/settings/calendar-push-templates` | tabel Type · Time sent: Live events (at start / 1 h before / 24 h before) · Published videos (same day / day before) · Scheduled videos (at start / 1 h / 24 h) · Coming soon videos ("Notify Me"); elke rij → eigen sjabloonpagina (niet geopend) | — | 9 sjablonen |
| Exported files | `/manage/settings/exported_files` | tabel File name · Note · Status · Export date; 6 pagina's × 20 (rijen gezwart: bestandsnamen bevatten persoonsgegevens-exports) | Previous/Next | ≥ 100 exports |
| Video comments (Settings-kaart → People) | `/manage/people/video_comments/settings` | **Access to view** combobox Anyone / All logged in users / Logged in users with access · **Access to post** combobox All logged in users / Logged in users with access · **Availability** radio Enable / Disable video comments | Save [uit] | view = Anyone, post = All logged in users, enabled |
| General · Domain · Email templates · Snippets | SR 2b | zie `reference/storefront-2026-09/sr2b-2026-09-04/admin/` (D/E/C/snippets) | | niet opnieuw gemeten |

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
| **AD 0b (07-09)** | loads 32 (verkenning 5 · vastlegging 24 · controle 1 · factuur opnieuw 1 · checkout opnieuw 1), 429 = 0, STOP 0, 0 klikken; cellen 24 (Home 1 · Subscriptions 3 · Sales 2 · Analytics 6 · Settings 12); manifest 68 (24 PNG, 18 HTML, 24 tekst, 2 meta) lokaal = NAS 68/68; fouten.log 11 nota's; tellingen: plannen 11, facturen 3.134 (126 p.), analytics 6, settings 14 kaarten (10 + hub gemeten, 4 SR 2b) |
| fouten.log | 14 regels: 9 nota's (formulieren geopend, PII-maskering) + incident (2) + upload-knop + banner-zwarting + heropname ledendetail |

## §5 Vragen en nota's voor de founder

1. Uscreen toont per video geen Age/Access-kolom in de lijst; de eigen `/admin/videos` wel (Age rating, Bunny). Behouden als extra kolom of 1:1 weglaten? (standaardaanname AD 2: 1:1 = weglaten, age rating blijft in het detail).
2. Statussen: Uscreen kent Unpublished/Published/Scheduled; de DB kent draft/published/scheduled/live. Voorstel: "draft" tonen als "Unpublished"; "live" blijft een eigen status (Live is buiten scope).
3. Custom filters bestaan in de DB (`filters`-tabel) — bevestigen dat AD 2 ze beheert (2 filters, 14 opties).
4. Email capture "Created at Sep 6, 2026" — er lijkt vandaag een formulier aangemaakt (0 e-mails); niet door deze sessie (alleen lezen; geen New-knop geraakt). Ter controle.
5. (AD 0b) Home toont drie 30-dagen-cijfers; in de eigen admin tot de betaal-/kijkplatformkoppeling als VOORBEELD gelabeld (B84) — of liever de tegels weglaten tot echte cijfers?
6. (AD 0b) Settings › Checkout/Integrations/Security/Geo-blocking: als tekst en schakelaars 1:1 nabouwen zonder werking ("wacht op betaal/kijkplatform"), of alleen de kaarten die de eigen stack kent (webhooks, user fields, video comments)?
7. (AD 0b) Subscriptions: de `plans`-tabel is leeg (0 rijen); de 11 Uscreen-plannen als metadata importeren (naam, prijs, interval, zichtbaarheid, apps-koppeling) vóór AD 2.3, of pas bij de betaalbeslissing?
8. (AD 0b) Sales › Invoices bestaat alleen als Stripe-koppeling; tot die tijd lege lijst met de gemeten kolommen, of de sectie als menunaam laten?
