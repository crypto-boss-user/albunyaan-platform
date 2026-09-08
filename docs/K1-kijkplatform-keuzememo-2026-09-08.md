# K 1 — Kijkplatform-keuzememo (SESSIE K deel 1, 2026-09-08)

Bron van de opdracht: founder-brief sessie K deel 1; plan `docs/PLAN-2026-09-werkstromen.md` §3.6 (K 0-getallen), §5 B8/B9/B26,
§6 punt 26; meetrapport `~/projects/_scratch/K0-meetrapport-2026-09-07.md`. Mandaat B61. Uitvoerder: Claude Code (Fable 5.1).
Repo `exit-phase` @ `e2eb867`, werkboom schoon vóór dit werk.

**Wat dit memo NIET deed [gemeten]:** geen accounts aangemaakt, geen proefabonnementen, niets richting Bunny, niets geüpload, niets
geïnstalleerd, geen kosten. Enige leesacties buiten de repo: manifest.jsonl van de NAS gekopieerd naar de sessie-scratchpad (`ssh cat`),
`videos` in Supabase gepagineerd gelezen (per 1.000, REST-clamp), de K 0-export van 07-09 opnieuw gelezen, en zes prijspagina's
gefetcht. **Alle prijzen zijn gelezen op 2026-09-08** (datum per kandidaat vermeld; prijzen wijzigen — bij een pilot opnieuw lezen).

**Labels:** [gemeten] = zelf uitgevoerd/gelezen · [K 0] = uit het meetrapport van 07-09 · [prijs 08-09] = van de prijspagina op 2026-09-08 ·
[afgeleid] = rekensom · [aanname] = keuze van mij, aanpasbaar · [te meten] = onbekend, niet geschat.

---

## §0 In één oogopslag

| Kandidaat | Maandelijks nu (≈ 4.821 kijkuur, vol archief) | Maandelijks bij 2× | Eenmalig vullen 80 %-set / vol archief | Pilot 2 wk, 50 video's | EU-opslag | Live-pad | Rang |
|---|---|---|---|---|---|---|---|
| **Bunny Stream** | **$55–90** | $80–140 | $0 / $0 (encoding gratis) | **≈ $1–2** ($1-minimum) | ja (Frankfurt) | preview-aanmelding [te meten]; anders eigen relay | **1** |
| Zelf hosten (Hetzner Object Storage + Bunny CDN) | €65–90 + eigen beheer | €115–140 | €0–60 rekentijd + dagen bouwwerk [te meten] | ≈ €6 + bouwtijd | ja (DE/FI) | eigen relay (bestaande kit) | 2 |
| Cloudflare Stream | $1.135 (80 %-set alleen: $425) | $1.425 | $0 (opslag vooraf gekocht) | ≈ $6 | geen regiokeuze | sterkste ingebouwde live, maar opname verplicht | 3 |
| api.video | $972 (80 %-set: $567) | $1.464 | $0 | ≈ $2–5 | ja (per project) | prijs niet op de pagina [te meten] | 4 |
| Mux | $555–695 (80 %-set: $215–270) | $787–984 | $0 (Basic) | ≈ $0–2 | nee (VS) | $5.400/mnd voor 4 kanalen 24/7 + 12 u-limiet | 5 |

Alle bedragen excl. btw (21 % NL bij Bunny/Hetzner zonder btw-nummer; buitenlandse aanbieders idem via verlegging). Uscreen nu: ≈ € 2.900/maand
[doc, memory `bunny-cost-model`, niet met factuur onderbouwd]. **Aanbeveling (§4): Bunny Stream opnieuw, gefaseerd (80 %-set eerst), met de
drie Bunny-lessen ingebouwd; pilot van twee weken met 50 video's als founder-ja (geld).**

---

## §1 Eisen (elk met bron)

