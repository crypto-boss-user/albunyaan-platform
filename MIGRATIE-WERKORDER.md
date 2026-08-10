# MIGRATIE-WERKORDER — fidelity-fixes van 6 augustus 2026

STATUS: klaar om uit te voeren in Claude Code op de Mac (branch `exit-phase`).
Alles hieronder is op 6 aug 2026 LIVE geverifieerd tegen de Uscreen-beheeromgeving
en de cloud-database. Geen aannames; bij elk punt staat wat het bewijs is.

## Wat er is vastgesteld (de eerlijke stand)

1. **KWALITEIT — hele bibliotheek één kwaliteitstrap te laag overgezet.**
   De transfer gebruikte `ffmpeg -map 0:p:1`. Mux zet de BESTE variant bovenaan;
   `p:1` pakt dus altijd de op-één-na-beste. Bewijs: "Film Omar al-Mukhtar" is
   op Uscreen 720p, onze kopie op Bunny is max 480p; "Albunyaan App" is op
   Uscreen 1080p. Steekproef van 7 kopieën: geen enkele haalt 1080p.
   → Fix zit nu in `worker/migrate-videos.ts` (ffprobe kiest voortaan de beste
   variant). Herstel van de ±15.800 al overgezette video's: `worker/requality-videos.ts`.

2. **VOLGORDE — series klopten al, categorieën niet.**
   Series/afleveringen: 686/686 correct (bestaande audit). Maar de
   categorie-volgorde is nooit vastgelegd en de nieuwe site sorteerde
   categorieën alfabetisch/op-grootte. Uscreen-categorieën zijn een HANDMATIG
   geordende, GEMENGDE lijst van video's én series ("Manage content").
   → Nieuwe tabel `category_items` (migratie 0013), scraper
   `scrape-category-order.mjs`, en de site rendert die volgorde nu exact
   (`catalog.ts` + categoriepagina).

3. **ONBEREIKBARE VIDEO'S — 174 van de 197 gepubliceerde losse video's**
   (films, app-pagina's) hangen in GEEN enkele serie of categorie in onze
   database, terwijl ze op Uscreen wél in categorieën staan (bewijs:
   "Albunyaan App" zit daar in 2 categorieën, bij ons in 0). Dít is waarom
   lange video's/films "verdwenen" lijken — de bestanden zíjn overgezet.
   → De extras-import herstelt de categorie-koppelingen volledig.

4. **BESCHRIJVINGEN / BIJLAGEN / ONDERTITELS / TAGS — nooit gescraped.**
   Alle 15.861 video's hebben lege description, short_description, resources
   én subtitle_tracks (query-bewijs). Uscreen heeft 107 downloadbare bestanden
   (APK's/PDF's — de "apps") en per video auto-gegenereerde EN-ondertitels.
   → `harvest-video-extras.mjs` + `download-resources.mjs` + `import-video-extras.ts`.

5. **±122 nieuwe video's** sinds de catalogus-kopie van 5 juli ontbreken als rij.
   → De extras-harvest enumereert nu rechtstreeks bij Uscreen en de import maakt
   de ontbrekende rijen aan.

6. **DOORBRAAK die alles versnelt:** de Uscreen-admin praat met een interne API
   (`POST /bullet_api/v1/…`). `videos.details {id}` geeft in één call van
   ~100 ms: beschrijving, categorie-ids, bijlage-ids, tags, permalink,
   ondertitels ÉN een verse getokeniseerde Mux-HLS-url. Geen zware
   pagina-loads meer voor de harvest → veel sneller en veel minder
   hCaptcha-risico. Alle nieuwe scripts gebruiken deze API via de twin Chrome.

7. **COMMENTS (ta3lieqaat) — locatie nog niet bevestigd.** De Community-module
   in de admin staat UIT, dus de reacties leven op de storefront-videopagina's.
   Tabel `video_comments` staat klaar (0013); de scraper kan pas geschreven
   worden na één controle op een storefront-pagina (stap 8).

## Volgorde van uitvoeren

### STAP 0 — GELD EERST (eigenaar, ~15 min) ⚠⚠
1. **Bunny-saldo aanvullen + auto-recharge aan.** Saldo stond op $7,22; de
   requality-run laat de opslag tijdelijk (oud+nieuw naast elkaar) en daarna
   blijvend groeien (hogere kwaliteit = grotere bestanden; verwacht ruwweg
   1,5–2× de huidige 3,3 TB). Een schorsing midden in de omwisseling is het
   slechtst denkbare faalmoment.
2. **Openstaande Uscreen-factuur betalen** (rode balk in het beheer). Als
   Uscreen het account bevriest, valt de bron weg en kijken je leden nergens meer.

### STAP 1 — migratie 0013 toepassen (5 min)
Plak `supabase/migrations/0013_structure_fidelity.sql` in de Supabase SQL-editor
(of `supabase db push`). Zonder deze migratie werken de import- en
requality-scripts niet (nieuwe kolommen/tabellen + manifest-status 'quality_ok').

### STAP 2 — extras harvesten (~2 uur, onbeheerd)
Twin Chrome moet draaien met een levende admin-sessie.
```
cd ~/projects/albunyaan-platform/worker
node harvest-video-extras.mjs
```
Hervatbaar; bij sessie-verlies stopt hij netjes → opnieuw inloggen en herstarten.

### STAP 3 — de 107 bestanden (apps/PDF's) binnenhalen (~30 min)
```
node download-resources.mjs --upload
```
Download alles naar `~/.albunyaan-cc/resources/` én zet ze in Supabase Storage
(bucket `resources`, publiek). LOKALE KOPIE = meteen ook de NAS-back-up-regel.

### STAP 4 — categorie-volgorde vastleggen (~5 min)
```
node scrape-category-order.mjs
```
Leest de volgorde van de PUBLIEKE storefront-categoriepagina's (dat is de
waarheid die leden zien; de admin-lijst is niet uitleesbaar).

