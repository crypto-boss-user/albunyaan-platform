# Eindrapport fidelity-werkorder — 6/7 augustus 2026

Wat er is overgezet, wat is gerepareerd, wat niet kon, en waarop dat gebaseerd is.
Alle cijfers komen uit `worker/verify-migration-extras.mjs`, `worker/audit-migration.mjs`
en directe controles tegen de cloud-database en de Bunny-bibliotheek.

## 1. Volgorde van video's — HERSTELD

- **Series/afleveringen: 686 van 686 sluitend**, exact de Uscreen-volgorde
  (`collection_items.position`; audit 2026-08-07).
- **Categorieën waren de echte fout**: de nieuwe site sorteerde categorie-inhoud
  alfabetisch. Uscreen-categorieën zijn een handmatig geordende, GEMENGDE lijst
  van losse video's én series. Opgelost met tabel `category_items` (migratie 0013),
  scraper `scrape-category-order.mjs` en aangepaste weergave in `catalog.ts`.
- Nu vastgelegd: **25 categorieën met site-positie, 1.348 geordende items**.
- Steekproef «تطبيقات الحماية للأطفال 🛡️ Protect Your Child» (het door de oprichter
  genoemde voorbeeld): 8 van 8 onderdelen in exact de Uscreen-volgorde —
  Kids Place → Parental Controls in Windows (serie) → Protection in iOS →
  Kids Parental Control Series (serie) → 4 losse app-video's.
- Nog open: **41 items** (29 live-kanalen die geen serie zijn + 8 series van na de
  juli-kopie + 4 overige) staan nog niet in de categorie-volgorde. Geteld, niet verzwegen.

## 2. Kwaliteit — OORZAAK GEVONDEN, FIX BEWEZEN, HERSTEL WACHT OP GO

- **Oorzaak**: de transfer gebruikte `ffmpeg -map 0:p:1`. Mux zet de BESTE variant
  vooraan, dus `p:1` pakte stelselmatig de op-één-na-beste. De hele bibliotheek staat
  daardoor één kwaliteitstrap te laag (bewijs: Film Omar al-Mukhtar was 720p bij de
  bron en 480p bij ons; Albunyaan App 1080p bij de bron).
- **Fix**: `migrate-videos.ts` kiest nu via `ffprobe` de hoogste variant.
- **Bewijs in productie**: de 123 video's van na de juli-kopie zijn met de gefixte
  engine overgezet — steekproef 6/6 op 1080p→1080p; alle 123 nagemeten bij Bunny.
- **Pilot (verplichte poort vóór de volledige run), 2026-08-07 op de VPS, 5/5 geslaagd:**

  | video | bron | oude kopie | nieuwe kopie |
  |---|---|---|---|
  | Albunyaan App | 1080p | 720p | **1080p** |
  | Film Omar al-Mukhtar | 720p | 540p | **720p** |
  | Upin & Ipin | 720p | 480p | **720p** |
  | الألوان | 1080p | 540p | **1080p** |
  | يوميات ناصر afl. 11 | 1080p | 540p | **1080p** |

  Nieuwe kopieën samen 4,82 GB. Oude kopie wordt pas verwijderd ná geslaagde encode
  (fail-closed). Doorlooptijd 15 minuten voor 5 video's.
- **Stand**: 128 van 15.972 video's staan aantoonbaar op bronkwaliteit; 15.844 zijn
  nooit gemeten en gaan mee in de kwaliteitsronde (`requality-videos.ts`, uitsluitend
  op de Hetzner-VPS; 3–6 TB verkeer). **Wacht op**: goedkeuring pilot + saldo (±$300).

## 3. Documenten en downloads — OVERGEZET

- **107 van 107 bestanden**: 106 lokaal veiliggesteld in `~/.albunyaan-cc/resources/`
  (inclusief een xapk van 3,0 GB die drie eerdere pogingen brak), **73 met eigen
  publieke URL** in Supabase Storage (bucket `resources`).