| # | Eis | Waarom / bron | Meetlat |
|---|---|---|---|
| E1 | **Per video vullen vanuit de NAS, gefaseerd** — eerst de 2.646 video's (80 % van de views, 0,50 TB), daarna de rest | K 0 §5 punt 3; plan §3.6 K 1 ("als de kandidaat per video kan ingesten") | pull-van-URL of push-upload per bestand via API; geen alles-of-niets-import; wachtrij-/rate-limiet [te meten per kandidaat] |
| E2 | **Opslag 2,92 TB** origineel (16.031 video's); kijkplatform-noemer 15.171 = 2,71 TB (B8) | K 0 §0 getal 1 | prijs per GB of per minuut; wat er ná transcodering staat |
| E3 | **Egress bij het gemeten kijkvolume** — 4.821 kijkuur/30 d = 289.260 minuten [K 0 §4.1]; bitrate van het archief **1,04 GB per kijkuur = 2,31 Mbit/s** [gemeten, §1.1] → **≈ 5,0 TB/maand**; bij 2×: 578.520 min ≈ 10 TB | K 0 §4.1 × §1.1 hieronder | prijs per GB (Bunny, CDN) of per minuut (Cloudflare, Mux, api.video) |
| E4 | **Transcodering** naar adaptieve HLS (de originelen zijn losse mp4's, mediaan 120 MB) | K 0 §2; §6 punt 26 (`resolution_tier` ≠ bronresolutie) | gratis/inbegrepen, of prijs per minuut × 168.500 min |
| E5 | **Afgeschermde weergave** — getekende URL's/tokens per lid; geen open HLS-URL's | CLAUDE.md RLS-regel; B22 (oude playback-gate was Bunny-token-gebonden) | token-auth/signed URL's zonder meerprijs; DRM alleen als optie |
| E6 | **Speler op web én bruikbaar in iOS/Android/TV** — 55 % van de accounts is via de apps aangemaakt | K 0 §4.4 (proxy); §6 punt 28 (TV/AirPlay/Cast-poort, PWA + IAP) | HLS afspeelbaar in AVPlayer/ExoPlayer/tvOS/Android TV; SDK is een plus, geen eis |
| E7 | **Live-kanalen** — 29, waarvan 4 = 69 % van de live-views; 3,35 % van alle views maar Basmah = #1-item | K 0 §4.3; B9 open; `infra/live-relay/CHANNELS-INVENTORY.md` (bron-URL's niet bij Uscreen — runbook E) | relay via de kandidaat (RTMP-ingest) of apart; kosten per 24/7-kanaal |
| E8 | **EU-dataregio** (leden NL/BE; land: NL 31 %, BE 3 %, onbekend 47 %) | K 0 §4.4; AVG | opslagregio kiesbaar in de EU; verwerking van kijkdata |
| E9 | **Geen minimumafname, maandelijks opzegbaar, exporteerbaar** | gouden regel 4 (Bunny-stop: "kosten zonder functie"); B7-argument | prepaid/PAYG zonder contract; mp4-terughalen mogelijk — de NAS blijft de bron, dus export is een plus, geen eis |
| E10 | **Analytics** (views, kijktijd per video; liefst per lid) | AD 2 KP-rijen (`AD-werklijst.md` §14: views/watch time leeg "tot kijkplatform") | per-video statistieken via API; per-lid = eigen `watch_progress` (migratie 0005) |
| E11 | **Leverancier die stopzetten netjes afhandelt** — de Bunny-les: saldo −$17,67 → account 5 dagen dicht → bij verwaarlozing wist de bibliotheek | memory `bunny-cost-model`/`residual-19-and-debris`; teambesluit 2026-09-02 | wat gebeurt er bij niet-betalen; waarschuwingen; saldo-alarm bouwbaar; 2FA |

### §1.1 Gemeten: de gemiddelde bitrate van het archief [gemeten 2026-09-08]

Methode: `manifest.jsonl` (18.429 regels, 16.031 `kind: video`, som 2.923.209.922.965 B = identiek aan K 0) gejoind op `videos.external_id`
met `duration_seconds` uit Supabase (15.984 rijen gepagineerd, 123 zonder/0 duur → 15.861 met duur).

| Grootheid | Waarde |
|---|---|
| Gejoind (manifest ∩ DB met duur) | **15.840 video's · 2.882.564.459.987 B · 9.967.700 s = 2.769 u** |
| **Gemiddelde bitrate (bytes-gewogen)** | **1,041 GB per kijkuur = 2,31 Mbit/s** |
| Per-video bitrate | mediaan 2,13 Mbit/s · p10 0,86 · p90 3,63 |
| member_visible-deel (15.171) | 2,712 TB · **2.620 u = 157.200 min** · 1,035 GB/u |
| Manifest-video's zonder DB-duur | 191 (40,6 GB) → geschat +39 u [afgeleid op de gemiddelde bitrate] |
| **Totaal archief** | **≈ 2.808 u = 168.500 min** [afgeleid: 2.769 gemeten + 39 geschat] |
| 80 %-set (2.646 video's, uit de K 0-export van 07-09, id via de Video Link) | **26.400 min = 440 u · 0,503 TB** (DB-duur; 88 zonder DB-duur; Uscreens eigen duurkolom geeft 27.689 min = 461 u) |
| 95 %-set (5.853) | 66.200 min = 1.103 u · 1,235 TB |
| Alle 10.007 bekeken video's met link (90 d) | 109.100 min = 1.818 u · 2,01 TB |

Gevolg voor de kostenmodellen: **per-GB-aanbieders rekenen met 2,9–4 TB opslag en 5 TB egress; per-minuut-aanbieders met 168.500 opgeslagen
minuten en 289.260 geleverde minuten.** Het archief is lang (2.808 u) en wordt weinig bekeken (289.260 geleverde min/maand = 1,7× de
archiefduur) — precies het profiel waarin een per-minuut-opslagtarief pijn doet en een per-GB-tarief niet.

---

## §2 Kandidaten (feiten per kandidaat, gelezen 2026-09-08)

### 2.1 Bunny Stream (bunny.net, Slovenië) — [prijs 08-09: `bunny.net/pricing/stream/` + `bunny.net/docs/stream/pricing`]
- **Vullen vanuit de NAS:** *Fetch Video* — `POST /library/{libraryId}/videos/fetch` met een URL **én optionele headers** ("The headers that
  will be sent along with the fetch request"); wachtrij, 429 "Too many fetch jobs queued" bij te veel tegelijk → per video, gefaseerd, met
  een teller. Ook push-upload (PUT) per video. De NAS heeft geen publieke HTTP-poort (alleen ssh 8022 [gemeten]) → een tijdelijke
  getekende-URL-laag (NAS-reverse-proxy of VPS) of push vanaf de Mac/VPS die de NAS leest [aanname; keuze bij de pilot].
- **Transcodering:** standaard H.264 tot 1080p **gratis** ("No Transcoding Fees"); *Premium Encoding* optioneel $0,025/min (≤ 480p),
  $0,050/min (720p/1080p), $0,150/min (1440p/2160p) — niet nodig voor dit archief (mediaan 2,1 Mbit/s).
- **Prijsmodel:** opslag **$0,01/GB/maand** (Europe – Frankfurt); geo-replicatie +$0,01 (2e regio), +$0,005 (3e+); CDN **Standard
  Europe & North America $0,010/GB**, Volume-network **$0,005/GB** (0–500 TB); DRM (MediaCage) $99/maand + $0,005/licentie; AI-transcriptie
  $0,10/min/taal; **$1 minimum per maand**; 14 dagen proef zonder kaart; prepaid saldo (PayPal/kaart/crypto).
- **Live:** niet op de prijspagina; zoekresultaat 08-09: "Bunny Stream customers can sign up for a new live streaming preview (RTMP ingest &
  distribution, DVR, VOD)". Status/prijs/limieten **[te meten — aanmelding = founder-actie]**. Zonder preview: eigen relay (VPS, `infra/live-relay/`
  is precies voor "IPTV-feed → Bunny" ontworpen) met HLS via Bunny CDN.
- **App/TV-pad:** HLS-URL + embed-iframe; geen eigen iOS/Android-SDK → native AVPlayer/ExoPlayer/tvOS/Android TV spelen de HLS met token.
- **Token:** token-authenticatie en domeinrestrictie inbegrepen ("all security features completely FREE"); embed-token + HLS-token per URL met
  vervaltijd (de oude `BUNNY_EMBED_TOKEN_KEY`-gate, B22).
- **Dataregio:** opslag Frankfurt (DE) standaard; CDN wereldwijd; EU-bedrijf.
- **Opzeggen:** geen contract; prepaid; bij een leeg saldo wordt het account **uitgeschakeld** en bij langdurig niet-betalen de bibliotheek gewist
  (de les van juli 2026). Terughalen: originelen bewaren = extra opslag; mp4-fallback downloadbaar. **Onze bron blijft de NAS.**
- **Bijzonder:** het oude account is op 2026-09-02 door de eigenaar gestopt met saldo −$7,42 [memory]. Nieuw account óf heropening met verrekening
  = **[te meten, founder]**. Alle `bunny_video_id`'s in de DB zijn dood en horen bij de oude bibliotheek: een nieuwe bibliotheek geeft nieuwe id's.

### 2.2 Cloudflare Stream (VS) — [prijs 08-09: `developers.cloudflare.com/stream/pricing/`, "last updated September 1, 2026"]
- **Vullen:** `POST /stream/copy` met een **publieke** URL ("Stream will fetch the file on your behalf"; geen headers/auth voor de bron
  gedocumenteerd) of TUS/direct upload per video (max 30 GB per bestand).
- **Transcodering:** "Ingress and encoding are always free."
- **Prijsmodel:** **$5 per 1.000 minuten opgeslagen** (vooraf gekocht, in blokken), **$1 per 1.000 minuten geleverd** (achteraf); speler, HLS/DASH,
  mp4-download, simulcast inbegrepen. Geen gratis laag voor Stream.
- **Live:** RTMPS/SRT-**push** (geen pull van een bron-URL) → eigen relay blijft nodig voor IPTV-bronnen; encoding gratis; **"All Stream Live videos
  are automatically recorded"** → opnameminuten tellen als opslag ($5/1.000 min): 4 kanalen × 24/7 = 172.800 min/maand = tot $864/maand als de
  opnames blijven staan; direct wissen via API = [te meten].
- **App/TV:** HLS/DASH + Stream Player (web); native spelers via HLS.
- **Token:** getekende URL's (signed tokens) inbegrepen.
- **Dataregio:** **geen regiokeuze voor Stream** (community-vragen 2021 en 2025 onbeantwoord; Data Localization Suite geldt voor andere producten);
  opslag "across the global network".
- **Opzeggen:** maandelijks; opslag is vooraf gekochte capaciteit ("cannot upload if total duration exceeds purchased capacity").

### 2.3 Mux (VS) — [prijs 08-09: `mux.com/pricing` + `mux.com/docs/pricing`]
- **Vullen:** asset aanmaken met een **publieke** input-URL of direct upload; per video.
- **Transcodering:** *Basic* gratis; *Plus* $0,025/min (720p) – $0,03125/min (1080p); *Premium* $0,0384+.
- **Prijsmodel:** opslag **$0,0024/min/maand (720p)**, $0,003 (1080p); levering **$0,0008/min (720p)**, $0,001 (1080p), **eerste 100.000
  geleverde minuten per maand gratis**; PAYG met $20 maandkrediet; DRM $100/maand + $0,003/play; signed URL's gratis.
- **Live:** RTMP(S)/SRT-push; live-encoding *Plus* **$0,03125/min (1080p)**; "Mux automatically disconnects clients after 12 hours" → 24/7-kanalen
  passen niet zonder maatwerk; 4 kanalen 24/7 ≈ $5.400/maand alleen aan encoding.
- **App/TV:** officiële SDK's (iOS/Android/web) + HLS.
- **Dataregio:** opslag van assets niet kiesbaar; docs noemen alleen een EU-ingestlocatie (Duitsland) voor *Mux Data* (kijkstatistieken), waarna de
  data "sent to the United States"; assets US-East [zoekresultaat 08-09] → **niet EU**.
- **Opzeggen:** PAYG maandelijks; master-toegang/static renditions tegen meerprijs.

### 2.4 api.video (Frankrijk, OVHcloud-dochter) — [prijs 08-09: `api.video/pricing/`]
- **Vullen:** "Upload by URL" inbegrepen (publieke bron) of upload per video; 100 upload-API-calls/min op PAYG.
- **Transcodering:** "FREE FOR UNLIMITED MINUTES".
- **Prijsmodel:** hosting **"as low as" $0,00285/min opgeslagen**, levering **"as low as" $0,0017/min geleverd** (staffels niet op de pagina →
  basisprijs gerekend); custom domain € 60/maand; domain-referrer-restrictie $20/maand (PAYG); analytics-retentie $12–299/maand; PAYG zonder
  minimum; gratis sandbox alleen 30 s met watermerk.
- **Live:** RTMP(S)/SRT; **prijs voor live niet op de prijspagina [te meten]**.
- **App/TV:** SDK's iOS/Android/web + HLS.
- **Token:** private video's met tokens inbegrepen.
- **Dataregio:** **EU of VS per project** kiesbaar ("Each project … its own distinct settings, including the video storage location", blog
  2023-11-21); EU-datacenter niet benoemd.
- **Opzeggen:** PAYG maandelijks; enterprise = jaarcontract.

### 2.5 Zelf hosten — NAS/VPS als bron, HLS vooraf getranscodeerd (ffmpeg), object storage + CDN
- **Opzet [aanname]:** ffmpeg maakt per video een HLS-ladder (2–3 rungs, want bron mediaan 2,1 Mbit/s) op de Mac/NAS/VPS → **Hetzner Object
  Storage** (S3, Falkenstein/Nürnberg/Helsinki) → **Bunny CDN pull zone** met token-auth ervoor (of Bunny Storage i.p.v. Hetzner, zelfde $0,01/GB).
  Speler: hls.js op web, native HLS in apps. Getekende URL's: Bunny-token op de pull zone (gratis) of eigen signing op de VPS/Vercel-edge.
- **Prijzen [prijs 08-09]:** Hetzner Object Storage **€ 4,99/maand incl. 1 TB opslag + 1 TB egress; extra opslag € 4,99/TB; egress € 1,00/TB
  ($1,20)** [zoekresultaat 08-09 — de Hetzner-pagina zelf toonde de bedragen niet in de fetch; een derde site noemt € 5,99/€ 1,20 → **bij de pilot
  nalezen**]; ingress gratis. Bunny CDN Standard EU/NA **$0,010/GB**, Volume $0,005/GB, $1 minimum. Bestaande Hetzner-VPS € 14,51/maand (B7).
- **Transcodering:** eigen rekentijd: 2.808 u video; bij ≈ 5× realtime op één dedicated vCPU-server ≈ 560 u ≈ 24 dagen [afgeleid, snelheid
  = **te meten**]; op de Mac/NAS gratis maar weken; geen wachtrij-API, wel volledige controle.
- **Live:** eigen relay (bestaande kit `infra/live-relay/`) → HLS naar storage/CDN; kosten = VPS + egress.
- **Analytics:** geen — alles zelf (CDN-logs + eigen `watch_progress`).
- **Dataregio:** volledig EU. **Opzeggen:** maandelijks, alles exporteerbaar (het zijn onze bestanden).
- **Risico:** wij zijn de leverancier (onderhoud, storingen, geen support); het bouwwerk (packaging, signing, speler, statistieken, relay) is dagen
  tot weken en concurreert met SR 4/AD.

---

## §3 Kosten in één tabel

**Aannames (expliciet):** kijkvolume nu = 4.821 kijkuur/maand = 289.260 geleverde minuten ≈ 5,0 TB egress (1,04 GB/u); 2× = 578.520 min ≈ 10 TB.
Vol archief = 168.500 min / 2,92 TB origineel; 80 %-set = 26.400 min / 0,50 TB. Opslag ná transcodering bij per-GB-aanbieders **3–4 TB [aanname:
de vorige Bunny-bibliotheek kostte ≈ $30–40/maand bij ≈ 3 TB, memory `bunny-cost-model`; renditions kunnen tot 2× de bron zijn → te meten in de
pilot: bytes per video ná encodering]**. Per-minuut-aanbieders: 720p-tarief waar dat bestaat (bron mediaan ≈ 720p), 1080p als bovengrens.
Live niet in de maandbedragen (apart in §3.2). Alle bedragen excl. btw, afgerond.

### 3.1 VOD

| Kandidaat | Eenmalig vullen 80 %-set | Eenmalig vullen vol archief | Maandelijks nu — 80 %-set | Maandelijks nu — vol archief | Maandelijks 2× — vol archief | Pilot 2 wk / 50 video's (≈ 9 GB, ≈ 530 min) |
|---|---|---|---|---|---|---|
| **Bunny Stream** | $0 (encoding + ingress gratis; opslag vanaf dag 1) | $0 | opslag 0,5–0,7 TB $5–7 + egress 5 TB **$25 (Volume) – $50 (Standard)** = **$30–57** | opslag 3–4 TB $30–40 + egress $25–50 = **$55–90** | opslag $30–40 + egress $50–100 = **$80–140** | **$1–2** ($1-minimum; opslag $0,09; enkele GB egress) |
| Zelf hosten (Hetzner OS + Bunny CDN) | rekentijd ≈ 3–4 dagen CPU [te meten] | rekentijd ≈ 24 dagen CPU op 1 server ≈ **€ 30–60** huur, of € 0 op Mac/NAS in weken [te meten] | Hetzner € 4,99 + CDN $25–50 + VPS € 14,51 = **€ 45–70** | Hetzner € 15–20 + origin-egress ≤ € 4 + CDN $25–50 + VPS € 14,51 = **€ 65–90** | **€ 115–140** | € 4,99 + $1 = **≈ € 6** + bouwtijd (dagen) |
| Cloudflare Stream | $0 (opslag vooraf: 27 blokken = $135 eerste maand) | $0 (169 blokken = $845 eerste maand) | opslag $135 + levering $290 = **$425** | opslag $845 + levering $290 = **$1.135** | $845 + $580 = **$1.425** | 1 blok $5 + levering ≈ $0,5 = **≈ $6** |
| api.video | $0 | $0 | opslag $75 + levering $492 = **$567** | opslag $480 + levering $492 = **$972** | $480 + $984 = **$1.464** | opslag $1,5 + levering ≈ $1 = **≈ $2–5** (PAYG, kaart) |
| Mux | $0 (Basic; Plus zou $660–825 zijn) | $0 (Basic; Plus $4.200–5.300) | opslag $63–79 + levering $151–189 = **$215–270** | opslag $404–505 + levering $151–189 = **$555–695** | $404–505 + $383–479 = **$787–984** | binnen de gratis laag ≈ **$0–2** (kaart + $20-PAYG-krediet nodig) |

Ter vergelijking: Uscreen ≈ € 2.900/maand [doc]. Bunny = ≈ 2–3 % daarvan; de per-minuut-aanbieders 20–50 %.

### 3.2 Live (4 kanalen 24/7 = 172.800 ingest-minuten/maand; kijktijd live [te meten], bovengrens ≈ 10 % van 4.821 u = 480 u = 28.800 min)

| Pad | Maandelijks | Kanttekening |
|---|---|---|
| Eigen relay-VPS → HLS → Bunny CDN | VPS € 14,51 (bestaand, B7) + egress ≤ 0,5 TB ≈ $3–5 | bron-URL's van de IPTV-provider nodig (runbook E, niet bij Uscreen); 4 ffmpeg-processen 24/7 op één VPS [te meten] |
| Bunny Stream Live (preview) | [te meten] | aanmelding = founder; nog geen prijspagina |
| Cloudflare Stream Live | levering ≤ 28.800 min ≈ $29 + **opnames 172.800 min = $864 tenzij direct gewist [te meten]** | push-only, dus de relay-VPS blijft nodig; encoding gratis |
| Mux Live | ≈ $5.400 encoding + levering | 12 u-limiet per stream → uitgesloten voor 24/7 |
| api.video Live | [te meten] | RTMP(S)/SRT; prijs niet gepubliceerd |

### 3.3 Wat de pilot van twee weken (50 video's) bewijst
Per video: fetch/upload vanuit de NAS via de gekozen laag, encoding-doorlooptijd, bytes ná encodering (→ opslagaanname), HLS met token in
hls.js én in een iOS-/Android-speler (E6), Bunny-statistieken-API (E10), en de factuur-/saldo-mechaniek (E11: auto-recharge instellen, 2FA, alarm).
Kosten: zie kolom rechts in §3.1 — bij Bunny **$1–2 + een eerste prepaid-storting (bijv. $10–20) = founder-vraag (geld)**.

---

## §4 Risico's, rangorde, aanbeveling

### 4.1 Risico's per kandidaat

| Kandidaat | Lock-in | Prijsverandering | Live | Apps/TV | Specifiek |
|---|---|---|---|---|---|
| Bunny Stream | laag: NAS = bron, HLS-standaard; nieuwe id's bij nieuwe bibliotheek | prijs 2026 = prijs juli 2026 [memory]; prepaid, maandelijks te stoppen | **geen GA-live** → relay of preview [te meten] | HLS + token in native spelers; geen SDK (geen eis) | **de saldo-les**: leeg saldo = platform dicht → auto-recharge + 2FA + saldo-bewaker weer aan zijn launch-eisen; oud account −$7,42 verrekenen [te meten] |
| Zelf hosten | laagst (eigen bestanden) | Hetzner-prijsbron onzeker (€ 4,99 vs € 5,99) | relay = zelf | HLS, alles zelf | wij zijn de leverancier; bouwwerk concurreert met SR 4/AD; geen analytics |
| Cloudflare Stream | middel: mp4-download inbegrepen | pagina bijgewerkt 01-09-2026 | beste ingebouwde live, maar **opname verplicht** = kosten | HLS/DASH, speler | **geen EU-regiokeuze (E8)**; opslag per minuut = 10–14× Bunny voor dit archief |
| api.video | middel | "as low as" = staffels onbekend | prijs onbekend | SDK's | duurste per maand; EU wél goed |
| Mux | middel–hoog (master-toegang betaald) | staffels gepubliceerd | 12 u-limiet + $5.400/maand | beste SDK's | **niet EU (E8)**; levering na 100k gratis minuten oké, opslag per minuut duur |

### 4.2 Rangorde (met reden)
1. **Bunny Stream** — voldoet aan E1–E6, E8–E11; enige gat = E7 (live) dat elke kandidaat behalve Cloudflare ook heeft. Kosten 10–20× lager dan
   de per-minuut-aanbieders omdat het archief lang en weinig bekeken is (§1.1). Per-video fetch **met headers** maakt gefaseerd vullen vanaf een
   afgeschermde NAS-laag mogelijk. De stop in september was "kosten zonder functie", geen kwaliteits- of betrouwbaarheidsprobleem; de uitval
   in juli was een saldo-fout aan onze kant. Vereist wel: **CLAUDE.md-⛔-blok herzien** (founder, gouden regel 6a) en de saldo-bewaker weer aan.
2. **Zelf hosten (Hetzner + Bunny CDN)** — goedkoopst in euro's en volledig EU, maar het duurst in mensuren en zonder analytics; verstandig als
   terugvaloptie of als het team Bunny-als-platform afwijst.
3. **Cloudflare Stream** — technisch het simpelst en het beste live-verhaal, maar E8 faalt en de opslagprijs per minuut maakt het vol archief
   ≈ $1.100/maand. Alleen zinvol als het team live bij Cloudflare wil onderbrengen (hybride: Bunny VOD + Cloudflare live) én de opnames direct gewist
   kunnen worden [te meten].
4. **api.video** — EU en gratis encoding, maar ≈ $970/maand; live-prijs onbekend.
5. **Mux** — niet EU, live onbruikbaar voor 24/7, duurste opslag.

### 4.3 Aanbeveling (drie zinnen)
Kies **Bunny Stream opnieuw**, met een **nieuw account of verrekende heropening**, en vul **gefaseerd**: eerst de 2.646 video's (0,50 TB, ≈ 3 u
uplink) vóór de cutover, de rest (2,2 TB, ≈ 12 u uplink) daarna maar vóór de Uscreen-opzegging. Bouw de drie Bunny-lessen vanaf dag 1 in:
**auto-recharge + geldige kaart, 2FA, saldo-bewaker weer aan met Telegram-alarm bij < $20** — en behandel "Bunny is geen dependency" (CLAUDE.md ⛔)
als een founderbesluit dat herzien wordt, niet als iets dat stil vervalt. Live blijft een **aparte beslissing (B9)**: eigen relay op de bestaande VPS is
het goedkoopste bewezen pad, Bunny Live-preview is [te meten], Cloudflare alleen als hybride.

### 4.4 Wat de founder moet beslissen (geld → founder-vraag, B61)
1. **Pilot Bunny ja/nee** — nieuw account + prepaid ≈ $10–20 + auto-recharge-kaart (geld). Zonder pilot geen opslag-/encodingmeting.
2. **EU-dataregio: harde eis of niet** — bepaalt of Cloudflare (live-hybride) überhaupt mag.
3. **Live-pad (B9)**: relay op de Hetzner-VPS (dan B7 = aanhouden), Bunny Live-preview aanvragen, Cloudflare live-only, of tijdelijk buiten
   scope. Termijn: 2026-10-03 (B7).
4. **CDN-tier**: Standard ($0,010/GB, 119 PoPs) of Volume ($0,005/GB, 10 PoPs) — [aanname: Standard tot de pilot latency in NL/BE/MA meet].

---

## §5 Wat de keuze verandert in het plan

| Plek | Nu | Bij Bunny (aanbeveling) |
|---|---|---|
| **SR 4 stap 12 (speler)** | "12–15 na kijkplatform-/betaalbeslissing" (§3.3); `/watch` zonder CTA; speler = poster | speler = HLS met Bunny-token (hls.js) of embed-iframe met embed-token; `videos.bunny_video_id` krijgt **nieuwe** id's uit de nieuwe bibliotheek (oude kolomwaarden wissen of als `bunny_video_id_oud` markeren); B22-playback-gate ontdooien met nieuwe sleutelnamen |
| **Poort 1 (B8)** | twee noemers 16.031 archief / 15.180 kijkplatform | kijkplatform-telling = "video's met een afspeelbaar id op Bunny"; **fase 1 = 2.646 van 15.180**, fase 2 = 15.180/15.180 vóór opzegging; rapportages tonen beide (BS 2) |
| **Live (B9)** | open, termijn 2026-10-03 | drie paden (§3.2); relay-VPS = B7 aanhouden; IPTV-bron-URL's = runbook E (collega/founder); B67 (29 kaarten als metadata) blijft |
| **Cutover** | datum OPEN; poorten §6 punt 28 | volgorde: pilot (2 wk) → 80 %-set vullen → SR 4 stap 12 → leden-/DB-migratie → contentstop → rest vullen → AS 6 laatste orde-pas → cutover; nieuwe cutover-poort: "saldo-bewaker live + auto-recharge bewezen" |
| **AS-wachter** | archiveert nieuwe video's op de NAS | nieuwe stap: nieuwe video ook naar Bunny fetchen (T2, na de pilot) — anders loopt het platform achter op Uscreen |
| **AD (KP-rijen)** | views/watch time/DRM/device-limit/geo leeg "tot kijkplatform" | Bunny Statistics-API voor views/bandbreedte; per-lid kijktijd = eigen `watch_progress`; upload in de admin (B81 "na kijkplatformkeuze") |
| **CLAUDE.md ⛔-blok + memory `bunny-account-gestopt`** | Bunny = geen dependency | founderbesluit + diff ter keuring (gouden regel 6a); saldo-bewaker `bunny-balance-watch.py` opnieuw activeren met nieuwe sleutels; nieuwe `BUNNY_*` in `cloud.env` |
| **B7 Hetzner-VPS** | opzeggen tenzij B9 de VPS nodig heeft | bij relay-pad: aanhouden (€ 14,51) als live-relay |

Bij een andere keuze (zelf hosten / Cloudflare) verandert dezelfde tabel: speler = hls.js op eigen HLS (zelf) of Stream Player (Cloudflare),
poort 1 = zelfde noemer, wachter-stap = zelfde idee, ⛔-blok blijft (Bunny alleen als CDN bij zelf hosten = geen Stream-account).

## §6 Niet gemeten en waarom

| Punt | Reden |
|---|---|
| Bytes ná transcodering per kandidaat | vereist een upload → pilot |
| Bunny Live-preview: beschikbaarheid, prijs, limieten | aanmelding = founder-actie (geen accounts aanmaken) |
| api.video live-prijs; Cloudflare opname-wissen; Mux 24/7-uitzondering | niet op de prijspagina's; salesvraag |
| Ingest-tempo (parallelle fetches, encoding-wachtrij) | pilot |
| Kijktijd van live-kanalen | K 0 §6: tegel geeft alleen views |
| Hetzner Object Storage-prijs (€ 4,99 vs € 5,99) | pagina toonde de bedragen niet in de fetch; twee bronnen verschillen |
| Latency NL/BE/MA per CDN-tier | pilot |

## §7 Bestanden
- Dit memo: `docs/K1-kijkplatform-keuzememo-2026-09-08.md`
- Beslislijst: `docs/BESLISLIJST-2026-09-08.md`
- Sessie-scratchpad (tijdelijk, niet in git): `k1/manifest-2026-09-08.jsonl`, `k1/video-bytes.json`, `k1/videos-duration.tsv`, `k1/haal-duur.py`
- K 0: `~/projects/_scratch/K0-meetrapport-2026-09-07.md`; K 0-export hergebruikt uit de sessie-scratchpad van 07-09 (`k0/omni-videos-90d-alles.csv`)