### STAP 5 — importeren (~10 min)
```
cd ~/projects/albunyaan-platform/worker
set -a; source ~/.albunyaan-cc/cloud.env; set +a
ALBUNYAAN_DB_DRIVER=supabase node_modules/.bin/tsx import-video-extras.ts
```
Bestaande titels/slugs/statussen worden NIET overschreven (alleen de nieuwe
±122 rijen krijgen alles). Onopgeloste permalinks worden geteld en gelogd —
niet stil overgeslagen.

### STAP 6 — laatste 19 uploads (met de kwaliteitsfix)
`migrate-videos.ts` pakt voortaan automatisch de beste variant. De 19 resterende
(grote) bestanden het liefst via de Hetzner-VPS (trage thuis-upload, curl exit 28).

### STAP 7 — DE GROTE: kwaliteits-hertransfer (dagen tot weken)
```
node_modules/.bin/tsx requality-videos.ts --status   # eerst kijken
node_modules/.bin/tsx requality-videos.ts --run      # dan draaien
```
- Werkt in rondes van 100: verse tokens via de API → beste variant → nieuwe
  Bunny-upload → wachten tot encoding klaar → pas dan omwisselen → oude kopie
  verwijderen. Faalt iets, dan blijft de oude (lagere maar werkende) kopie staan.
- Video's waarvan de kopie al gelijk is aan het origineel worden gemarkeerd
  ('quality_ok') zonder bandbreedte te verspillen.
- **Bandbreedte: ruwweg 3–6 TB down + hetzelfde up.** NIET op de thuisbundel
  doen — dit hoort op de VPS (20 TB inbegrepen). Zelfde splitsing als in het
  bestaande VPS-plan: harvest op de Mac, transfer op de VPS.
- Niet tegelijk met de oude overnight-orchestrator draaien (zelfde browser).

### STAP 8 — comments (ta3lieqaat) lokaliseren en scrapen
1. Open in de twin Chrome een storefront-videopagina waarvan je wéét dat er
   reacties onder staan, en kijk in DevTools → Network welke request de
   reacties levert (waarschijnlijk iets als `/api/v1/…/comments` op
   albunyaan.tv). 
2. Geef die URL-vorm aan Claude Code → scraper schrijven naar
   `~/.albunyaan-cc/uscreen-comments.jsonl` en importeren in `video_comments`
   (tabel staat klaar; velden: auteur, tekst, datum/tijd, volgorde).
3. De site toont ze daarna onder de video (kleine UI-taak).

### STAP 9 — verifiëren (na elke stap herhaalbaar)
```
node verify-coverage.mjs              # DE dekkingscontrole: bron vs database vs weergave
node verify-migration-extras.mjs      # dekking beschrijvingen/bijlagen/volgorde/kwaliteit
node audit-migration.mjs              # bestaande audit incl. duurcontrole
```