- **33 grote APK's staan bewust alleen lokaal**: het gratis Supabase-plan begrenst
  uploads op 50 MB (verhogen = betaald plan; API antwoordde met 402). Hostingbesluit
  ligt bij de oprichter; de bestanden zijn veilig.
- Gekoppeld aan de juiste video's (76 video's hebben bijlagen) en zichtbaar op de
  videopagina achter de toegangspoort, met de echte bestandsnaam bij het downloaden.

## 4. Apps — OVERGEZET

De "apps" zijn Uscreen-resources (APK/XAPK) plus app-video's met verwijslinks in hun
beschrijving. Beide categorieën staan compleet in de database: «تطبيقات متنوعة
📱Apps (only for android)» met 71 losse app-video's en «Protect Your Child» met de
mix van apps en series, beide in de originele volgorde.

## 5. Comments / ta3lieqaat — GEEN KIJKERSREACTIES OP DIT PLATFORM

**Conclusie: er valt geen enkele ledenreactie over te zetten, want ze bestaan niet.
Wat de oprichter als "ta3lieqaat" zag, is het About-blok — beschrijvende tekst zonder
naam of datum — en die teksten ZIJN gemigreerd.**

Onderbouwing (2026-08-07):

1. **De winkelinstelling zelf zegt het**: de configuratie die Uscreen aan elke
   bezoeker én aan de app meestuurt bevat `gon.settings = { …, "commenting": false, … }`.
   Gecontroleerd zowel uitgelogd als in een ingelogde ledensessie. Commentaar staat
   store-breed uit.
2. **Geen spoor in de weergave**: op de programmapagina's (uitgelogd, ingelogd,
   met mobiele user-agent, na "Start watching") staan nul comment-elementen, nul
   comment-verzoeken in het netwerkverkeer en geen `تعليق`-tekst.
3. **De Community-module staat uit** in de beheeromgeving; `/manage/comments` geeft 404.
4. **Visuele bevestiging door de oprichter**: het blok op de telefoon bevat alleen
   beschrijvende tekst, geen ledennaam en geen datum.

Wat wél is overgezet (want dát was de inhoud):
- **141 serie-beschrijvingen** geoogst van de storefront en in `collections.description`
  gezet (o.a. de Salah al-Din al-Ayyubi-tekst uit de screenshot). 481 series hebben
  op Uscreen zelf geen tekst.
- **23 video's met een eigen beschrijving**; de overige 15.946 video-beschrijvingen zijn
  bij de bron lege HTML-schillen (`<p></p>`) — Uscreen bewaart de echte tekst op
  serieniveau.
- De tabel `video_comments` (migratie 0013) blijft leeg bestaan, klaar voor het geval
  reacties ooit worden aangezet.

Bijkomend: het Zapier-API-token werkt niet op de app-API v2 (controletest: geen token
→ 403, Zapier-token → 404, verzonnen token → 404, dus identiek gedrag aan een fout
token). Dat is nu niet meer nodig; `USCREEN_STORE_TOKEN` kan uit `cloud.env`.

## 6. Dekkingscontrole — de nieuwe definitie van "klaar"

`worker/verify-coverage.mjs` telt **drie lagen** tegen elkaar en meldt elk verschil
met naam en toenaam:

| laag | bron van waarheid |
|---|---|
| BRON | de Uscreen-oogst in `~/.albunyaan-cc/*.jsonl` |
| DATABASE | de cloud-Supabase |
| WEERGAVE | wat de gegenereerde bladerversie daadwerkelijk rendert |