**DEFINITIE VAN "KLAAR" (oprichtersregel 2026-08-07): alle drie de lagen tellen
gelijk.** `verify-coverage.mjs` zet bron (Uscreen-oogst), database en weergave
(de daadwerkelijk gerenderde bladerversie) naast elkaar en toont per soort ✅ of
❌ mét de namen van wat ontbreekt. Eén ❌ = niet klaar, punt. Het script draait
AUTOMATISCH na elke showcase-build en na elke import, en stuurt bij een ❌ een
Telegram-melding. Aanleiding: twee categorieën (o.a. «Age 16+», 1.119 video's)
verdwenen stilzwijgend uit de bladerversie doordat hun permalink een spatie en
een plusteken bevat en de scrape-lus te vroeg afbrak — precies het soort stille
gat dat een teller-vergelijking wél vindt en losse controles niet.

Aanvullend "klaar": beschrijvingen ≈ bibliotheek-groot, bijlagen gekoppeld,
0 onbereikbare gepubliceerde video's, gedowngradede video's = 0 — én de
bestaande audit blijft groen. (Comments: zie eindrapport §5 — die bestaan niet
op dit platform, `"commenting": false`.)

## Archief (NAS) — teambesluit 2026-08-10

**Bestemming: de eigen Synology NAS** (`/volume1/Albunyaan/archief-originelen/`,
`ssh mostafa@nas.fitrahmedia.nl -p 8022`). De eerder overwogen Hetzner Storage Box is
GESCHRAPT — de NAS-lijn is bewezen snel genoeg (197 MB/s, 4,46 GB in 22 s; 46 TB vrij).

**Wat er in gaat:** de ONAANGERAASTE originelen van alle video's (via "Request download"
in de Uscreen-admin → mezzanine.mux.com; Bunny bewaart originelen zelf niet:
`KeepOriginalFiles: false`, bewezen 2026-08-09) plus alle afbeeldingen op originele
grootte (kale bestandsnaam op de CDN = 1480×832; `small_`/`big_` zijn verkleinde
afgeleiden — de urls staan al in `~/.albunyaan-cc/uscreen-videos-rich.jsonl` en
`uscreen-collection-covers.jsonl`).

**Werkwijze:** Mac genereert wachtrijen via de admin-sessie
(`worker/archive-request-links.mjs`, member-first, hervatbaar, fail-honest); de NAS werkt
ze af met `archive-fetch.sh` (curl hervatbaar, partials op /volume1 — nooit /tmp, dat is
een RAM-schijf). **Definitie "geverifieerd": bytes komen exact overeen met de verwachte
bytes uit de wachtrij ÉN de sha256 staat in `manifest.jsonl`.** Elk falend item met naam
en reden in `fouten.log` — nooit stilzwijgend overslaan.

**Poort: eerst een tempo-test met 20 video's** (prep-tempo van Uscreen is de onbekende),
rapport met doorlooptijdschatting, dan pas founder-akkoord voor de volledige run
(15.972 video's, geschat 5–7 TB).

**Samenhang:** de gouden regel blijft — Uscreen pas opzeggen na compleet + geverifieerd
archief. De stap-7-kwaliteitsronde voedt straks uit dit archief (NAS → Bunny) in plaats
van uit verse Mux-tokens; de bestaande poorten van stap 7 (pilot ✅, geldpoort,
33 GB-VPS-grens) blijven onverkort staan.

## Kleine losse eindjes (voor Claude Code, laag risico)
- `build-library-showcase.mjs` toont alleen series → losse video's (films,
  app-pagina's) toevoegen, anders lijken ze te ontbreken in de bladerversie.
- Ondertitel-BESTANDEN (VTT) worden nu alleen als metadata vastgelegd;
  daarna nog spiegelen naar eigen opslag.
- 3 thumbnails staan nog op uscreencdn.com (bestaande audit §6).
- Bekend & onherstelbaar: 12 video's van de reeks "نكتة ومن أول السطر" zijn op
  Uscreen zelf verwijderd; 1 kapotte verwijzing (audit §3) opnieuw ophalen.

## Wat er NIET beweerd wordt
- Er is niets hiervan al uitgevoerd; dit zijn de gereedschappen + het bewijs.
- De comments zijn nog niet veiliggesteld (locatie eerst bevestigen, stap 8).
- "Zelfde kwaliteit" betekent: de beste variant die Mux/Uscreen serveert.
  Als Uscreen zelf ooit lager heeft geëncodeerd dan het ooit geüploade
  bronbestand, is dát ons maximum — het bronbestand zelf is alleen via
  "Request download" per video op te vragen (handmatig, niet schaalbaar).