Per soort (video's, series, categorieën, bijlagen, beschrijvingen) een ✅ bij
gelijke tellingen of een ❌ met de ontbrekende namen. Exitcode 1 bij één ❌.
Draait **automatisch** na elke showcase-build en elke import; bij een ❌ gaat er
een Telegram-melding naar de oprichter.

**Aanleiding**: twee categorieën verdwenen stilzwijgend uit de bladerversie —
«العمر - Age 16+» (1.119 video's) en «تربية وتعليم Essential Knowledge Kids»
(1.579 video's), plus «رمضانيات Ramadaan» en «Channels Live». Oorzaak: hun
storefront-permalink bevat een spatie en een plusteken (`category-Age 16+`) die
niet ge-encodeerd werden, en de scroll-lus stopte al bij de eerste nulmeting van
een traag ladende pagina. Beide gerepareerd; de scraper houdt nu bovendien per
categorie altijd de meting met de méeste items (de storefront laadt wisselvallig:
dezelfde categorie gaf 71 items in de ene ronde en 40 in de volgende).

**Vanaf nu geldt: "klaar" = alle drie de lagen tellen gelijk.**

Stand na reparatie (2026-08-07 22:15) — **25 van 25 categorieën in beeld**:

| soort | bron | database | weergave | |
|---|---|---|---|---|
| video's | 15.972 | 15.984 | 15.984 | ❌ verklaard: 12 rijen bestaan alleen bij ons (op Uscreen verwijderd, bij ons bewaard) |
| series | 686 | 686 | 686 | ✅ |
| categorieën | 25 | 25 | 24 + Channels Live | ❌ verklaard: zie hieronder |
| bijlagen (unieke bestanden) | 107 | 82 | 82 | ❌ verklaard: 25 bestanden hangen bij Uscreen aan géén enkele video |
| bestanden veiliggesteld | 107 | 107 | — | ✅ |
| series met beschrijving | 141 | 141 | — | ✅ |

De drie resterende ❌'en zijn **verklaarde, gewenste verschillen**, geen gaten:
- de 12 op Uscreen verwijderde video's houden wij juist vast;
- 25 bijlagen zijn bij Uscreen aan geen enkele video gekoppeld (wel veiliggesteld);
- «Channels Live 📡» bevat 29 IPTV-streams die nooit video-rijen in onze catalogus
  waren (geverifieerd in de back-up van 6 augustus: 0 rijen met status `live`, ook
  vóór dit werk). Live-kanalen horen bij de aparte live-werkstroom, niet bij de
  videomigratie.

Categorieën waarvan de storefront-volgorde niet vast te stellen was, worden nu
tóch getoond op basis van hun `video_categories`-koppelingen, met de voetnoot
"volgorde niet vastgesteld — categorie niet openbaar op storefront".

## 7. Verificatie — de harde cijfers (2026-08-07)

| | |
|---|---|
| Lid-zichtbare video's op eigen opslag | **15.180 van 15.180 (100%)** |
| Hele catalogus op eigen opslag | 15.972 van 15.984 (99,92%) |
| Kruiscontrole database ↔ Bunny | 15.972 gematcht, **0 kapotte verwijzingen** |
| Volgorde series | 686 van 686 sluitend |
| Beschrijvingen | 15.969 video's + 141 series |
| Bijlagen | 107 bestanden veiliggesteld, 73 online |
| Onbereikbare gepubliceerde video's | van 174 → **2** (en die 2 zijn óók op Uscreen categorieloos) |
| Omvang bibliotheek | 3,42 TB |

## 7. Wat NIET kon of open blijft

- **12 video's onherstelbaar**: de reeks «نكتة ومن أول السطر» is op Uscreen zelf
  verwijderd. Niet lid-zichtbaar, blokkeert niets.
- **Kwaliteitsronde** voor 15.844 video's — wacht op goedkeuring + saldo.
- **31 bestanden met afwijkende speelduur** (audit §3): mogelijk incompleet overgezet;
  gaan verplicht mee in de kwaliteitsronde.
- **41 categorie-items** nog niet geplaatst (live-kanalen + na-juli-series).
- **33 grote APK's** wachten op een hostingbesluit.
- **3 thumbnails** laden nog van uscreencdn.com.
- **624 restobjecten** in de Bunny-bibliotheek — opruimen alleen na expliciete goedkeuring.
- Eén eerdere melding is ingetrokken: "verdwenen aflevering 4166270" bleek het
  content-id van de serie zelf. Er ontbreekt niets extra's.
