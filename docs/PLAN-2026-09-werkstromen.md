# PLAN 2026-09 — werkstromen Albunyaan (SR storefront-pariteit · RV review · BS Bunny-stop · AS archief)

STATUS: vastgesteld 2026-09-02 (founder-akkoord), branch `exit-phase`. Eén document voor founder, team en
Claude Code. Besloten bij akkoord: B2 = ja; `~/projects/_scratch/` = ja. **Founderbeslissingen van 2026-09-03
verwerkt in §5** (B4–B6, B10, B11, B13–B18, B21–B27 besloten; B1/B3 bij Cowork; B19/B20 wachten op RV 0;
tweede ronde 2026-09-03: B7/B8/B12/B30 besloten, B28 + B1/B3 door Cowork gedaan, B9 en B29-bouwen open).
**AS 6 UITGEVOERD 2026-09-03** (go tegen sha256 b76bb907…37ec; 279/279, sha 83/83, audit 24 = alleen AS 10).
Wachter gerepareerd (`122f7db`), handmatige ophaalronde bewezen: NAS 16.025 = Uscreen 16.025.
Bron van waarheid voor Bunny: het ⛔-blok in `CLAUDE.md`. Bij tegenspraak wint `CLAUDE.md`.

**Leeswijzer — labels en uitvoerders.** `[gemeten]` = zelf gemeten op 2026-09-02 met een commando of
bestand (meetronde van die dag). `[Cowork]` = uit de Cowork-planningscontext van de founder van 2026-09-02,
niet gemeten. `[memory]` / `[doc]` = uit sessiegeheugen resp. een document, met datum. `[te meten]` = nog
door niemand gemeten; schatten is verboden. Uitvoerders: **founder** · **Claude Code** · **team** ·
**collega** (van het review-pakket) · **Cowork**. Elke stap in §3 heeft dezelfde zes velden:
Doel · Gemeten vóór · Uitvoerder · Bewijs klaar · Poort · Tier (T0–T3 per `albunyaan-change-control`).
Engelse vaktermen (fail-closed, bloat, tier, go) blijven onvertaald. Paden: repo =
`/Users/a2020/projects/albunyaan-platform`; memory = `~/.claude/projects/-Users-a2020-projects-albunyaan-platform/memory/`
(10 bestanden) én de oudere map `~/.claude/projects/-Users-a2020-Fable-5-PLAN/memory/` (archief t/m 2026-07-13).

## §1 Doel en gouden regels

**Doel van dit plan:** de komende weken zó werken dat (1) het NAS-archief afgerond en bewaakt blijft (AS),
(2) niets meer van een levend Bunny-account uitgaat (BS), (3) `apps/web` qua uiterlijk, menu's en
pagina-indeling gelijk wordt aan de huidige albunyaan.tv-storefront (SR), en (4) elke codewijziging door een
gemeten en ingevoerde review-pipeline gaat vóórdat er in SR 4 gebouwd wordt (RV).

**Gouden regels:**
1. **Uscreen wordt pas opgezegd als álles veilig is.** Vastgelegd in `MIGRATIE-WERKORDER.md:187` ("de gouden
   regel blijft — Uscreen pas opzeggen na compleet + geverifieerd archief") en `memory/nas-archief.md:148,274`.
   De harde kant: **data-out-before-notice — Uscreen wist account + alle content binnen 30 dagen na
   opzegging, zonder ophaalvenster** (`.claude/skills/albunyaan-change-control/SKILL.md:139`;
   `Fable-5-PLAN/memory/albunyaan-platform-rebuild.md:67`, 2026-07-05). Welke formulering kanoniek wordt
   (werkorder vs MASTER-PLAN, dat de regel niet kent — §7 T11): §5 B1.
2. **Contentstop, cutover en opzegging zijn drie aparte, latere beslissingen.** Geen van de drie staat in dit
   plan gepland (§2 "nog niet gepland"). Het woord "contentstop" komt in MASTER-PLAN, TODO en PROMPTS niet
   voor [gemeten]; de driedeling wordt in dít plan geïntroduceerd en vraagt bevestiging (§6 punt 25).
3. **Cutoverdatum = OPEN.** De datum 28 augustus 2026 staat nog op vier expliciete plekken in MASTER-PLAN v2.12
   (`:170`, `:880` — de enige met het letterlijke label "COMMITTED 2026-07-29" —, `:1128`, en `:1228-1229` als
   Stripe-slipclausule "the only item that can slip 28 Aug week-for-week") plus vier indirecte
   (`:171,190,1067,1240`), en in `ALBUNYAAN-TODO-BEGINNER.md:31-33` en `ALBUNYAAN-PROMPTS-v2.md:682,760-761`
   [gemeten]. Nergens gereset. MASTER-PLAN kent bovendien een eigen verschuifregel (`:1145-1146`: "a missed
   week-milestone moves the cutover by exactly the weeks missed") — §7 T1. **Dit plan zet de datum op OPEN**;
   het bijwerken van de drie stuurdocumenten is founder-werk onder de één-schrijver-regel
   (`MASTER-PLAN:176-177`) → §5 B1.
4. **Bunny is geen actieve dependency** (teambesluit 2026-09-02, ⛔-blok `CLAUDE.md:7-13`): geen taak, script
   of wachter mag van een levend account uitgaan; `bunny_video_id`- en showcase-play-links zijn dood en worden
   nergens als "werkend" gerapporteerd; de kwaliteitsronde (±$300 [doc, in vier ⛔-blokken; niet onderbouwd met
   factuur]) vervalt; het kijkplatform wordt bij de cutover gekozen (Bunny óf alternatief) en gevuld uit het
   NAS-archief.
5. **Meetregels van dit plan:** elk getal zonder eigen meting draagt een label (zie leeswijzer);
   "geverifieerd" betekent voor archiefmateriaal wat `MIGRATIE-WERKORDER.md:179-181` zegt: *bytes komen exact
   overeen met de verwachte bytes uit de wachtrij ÉN de sha256 staat in `manifest.jsonl`; elk falend item met
   naam en reden in `fouten.log` — nooit stilzwijgend overslaan.* Dezelfde definitie geldt voor de
   storefront-referentie (SR 1/SR 2).
6. **Change-control blijft de poort** (`albunyaan-change-control`: tiers T0–T3, MODEL FITNESS,
   founder-sign-off-lijst). Twee aanvullingen: (a) **`CLAUDE.md` wijzigt alleen na founder-akkoord op de diff,
   ongeacht tier** (het is de grondwet); (b) de bron van het MODEL-FITNESS-precedent
   (`SKILL.md:151`) verwijst naar een niet-bestaand plan — §7 T18; tot dat hersteld is geldt de tekst van de
   skill zelf. Ook gemeten: de globale modeldefault in `~/.claude/settings.json:5` is `claude-fable-5-1[1m]`
   terwijl `modelSettings` alleen `claude-opus-5` kent en de sessie als claude-opus-5[1m] draait → welk model
   "sterker model bij T2/T3" selecteert is [te meten] (RV 0.1).
7. **Standing rules uit MASTER-PLAN §4 blijven gelden** (draft-and-hold, founder publiceert met de hand; geen
   muziek; geen gezichten/figuren van vrouwen of meisjes; AI schrijft nooit religieuze tekst; geen gharar) —
   met één gedocumenteerde, stap-specifieke uitzondering (`ALBUNYAAN-PROMPTS-v2.md:586-588`, 2026-07-29: de
   Brevo-lijstimport werd aan een sessie gedelegeerd, "for THIS step only"). Relevant zodra SR 4 teksten of
   beelden aanraakt.
8. **Schrijfregel:** lezen mag altijd; elke eerste schrijfactie van een werkstroom (nieuwe map, nieuw
   bestand buiten `~/projects/_scratch/`, installatie, launchd-wijziging) heeft een founder-ja. Meetrapporten
   van SR 0 en RV 0 landen daarom in `~/projects/_scratch/` (buiten elke repo). **Founder-ja voor die map
   gegeven op 2026-09-02** (bij akkoord op dit plan); de map is daarop aangemaakt, leeg.
9. **Huisstijlnorm (founder 2026-09-03, §5 B13):** de Albunyaan-huisstijl zoals leden die nu zien op
   albunyaan.tv (Uscreen) is de norm — **1:1 pariteit in uiterlijk én structuur**: het echte logo (Arabisch
   woordmerk), kleuren, lettertypes, knopstijlen, banner/hero, menu's, footer, pagina-indeling, blokken en
   volgorde, teksten, talen/RTL. Het "saraev"-ontwerp in `packages/core/src/tokens.ts` en
   `apps/web/app/globals.css` vervalt als norm; in SR 4 worden de tokens omgezet naar de in SR 0/SR 2 gemeten
   Uscreen-waarden (één tokenwissel, raakt bewust ook de mobiel/TV-doelen — §7 T16). Het bindende
   normdocument voor vormgeving is de **gemeten storefront** (SR 0/SR 2), niet een merkbestand (§7 T32
   beslist); `brand-manhaj.md` geldt alleen nog voor inhoudsregels.

## §2 Werkstromen en status

| Code | Werkstroom | Status 2026-09-02 | Eerste actie |
|---|---|---|---|
| **AS** | Archief afronden (NAS) | Afrondend. `audit-volledig.mjs` op **28 punten**: AS 6 (4 series) + AS 10 (24 topmappen), alle andere assen 0 [gemeten `~/.albunyaan-cc/archief/audit/AUDIT-VOLLEDIG.txt`, 02-09 11:53]. NAS = Uscreen = 16.024/16.024, ontbrekend 0, NAS-only 0 [memory hercontrole 2026-09-01, nas-archief.md:569-571]. | AS 6.1 droogloop (founder-opdracht: eerste actie van de volgende sessie) |
| **BS** | Bunny-stop-controle | Meetronde klaar (BS 0, Bijlage A). Open: launchd-restant, ruis, tellingen, tweede ⛔-ronde (incl. memory-map), half-doorgestreepte stuurdocumenten, VPS. | BS 1 na §5 B3/B4 |
| **SR** | Storefront-pariteit `apps/web` ↔ albunyaan.tv | Niet gestart. Repo heeft een 5-juli-referentie (`reference/real-site-ia.json`, 11 clone-PNG's) en een eigen skin ("saraev rebuild") [gemeten]. Geen SR-grondslag in docs/, CLAUDE.md, MASTER-PLAN, TODO of PROMPTS [gemeten, §7 T29]. | SR 0 meetronde (`_scratch` bestaat; kan starten) |
| **RV** | Review-voorzieningen + Playwright-baseline | Niet gestart. 9-stappen-document ligt untracked in `docs/review-pipeline/` [gemeten]; codex/cubic/bun/gstack/karpathy niet aanwezig; geen CI, geen hooks, geen testsuite bij apps/web [gemeten]. | RV 0 meetronde (`_scratch` bestaat; B2 besloten; kan starten) |
| — | **Kijkplatformkeuze** (Bunny óf alternatief) | **nog niet gepland** (bekende randvoorwaarden: §6 punt 26) | — |
| — | **Leden-/DB-migratie** | **nog niet gepland** (bekende randvoorwaarden: §6 punt 27) | — |
| — | **Contentstop** | **nog niet gepland** — aparte beslissing (gouden regel 2; §6 punt 25) | — |
| — | **Cutover** (incl. Uscreen-opzegging) | **nog niet gepland** — datum OPEN; bekende poorten: §6 punt 28 | — |

## §3 Stappen per werkstroom

Vaste vorm per stap: **Doel** · **Gemeten vóór** · **Uitvoerder** · **Bewijs klaar** · **Poort** · **Tier**.
Groepskoppen (AS 6, AS 7, …) dragen zelf geen velden; elke uitvoerbare stap heeft een puntnummer.

### §3.1 AS — archief afronden

**AS 6 — volgorde-synchronisatie (2 series, 83 unieke bestanden op 279 paden) [gemeten 2026-09-03] — UITGEVOERD
2026-09-03 11:07 (AS 6.2–6.5 klaar, zie de stappen; alleen AS 6.6 nog open).**
Founder-opdracht 2026-09-02, letterlijk "eerste actie van de volgende sessie, in deze volgorde, niet
samenvoegen met ander werk" [memory nas-archief.md:11-20]. Het plan van 02-09 (4 series, "216 op 545") bleek in
de droogloop van 03-09 33 hernoem-regels dubbel te bevatten én twee series te hernummeren die al goed staan:
Uscreen toont in `1897232 The Arabic Language 1` 14 en in `1896296 Al-Aqeedah 1` 19 video's twee keer in
dezelfde collectie (eigen playlist_item-id per positie, dubbele dividers, in één
`contents_collections.details`-antwoord — broncontrole 2026-09-03 08:42, `~/projects/_scratch/b30/`). Definitie
sindsdien (B30, founder 2026-09-03): **elke video één keer, eerste voorkomen, aaneengesloten**; audit-as 6
ontdubbelt op video_id en meldt dat altijd (`e12e24a`); plangenerator `worker/as6-plan.mjs` (`d0f9890`).
Plan nu: `~/.albunyaan-cc/archief/as6-plan.json` [gemeten 2026-09-03 10:46: 2876693 Saud and Sara (30
hernoemingen, breedte 2, 4 mappen = 120), 1703237 General Anasheed (53, 2, 3 = 159); **83 unieke bestanden,
279 fysieke acties**; 0 naamconflicten; 0 dubbele regels; oud plan bewaard als
`as6-plan.json.voor-b30-2026-09-03`]. Audit na de wijziging: AS 6 = 2, ontdubbeld 2 series/33 items, totaal
26 (was 4/28). Val: nummerbreedte per serie behouden (breedte = max(huidig, nodig)) [memory :38-40]. De founder
noemt dit de procedure "volgorde-synchronisatie", nogmaals te draaien bij de contentstop [memory :42-45].

- **AS 6.1 Droogloop — KLAAR 2026-09-03 [gemeten].** Doel: alle regels tonen, niets samenvatten. Droogloop 1
  (`~/projects/_scratch/AS6-droogloop-2026-09-03.txt`, 545 regels van het oude plan, live NAS): 479 unieke
  acties, 183 inodes, 66 dubbele regels → B30. Droogloop 2 na B30
  (`~/projects/_scratch/AS6-droogloop-2-2026-09-03.txt`, sha256
  `b76bb907627b318a52c48a7c6b299aa1d181437165446d507787fd5a575137ec`). Gemeten vóór: as6-plan.json van
  d0f9890 (10:46); audit AS 6 = 2 [gemeten]. Uitvoerder: Claude Code. Bewijs klaar: **279 regels (120 / 159),
  83 unieke bestanden, 0 conflicten (3 controles), 0 dubbele regels, bronbestanden gevonden 279/279 = 100 %;
  noemer sha-controle 83 inodes op 279 paden.** Poort: geen (lezen). Tier: T0.
- **AS 6.2 Go** — Doel: expliciete go van de founder over **279 fysieke acties op 83 bestanden**, verwijzend
  naar de sha256 van droogloop 2. Gemeten vóór: AS 6.1-lijst (droogloop 2). Uitvoerder: founder. Bewijs klaar:
  schriftelijke go met datum, vastgelegd onder §5 (B-regel) én herhaald in de commit-tekst van AS 6.4. Poort:
  founder. Tier: T3 (verplaatsen van archiefbestanden buiten het gevestigde pad). **GEGEVEN 2026-09-03** ("go voor
  279 acties op 83 bestanden volgens AS6-droogloop-2-2026-09-03.txt, sha256 b76bb907…37ec"); sha hercontrole vóór
  uitvoering: gelijk.
- **AS 6.3 Terugvalkopie (vóór elke beweging)** — Doel: manifest-kopie op de NAS
  (`manifest.jsonl.voor-as6-<datum>`, patroon van `manifest.jsonl.voor-verhuizing2-20260902`). Gemeten vóór:
  AS 6.2 go; NAS-loop vrij (`_lock` niet bezet; `stoploop.sh`-regel [memory :398-406]); huisregel "tijdens een
  run wijzigt niemand handmatig iets" aan het team gemeld [memory :231-233]. Uitvoerder: Claude Code.
  Bewijs klaar: 1 kopie met sha256 gelijk aan het levende manifest. Poort: AS 6.2. Tier: T1 (schrijft op de NAS).
  **KLAAR 2026-09-03 [gemeten]:** `manifest.jsonl.voor-as6-2026-09-03` = sha256 `5538b4bd…be48`, 18.279 regels,
  gelijk aan het levende manifest; wachtrij `_queue` leeg, NAS-loop idle (laatste verwerking 26-08).
- **AS 6.4 Uitvoering** — Doel: hernoemen op de NAS, hardlink-plekken meegenomen. Gemeten vóór: AS 6.3-kopie
  bestaat. Uitvoerder: Claude Code. Bewijs klaar: 279/279 uitgevoerd, 0 fouten; omgekeerde lijst
  `_ops3-terug-<datum>.tsv` met 279 regels (patroon `_ops2-terug-20260902.tsv`). Poort: AS 6.2. Tier: T2
  (raakt manifest/hardlinks — fail-closed pad). **KLAAR 2026-09-03 11:07 [gemeten]:** 279/279 `mv -n`, 0 STOP
  (`_verhuis4-as6-20260903.log` op de NAS); `_ops3-terug-2026-09-03.tsv` 279 regels (FILEMV nieuw → oud) op de NAS
  vóór de eerste beweging geplaatst; manifest herschreven (83 records, 279 paden; 18.279 regels; atomair via .tmp +
  mv, alleen bij ongewijzigde sha én lege wachtrij); lokaal `structuur.jsonl` (83/279) en `structuur-series.jsonl`
  (2 series/83 eps) bijgewerkt met backups `*.voor-as6-20260903`.
- **AS 6.5 Sha- én volgorde-verificatie** — Doel: geen byte veranderd, volgorde = platformvolgorde. Gemeten
  vóór: AS 6.4-log. Uitvoerder: Claude Code. Bewijs klaar: sha256 over de 83 unieke bestanden = 83/83 gelijk
  aan manifest (noemer uit AS 6.1, droogloop 2); `audit-volledig.mjs --hergebruik` → AS 6 = 0 én de regel
  "ontdubbeld op video_id: 2 series, 33 items", totaal 24 (alleen AS 10 over); één telling per definitie voor
  series/collecties (§7 T20). Poort: telling exact 0 — anders niet klaar.
  Tier: T0. **KLAAR 2026-09-03 [gemeten]:** `sha256sum -c` op de NAS 83/83 OK (35 s); audit `--hergebruik` 09:10Z én
  verse audit 09:35Z: AS 6 = 0, AS 11 = 0/0, AS 12 = 0, ontdubbeld 2/33, **TOTAAL 24 (alleen AS 10)**; verse oogst:
  AS 1 = 16.025/16.025.
- **AS 6.6 Volgorde-check in de wachter als eindtest** — Doel: de dagelijkse wachter meldt afwijkende volgorde
  (SIGNALEREN, nooit repareren). Gemeten vóór: **die check BESTAAT NIET** — `worker/archief-bijwerken.mjs`
  stap 1b controleert alleen collectie-dekking [memory :21-27]; dus eerst code: AS 6-logica uit
  `worker/audit-volledig.mjs` ("AS 6") overnemen, niet opnieuw bedenken. Uitvoerder: Claude Code (code) →
  founder (keuring). Bewijs klaar: `node --check` 0 fouten; één handmatige ronde exit 0 met de regel
  "volgorde: 0 series afwijkend"; diff met 0 regels die repareren. Poort: founder keurt de signaleer-only
  semantiek; review per RV zodra die bestaat, tot dan change-control review-eisen 1/4/6 (§4 punt 3). Tier: T1.

**AS 7 — wachter 04:15 bewijzen.** Cowork zegt "wachter 04:15 vangt nieuwe uploads"; gemeten: het log bevat
**nul geslaagde 04:15-rondes** (27–29 aug exit 127 PATH-fout; 30 aug–2 sep 04:15 "STOP: twin Chrome intern
stuk"); drie geslaagde handmatige rondes (29 aug 15:20; 2 sep 10:34 en 11:16) [gemeten
`~/.albunyaan-cc/archief-bijwerken.log`]. Fix van 02-09: `archief-bijwerken.sh` start `start-twin.sh`
(profiel `chrome-twin-2`) zelf [gemeten r72-78, r105].
- **AS 7.1 Eerste echte nachtelijke test** — Doel: bewijs dat de 04:15-ronde slaagt. Gemeten vóór: twin op
  :9333 met chrome-twin-2 (Chrome/146.0.7680.31) draait [gemeten]; Uscreen-sessie geldig [te meten — vereist
  Uscreen-verkeer]; exitcode-semantiek: `launchctl list` toont alleen de status van de launchd-gestarte run
  (de 04:15-run van 02-09 gaf exit 4 om 04:15:37 [gemeten]; handmatige rondes wijzigen die status niet).
  Uitvoerder: launchd (nacht 3 sep 04:15), Claude Code leest af. Bewijs klaar: `archief-bijwerken.log` bevat
  "=== wachter klaar ===" met tijdstempel 04:1x én `launchctl list` toont exit 0 voor
  `com.albunyaan.archief-bijwerken`; 1 ronde = 1 bewijs. Poort: geen. Tier: T0.
  **Stand 2026-09-03 [gemeten]: NIET bewezen.** De 04:15-ronde van 03-09 liep wél door tot "=== wachter klaar ==="
  (04:21:19, `launchctl list` exit 0): Uscreen 16.025 video's, 1 nieuw (4333088, `09 - العمر - Age 16+/65 -
  معركة عين جالوت`), dekking 703/0/6, structuur bijgewerkt. Maar beide ophaal-kinderen logden "klaar (exit null)"
  binnen dezelfde seconde: `archief-bijwerken.mjs:428` doet `spawnSync('node', …)` met een kaal `node`, en
  launchd geeft alleen `/usr/bin:/bin:/usr/sbin:/sbin` mee → `ENOENT`, `status null`, geen signaal
  (gereproduceerd met `env -i PATH=/usr/bin:/bin:/usr/sbin:/sbin /usr/local/bin/node -e "spawnSync('node',…)"` →
  `status null, error ENOENT`). De wrapper zoekt node wél met absoluut pad (`archief-bijwerken.sh:53-67`) maar
  exporteert geen PATH. Gevolg: geen wachtrijbestand aangemaakt, op de NAS géén map `65 - معركة عين جالوت` en
  0 treffers voor 4333088 in `manifest.jsonl`; het 02-09-audit-cijfer 16.024/16.024 is met de oogst van 03-09
  dus 16.024/16.025. Eerdere rondes raakten dit pad nooit (0 nieuwe video's → vroege exit). Telegram meldde
  vermoedelijk "video-ronde exit null — logboek nakijken" (founder bevestigt). **Voorstel (T1, wachtercode,
  founder-ja + review-eisen 1/4/6; nog niets gewijzigd):** in `draai()` `process.execPath` i.p.v. `'node'`,
  `r.error`/`r.signal` meeloggen, en `status === null` als mislukt behandelen (Telegram + exit ≠ 0); in de
  wrapper `export PATH="$(dirname "$NODE"):$PATH"`. Bewijs blijft: één 04:15-ronde waarin een nieuwe video
  aantoonbaar op de NAS landt (manifest +1).
  **Reparatie 2026-09-03 (goedgekeurd, T1, commit `122f7db` + wrapper buiten de repo):** `process.execPath`;
  `error`/`signal` gelogd; `status === null` = MISLUKT (nooit "klaar"); mislukte ophaalronde → Telegram + exit 6;
  wrapper `export PATH="$(dirname "$NODE"):$PATH"` en case 6; spawnSync → async `spawn` met await (kinderen bewust
  sequentieel). Drie paden gemeten onder launchd-PATH: ENOENT → status null/error ENOENT; execPath → 0; timeout →
  signaal SIGTERM. Adversariële review (3 lenzen): geen blokkerende bevinding, 2 hardenings overgenomen.
  **Bewijs handmatige ophaalronde 2026-09-03 [gemeten]:** `archive-request-links.mjs --batch 10 --negeer-wachtrij`
  → prep 4333088 OK (508.839.302 bytes; de 9 bekende "PREP GEWEIGERD 404" = vervallen video's, §7 T33), wachtrij
  naar de NAS; NAS-loop 11:21:24 "OK video/4333088 09 - العمر - Age 16+/65 - معركة عين جالوت.mp4"; manifest-regel met
  sha256 `bf9fa491…dd2f` (18.280 regels); verse audit 09:35Z: **AS 1 = 16.025/16.025**, totaal 24.
  **Twee restpunten (niet in de diff, voorstel):** (1) een eenmaal gemiste video staat al in `structuur.jsonl`, dus
  een ronde zonder nieuwe video's exit vóór stap 4/5 en haalt hem niet alsnog op — daarom was de handmatige ronde
  nodig; voorstel: markerbestand `archief/OPHAAL-MISLUKT` dat de volgende ronde consumeert en dan stap 4/5 tóch
  draait (T1, founder-ja). (2) `archive-extras.mjs` eindigde met exit 1: de tekst-ingest op de NAS gebruikt dezelfde
  `_lock` als `archive-fetch.sh --loop`, die sinds 24-08 permanent draait → "LOCK BEZET"; covers/bijlagen gaan wel
  via de wachtrij. Sinds 24-08 kan de tekst-ingest dus nooit slagen (pre-existing; AS 8 = 0 omdat de audit
  metadata-aanwezigheid meet, niet verversing) — aparte beslissing: ingest via de wachtrij laten lopen, of een
  eigen lock (T1). **AS 7.1 oordeel: reparatie bewezen via de handmatige ronde; het nachtelijke bewijs 1/1 volgt
  pas bij de eerstvolgende 04:15-ronde mét een nieuwe video.**
- **AS 7.2 Zelfherstel-besluit** — Doel: antwoord op de founder-vraag van 2026-08-30 (mag de wachter bij exit 4
  Chrome herstarten + de ronde herhalen?) [memory :264-268, 381-387]. Gemeten vóór: AS 7.1-uitkomst.
  Uitvoerder: founder. Bewijs klaar: schriftelijk antwoord met datum onder §5 B10. Poort: founder. Tier: T0.
- **AS 7.3 CLAUDE.md:36 bijwerken** — Doel: grondwet noemt het werkende profiel. Gemeten vóór: `CLAUDE.md:36`
  noemt `chrome-emdb-clone`; praktijk = `chrome-twin-2` via `start-twin.sh`, oud profiel crasht (exit 133) en
  blijft als terugval [memory :661-685] [gemeten]. Uitvoerder: Claude Code. Bewijs klaar: 1 diff; `grep -c
  chrome-emdb-clone CLAUDE.md` = 0 (of 1 als "terugval"-vermelding). Poort: founder (elke CLAUDE.md-diff,
  gouden regel 6a). Tier: T0.

**AS 8 — bekende archiefgaten (besluiten, geen uitvoering).**
- **AS 8.1 Gaten voorleggen** — Doel: founder beslist over (a) ondertitels: 0 gearchiveerd van 4.489
  [memory nas-archief.md:338] of 4.494 [memory :418-419] — verschil 5, aantal [te meten met één telling op
  `subtitles[].vtt_url` in `uscreen-video-details.jsonl`]; 34 handmatig geüpload; ~30 MB voor álle sporen
  samen [memory :418-426, 2026-08-26], omvang van alleen de 34 = [te meten]; geparkeerd 2026-08-26 → §5 B12;
  (b) 1,4 TB in `/volume1/Albunyaan/#recycle` (DSM-beslissing team) [memory :209, 2026-08-11];
  (c) comments-status (§7 T8). Gemeten vóór: bovenstaande tellingen. Uitvoerder: Claude Code (lijst) →
  founder/team (besluit). Bewijs klaar: 3 beslissingen met datum in §5 (B12) resp. teamlogboek. Poort:
  founder. Tier: T0. **KLAAR 2026-09-03:** (a) B12 = minimaal de 34 handmatige → AS 8.2; (b) `#recycle` (1,4 TB)
  laten tot na de cutover; (c) comments definitief gesloten (T8), memory + teamsamenvatting gecorrigeerd.
- **AS 8.2 Ondertitels: de 34 handmatige archiveren (B12)** — Doel: de 34 handmatig geüploade .vtt's staan
  geverifieerd op de NAS (definitie gouden regel 5: bytes + sha256 in `manifest.jsonl`, falers in `fouten.log`).
  Gemeten vóór: welke 34 het zijn en hun omvang — [te meten] met één telling op `subtitles[]` in
  `uscreen-video-details.jsonl` (handmatig vs auto, §7 T36: 4.489 vs 4.494), vóór er iets wordt opgehaald;
  bestemming en manifest-`kind` voor ondertitels [te bepalen — voorstel: naast het videobestand,
  `<video-stem>.<taal>.vtt`, kind `ondertitel`]; NAS-loop idle. Uitvoerder: Claude Code (alleen lezen bij Uscreen:
  `subtitles[].vtt_url` ophalen, geen admin-acties). Bewijs klaar: telling 34 = 34 op de NAS, sha256 34/34 in het
  manifest, `audit-volledig.mjs` AS 7/11 = 0 (geen ongeregistreerde bestanden). Poort: founder ziet de meting
  (aantal + MB) vóór het ophalen. Tier: T1 (schrijft op de NAS, nieuwe kind in het manifest).

**AS 9 — catalog-backup onbetrouwbaar.** Nieuw gemeten: in het log-venster 2026-08-20 t/m 2026-09-02 eindigden
8 van 14 nachtelijke rondes van `com.albunyaan.catalog-backup` (03:30) met "BACKUP DONE WITH ERRORS" (eerste
23-08) en 6 met "BACKUP OK"; laatste geslaagde: 01-09 03:30 (73.067 rijen, `videos` 15.984); op 02-09 03:30
liepen `collection_items`, `video_categories` en `videos` in een read timeout (22.690 rijen); het log noemt
op r2452 ook een OneDrive-melding (geen Volledige Schijftoegang → tweede kopie hapert) [gemeten
`~/.albunyaan-cc/backup.log:1980-2487`]. Intermitterend, niet permanent — maar ≈57 % foutrondes.
- **AS 9.1 Oorzaak meten en herstellen** — Doel: elke nacht een volledige back-up. Gemeten vóór: de reeks
  hierboven; timeout-waarde en paginering in `backup-catalog.py` [te meten]; OneDrive-FDA-status [te meten].
  Uitvoerder: Claude Code (fix in het back-upscript = T1); founder voor OneDrive-rechten en elke
  launchd-wijziging (guardrail). Bewijs klaar: **drie opeenvolgende** nachtelijke rondes "BACKUP OK" én
  rijtelling `videos` = Supabase-count (gepagineerd, 1000-rijen-clamp) — één handmatige run bewijst niets bij
  een intermitterend patroon. Poort: founder ziet het rapport. Tier: T1.
  **Notitie 2026-09-03 [gemeten]:** ronde 03-09 03:30 logt "BACKUP OK: 73073 rows, 37 tables" (`backup.log:2526`),
  maar `launchctl list com.albunyaan.catalog-backup` toont `LastExitStatus = 768` (= exit 3). Log en exitcode
  spreken elkaar tegen: welke stap ná de "BACKUP OK"-regel geeft 3 terug (OneDrive-kopie? — r2452-melding) is
  [te meten] in AS 9.1; tot dan telt een "OK"-regel niet als bewijs zonder exit 0.
  **Gemeten 2026-09-03 (alleen lezen, twee onafhankelijke lezers, tweede probeerde de eerste te weerleggen — niet
  gelukt):** exit 3 is de **bewuste** eindcode van `backup-catalog.py:143` (`sys.exit(1 if errors else (3 if mirror
  else 0))`): dump compleet, alleen de OneDrive-spiegel/rotatie faalde. Stap: `rotate(ONEDRIVE_ROOT, 7)` (r125 →
  r87 `root.iterdir()`) → PermissionError (geen Volledige Schijftoegang voor het launchd-python), gevangen op r126 →
  `mirror` → exit 3. Log en exitcode spreken elkaar NIET tegen: stdout is blokgebufferd, stderr regelgebufferd, dus
  de "LET OP"-regel (stderr, r140) landt vóór het stdout-blok van dezelfde ronde (`backup.log:2488` hoort bij 09-03,
  `:2452` bij 09-02). Sinds 20-08 had géén ronde exit 0: OK-rondes = 3, foutrondes = 1 (15 LET OP ↔ 15 BACKUP-regels).
  `copytree` naar OneDrive slaagt wél (2026-09-03_0330 staat er, 38 bestanden), alleen listen/rotatie niet → OneDrive
  bevat 54 back-upmappen (oudste 2026-07-07) i.p.v. 7. De plist start `/usr/bin/python3` rechtstreeks (geen wrapper);
  768 = 3<<8, normale exit. **Voorstel (niets uitgevoerd):** (1) founder: Volledige Schijftoegang voor het ECHTE
  binary `…/Python3.framework/Versions/3.9/Resources/Python.app/Contents/MacOS/Python` (com.apple.python3) —
  `/usr/bin/python3` is een gedeelde xcode-select-shim, die toevoegen doet niets; let op: de eerste geslaagde rotatie
  verwijdert dan 47 oude OneDrive-mappen (lokaal blijven 14); (2) T1: `sys.stdout.reconfigure(line_buffering=True)`
  bovenaan `main()` zodat het log chronologisch leest; (3) apart voorstel voor de exit-1-rondes (8 van 15): retry met
  backoff per pagina in `req()`/`dump_table()` (r36/r50) i.p.v. de hele tabel als ERROR. Bewijs blijft: drie
  opeenvolgende nachten exit 0 + rijtelling.

**AS 10 — Engels-map: 28 vs 61 seriemappen.** Rechten zijn NIET de oorzaak [memory nas-archief.md:47-67,
tweemaal gemeten: alle 61 seriemappen identiek `drwxr-xr-x mostafa:users`; Samba `skip smb perm=yes`,
`hide unreadable=no`]. De audit telt iets anders: **24 van de 35 TOPmappen in de archiefwortel zonder
Synology-ACL** (niet te verwarren met de 35 Engelse seriemappen van vóór AS4) [gemeten AUDIT-VOLLEDIG.txt:18],
waarvan 6 werkmappen (_lock, _oud-logs, _partial, _staging-bijlagen, beeld, video). Founder-plan in 3 stappen:
- **AS 10.1 Hertelling door de collega** — Doel: symptoom weg of bevestigd. Gemeten vóór: English heeft 61
  seriemappen (was 35 vóór de AS4-verhuizing van 02-09) [memory :63-66]. Uitvoerder: collega (map
  sluiten/heropenen of share opnieuw verbinden). Bewijs klaar: geteld aantal; 61 → klaar. Poort: geen. Tier: T0.
- **AS 10.2 Namen + screenshot (alleen als het geen 61 is)** — Doel: naam-voor-naam vergelijken, niet het
  aantal. Gemeten vóór: AS 10.1 ≠ 61. Uitvoerder: collega levert; Claude Code vergelijkt met `ls` op de NAS.
  Bewijs klaar: N ontbrekende namen benoemd, N verklaard, 0 onverklaard. Poort: geen. Tier: T0.
- **AS 10.3 Rechten-hygiëne als APARTE opruimactie** — Doel: voorspelbare rechten (doelvorm A:
  `drwxr-xr-x mostafa:users`/644, al de vorm van 1449 van 1794 mappen [memory :52-54]) + preventie in
  `archive-fetch.sh` en de wachter (vorm zetten ná mkdir). **Nooit geboekt als oplossing voor AS 10.1.**
  Gemeten vóór: keuze doelvorm (§5 B11); val `synoacltool -del` → `d---------` → altijd `chmod 755` erachteraan;
  eerst op één map testen [memory :77-84]; rechten-backup `rechten-backup-voor-acl-20260902.txt` (6,7 MB)
  bestaat [gemeten]. Uitvoerder: Claude Code, founder erbij. Bewijs klaar: `rechten.txt`-scan 0 afwijkingen;
  audit AS 10 = 0; eigen logboekregel. Poort: founder (B11). Tier: T2 (raakt ~55k objecten).

### §3.2 BS — Bunny-stop-controle

- **BS 0 Meetronde** — Doel: vaststellen welke automatiseringen Bunny nog raken. Gemeten vóór: n.v.t. (eerste
  stap). Uitvoerder: Claude Code (2026-09-02). Bewijs klaar: Bijlage A — 12/12 LaunchAgents beoordeeld, 1 met
  echte Bunny-API-call (bunny-balance-watch, nu no-op), 0 automatisch startende verify-coverage/showcase-ketens,
  0 crontab-regels; vastgelegd in `memory/bunny-account-gestopt.md`. Poort: founder bevestigt dat BS 0 als
  klaar geboekt mag worden (§7 T7). Tier: T0. **Status: KLAAR [gemeten].**
- **BS 1 Tweede ⛔-ronde (docs-hygiëne)** — Doel: geen enkel levend document geeft nog Bunny-instructies
  zonder markering. Gemeten vóór [gemeten]: ⛔ staat in 8 repo-bestanden (README, MIGRATIE-WERKORDER, CLAUDE.md,
  cutover-runbook, team-handbook + skills bunny-operations/migration-runbook/ops-and-automations) + 3 buiten de
  repo = 11; **9 van 12 skills** dragen ongemarkeerde Bunny-instructies (failure-archaeology 37 treffers,
  platform-replacement-campaign 29, migration-debugging-playbook 22, …); `PROJECT_SUMMARY.md` (13 KB, "for
  external review"), `migration-truth.md` en `docs/security-findings-report.md` (r66: "197/197 published VOD
  already on Bunny") 0 ⛔; **memory-map: 0 van 10 bestanden met ⛔**, o.a. `nas-archief.md:148` noemt de
  kwaliteitsronde nog als lopend; MASTER-PLAN §A1.3 (62 debris) en §A3.1 punt 1–2 (BUNNY_API_KEY-P0, "WS5 signed
  playback is LIVE") niet doorgestreept; TODO r.26-29/35-39/269-272 en PROMPTS r.722-744/767-769 ongewijzigd;
  `docs/cutover-runbook.md:153` verwijst levend naar "project memory" (r.22 ook, maar al doorgestreept).
  Uitvoerder: Claude Code (repo + memory) · founder/Cowork (~/projects, geen git). Bewijs klaar: `grep -rl '⛔'`
  dekt elk bestand met >0 Bunny-instructies, óf het staat op de "historisch archief"-lijst; 0 levende
  "see project memory"-verwijzingen. Poort: founder zegt welke bestanden archief zijn (§5 B3, B4). Tier: T0.
- **BS 2 Automatiserings-ruis** — Doel: geen ruis, geen betekenisloze getallen. Gemeten vóór [gemeten]:
  `migration-watchdog` logt elke 5 min "ORCHESTRATOR DOWN" (9.723 regels, geen Telegram); `bundle-meter`
  draait elke 5 min (33 GB om 18:27) en kan bij 250 GB "orchestrator + workers killen"; vlaggen
  BUNDLE-ALERT/BUNDLE-WARN (23 juli) staan er nog; `morning-report.sh:11` en
  `~/Marketing-Pipelines-Albunyaan/scripts/collect_metrics.py:75-76` tellen `bunny_video_id`;
  `bunny-balance-watch` zit nog in het launchd-geheugen zonder plist; `archief-status` miste eerder rondes door
  launchd-drift van StartInterval (fix = plist naar StartCalendarInterval, vereist unload+load → founder erbij)
  [memory :461-468]. Uitvoerder: founder voor elke `launchctl bootout`/reload (guardrail blokkeert Claude Code —
  bewust); Claude Code voor scriptwijzigingen. Bewijs klaar: `launchctl list | grep albunyaan` zonder
  migration-watchdog/bundle-meter/bunny-balance-watch (12 → 9); 0 BUNDLE-vlaggen; morning-report en
  metrics-digest zonder Bunny-regel (vervangen door de NAS-telling ná §5 B8). Poort: founder (§5 B5). Tier: T1
  (scripts); het uitladen doet de founder zelf.
- **BS 3 verify-coverage / showcase** — Doel: geen vals Telegram-alarm, geen dode play-knoppen. Gemeten vóór
  [gemeten]: **twee** aanroepers geven `--telegram` door — `build-library-showcase.mjs:723` en
  `import-video-extras.ts:223`; `verify-coverage.mjs` heeft zes assen (r119-153) en **geen Bunny-as**;
  `bunny_video_id` staat alleen in de SELECT r104 en wordt daarna niet gebruikt (dode kolom); showcase bouwt
  `iframe.mediadelivery.net`-links (r120-126). Voorstel: (1) `--telegram` uit beide aanroepen; (2) `NO_PLAY`
  standaard aan; (3) dode kolom uit de SELECT (cosmetisch, raakt geen telling). Uitvoerder: Claude Code.
  Bewijs klaar: `grep -rn -- --telegram worker/` geeft alleen verify-coverage.mjs zelf; showcase-build zonder
  Telegram-bericht; verify-coverage-uitvoer ongewijzigd in tellingen (zes assen). Poort: founder zei op
  2026-09-02 "voorstel, nog niets veranderen" → §5 B6; volgorde t.o.v. RV 1: §4 punt 6. Tier: T1 (raakt de
  dekkingscontrole; per bloat-regel van RV géén verwijdering van de controle zelf).
- **BS 4 VPS + sampler** — Doel: geen kosten zonder functie. Gemeten vóór: Hetzner `albunyaan-migration-1`
  (root@2.28.5.57, €14,51/mo [doc MASTER-PLAN:1023]) had als enige functie Bunny-transfers;
  `MASTER-PLAN:1124-1125` laat de "throughput sampler tot cutover" draaien voor het vervallen gate 1.
  Uitvoerder: founder. Bewijs klaar: opzegbevestiging Hetzner, óf schriftelijk "aanhouden voor live-relay"
  (§5 B7/B9). Poort: founder. Tier: T3 (kosten).
- **BS 5 Bunny-restlijst formeel sluiten** — Doel: de nooit afgesloten Bunny-beslissingen als VERVALLEN
  vastleggen: 57 non-empty untracked + 5 tracked-but-invalid = 62 debris [doc MASTER-PLAN:1060-1063,
  2026-07-22]; ~80 GB bundle-mysterie [memory vps-split-migration.md:37, 2026-07-22]; residual-19-upload
  [doc MASTER-PLAN:1160-1162, 2026-07-30]. Gemeten vóór: BS 1 afgerond. Uitvoerder: Claude Code (memory) ·
  founder (MASTER-PLAN). Bewijs klaar: 0 open Bunny-items in `MEMORY.md`; 3 blokken VERVALLEN in MASTER-PLAN.
  Poort: geen. Tier: T0.

### §3.3 SR — storefront-pariteit (`apps/web` ↔ albunyaan.tv)

**Doel:** `apps/web` qua uiterlijk, menu's en pagina-indeling gelijk aan de huidige albunyaan.tv (Uscreen) —
**1:1 in uiterlijk én structuur** (founder 2026-09-03, B13; gouden regel 9): logo, kleuren, lettertypes,
knopstijlen, banner/hero, menu's, footer, pagina-indeling, blokken en volgorde, teksten, talen/RTL.
**Founder-regel (founder 2026-09-03):** "SR bouwt alleen functies en indeling. De bestaande catalogus-metadata
(titels, omslagen, categorieën, volgorde) blijft als vulling; er komen NU geen videobestanden, geen afspeelbare
content, geen leden en geen nieuwe data-imports naar het nieuwe platform. Speler toont poster tot de
kijkplatformkeuze."
**Buiten scope (letterlijk, founder):** community, bundels, mobile/TV-apps-sectie, refer-to-Uscreen.
**Bij twijfel: vragen, nooit stilzwijgend meenemen of weglaten.** De twijfelgevallen die bij het opstellen
zichtbaar waren zijn op 2026-09-03 beslist (§5 B13–B18, B27); nieuwe twijfelgevallen krijgen een B-nummer.

**Cowork-bevindingen a–g en waar ze landen:** (a) eigen huisstijl → gemeten hieronder + B13; (b) ia-json
achterhaald → SR 0 punt 1 + §7 T14/T15; (c) Uscreen-admin als bron → SR 0 punt 4 [Cowork, niet gemeten];
(d) matrix → SR 0 punt 6 + B14/B15/B27; (e) opslag → SR 1 + B17; (f) Playwright/hCaptcha → SR 0 punt 3 +
§7 T27; (g) beslisvragen → B13–B17.

**Wat er al in de repo staat [gemeten 2026-09-02]:** `reference/real-site-ia.json` (nav 10 items incl.
Contact, footer 5 zonder Privacy, 15 catalogRows, 21 live channels in `liveCategory`; capturedFrom
"albunyaan.tv/catalog (live, 2026-07-05 night)" — of die capture anoniem of ingelogd was staat er niet) +
`reference/real-catalog.png` (4,9 MB) + `reference/deltas/` 11 PNG's `clone-*.png` (5 juli 04:30–04:38;
bestandsnaam suggereert de EIGEN clone — [te meten: beeldinspectie]). Eigen skin: `packages/core/src/tokens.ts`
(38 r., "single source of truth for all app targets (web, mobile, TV)", bron "saraev landing rebuild +
docs/brand-manhaj.md" — dat laatste bestand bestaat NIET; `README.md:35` wijst naar
`~/Marketing-Pipelines-Albunyaan/brand/brand-manhaj.md` → §7 T32) + `apps/web/app/globals.css` (192 r.,
"keep in sync", geen sync-script); `#447525` 6×, Inter + Playfair via next/font, hero-gradient gedupliceerd;
"Glow" 0 treffers in de repo. Sinds 2026-07-12 is aan de storefront-vormgeving niets veranderd (git log).
Nav in `apps/web/components/SiteHeader.tsx:8-14`: Home, Videos, About us, Dawah, Q&A, Coupon, Download app —
**geen Contact, geen dropdown**, en `hidden lg:flex` (r52): **onder ~1024 px is er GEEN navigatie, geen
hamburger**; r6 claimt "structure per reference/real-site-ia.json" maar implementeert 7 van de 10 items.
Footer `SiteFooter.tsx:9-16`: Videos, Q&A, Contact, Donate, Terms of service, Privacy policy (r5-7: Privacy
bestond op de oude site NIET). Talen: `lib/session.ts:28` en/ar/nl; `layout.tsx:24` dir=rtl bij ar;
`LanguageSwitcher.tsx:13` "Visual EN/AR/NL switcher" — **0 vertaalbestanden, geen i18n-bibliotheek: AR/NL tonen
dezelfde Engelse tekst met alleen dir/lang gewisseld.** 29 page.tsx-routes, 21 publiek: /, /about-us, /account,
/auth/confirm, /catalog, /categories/[slug], /contact, /coupon, /dawah, /donate, /download-app, /join, /login,
/parents, /privacy, /profiles, /programs/[slug], /qa, /search, /terms, /watch/[slug]. Van de Cowork-paginalijst
[Cowork] ontbreekt een route voor "Language prefs" en "new-payment". Tooling: `worker/shot.mjs`/`shot2.mjs`
schieten localhost:3010 zonder viewport; `worker/render-html-image.mjs` gebruikt Playwright's eigen headless
chromium ("never the shared twin browser") met viewport-argumenten maar rendert file://; 16 worker-scripts
noemen albunyaan.tv als bron, waaronder `storefront-covers.mjs` en `scrape-category-order.mjs` via de twin
Chrome (:9333); `scrape-category-order.mjs:36-38`: de storefront laadt wisselvallig (71 vs 40 items — altijd
de meting met de meeste items houden); redirect-map-scripts lezen kleine partials via plain curl
(`docs/redirect-map.md:51-53`), categorie-partials geven 406 (r88-90). hCaptcha is in het hele corpus alleen
aan concurrente ADMIN-loads gekoppeld (`CLAUDE.md:29`); over volledige publieke pagina-loads bestaat **geen
meting**. `ALBUNYAAN-TODO-BEGINNER.md:110-111` (2026-07-27): "the public site hides the catalog behind login"
→ §7 T13. Waar SR 4 zichtbaar wordt: Vercel-alias volgt `main`, **main 74 commits achter `exit-phase`**
[gemeten] → B18.

**SR 0 — Meetronde (alleen lezen; rapport in `~/projects/_scratch/`).**
- Doel: alles wat de Cowork-context als "tekstpeiling" bracht, vervangen door metingen.
- Gemeten vóór: `~/projects/_scratch/` bestaat (founder-ja 2026-09-02); twin Chrome op :9333 met chrome-twin-2
  draait [gemeten]; Uscreen-admin-sessie geldig [te meten]; READ-AND-EXPORT-ONLY-regels
  (`ALBUNYAAN-PROMPTS-v2.md:495-501`: niets aanmaken/bewerken/verzenden; niet klikken op
  Send/Delete/Save/Publish/Confirm/Archive; login-wall of 2FA → STOP) gelden letterlijk.
- Uitvoerder: Claude Code.
- Meet (elk punt = één regel in het rapport, met commando/URL en tijdstip):
  1. Live menu, footer, hero-teksten, taalwisselaar op albunyaan.tv (anoniem, EN/AR/NL) — vergelijk met
     real-site-ia.json en met SiteHeader/SiteFooter; tel items; staat Privacy nu in de live footer (§7 T15)?
  2. Is /catalog anoniem bereikbaar of achter login (§7 T13)? Welke pagina's zijn überhaupt anoniem?
     **Voorwaarde B14 (founder 2026-09-03):** blijken /catalog of /programs anoniem onbereikbaar, dan komt
     B14 (testaccount) terug als vraag vóór SR 1 — niet stilzwijgend doorgaan.
  3. hCaptcha/bot-check bij N volledige pagina-loads met assets [N en interval vastleggen in het rapport;
     1,8 s is het admin-harvest-precedent uit `CLAUDE.md:29`, niet gemeten voor de publieke storefront].
     **Volgorde: uitsluitend Playwright's eigen headless chromium (render-html-image-precedent, eigen profiel,
     geen Uscreen-cookies). De twin Chrome pas als headless faalt, pas ná een geslaagde AS 7.1, en met eigen
     founder-poort — de twin draagt de admin-sessie die de wachter nodig heeft. Bij het eerste
     bot-check-signaal: STOP, geen tweede poging, melden.**
  4. Uscreen-admin (alleen lezen) — alle onderdelen hieronder zijn [Cowork, niet gemeten]: bestaat er een
     "Theme Customization"-scherm (kleuren, logo, favicon, fonts), een "Settings → Snippets"-scherm (custom
     CSS/head-code) en een per-pagina blokkenlijst? Zo ja: exporteren als tekst/JSON, letterlijk. Zo nee:
     melden wat er wél is. Bevestig of het thema "Glow" heet [Cowork; 0 treffers in repo]. Paginalijst
     [Cowork]: Homepage, About us, Contact, coupon, Dawah, Downloads, Language prefs, new-payment, Privacy,
     Servicevoorwaarden.
     **Aanvulling founder 2026-09-03 (alleen lezen/exporteren):** (i) logo-, favicon- en bannerbestanden op
     originele grootte exporteren — dit zijn de bronwaarden voor de tokenwissel in SR 4 (B13); (ii) de
     e-mailsjablonen van Uscreens ingebouwde e-mailsysteem — welkomstmail, inlog/wachtwoord, betaling,
     opzegging — als tekst exporteren; de founder wil ze op het nieuwe platform overnemen. Vastleggen = SR 0;
     bouwen = aparte beslissing (§5 B29, open). Welke maildienst het nieuwe platform gebruikt blijft
     [te meten] bij de cutover-planning — alleen de NAMEN van SMTP-variabelen meten, nooit waarden (§7 T9).
  5. Welke Uscreen-pagina's bestaan er meer dan die 10 (sitemap/menu) — "bij twijfel vragen"-lijst.
  6. Vastleg-matrix afleiden: paginatypes P × formaten F × talen 3 × sessies 1 (anoniem) — beslist
     2026-09-03: B14 = nee (voorlopig), B15 = EN/AR/NL, B27 = F = 2 (1440/390 px; 1024 px alleen als
     controlepunt in SR 3, niet in de matrix). P = [te meten] uit punt 4–5. Geen celtelling vóór P vaststaat.
     De ingelogde helft telt in het manifest als "niet vastgelegd (B14)" — geen stil gat.
  7. Viewport-check van de bestaande 11 clone-PNG's (afmetingen; clone of Uscreen?).
  8. Live-categorie tellen (21 [ia-json 05-07] vs 29 [memory] — §7 T28).
  9. Wat de eigen app nu doet op 390 px (geen nav) en in AR (alleen dir) — vaststelling, geen oordeel.
- Bewijs klaar: `~/projects/_scratch/SR0-meetrapport-<datum>.md` met 9 genummerde metingen (elk: waarde,
  bron/URL, tijdstip), P vastgesteld, de "twijfelgevallen voor de founder"-lijst; 0 schermafbeeldingen in git.
- Poort: geen voor het lezen (founder-ja voor `_scratch` is gegeven); twin-variant van punt 3 alleen na
  AS 7.1 + founder-ja. Tier: T0.

**SR 1 — Mini-test (3 pagina's × 2 formaten, incl. NAS-kopie en telling).**
- Doel: bewijzen dat de vastlegweg werkt vóór de volledige ronde: vastleggen → manifest → NAS → sha256.
- Gemeten vóór: SR 0-rapport (vastlegweg; anoniem of testaccount); **B17 akkoord vóór de eerste schrijfactie**;
  `/volume1/Albunyaan/storefront-referentie/`, `var/storefront-referentie/` en `reference/storefront-2026-09/`
  bestaan nog niet [gemeten]; `var/` staat in `.gitignore:24` [gemeten].
- Uitvoerder: Claude Code.
- Wat: 3 pagina's (voorstel: Homepage, About us, één programma- of categoriepagina — te bevestigen) × 2
  formaten, EN, anoniem; per cel 3 artefacten (PNG, HTML-dump, tekstextract menu/footer/koppen) = **18
  inhoudsbestanden** + `manifest.jsonl` (pad, bytes, sha256, URL, viewport, taal, sessie, tijdstip) +
  `fouten.log`.
- Bewijs klaar: manifest telt 18 regels; 18 lokaal = 18 op de NAS; sha256 18/18 gelijk; fouten.log leeg of
  met naam+reden. Definitie "geverifieerd" = `MIGRATIE-WERKORDER.md:179-181`.
- Poort: B17 (vóór de eerste schrijfactie); founder ziet het mini-testrapport en zegt go voor SR 2.
- Tier: T1 (schrijft artefacten onder var/ en in een NIEUWE NAS-map — nooit in `archief-originelen/`;
  leest read-only).

**SR 2 — Volledige vastlegging.**
- Doel: de complete matrix (P × F × 3 × 1, uit SR 0) + admin-exports (thema, snippets, blokkenlijsten,
  logo/favicon/banner op originele grootte, e-mailsjablonen als tekst).
- Gemeten vóór: SR 1 geslaagd; beslissingen genomen op 2026-09-03: B14 = nee (sessies 1, anoniem; ingelogde
  helft in het manifest als "niet vastgelegd (B14)"), B15 = drie talen, B16 = ja vastleggen, B27 = 1440/390 —
  de matrix is gedefinieerd zodra P (SR 0) vaststaat; wisselvallig laden (71 vs 40) → per cel meerdere
  pogingen, hoogste telling houden [gemeten precedent].
- Uitvoerder: Claude Code. Maakt de founder later alsnog een testaccount aan, dan volgt een aanvullende
  SR 2-ronde voor de ingelogde helft (aparte telling, zelfde manifest).
- Bewijs klaar: manifest-telling = P × F × talen × sessies × 3 artefacten = aantal op NAS, sha256 100 %
  gelijk; lichte bestanden (manifest, teksten, CSS, JSON) in `reference/storefront-2026-09/` in git; zware
  PNG/HTML in `var/storefront-referentie/` + NAS; fouten.log per faler.
- Poort: telling sluitend (0 ontbrekend) — anders niet klaar. Tier: T1.

**SR 3 — Vergelijk: heeft / wijkt af / ontbreekt = werklijst.**
- Doel: per pagina en per element (menu-item, footer-link, blok, tekst, volgorde, RTL-gedrag, formaat) één
  van drie oordelen, met de bron ernaast.
- Gemeten vóór: SR 2 compleet; **huisstijlbeslissing genomen: B13 = 1:1 (founder 2026-09-03)** — "wijkt
  af" geldt dus óók voor kleur, lettertype, knopstijl en hero; merknorm = de gemeten storefront (§7 T32
  beslist). Checkout-/aanmeld-/language-prefs-pagina's staan in de werklijst als "buiten bouwscope tot de
  betaalbeslissing" (B16); 1024 px alleen als controlepunt (B27). Startlijst van
  **kandidaat-delta's** — [gemeten] geldt alleen voor de apps/web-kant, de albunyaan.tv-kant is [Cowork,
  tekstpeiling] tot SR 0/SR 2 haar meet: geen mobiele nav (<1024 px) [gemeten]; Contact ontbreekt in nav
  [gemeten]; dropdown Contact▾ [Cowork] vs plat [gemeten]; "Download app" [gemeten] vs "Download apps"
  [Cowork]; hero-tekst ("I want to protect my Islamic identity…" [Cowork] vs Arabische kop + "An Islamic
  multimedia platform…" in `page.tsx:16-21` [gemeten]); NL-reviewsecties [Cowork] afwezig [gemeten];
  Privacy policy al aanwezig [gemeten] — delta of convergentie [te meten, SR 0 punt 1]; "Language prefs" en
  "new-payment" zonder route [gemeten]; AR/NL zonder vertaling [gemeten].
- Uitvoerder: Claude Code (lijst) → team (akkoord).
- Bewijs klaar: `reference/storefront-2026-09/SR3-werklijst.md`: aantallen per oordeel per pagina
  (heeft/wijkt af/ontbreekt), buiten-scope-items apart gemarkeerd, twijfelgevallen als vragen.
- Poort: **team-akkoord op de werklijst** (expliciet, met datum). Tier: T0.

**SR 4 — Bouwen (pas na RV 2 én team-akkoord).**
- Doel: werklijst afwerken, per bouwstap één commit + één Playwright-structuurtest als bewijs (menu-items,
  footer-links, RTL, pagina-indeling, teksten) — **géén pixelvergelijking** (meet niets zinnigs tussen twee
  verschillende sites [Cowork, overgenomen]).
- Gemeten vóór: RV 2 ingevoerd (§3.4) — zonder review-pipeline geen SR 4; testsuite-basis bij apps/web
  aanwezig (RV 2, B25): @playwright/test is nergens geïnstalleerd, apps/web heeft geen test-script (lint =
  `tsc --noEmit`), geen config, geen tests/ [gemeten]; B18 beslist 2026-09-03: preview-URL per branch, `main`
  niet bijtrekken vóór een bewuste release. Eerste bouwstap = de **tokenwissel** (B13): `packages/core/src/tokens.ts`
  + `apps/web/app/globals.css` naar de in SR 0/SR 2 gemeten Uscreen-waarden — één wissel, raakt bewust ook
  de mobiel/TV-doelen (§7 T16), geen tweede skin ernaast.
- Uitvoerder: Claude Code; team keurt per stap (of per PR als RV de PR-werkwijze invoert).
- Bewijs klaar (per stap): test groen (commando + uitvoer in de commit-tekst, per RV-regel "review-log in de
  commit-tekst"); `pnpm build` groen; werklijst-item afgevinkt met verwijzing naar de test; teller
  "N van M werklijst-items klaar" in elke commit.
- Poort: team-akkoord SR 3 + RV-pipeline gedraaid per commit (tier-afhankelijk licht/volledig).
- Tier: T1 (UI/CSS/copy); **T2 zodra een stap auth, entitlement, playback of RLS raakt** (bv. ingelogde
  header-varianten, /account, /watch) → sterker model + review; T3 voor alles wat publiek deployt
  (change-control regel 5 en sign-off punt 8: geen public deploy vóór policies + auth).

### §3.4 RV — review-voorzieningen + Playwright-baseline

**Doel:** zo min mogelijk fouten in code; elke codewijziging krijgt een review-pipeline die gemeten, gekeurd en
ingevoerd is — vóór SR 4. **Grondwet blijft `CLAUDE.md` + de 12 repo-skills** [gemeten: exact 12]; alles
nieuws hangt eronder en krijgt de regel "bij tegenspraak wint CLAUDE.md".

**Gemeten uitgangspunt [2026-09-02]:** het collega-document ligt als
`docs/review-pipeline/bron-collega-9-stappen-pipeline.md` (270 r., **untracked** → B2); het kent **vijf**
non-negotiable regels (r62-76), niet vier — regel 5 "Delegated work inherits nothing" (subagent-briefs
herhalen de regels) ontbreekt in de Cowork-samenvatting en is voor deze repo (veel subagent-werk) juist
relevant (§7 T25). Stap 9 schrijft `gstack /review` + `cubic review --base <sha> --json` voor (r179-196) —
geen van beide is aanwezig. Globaal: `permissions.defaultMode = bypassPermissions`,
`skipDangerousModePermissionPrompt = true`, enige rem = PreToolUse-hook `guardrail.py` (bewust korte lijst;
patroonlijst r16-eind [te meten in RV 0.1]); geen repo-`.claude/settings.json`; geen CI, geen husky, geen
git-hooks; codex/cubic/bun niet geïnstalleerd; geen OPENAI_API_KEY/CODEX_*-naam; geen `~/.codex`; geen
`AGENTS.md`/`.cursorrules`/`GEMINI.md`; `~/projects/_scratch` bestaat niet; officiële marketplace gekloond
(0 plugins actief) met o.a. `code-review`, `security-guidance`, `pr-review-toolkit`, `code-simplifier`;
`~/.claude/skills/` bevat twee symlinks naar mappen buiten ~/.claude (precedent dat "vastgepind" niet
definieert). Bestaande huis-methode: `docs/security-findings-report.md:5` (6 vijandige reviewer-agents →
adversarial verificatie → completeness-critic; 21 → 19 bevestigd, 2 weerlegd) — nergens als skill vastgelegd.
De change-control-skill verwijst **4×** naar een niet-bestaand WS-plan (`SKILL.md:45,125,151,194`; r151 =
MODEL-FITNESS-precedent, r194 = grep-commando dat gegarandeerd faalt) → §7 T18.

**Waarom gstack niet als geheel [Cowork, te toetsen in RV 0.2]:** eigen hook-installatie in
`~/.claude/settings.json`, sectie in CLAUDE.md, Bun-vereiste, auto-update elk uur (= ongelezen instructies),
en `/ship`/`/land-and-deploy` die zelf committen/pushen — alle vijf raken de globale configuratie of botsen
met founder-sign-off en de RLS-regel. Daarom alleen `/review` en `/cso`, lokaal en vastgepind (= kopie met
commit-sha in de skill-kop, geen symlink), pas nadat gemeten is of ze zonder de rest werken.

**Playwright-baseline [gemeten]:** `worker/package.json:26` declareert `^1.50.0`; geïnstalleerd `1.61.1`;
telling scripts: **54** met echte import (`grep -l "from 'playwright'|require('playwright')"`), **57** met de
string "playwright", **100** scripts totaal (68 .mjs + 32 .ts) — norm vaststellen (B21). Zes harnesses bestaan
(alle `.ts`, 12–13 juli 2026, samen 72.073 bytes [`wc -c worker/e2e-*.ts`]); vijf gebruiken de losse
`playwright`-library + eigen `check()`-assertie, `e2e-coupon-redeem.ts` gebruikt `record()`/`CheckResult`
(r49-53) — een wrapper moet beide uitvoerconventies lezen; geen runner. Poorten: vier defaulten op
`BASE_URL=http://localhost:3012` (admin-gate:34, playback-gate:30, admin-crud:28, ws10-pages:20), **twee op
:3010** (member-auth:34, coupon-redeem:31); `CLAUDE.md:16` schrijft :3010 voor de dev-server voor. Vereisten:
lokale Supabase (+ `[auth.mfa.totp]`), Mailpit (:54324), `worker/.env` als fallback; **playback-gate vereist
`BUNNY_EMBED_TOKEN_KEY` en test signed Bunny-embeds → sinds 02-09 een ⛔-gevoelige test** (B22).
`phase1:test` = `vitest run` (5 bestanden in `worker/test/`, vitest 3.2.6), niet Playwright. apps/web: geen
test-script, geen config, geen tests/, geen @playwright/test.

**RV 0 — Meetronde (alleen lezen; kladmap = schrijfactie → founder-ja).**
- Doel: alle "te toetsen"-aannames uit de Cowork-beoordeling meten; concepten schrijven, niets invoeren.
- Gemeten vóór: `~/projects/_scratch/` bestaat (aangemaakt 2026-09-02 na founder-ja, buiten elke repo, wordt
  niet gecommit); B2 besloten (brondocument gecommit) — citeren met regelnummers is nu stabiel.
- Uitvoerder: Claude Code; collega voor RV 0.6.
- Sub-stappen:
  - **RV 0.1 Globale staat** — grotendeels KLAAR [gemeten, zie hierboven]; rest: `guardrail.py` volledige
    patroonlijst lezen en vastleggen wat hij wél/niet tegenhoudt; welk model `settings.json:5`
    (`claude-fable-5-1[1m]`) vs `modelSettings` (`claude-opus-5`) feitelijk selecteert [te meten] — de
    grondslag van "sterker model bij T2/T3".
  - **RV 0.2 gstack en karpathy-skills alleen lezen** in `_scratch` (clone/download, geen installatie, geen
    hook, geen settings-wijziging): meten of `/review` en `/cso` los van de rest werken (welke bestanden,
    welke aannames over Bun/hooks/auto-update, licentie MIT bevestigen [Cowork], versie/commit pinnen);
    karpathy: inhoud isoleren [Cowork: "±50 regels", "vier principes" — aantal en inhoud staan nergens op
    schijf; eerst vaststellen wát het is] en tegen `CLAUDE.md` + change-control leggen.
  - **RV 0.3 Botsingstabel document ↔ repo**: elke 9-stappen-regel naast de bestaande regels (change-control
    regels 1–9 `SKILL.md:62-110`, MODEL FITNESS-stoplijst `:147-172`, founder-sign-off T3-lijst `:129-145`,
    review-eisen `:174-182`). Vaste uitzondering vastleggen: **fail-closed-paden, tellingscontroles en
    opruimcode zijn nooit bloat** (change-control regel 4: on-failure `deleteVideo` + nulling
    `uscreen_hls_url`; bundle-STOP; orchestrator-no-auto-restart; verify-coverage's zes assen) — stap 1/8 mag
    die alleen als "vraag" queue'en, nooit strippen (het document zegt dat zelf: pre-existing → question).
  - **RV 0.4 Cubic/Codex-documentatie lezen** (web, geen installatie): bestaat de gratis laag [Cowork], PR-modus
    vs CLI op lokale diffs, wat de derde partij ziet (code verlaat de machine — teamvraag); Codex:
    abonnements-/API-sleutel-eis [Cowork], leest het AGENTS.md, kosten → B19/B20 pas hierna.
    Ook: de vier officiële marketplace-plugins (`code-review`, `security-guidance`, `pr-review-toolkit`,
    `code-simplifier`) lezen vóór derden importeren.
  - **RV 0.5 Concepten** (in `_scratch`, later in de repo bij RV 2): (a) `Werkregels`-blok voor `CLAUDE.md`:
    regels 1–5 van het document + de Karpathy-principes (zodra RV 0.2 ze heeft), ontdubbeld tegen wat er al
    staat; (b) repo-skill `review-pipeline/SKILL.md` met de aanpassingen (bloat-uitzondering; "geen nieuwe
    .md" → rapporten in `docs/` blijven, review-log in commit-tekst; stap 9 = "de reviewers die gemeten en
    geïnstalleerd zijn"; zwaarte per tier: T0/T1 licht = stappen 2,3,6; T2/T3 volledig = 1–9; "bij
    tegenspraak wint CLAUDE.md"); (c) `AGENTS.md`-brug voor Codex (verwijst naar CLAUDE.md + de
    incident-regels, geen tweede waarheid); (d) inventaris van de zes harnesses: dekking, vereisten,
    poorten, uitvoerconventie (check()/record()), wat nodig is om ze **zonder herschrijven** in één commando
    te zetten — advies: wrapper eerst, geen migratie naar @playwright/test.
  - **RV 0.6 Vragen aan de collega** (uitvoerder: collega): gstack als geheel — waarom, en wat verliest hij
    als alleen /review en /cso lokaal komen; Cubic via PR's of via CLI; Codex: welk abonnement gebruikt hij zelf.
- Bewijs klaar: `~/projects/_scratch/RV0-meetrapport-<datum>.md` met: globale staat (bron), gstack/karpathy
  meting (bestandslijst, versie, MIT-bevestiging, werkt-los ja/nee), botsingstabel (N regels, N botsingen),
  Cubic/Codex-feiten met citaten, de vier concepten, harness-inventaris (6 regels: naam · dekt · vereist ·
  poort · conventie · laatst gewijzigd), antwoorden collega (3, of "open").
- Poort: geen voor het lezen; founder-ja voor `_scratch` en voor elke installatie (RV 0 installeert niets —
  ook geen `pnpm add`). Tier: T0. Alles wat de globale `~/.claude/settings.json` of hooks zou wijzigen is
  configuratie → founder-toestemming (B23).

**RV 1 — Mini-test: de pipeline één keer handmatig op een bestaande kleine commit.**
- Doel: doorlooptijd, bevindingen per stap, terecht/onterecht, botsingen — met bewijs, niet bewering.
- Gemeten vóór: RV 0-concepten bestaan; keuze van de commit (B24): Cowork stelt `audit-volledig.mjs` uit
  `3b22309` voor, maar die commit wijzigt dat bestand **5 regels** (4 ins/1 del; +78 in
  `haal-serie-extras.mjs`; 82 ins/1 del totaal) [gemeten]; `91a5c1c` introduceerde het script met 380 regels,
  het bestand telt nu 383 [gemeten]. Advies: `91a5c1c`, file-scoped (het hele script = precies het soort
  tellingscode waar de bloat-uitzondering op getest moet worden).
- Uitvoerder: Claude Code (stappen 1–8 handmatig met agents per stap; elke brief herhaalt de regels — regel 5);
  stap 9 met wat gemeten en aanwezig is (nu: niets van derden → "stap 9 niet gedraaid: cubic/gstack niet
  geïnstalleerd; gedraaid in plaats daarvan: …" — luid melden, non-negotiable regel 1).
- Wat NIET: harnesses draaien (founder: niet nu), iets installeren, iets committen.
- Bewijs klaar: `docs/review-pipeline/RV1-mini-test-<sha>.md` (of `_scratch` tot B2): per stap tijd, uitvoer,
  bevindingen met terecht/onterecht-oordeel, of een bevinding een fail-closed-pad als bloat aanmerkte (de
  lakmoesproef), botsingen met change-control, totale doorlooptijd; 9/9 stappen gelogd (gedraaid of luid
  overgeslagen).
- Poort: **keuring** door founder + collega op basis van dat rapport. Tier: T0.

**RV 1c — Playwright-baseline in kaart (inventarisatie, geen installatie).**
- Doel: definitie van "baseline" voor pipeline-stap 2 zonder de harnesses te herschrijven.
- Gemeten vóór: harness-inventaris (RV 0.5d); of de zes nog slagen tegen de huidige code is **[te meten] —
  bewust NIET nu gedraaid** (vereist lokale Supabase + Mailpit + dev-server op de juiste poort).
- Uitvoerder: Claude Code (inventaris) → founder (ja/nee op installatie, B25).
- Bewijs klaar: tabel 6 harnesses; voorstel voor één commando (bv. `pnpm --filter @albunyaan/worker e2e` dat de
  zes na elkaar start met vaste `BASE_URL`; twee defaults (:3010) moeten dan omgezet — B25); lijst wat een
  apps/web-suite minimaal vereist (@playwright/test, playwright.config, tests/, test-script) — als voorstel;
  playback-gate gemarkeerd als ⛔-gevoelig (B22).
- Poort: founder-ja op installatie (schrijfactie + dependency), in RV 2. Tier: T0 (inventarisatie; de
  installatie die eruit volgt is T1 in RV 2).

**RV 2 — Invoering (pas na keuring).**
- Doel: de gekeurde set in de repo: `Werkregels`-blok in `CLAUDE.md` (ontdubbeld), skill
  `.claude/skills/review-pipeline/`, `AGENTS.md`-brug (alleen als Codex doorgaat), lokale vastgepinde
  `/review`+`/cso`-skills (alleen als RV 0.2 "werkt los" mat; kopie met commit-sha, geen symlink),
  Cubic-werkwijze (alleen als B19 ja), Playwright-runner + apps/web-suite-skelet (alleen als B25 ja),
  commit-conventie: review-log in de commit-tekst; rapporten in `docs/review-pipeline/`.
- Gemeten vóór: RV 1 gekeurd; beslissingen B19–B25; **geen** globale settings-/hook-wijziging zonder
  expliciete founder-toestemming (bypassPermissions + guardrail blijven zoals ze zijn tenzij de founder anders
  zegt).
- Uitvoerder: Claude Code; founder keurt de `CLAUDE.md`-diff (gouden regel 6a).
- Bewijs klaar: `CLAUDE.md`-diff met 0 dubbele regels; 1 skill geladen (zichtbaar in de skill-lijst); 1 echte
  T1-commit met review-log in de commit-tekst en 9/9 pipelinestappen gelogd; als PR-werkwijze: 1 PR op een
  `stap/*`-branch gekeurd door het team; als runner: 1 commando dat 6 harnesses start (niet: dat ze slagen).
- Poort: founder (CLAUDE.md) + team (werkwijze). **RV 2 klaar = voorwaarde voor SR 4.**
- Tier: T0 (docs/skills) · T1 (runner/tests/dependencies) · configuratie (hooks/settings) = founder-toestemming
  · alles wat sends/secrets raakt blijft T3 (ongewijzigd).

**Minimale RV-set die SR 4 vrijgeeft:** Werkregels-blok + review-pipeline-skill (met bloat-uitzondering en
tier-zwaarte) + Playwright-runner voor de bestaande zes + apps/web-suite-skelet met ten minste één groene
structuurtest + één T1-commit die de pipeline aantoonbaar doorliep. Cubic/Codex/gstack zijn **geen**
voorwaarde voor SR 4 (stap 9 draait dan met "wat gemeten en geïnstalleerd is").

## §4 Afhankelijkheden en volgorde over werkstromen heen

**Als lijst (voorwaarde → afhankelijke stap: reden):**
1. AS 6.1 → alles: founder-opdracht "eerste actie van de volgende sessie, niet samenvoegen" — AS 6.1/6.2 gaan
   vóór SR 0/RV 0 in dezelfde sessie.
2. AS 6.2 (go) → AS 6.3/6.4: geen bestandsbeweging zonder expliciete go over 545 acties; terugvalkopie
   (AS 6.3) vóór de eerste beweging.
3. RV 2 → AS 6.6: nieuwe wachtercode gaat door de review-pipeline; tot RV 2 bestaat geldt change-control
   review-eisen 1/4/6 als minimum — de founder mag AS 6.6 eerder vrijgeven.
4. AS 7.1 (nacht 3 sep) → uitspraak "wachter vangt nieuwe uploads": pas ná één geslaagde 04:15-ronde.
5. AS 7.1 → SR 0 punt 3 (twin-variant): de twin draagt de admin-sessie die de wachter nodig heeft; geen
   bot-check-provocatie op de twin vóór de wachter bewezen is (en alleen met founder-ja).
6. RV 1 → BS 3: de bloat-uitzondering wordt op verify-coverage's tellingscode getest; verander de
   dekkingscontrole niet vóór RV 1 er één keer naar gekeken heeft — uitzondering: `--telegram` mag eerder uit
   beide aanroepen bij vals alarm.
7. BS 1 (⛔-ronde) → SR 3 / RV 1: geen harde blokkade voor SR 0/RV 0, wel vóór SR 3/RV 1, zodat geen reviewer
   of vergelijker nog uit Bunny-documenten (skills, security-findings-report, memory) redeneert.
8. `_scratch` (founder-ja gegeven 2026-09-02) → SR 0 en RV 0: eerste schrijfactie van beide werkstromen — ontgrendeld.
9. SR 0 → SR 1 → SR 2 → SR 3 → team-akkoord → SR 4: strikt sequentieel; SR 0–3 lopen **parallel** aan RV 0–2.
10. B13 (huisstijl) + T32 (merknorm) → SR 3: vóór SR 3, niet vóór SR 0 (Cowork; overgenomen).
11. B14/B15/B16/B27 (testaccount, talen, checkout, formaten) → SR 2: bepalen de matrix.
12. B17 (opslag) → SR 1: eerste schrijfactie onder var/ en op de NAS.
13. RV 2 → SR 4: geen bouw zonder ingevoerde pipeline + Playwright-baseline.
14. B18 (waar SR 4 zichtbaar wordt: `main` 74 achter) → SR 4: anders bouwt SR 4 op een branch die niemand
    ziet, of deployt hij per ongeluk (RLS-regel: geen public deploy).
15. B2 (brondocument gecommit, 2026-09-02) → RV 0.3: ontgrendeld.
16. RV 0.6 (collega) → RV 2 (Cubic/gstack-deel): wacht op de antwoorden; **niet** op de rest van RV.
17. AS 9.1 (back-up betrouwbaar) → alles wat de database muteert (SR 4, later leden-migratie): ≈57 %
    foutrondes is geen basis voor data-mutaties.
18. Kijkplatformkeuze → nieuwe poort 1 (noemer, B8) → cutover; live-channels-antwoord (B9, aantal [te meten]
    §7 T28) → cutover.
19. Contentstop → tweede AS 6-run (volgorde-synchronisatie als allerlaatste orde-pas) → cutover.

**Als tekstschema:**

```
NU (sessie 1)   AS 6.1 droogloop ─► AS 6.2 go(founder) ─► AS 6.3 terugvalkopie ─► AS 6.4 uitvoeren ─► AS 6.5 sha+volgorde
                                                                                                    └─► AS 6.6 wachter-signaal (code; RV 2 of founder-vrijgave)
nacht 3 sep     AS 7.1 eerste echte 04:15-ronde ─► AS 7.2 zelfherstel-besluit (B10) · AS 7.3 CLAUDE.md:36 (founder keurt)
parallel        BS 1 ⛔-ronde 2 (B3/B4) · BS 2 ruis (founder bootout, B5) · BS 3 verify-coverage/showcase (B6, NA RV 1) · BS 4 VPS (B7) · BS 5 restlijst
                AS 8.1 archiefgaten voorleggen (B12) · AS 9.1 back-up meten/herstellen · AS 10.1 hertelling (collega) → 10.2 → 10.3 (B11, aparte opruimactie)
founder-ja ✓    _scratch (2026-09-02) ───────────────────────────────────────────────────────────────────────────┐
SR-lijn         SR 0 meten ─► SR 1 mini-test (B17) ─► SR 2 volledig (B14-16, B27) ─► SR 3 vergelijk (B13, T32) ─► TEAM-AKKOORD ─┐
RV-lijn         RV 0 meten (B2; collega-vragen) ─► RV 1c baseline ─► RV 1 mini-test (B24) ─► KEURING ─► RV 2 invoeren (B19-25) ─┤
                                                                                                                              ▼
                                                                                  SR 4 bouwen (B18; per stap: test + pipeline)
LATER (niet gepland)  kijkplatformkeuze (B8, B9) ─► leden-/DB-migratie ─► contentstop ─► AS 6 nogmaals ─► cutover (datum OPEN) ─► opzegging (30-dagen-wisklok)
```

## §5 Beslissingen die op de founder of het team wachten

Overzicht (details per blok eronder):

| # | Onderwerp | Wie | Blokkeert |
|---|---|---|---|
| B1 | Cutoverdatum OPEN + kanonieke gouden regel in de stuurdocumenten — **founder 2026-09-03: belegd bij Cowork** | founder/Cowork | lezers van MASTER-PLAN |
| B2 | 9-stappen-brondocument committen — **BESLOTEN 2026-09-02: ja, apart commit** | founder | RV 0.3 (ontgrendeld) |
| B3 | ⛔-ronde ook buiten de repo — **founder 2026-09-03: belegd bij Cowork** | founder/Cowork | BS 1 (deel buiten repo) |
| B4 | Welke documenten "historisch archief" vs "levend" — **BESLOTEN 2026-09-03** (uitvoering in BS 1) | founder | BS 1 (ontgrendeld) |
| B5 | Welke automatiseringen uit — **BESLOTEN 2026-09-03: ja, alle drie** (launchctl = founder) | founder | BS 2 (ontgrendeld) |
| B6 | verify-coverage/showcase-voorstel — **BESLOTEN 2026-09-03: 1+2 na AS 6.5, 3 na RV 1** | founder | BS 3 (ontgrendeld) |
| B7 | Hetzner-VPS — **BESLOTEN 2026-09-03: opzeggen tenzij B9 binnen een maand beantwoord is** (founder zegt zelf op) | founder | BS 4 (wacht op de opzegging) |
| B8 | Noemer nieuwe poort 1 — **BESLOTEN 2026-09-03: twee getallen naast elkaar, 16.024 archief / 15.180 kijkplatform** | founder + team | kijkplatformkeuze, BS 2 (ontgrendeld) |
| B9 | Live channels: antwoord vóór cutover — **OPEN (founder 2026-09-03)** | founder | kijkplatformkeuze → cutover; B7-termijn |
| B10 | Wachter-zelfherstel bij exit 4 — **BESLOTEN 2026-09-03: ja, één poging** | founder | AS 7.2 (beantwoord) |
| B11 | Rechten-doelvorm — **BESLOTEN 2026-09-03: A (755/644)** | founder | AS 10.3 (ontgrendeld) |
| B12 | Ondertitels — **BESLOTEN 2026-09-03: minimaal de 34 handmatige archiveren** (nieuwe stap AS 8.2) | founder | contentstop/cutover (ontgrendeld) |
| B13 | Huisstijl — **BESLOTEN 2026-09-03: 1:1 Uscreen-huisstijl, saraev vervalt** | founder | SR 3 (ontgrendeld) |
| B14 | Testaccount — **BESLOTEN 2026-09-03: nee, voorlopig** (voorwaarde SR 0 punt 2) | founder | SR 2 (ontgrendeld) |
| B15 | Talen — **BESLOTEN 2026-09-03: EN/AR/NL** | founder | SR 2 (ontgrendeld) |
| B16 | Checkout-/aanmeldpagina's — **BESLOTEN 2026-09-03: ja vastleggen** | founder | SR 2/SR 3 (ontgrendeld) |
| B17 | Opslagvoorstel — **BESLOTEN 2026-09-03: akkoord** | founder | SR 1 (ontgrendeld) |
| B18 | Waar SR 4 zichtbaar wordt — **BESLOTEN 2026-09-03: preview-URL per branch** | founder | SR 4 (ontgrendeld) |
| B19 | Cubic — open, **wacht op RV 0.4 + RV 0.6** (founder 2026-09-03) | team | RV 2 (deel) |
| B20 | Codex — open, **wacht op RV 0.4 + RV 0.6** (founder 2026-09-03) | founder | RV 2 (deel) |
| B21 | Playwright-telnorm + pinnen — **BESLOTEN 2026-09-03: 54; pin 1.61.1 in RV 2** | team | RV 1c (ontgrendeld) |
| B22 | e2e-playback-gate — **BESLOTEN 2026-09-03: bevriezen met ⛔-kop, niet draaien** | founder | RV 1c/RV 2 (ontgrendeld) |
| B23 | Settings/hooks — **BESLOTEN 2026-09-03: alleen repo-eigen `.claude/settings.json`** | founder | RV 2 (ontgrendeld) |
| B24 | RV 1-commit — **BESLOTEN 2026-09-03: `91a5c1c`, file-scoped** | founder + collega | RV 1 (ontgrendeld) |
| B25 | Poortnorm + apps/web-suite — **BESLOTEN 2026-09-03: 3012; CLAUDE.md-diff ter keuring** | founder | RV 1c/RV 2 → SR 4 (ontgrendeld) |
| B26 | Publieke archief-statuspagina — **BESLOTEN 2026-09-03: laten; teamregel** | founder/team | — |
| B27 | Formaten — **BESLOTEN 2026-09-03: 1440/390; 1024 alleen controlepunt SR 3** | founder | SR 2 (ontgrendeld) |
| B28 | SR/RV in het MASTER-PLAN — **GEDAAN door Cowork 2026-09-03** (MASTER-PLAN v2.13, verwijsregel bovenaan) | founder/Cowork | — |
| B29 | E-mailsjablonen — **founder 2026-09-03: vastleggen in SR 0 = ja; bouwen OPEN** | founder | cutover-planning |
| B30 | AS 6: volgorde-definitie bij dubbel getoonde video's — **BESLOTEN 2026-09-03 na broncontrole: elke video één keer, eerste voorkomen, aaneengesloten** | founder | AS 6.2 (ontgrendeld: 279 acties/83 bestanden) |

**Sessievolgorde (founder 2026-09-03):** sessie A = AS 6 (na de schriftelijke go: 6.3–6.5), daarna AS 9.1
meten, daarna T18-herstel (diff ter keuring); sessie B = SR 0; sessie C = RV 0. **Eén werkstroom per sessie.**
Open na 2026-09-03 (tweede ronde beslissingen): **B9** (live channels) en **B29-bouwen**; B19/B20 wachten op RV 0.4
en RV 0.6. Alle andere B's zijn besloten, belegd (B1/B3/B28 bij Cowork, uitgevoerd 2026-09-03) of gedaan (B30).
Extra besluiten zonder B-nummer (founder 2026-09-03): `#recycle` (1,4 TB) laten tot na de cutover; T8 comments
DEFINITIEF gesloten (memory + teamsamenvatting gecorrigeerd).

**B1 — Cutoverdatum en gouden regel in de stuurdocumenten.** Vraag: de vier expliciete + vier indirecte
"28 Aug"-plekken in MASTER-PLAN (`:170,880,1128,1228; :171,190,1067,1240`), TODO r.31-33 en PROMPTS
r.682/760-761 op OPEN zetten; welke van de twee mechanismen geldt (OPEN, of de eigen verschuifregel
`MASTER-PLAN:1145-1146`); versie v2.12 → v2.13 + regel in de versiehistorie (`:223`); en welke formulering van
de gouden regel kanoniek is (werkorder `:187` + 30-dagen-klok, of MASTER-PLAN aanvullen — §7 T11)? Wie:
founder (één-schrijver-regel `:176-177`). Advies: OPEN, alle acht plekken markeren, werkorder-formulering + klok
in het MASTER-PLAN overnemen; één Cowork-beurt. Blokkeert: niets in dit plan; wel elke lezer van het MASTER-PLAN.
**Founder 2026-09-03:** Cowork voert de markeringen in `~/projects` uit — geen actie voor Claude Code.
**Uitgevoerd door Cowork 2026-09-03 (founder-melding, [Cowork]):** MASTER-PLAN v2.13 — datum OPEN op 7 plekken,
gouden regel + 30-dagen-klok in §4, §A1.3/§A3.1 gemarkeerd; TODO 4 en PROMPTS 3 markeringen.

**B2 — 9-stappen-brondocument.** Vraag: `docs/review-pipeline/bron-collega-9-stappen-pipeline.md` stond
untracked — apart committen of laten staan tot RV 2? Wie: founder. **BESLOTEN 2026-09-02: ja** — apart
gecommit als `docs: bron-collega 9-stappen-pipeline (RV-input)` (tweede commit na dit plan); een reviewer kan
het nu met een sha citeren. Blokkeert: niets meer (RV 0.3 ontgrendeld).

**B3 — Tweede ⛔-ronde buiten de repo.** Vraag: MASTER-PLAN §A1.3 (62 debris), §A3.1 punt 1 (BUNNY_API_KEY-P0)
en punt 2 ("WS5 signed playback LIVE"), TODO r.26-39 en r.269-272, PROMPTS r.722-744/767-769 staan nog als
werkbare instructies; ook niet-Bunny-verouderingen in de TODO (taste-spec "lopend" vs PROMPTS:903-909 FINAL;
ledenaantallen 928/~600 vs 588/377/653). Meenemen? Wie: founder/Cowork. Advies: ja, T0, ⛔ per blok, niets
verwijderen; ledenaantallen als [te bevestigen]. Blokkeert: BS 1.
**Founder 2026-09-03:** Cowork voert de markeringen in `~/projects` uit — geen actie voor Claude Code; BS 1 beperkt
zich voor Claude Code tot repo + memory. **Uitgevoerd door Cowork 2026-09-03** (zie B1; [Cowork], niet zelf gemeten).

**B4 — Archief vs levend.** Vraag: welke bestanden gelden als "historisch archief" (één regel bovenaan) en
welke als levend (⛔-kop)? Kandidaten: 9 skills met Bunny-instructies, `PROJECT_SUMMARY.md`,
`migration-truth.md`, `docs/security-findings-report.md`, en de 10 memory-bestanden (0 ⛔; minimaal
`nas-archief.md:148`, `MEMORY.md`, `bunny-cost-model.md`, `residual-19-and-debris.md`,
`vps-split-migration.md`). Wie: founder. Advies: skills en memory = levend (elke sessie laadt ze) → ⛔-kop; de
drie .md's → "historisch, Bunny gestopt 2026-09-02". Blokkeert: BS 1.
**BESLOTEN founder 2026-09-03:** skills en memory = levend (⛔-kop); `PROJECT_SUMMARY.md`, `migration-truth.md`,
`docs/security-findings-report.md` = "historisch, Bunny gestopt 2026-09-02". Uitvoering in BS 1, niet nu.

**B5 — Automatiseringen uit.** Vraag: `migration-watchdog` (ruis), `bundle-meter` (migratie-rem zonder
migratie), `bunny-balance-watch` (launchd-restant) uitladen; BUNDLE-ALERT/WARN-vlaggen opruimen;
`archief-status` naar StartCalendarInterval; `morning-report.sh` en `collect_metrics.py` Bunny-regel
vervangen? `launchctl bootout`/reload doet de founder zelf (guardrail). Wie: founder. Advies: alle drie uit;
vlaggen weg; Bunny-regel vervangen door de NAS-telling ná B8. Blokkeert: BS 2.
**BESLOTEN founder 2026-09-03:** ja — migration-watchdog, bundle-meter en bunny-balance-watch uitladen;
BUNDLE-vlaggen weg; de Bunny-regel in morning-report en metrics-digest wordt de NAS-telling zodra B8 beslist
is (BS 2, Claude Code, T1). De commando's hieronder voert **de founder zelf** uit (uid 501, gemeten
`id -u`); Claude Code voert ze niet uit (guardrail, bewust):

```
# 1. drie jobs uit het launchd-geheugen halen
launchctl bootout gui/501/com.albunyaan.migration-watchdog
launchctl bootout gui/501/com.albunyaan.bundle-meter
launchctl bootout gui/501/com.albunyaan.bunny-balance-watch
# 2. plists wegzetten zodat ze bij de volgende login niet opnieuw laden (bunny-balance-watch staat er al sinds 02-09)
mv ~/Library/LaunchAgents/com.albunyaan.migration-watchdog.plist \
   ~/Library/LaunchAgents/uitgeschakeld/com.albunyaan.migration-watchdog.plist.disabled-2026-09-03
mv ~/Library/LaunchAgents/com.albunyaan.bundle-meter.plist \
   ~/Library/LaunchAgents/uitgeschakeld/com.albunyaan.bundle-meter.plist.disabled-2026-09-03
# 3. vlaggen weg (beide 0 bytes, 23 juli 2026)
rm ~/.albunyaan-cc/BUNDLE-ALERT ~/.albunyaan-cc/BUNDLE-WARN
# 4. controle — verwacht 9 regels, zonder de drie
launchctl list | grep albunyaan
```

**B6 — verify-coverage/showcase.** Vraag: (1) `--telegram` uit beide aanroepen (`build-library-showcase.mjs:723`,
`import-video-extras.ts:223`), (2) `NO_PLAY` default, (3) dode kolom `bunny_video_id` uit de SELECT
(`verify-coverage.mjs:104`, cosmetisch)? Op 2026-09-02 zei de founder "voorstel, nog niets veranderen". Wie:
founder. Advies: 1+2 nu (klein, T1, geen telling geraakt); 3 na RV 1 (samen met de lakmoesproef op de zes
assen). Blokkeert: BS 3.
**BESLOTEN founder 2026-09-03:** ja — (1) en (2) ná AS 6.5, in een aparte commit, onder change-control
review-eisen 1/4/6; (3) na RV 1.

**B7 — Hetzner-VPS.** Vraag: opzeggen (€14,51/mo [doc]), of aanhouden voor de WS6 live-relay (die ook een VPS
wil)? Wie: founder. Advies: aanhouden alleen als B9 binnen een maand een antwoord krijgt; anders opzeggen
(kosten zonder functie — precies het Bunny-argument). Blokkeert: BS 4.
**BESLOTEN founder 2026-09-03:** opzeggen, tenzij B9 binnen een maand (vóór 2026-10-03) beantwoord is met een
antwoord dat de VPS nodig heeft. De founder doet de opzegging zelf; BS 4 wacht daarop.

**B8 — Noemer nieuwe poort 1.** Vraag: "telling bron = NAS = kijkplatform" — 16.024 (alles), 15.180
(member-visible set [memory watchable-video-truth.md]), of de publicatietelling (199 [memory 09-01] vs ≈197
[doc CLAUDE.md:22, security-findings:66] — §7 T35)? Wie: founder + team. Advies: 16.024 als archief-noemer,
15.180 als kijkplatform-noemer (wat leden mogen zien) — twee getallen, beide expliciet; de publicatietelling is
de storefront-eenheid en hoort niet in de poort. Blokkeert: kijkplatformkeuze; BS 2 (rapportages).
**BESLOTEN founder 2026-09-03:** twee getallen naast elkaar — **16.024 = archief-noemer** (alles wat bij Uscreen
bestond; sinds 2026-09-03 16.025 na één nieuwe video, de noemer beweegt mee met de wachter) en **15.180 =
kijkplatform-noemer** (member-visible set). Rapportages (BS 2) tonen beide, nooit één van de twee alleen.

**B9 — Live channels.** Vraag: de live channels (aantal 21 [ia-json 05-07] of 29 [memory 07-11/fidelity
08-07] — [te meten], §7 T28) zijn de meest bekeken content en hebben geen bestand: wat is het antwoord vóór
cutover — WS6-relay op een VPS met founder-URL's (founder-runbook E), of tijdelijk buiten scope? Wie: founder.
Advies: beslissing vóór de kijkplatformkeuze; zonder antwoord geen cutoverdatum. Blokkeert: kijkplatformkeuze
→ cutover.
**Founder 2026-09-03: OPEN.** Termijn gekoppeld aan B7: is B9 op 2026-10-03 nog onbeantwoord, dan wordt de VPS
opgezegd.

**B10 — Wachter-zelfherstel.** Vraag (2026-08-30, onbeantwoord): mag de wachter bij exit 4 (twin Chrome
stuk) zelf Chrome herstarten + de ronde herhalen? Wie: founder. Advies: ja, één poging, daarna Telegram —
fail-honest blijft. Blokkeert: AS 7.2.
**BESLOTEN founder 2026-09-03:** ja — één herstartpoging van Chrome + herhaling van de ronde, daarna Telegram.
Dit is het schriftelijke antwoord waar AS 7.2 om vraagt; de code ervoor valt onder AS 6.6/AS 7 (T1, review).

**B11 — Rechten-doelvorm.** Vraag: A (Linux-mode 755/644, al 1449/1794 mappen) of B (overal Synology-ACL)?
Wie: founder. Advies: A — kleinste verandering; preventie in `archive-fetch.sh`/wachter is het echte werk.
Blokkeert: AS 10.3.
**BESLOTEN founder 2026-09-03:** A (755/644); preventie in `archive-fetch.sh` en de wachter (vorm zetten ná mkdir).

**B12 — Ondertitels.** Vraag: de 34 handmatige .vtt's (en/of alle 4.489/4.494 — §7 T36) alsnog archiveren
vóór de opzegging? Geparkeerd 2026-08-26. Wie: founder. Advies: minimaal de 34 handmatige (omvang [te
meten]; alle sporen samen ~30 MB [memory]); auto-EN alleen als de kijkplatformkeuze ze nodig heeft.
Blokkeert: contentstop/cutover (gouden regel 1).
**BESLOTEN founder 2026-09-03:** minimaal de 34 handmatig geüploade ondertitels archiveren → nieuwe stap
**AS 8.2** (§3.1): alleen lezen bij Uscreen, omvang eerst meten, dan pas ophalen. Auto-EN blijft open tot de
kijkplatformkeuze.

**B13 — Huisstijl.** Vraag: 1:1 het Uscreen-thema ("Glow" [Cowork, niet in repo]) overnemen of de eigen
"saraev"-skin houden? Voorwaarde: het bindende merknorm-bestand vaststellen (§7 T32). Wie: team, vóór SR 3.
Advies: pariteit eerst (herkenbaarheid bij cutover), restyle later apart — Cowork-advies overgenomen.
Consequentie: `packages/core/src/tokens.ts` claimt single source of truth voor web/mobile/TV → één
tokenwissel, geen tweede skin ernaast. Blokkeert: SR 3.
**BESLOTEN founder 2026-09-03:** de Albunyaan-huisstijl zoals leden die nu zien op albunyaan.tv (Uscreen) is de
norm — 1:1 pariteit in uiterlijk én structuur (logo/Arabisch woordmerk, kleuren, lettertypes, knopstijlen,
banner/hero, menu's, footer, pagina-indeling, blokken en volgorde, teksten, talen/RTL). Het saraev-ontwerp
vervalt als norm; SR 4 zet de tokens om naar de gemeten Uscreen-waarden (één wissel, raakt bewust mobiel/TV —
§7 T16). T32 daarmee beslist: de gemeten storefront (SR 0/SR 2) is het bindende normdocument voor
vormgeving; `brand-manhaj.md` alleen voor inhoudsregels. Verwerkt in §1 regel 9, §3.3 en §7 T32.

**B14 — Testaccount.** Vraag: één member-testaccount voor de ingelogde matrix-helft (en voor de vraag of
/catalog achter login zit)? Wie: founder. Advies: ja, zonder betaalgegevens; anders is de helft van de matrix
leeg. Blokkeert: SR 2.
**BESLOTEN founder 2026-09-03:** nee, voorlopig. Matrix = P × F × 3 talen × 1 (anoniem); de ingelogde helft
telt in het manifest als "niet vastgelegd (B14)" — geen stil gat. De founder kan later alsnog een account
aanmaken → aanvullende SR 2-ronde. Voorwaarde: meet SR 0 punt 2 dat /catalog of /programs anoniem
onbereikbaar zijn, dan komt B14 terug als vraag vóór SR 1.

**B15 — Talen.** Vraag: EN/AR/NL of alleen EN vastleggen? Wie: founder. Advies: drie — AR/RTL is een
structuurverschil dat SR 3 moet zien; kost 3× opslag, geen extra beslissingen. Blokkeert: SR 2.
**BESLOTEN founder 2026-09-03:** drie talen (EN/AR/NL).

**B16 — Checkout/aanmeld/language-prefs.** Vraag: als referentie ja/nee? Wie: founder. Advies: wel vastleggen
(lezen kost niets), in SR 3 markeren als "buiten SR 4-scope tot de betaalbeslissing". Blokkeert: SR 2/SR 3.
**BESLOTEN founder 2026-09-03:** ja vastleggen; in SR 3 gemarkeerd als "buiten bouwscope tot de betaalbeslissing".

**B17 — Opslag.** Vraag: licht in `reference/storefront-2026-09/` (git), zwaar in `var/storefront-referentie/`
(gitignored; `var/` op `.gitignore:24`) én NAS `/volume1/Albunyaan/storefront-referentie/` met manifest.jsonl
+ sha256 + fouten.log — akkoord? Wie: founder. Advies: ja; NAS-map NIET onder `archief-originelen/`; eigen
manifest; akkoord vóór de eerste schrijfactie (SR 1). Blokkeert: SR 1.
**BESLOTEN founder 2026-09-03:** akkoord; NAS-map `/volume1/Albunyaan/storefront-referentie/` naast, nooit in,
`archief-originelen/`.

**B18 — Zichtbaarheid SR 4.** Vraag: Vercel-alias volgt `main`; `main` 74 commits achter `exit-phase`
[gemeten]. Alias omzetten, `main` bijtrekken, of preview-URL per branch? Wie: founder. Advies: preview-URL
per branch (geen public deploy — RLS-regel); `main` niet bijtrekken vóór een bewuste release. Blokkeert: SR 4.
**BESLOTEN founder 2026-09-03:** preview-URL per branch; `main` niet bijtrekken vóór een bewuste release.

**B19 — Cubic.** Vraag: mini-test toestaan (derde partij leest de code; PR-modus = `stap/*`-branch +
PR-werkwijze)? Gratis laag en CLI-op-lokale-diffs zijn [Cowork, niet gemeten] — beslissing pas ná RV 0.4.
Wie: team. Advies: eerst RV 0.4; test alleen als het team "code mag naar Cubic" zegt. Niet nodig voor SR 4.
Blokkeert: RV 2 (deel).
**Founder 2026-09-03:** open — wacht op RV 0.4 en de antwoorden van de collega (RV 0.6).

**B20 — Codex.** Vraag: als stap-5-reviewer — abonnement/API-sleutel [Cowork, niet gemeten] aanschaffen
(kosten + derde partij)? Nu: niets aanwezig. Wie: founder. Advies: uitstellen tot RV 1 laat zien dat stap 5
met een tweede Claude-agent (ander prompt-frame, adversarial — de huis-methode uit
`security-findings-report.md:5`) niet volstaat. Blokkeert: RV 2 (deel), AGENTS.md.
**Founder 2026-09-03:** open — wacht op RV 0.4 en de antwoorden van de collega (RV 0.6).

**B21 — Playwright-telnorm + pinnen.** Vraag: 54 (import) / 57 (string) / 100 (alles) als norm; `^1.50.0`
vastpinnen op 1.61.1? Wie: team. Advies: 54 (reproduceerbaar commando); pinnen ja, in RV 2 ([te meten] of
pnpm-lock 1.61.1 vasthoudt). Blokkeert: RV 1c.
**BESLOTEN founder 2026-09-03:** telnorm 54 (import); Playwright vastpinnen op 1.61.1 in RV 2.

**B22 — e2e-playback-gate.** Vraag: test signed Bunny-embeds (`BUNNY_EMBED_TOKEN_KEY`): bevriezen als
historisch of herschrijven bij de kijkplatformkeuze? Wie: founder. Advies: bevriezen met ⛔-kop; niet draaien;
herschrijven hoort bij de kijkplatformkeuze. Blokkeert: RV 1c, RV 2.
**BESLOTEN founder 2026-09-03:** bevriezen met ⛔-kop; niet draaien.

**B23 — Settings/hooks.** Vraag: mogen RV 2-onderdelen de globale `~/.claude/settings.json`/hooks of een
repo-`.claude/settings.json` wijzigen (bv. pre-push typecheck)? Wie: founder. Advies: alleen een
repo-`.claude/settings.json` met één PreToolUse-check; globaal niets (zie "Waarom gstack niet als geheel").
Blokkeert: RV 2.
**BESLOTEN founder 2026-09-03:** alleen een repo-eigen `.claude/settings.json`; globaal niets wijzigen.

**B24 — RV 1-commit.** Vraag: `3b22309` (5 regels audit-volledig + 78 haal-serie-extras) of `91a5c1c`
(introductie audit-volledig.mjs, 380 regels)? Wie: founder + collega. Advies: `91a5c1c`, file-scoped.
Blokkeert: RV 1.
**BESLOTEN founder 2026-09-03:** RV 1 op `91a5c1c`, file-scoped.

**B25 — Poortnorm + apps/web-suite.** Vraag: 3010 (`CLAUDE.md:16` + 2 harnesses) vs 3012 (4 harnesses); en
toestemming om @playwright/test + config + tests/ in apps/web te installeren (schrijfactie, dependency)? Wie:
founder. Advies: 3012 voor e2e (dev-server op 3010 met rust), twee defaults omzetten, vastleggen in CLAUDE.md
(founder keurt de diff); installatie ja, in RV 2. Blokkeert: RV 1c/RV 2 → SR 4.
**BESLOTEN founder 2026-09-03:** e2e-poort 3012; de twee :3010-defaults omzetten; de `CLAUDE.md`-diff gaat ter
keuring naar de founder; @playwright/test in RV 2.

**B26 — Publieke archief-statuspagina.** Vraag: `https://albunyaan-archief-status.vercel.app` lijst elke titel,
is noindex maar open voor wie de link heeft (`docs/team-handbook.md:89-96`; plist-commentaar
`com.albunyaan.archief-status.plist:3-6`) — bewust openbaar? Wie: founder/team. Advies: laten, met een
teamregel "link niet delen buiten het team"; anders wachtwoord (Vercel-project). Blokkeert: niets.
**BESLOTEN founder 2026-09-03:** statuspagina laten; teamregel "link niet buiten het team delen".

**B27 — Formaten.** Vraag: 1440/390 px [Cowork-keuze] bevestigen; 1024 px (breakpoint waar apps/web zijn nav
verliest, `SiteHeader.tsx:52`) als derde formaat? Wie: founder. Advies: 1440/390 + 1024 alleen in SR 3 als
controlepunt, niet in de volledige matrix. Blokkeert: SR 2.
**BESLOTEN founder 2026-09-03:** 1440/390; 1024 alleen als controlepunt in SR 3.

**B28 — SR/RV in het MASTER-PLAN.** Vraag: SR en RV komen in MASTER-PLAN, TODO en PROMPTS niet voor (0
treffers, §7 T29); MASTER-PLAN `:533` kent alleen "change-control gate" en "manhaj gate". Worden ze poorten in
de cutover-gate, of blijft dit plan het enige document? Wie: founder (één-schrijver-regel). Advies: één regel in
het MASTER-PLAN die naar dit plan verwijst, geen tweede uitwerking. Blokkeert: niets in dit plan.
**GEDAAN door Cowork 2026-09-03 (founder-melding):** MASTER-PLAN v2.13 met verwijsregel naar dit plan bovenaan.
Niet zelf gemeten (`~/projects` is geen git-repo; §7 T2) — [Cowork].

**B29 — E-mailsjablonen overnemen (nieuw, founder 2026-09-03, open).** Vraag: de welkomst- en ledenmails lopen
nu via Uscreens ingebouwde e-mailsysteem; SR 0 punt 4 legt de sjablonen (welkomstmail, inlog/wachtwoord,
betaling, opzegging) als tekst vast. Worden ze op het nieuwe platform gebouwd, en via welke dienst? Welke
maildienst het nieuwe platform gebruikt is [te meten] bij de cutover-planning (alleen namen van
SMTP-variabelen, nooit waarden — §7 T9). Wie: founder. Advies: beslissen ná SR 0 (dan zijn de teksten er) en
samen met de SMTP-vraag van §7 T9; bouwen valt onder T3 (raakt sends). Blokkeert: cutover-planning, niet SR.
**Founder 2026-09-03:** vastleggen in SR 0 = ja (punt 4); bouwen = OPEN.

**B30 — AS 6: volgorde-definitie bij dubbel getoonde video's (nieuw, uit de droogloop van 2026-09-03).**
Gemeten in AS 6.1 (`~/projects/_scratch/AS6-droogloop-2026-09-03.txt`, live NAS gelezen): Uscreen toont in
`1897232 The Arabic Language 1` 14 video's twee keer (267 video-items, 253 unieke) en in `1896296 Al-Aqeedah 1`
19 video's twee keer (82 items, 63 unieke). `as6-plan.json` bevat daardoor 33 hernoem-regels dubbel
(66 van de 545 regels): de werkelijke unieke acties zijn **479** (120/120/80/159), de sha-noemer is **183
inodes op 479 paden** (niet 216/545 — die telling bevat de dubbele regels). Vraag: welk nummer krijgt een
bestand dat Uscreen op twee posities toont? (A) laatste voorkomen = het huidige plan → 14 + 19 lege nummers
en de huidige audit meldt daarna nog 14 + 19 afwijkingen (AS 6.5-poort "AS 6 = 0" onbereikbaar); (B) eerste
voorkomen → zelfde gaten, 46 + 25 hernoemingen; (C) ontdubbeld, aaneengesloten → **beide series staan
vandaag al goed (0 hernoemingen)**; de audit-as 6 in `worker/audit-volledig.mjs` moet dan op video_id
ontdubbelen (T1-codewijziging, review-eisen 1/4/6). Wie: founder. Advies: C — geen gaten, geen dubbele
acties; AS 6 krimpt tot Saud and Sara + General Anasheed = **279 acties op 83 bestanden**; `as6-plan.json`
opnieuw genereren zonder de twee series, tweede korte droogloop (279 regels), dán de go. Blokkeert: AS 6.2.
**BESLOTEN founder 2026-09-03 (voorwaardelijk besluit, voorwaarde vervuld):** broncontrole via de twin Chrome
(één `contents_collections.details`-aanroep per serie, 08:42): 1897232 = 281 items (14 dividers + 267 video-items,
253 unieke subject_id's, 14 dubbel op posities 204–217 én 219–232, elk met een eigen playlist_item-id, divider
"عالم الأصوات" op 203 én 218); 1896296 = 91 items (9 dividers + 82 video-items, 63 unieke, 19 dubbel op 28–42/44–58
en 60–63/65–68, dividers "متن ثلاثة أصول وأدلتها" en "مراتب الدين" beide dubbel); posities aaneengesloten 1..N in
één antwoord, geen paginagrens; identiek aan de oogst van 02-09 die de audit las. Conclusie per serie: **Uscreen
toont ze zelf dubbel.** Definitie = elke video één keer, eerste voorkomen, aaneengesloten. Uitgevoerd: audit-as 6
ontdubbelt en meldt (`e12e24a`, diff ter keuring), plangenerator `worker/as6-plan.mjs` (`d0f9890`), oud plan
bewaard als `as6-plan.json.voor-b30-2026-09-03`, droogloop 2 = 279 acties op 83 bestanden (AS 6.1).

## §6 Wat uit geheugen/repo is toegevoegd dat in de Cowork-context ontbrak

Alle getallen in deze paragraaf zijn [memory] of [doc] met datum tenzij [gemeten] erbij staat.

1. **30-dagen-wisklok** bij Uscreen-opzegging → "data-out-before-notice" (`change-control SKILL.md:139`;
   `Fable-5-PLAN/memory/albunyaan-platform-rebuild.md:67`, 2026-07-05). Maakt van de gouden regel een harde volgorde.
2. **AS 6 = zes stappen, stap 6 vereist nieuwe wachtercode** (`nas-archief.md:21-27`, 2026-09-02); de founder
   noemt het "volgorde-synchronisatie", te herhalen bij de contentstop; 216 unieke hernoemingen op 545 paden
   [gemeten], breedte-val 74 → 173.
3. **AS 10: rechten zijn niet de oorzaak** (2× gemeten 2026-09-02; Samba `skip smb perm=yes`,
   `nas-archief.md:47-67`); driestappenplan (`:68-76`); audit telt 24 van 35 topmappen zonder ACL [gemeten] —
   iets anders dan de 28/61 seriemappen van het teamlid.
4. **Wachter 04:15 heeft nog nooit een geslaagde nachtelijke ronde gelogd** [gemeten]; 3 handmatige wel;
   fix 02-09; open founder-vraag zelfherstel (`:264-268`, 2026-08-30). `CLAUDE.md:36` noemt het kapotte profiel.
5. **Catalog-backup faalt intermitterend** (8 van 14 rondes 20-08 t/m 02-09, laatste OK 01-09) [gemeten,
   nieuw] — niet in enige context; OneDrive-FDA-melding in het log (`backup.log:2452`).
6. **Archiefgaten**: ondertitels 0 gearchiveerd van 4.489 (`nas-archief.md:338`) / 4.494 (`:418-419`), 34
   handmatig, ~30 MB alle sporen samen (2026-08-26); 1,4 TB in `#recycle` (`:209`, 2026-08-11); zes lege
   collecties bewust zonder map (allowlist `archief/collecties-bewust-leeg.txt`, 2026-09-01); 788 losse
   video's terecht in de 99-map (`:655`, 2026-09-01).
7. **Comments zijn gesloten** (`fidelity-workorder-2026-08-06.md:45`, 2026-08-07, founder-bevestigd:
   `"commenting": false`, `video_comments` blijft leeg) — nas-archief (`:271-272,341-342`) en
   `SAMENVATTING-TEAM-2026-09-01.md:66-67` noemen ze nog open (§7 T8).
8. **Live channels zonder migratiepad** = meest bekeken content (Basmah TV Live #1, 606 views/30d);
   "MUST have an answer before any cutover" (`albunyaan-platform-rebuild.md:87`, 2026-07-11); aantal 21
   [ia-json] vs 29 [memory] (§7 T28); WS6-relay-kit bestaat (`infra/live-relay/`, ongecommit 2026-07-12);
   founder-runbook E.
9. **Leden-/DB-migratie is in de cutover-runbook een dag-van-de-cutover-stap** (delta-import
   `import-people-csv.ts`, 5 zaps, ledenmail laatst; `docs/cutover-runbook.md`, 2026-07-13) met bekende
   blockers: `rate_limit_email_sent` 2/uur ("600-member migration BLOCKER" [memory
   `uscreen-exit-backend-phase.md:68`, 2026-07-12] — ledenaantal zelf: 588 [doc PROMPTS:540-541, 2026-07-29]
   vs ~600/928 [doc TODO:477-478], §7 T30), stock auth-config, Resend + DNS (founder-runbook A–C), Stripe
   identity verification ("the only item that can slip 28 Aug week-for-week", `MASTER-PLAN:1228-1229`),
   founder-review 27 paying-no-access en 329+17 phantom subs [doc `MASTER-PLAN:1180-1186, :843-847`,
   2026-07-30], WS8 `adopt-subscriptions.ts` (dry-run default, testsuite 28/28, founder-gated), ~80
   IAP-abonnees → vouchers + App-Store-cancel-mail (comms ongeschreven; plan alleen in sessiegeheugen).
10. **MASTER-PLAN §A3.4 founder-checklist** nog open per het document (2026-07-30): Stripe identity;
    founder-runbook A–C/E/F/I/J; approvals D-day-mail + IAP-comms; antwoorden 27 / 329+17 / 12 نكتة;
    runbook-walkthrough; vier voorgeschreven vrijdag-reviews (7/14/21/28 aug) niet vastgelegd.
11. **§A3.3 memory-export nooit gedaan**: `docs/cutover-runbook.md:153` zegt nog levend "see project memory"
    (r.22 ook, maar al doorgestreept) — tegen de eigen staande regel `MASTER-PLAN:1223-1224`. Onderdeel van BS 1/B3.
12. **Vercel-alias volgt `main`; main 74 commits achter `exit-phase`** [gemeten] (memory 2026-07-13: alias
    `albunyaan-web.vercel.app`) → B18.
13. **Legal**: `/terms` en `/privacy` live met amber draft-banner en [PLACEHOLDER]-haken; entiteitsnaam
    onbevestigd (item I) [memory 2026-07-12]. **Monitoring = nul** (item J) [doc `MASTER-PLAN:1210-1211`].
    **Redirect-map categorieën niet gescript** (25) [doc `:1209`].
14. **Resources**: 107 bijlagen, 106 lokaal, 73 in Supabase Storage (≤50 MB), **33 grote APK's alleen lokaal**
    — hostingbesluit open (gratis plan capt 50 MB) [memory `fidelity-workorder-2026-08-06.md:37`, 2026-08-07].
15. **RLS vóór public deploy**: `category_items` + `video_comments` hebben nog leespolicies nodig; verify-rls
    21/22 (enige FAIL = ontbrekende TEST_USER_A/B) [memory 2026-08-06].
16. **Twin Chrome**: `chrome-emdb-clone` crasht (exit 133), `chrome-twin-2` sinds 02-09, `start-twin.sh`,
    `CHROME_CDP`-noodklep (commit a0674db); gewone Chrome 150/152 serveert geen /json-endpoints → geen
    vervanging [memory `nas-archief.md:661-695`, 2026-09-02].
17. **Change-control-skill verwijst 4× naar een niet-bestaand WS-plan** (`SKILL.md:45,125,151,194`) [gemeten];
    de WS0–WS10-mapping overleeft alleen als "observed mapping" (`:125`); r151 draagt het MODEL-FITNESS-precedent.
18. **Huis-review-methode bestaat al** (`docs/security-findings-report.md:5`, 2026-07-12) — kandidaat voor
    stap 3/5 van de pipeline zonder derden.
19. **Officiële plugin-marketplace** gekloond 2026-09-02 (0 actief) met `code-review`, `security-guidance`,
    `pr-review-toolkit`, `code-simplifier` [gemeten] — meten vóór derden importeren (RV 0.4).
20. **Uscreen-admin-API is de waarheidsbron voor serie-metadata** (`bullet_api/v1/contents_collections.*`,
    `serie-extras-audit.md:23-29`, 2026-08-22); zoekwoorden 682/684 (2026-08-26); Arabische vindbaarheid =
    backlog ná cutover (2026-08-11).
21. **Storefront laadt wisselvallig** (`worker/scrape-category-order.mjs:36-38`: 71 vs 40 items, 2026-08-07)
    — SR 2 houdt per cel de meting met de meeste items (bestaand precedent); 16 worker-scripts lezen
    albunyaan.tv [gemeten].
22. **Telegram = founder-alertkanaal**; `send-push-notification.mjs` is het manhaj-gated LEDEN-kanaal en mag
    nooit voor founder-alerts (`fidelity-workorder-2026-08-06.md:35`, 2026-08-06) — geldt ook voor SR/RV.
23. **Huisregel archief**: tijdens een lopende run wijzigt niemand handmatig iets in de archiefmap
    (wipe-incident 2026-08-12, `nas-archief.md:231-233`) — geldt voor AS 6.4 en de nieuwe SR-map op de NAS.
24. **Mac-slaap** was de grootste operationele vertrager (Maintenance Sleep negeert caffeinate,
    `nas-archief.md:428-457`, 2026-08-17) — relevant voor elke nachtelijke ronde (AS 7.1).
25. **Driedeling contentstop ≠ cutover ≠ opzegging is in dit plan geïntroduceerd**; het woord "contentstop"
    komt in MASTER-PLAN/TODO/PROMPTS niet voor [gemeten 2026-09-02]. Bevestiging founder gevraagd (B1).
26. **Randvoorwaarden kijkplatformkeuze (informatief, GEEN planning):** nieuwe poort 1 zonder noemer (B8);
    live-channels-antwoord (B9); playback-gate-test is Bunny-gebonden (B22); `resolution_tier` in de admin is
    een afspeelniveau, geen bronresolutie (17/17 byte-identiek, `nas-archief.md:334-336`, 2026-08-24) — niet
    opnieuw als kwaliteitsprobleem aanmerken.
27. **Randvoorwaarden leden-/DB-migratie (informatief):** zie punt 9; plus Supabase CLI access token
    `albunyaan-cli-edge-deploy` verliep 2026-08-11 [memory] en het Supabase-plan (item F).
28. **Randvoorwaarden cutover (informatief):** poorten 2–6 `MASTER-PLAN:882-888` (TV-browser + AirPlay +
    Cast — testplan bestaat niet [doc 2026-07-30]; Stripe live keys + reconcile; custom SMTP live + gedrafte,
    gegate ledenmails — Brevo-90-dagen-regel, §7 T9; PWA-pad + ~80 IAP-plan; rollback: DNS TTL ~300 s 24–48 u
    vooraf, Uscreen één extra factuurcyclus); runbook nooit gerepeteerd → founder-walkthrough
    (`docs/cutover-runbook.md:167-169`); AS 6 nogmaals als laatste orde-pas; ondertitels (B12).
29. **Globale modeldefault** `~/.claude/settings.json:5` (`claude-fable-5-1[1m]`) ≠ `modelSettings`
    (`claude-opus-5`) ≠ draaiend model (claude-opus-5[1m]) [gemeten] → welk model de tier-regel selecteert is
    [te meten] (RV 0.1).

## §7 Tegenspraken tussen de Cowork-context en bronnen/metingen (beide versies, niet gekozen)

Per rij: versie A · versie B · gevolg als vraag. Geen rij is door keuze opgelost; waar dit plan een
werkaanname maakt, staat dat erbij en is er een B-nummer.

**T1 — Cutoverdatum.** A: Cowork: "MASTER-PLAN zegt 28 aug COMMITTED — verstreken; het plan reset naar OPEN".
B: `MASTER-PLAN:880` "COMMITTED 2026-07-29: cutover Friday 28 August 2026" (enige letterlijke COMMITTED);
`:170`, `:1128` varianten; `:1228-1229` slipclausule; indirect `:171,190,1067,1240`; `TODO:31-33`;
`PROMPTS:682,760-761` — nergens gereset [gemeten]. C: `MASTER-PLAN:1145-1146` "a missed week-milestone
moves the cutover by exactly the weeks missed" (vier gemiste vrijdagen → 28 aug + 4 weken?). Gevolg: dit plan
werkt met OPEN (founder-vormeis); welke van B/C de stuurdocumenten krijgen → B1.

**T2 — "Ongecommit".** A: Cowork: ⛔-notities "ongecommit, samen met jouw CLAUDE.md- en skill-wijzigingen".
B: repo-wijzigingen gecommit in `59b8e81` (2026-09-02 17:56) [gemeten]; `~/projects` is geen git-repo
(`fatal: not a git repository`) [gemeten] — daar bestaat "ongecommit" niet. Gevolg: geen actie; vraag: willen
we MASTER-PLAN/TODO/PROMPTS onder versiebeheer of back-up (83 KB single source of truth zonder historie)?

**T3 — Archiefomvang.** A: Cowork: "~4,3 TB". B: 0 treffers in repo, `~/projects` en memory [gemeten];
bestaande getallen: schatting 5–7 TB (`MIGRATIE-WERKORDER.md:185`, 2026-08-10), 46 TB vrij
(`nas-archief.md:119`), 3,42 TB = Bunny-bibliotheek (`audit-final.log`, 2026-08-07). Gevolg: [te meten]
`du -sh /volume1/Albunyaan/archief-originelen` (NAS); vraag: bron van 4,3?

**T4 — Wachter 04:15.** A: Cowork: "wachter 04:15 vangt nieuwe uploads". B:
`~/.albunyaan-cc/archief-bijwerken.log:1-77`: 0 geslaagde 04:15-rondes, 7 mislukte, 3 geslaagde handmatige
[gemeten]. Gevolg: uitspraak pas na AS 7.1; vraag: telt een handmatige ronde als bewijs?

**T5 — AS 6.** A: Cowork: "hernummering 4 series, wacht op go". B: memory `nas-archief.md:11-27,780-785`:
"volgorde-synchronisatie", 6 stappen, stap 6 zonder bestaande code; `as6-plan.json`: 216 unieke hernoemingen
op 545 paden [gemeten]. Gevolg: go over 545; AS 6.6 = code; vraag: geldt de go ook voor de wachtercode?

**T6 — AS 10.** A: Cowork: "hertelling door collega". B: memory `:68-76`: 3 stappen, rechten niet de oorzaak;
audit: 24 van 35 topmappen zonder ACL (`AUDIT-VOLLEDIG.txt:18`) [gemeten] ≠ 28/61 seriemappen. Gevolg:
hertelling = stap 1 van 3; opruimactie apart (B11); vraag: mag AS 10.3 als aparte actie worden gepland?

**T7 — Bunny-stop-controle.** A: Cowork: "nog te meten: LaunchAgents, Bunny-raakvlak,
verify-coverage/showcase". B: gemeten op 2026-09-02 (Bijlage A; niets start automatisch) [gemeten]. Gevolg:
versie A is door de meting achterhaald; vraag: mag BS 0 als klaar geboekt worden?

**T8 — Comments/ta3lieqaat.** A: `fidelity-workorder-2026-08-06.md:45` (2026-08-07): GESLOTEN,
founder-bevestigd (`"commenting": false`). B: `nas-archief.md:271-272,341-342` (2026-08-24/30) +
`SAMENVATTING-TEAM-2026-09-01.md:66-67`: "kijkersreacties nog niet gearchiveerd". Gevolg: vraag: geldt de
sluiting van 07-08? Zo ja: memory + teamsamenvatting corrigeren (T0, BS 1).
**BESLIST founder 2026-09-03: comments DEFINITIEF gesloten.** Gecorrigeerd (T0): `memory/nas-archief.md` (4 plekken)
en `~/.albunyaan-cc/archief/SAMENVATTING-TEAM-2026-09-01.md` (Openstaand). Versie B is daarmee achterhaald.

**T9 — SMTP.** A: `MASTER-PLAN:885-886,1140,1190` + `cutover-runbook.md:32-34`: "Brevo SMTP keys die after
90 days" (Cowork noemt het als deadline). B: memory `uscreen-exit-backend-phase.md:62,68,102` (2026-07-12):
transactionele mail = Resend + Supabase custom SMTP, DNS bij one.com; "brevo"/"90 dagen" komen in memory niet
voor [gemeten]. Gevolg: vraag: welke SMTP is de cutover-SMTP (Brevo of Resend)? De 90-dagen-regel geldt alleen
bij Brevo.
*Founder 2026-09-03:* welkomst- en ledenmails lopen NU via Uscreens ingebouwde e-mailsysteem; welke dienst het
nieuwe platform gebruikt weet de founder niet → blijft [te meten] bij de cutover-planning (alleen NAMEN van
SMTP-variabelen meten, nooit waarden). Sjablonen vastleggen = SR 0 punt 4; bouwen = B29. Tegenspraak A/B blijft.

**T10 — Leden-/DB-migratie.** A: Cowork: "later, niet in dit plan". B: `docs/cutover-runbook.md` stap 2 +
`MASTER-PLAN:1203-1206`: delta-import op de cutover-dag; `TODO:688-691` gates 3/4/5. Gevolg: beide kunnen
("later" = niet nu uitwerken); vraag: mogen de randvoorwaarden zo in §6 punt 9/27 blijven staan?

**T11 — Gouden regel.** A: Cowork: "ongewijzigd". B: staat NIET in MASTER-PLAN (0 treffers
gouden/golden/opzeg/contentstop [gemeten]); wél `MIGRATIE-WERKORDER.md:187` + `nas-archief.md:148,274` +
30-dagen-klok `SKILL.md:139`. Gevolg: §1 gebruikt de werkorder-formulering als werkaanname; vraag: wordt dat de
kanonieke formulering (dan MASTER-PLAN aanvullen — B1)?

**T12 — Playwright-telling.** A: Cowork: "gemeten 1.61.1, 57 scripts". B: 1.61.1 = geïnstalleerd;
`worker/package.json:26` zegt `^1.50.0`; 54 (import) / 57 (string) / 100 (alle) [gemeten]. Gevolg: B21.

**T13 — Catalogus achter login.** A: `ALBUNYAAN-TODO-BEGINNER.md:110-111` (2026-07-27): "the public site hides
the catalog behind login". B: `reference/real-site-ia.json:2`: "capturedFrom: https://albunyaan.tv/catalog
(live, 2026-07-05 night)" — of die capture anoniem of ingelogd was staat er niet; de enige bekende leesweg
sindsdien is de ingelogde twin (`storefront-covers.mjs:3-6`). Gevolg: SR 0 punt 2 meet het; vraag: is B14
(testaccount) daarmee blokkerend voor SR 2?

**T14 — Menu.** A: Cowork (tekstpeiling): live nav Home, Videos, Contact▾(Contact/About us/Dawah), Q&A,
Coupon, Download apps, Log in, Sign up. B: `real-site-ia.json:3` (05-07): 10 items incl. losse Contact/About
us/Dawah; memory `uscreen-exit-backend-phase.md:122` (07-12): About-us/Dawah toen uit de live header gehaald;
`SiteHeader.tsx:8-14`: 7 items, geen Contact, geen dropdown, terwijl r6 "structure per real-site-ia.json"
claimt (interne afwijking, los van de live site) [gemeten]. Gevolg: SR 0 meet; vraag: geldt de r6-afwijking
als codefout (SR 4-item) ongeacht wat de live site doet?

**T15 — Privacy in footer.** A: Cowork: "footer heeft nu Privacy policy" (nieuw). B: `SiteFooter.tsx:5-7`
(07-12): Privacy door ons toegevoegd, "NOT on the old site's footer" [gemeten]. Gevolg: [te meten in SR 0
punt 1]: staat Privacy nu in de live footer? Zo ja: convergentie, geen delta.

**T16 — tokens.ts.** A: Cowork: "tokens.ts / globals.css" (impliciet apps/web). B: tokens.ts staat in
`packages/core/src/` ("single source of truth for all app targets (web, mobile, TV)"); globals.css in
apps/web; handmatig "keep in sync" [gemeten]. Gevolg: B13-consequentie; vraag: raakt een tokenwissel bewust
ook mobile/TV-doelen? *Founder 2026-09-03 (B13):* ja — één tokenwissel in SR 4 naar de gemeten Uscreen-waarden,
raakt bewust ook de mobiel/TV-doelen.

**T17 — Uscreen-thema "Glow".** A: Cowork: thema heet Glow. B: 0 treffers in de repo [gemeten]. Gevolg: SR 0
punt 4 bevestigt in de admin.

**T18 — Grondwet.** A: Cowork: "grondwet = CLAUDE.md + 12 skills". B: `albunyaan-change-control/SKILL.md`
verwijst 4× (`:45,125,151,194`) naar het niet-bestaande `~/.claude/plans/regarding-exiting-new-screen-merry-hartmanis.md`
(0 treffers onder ~) [gemeten]; r151 = bron van MODEL FITNESS, r194 = grep-commando dat faalt; twee lezers
gaven bovendien verschillende regelnummers (45,125 vs 45,133). Gevolg: zolang het plan weg is, heeft gouden
regel 6 geen bronbestand; vraag: WS-definities officieel naar de skill verhuizen (T0), of het plan herstellen
(Time Machine/transcript)?

**T19 — Twin-Chrome-profiel.** A: `CLAUDE.md:36`: `chrome-emdb-clone`. B: `start-twin.sh` +
`archief-bijwerken.sh:72-78`: `chrome-twin-2` (oud profiel crasht) [gemeten]. Gevolg: AS 7.3 (T0, founder
keurt de diff).

**T20 — Series- en collectietelling.** A: `audit-final.log` slotblok (2026-08-07): "686 van 686 series
sluitend"; `structuur.jsonl` 684 series (`serie-extras-audit.md:39`, 2026-08-22); collecties 692 (05-07,
`albunyaan-platform-rebuild.md:83`) → 701 (22-08, `serie-extras-audit.md:25`). B:
`SAMENVATTING-TEAM-2026-09-01.md:51-53`: "698 series in het archief"; `AUDIT-VOLLEDIG.txt:5-6` (02-09): 703
collecties, 6 bewust leeg (= 697 met map); wachter 02-09: 703 collecties [gemeten]. Gevolg: definitiekwestie
(collecties vs series vs lege collecties vs datum); [te meten] met één telling per definitie in AS 6.5;
vraag: welke definitie wordt de rapportage-eenheid?

**T21 — Uscreen-maandlast.** A: `bunny-cost-model.md:19` + `MASTER-PLAN:890`: ≈€2.900/mo. B:
`albunyaan-platform-rebuild.md:65` (contract, 2026-07-05): $2.751/mo + $0,99/gebruiker ≈ $3.358/mo. Gevolg:
alleen relevant voor het kostenargument; [te meten] op de factuur; vraag: welk getal gebruikt het team?

**T22 — Saldo-bewaker.** A: Cowork: "saldo-bewaker uit" (afgerond). B: script no-op + plist verplaatst, maar
job nog in launchd-geheugen (guardrail blokkeert bootout) [gemeten]. Gevolg: founder doet `launchctl bootout`
of logt uit (B5).

**T23 — ⛔-dekking.** A: Cowork: ⛔ gezet in 7 documenten. B: ⛔ in 8 repo-bestanden + 3 buiten de repo = 11
[gemeten]; dekking desondanks smal: 3 van 12 skills; 9 met ongemarkeerde Bunny-instructies;
PROJECT_SUMMARY/migration-truth/security-findings-report 0 ⛔; memory 0 van 10; TODO:269-272 ongemarkeerd.
Gevolg: BS 1 / B3 / B4.

**T24 — Archief-statuspagina.** A: `docs/team-handbook.md:89-96`: `https://albunyaan-archief-status.vercel.app`,
publiek, niet wachtwoord-beveiligd, lijst van elke titel. B: `nas-archief.md:520-526` (2026-08-16):
`_ARCHIEF-STATUS.html` op de NAS — "Er staat NERGENS dat deze pagina op Vercel draait"; de plist zelf
(`com.albunyaan.archief-status.plist:3-6`, XML-commentaar) noemt beide bestemmingen [gemeten]. Gevolg: memory
is achterhaald (T0-correctie); vraag over de openbaarheid → B26.

**T25 — 9-stappen-regels.** A: Cowork: "regels 1–4 + Karpathy → Werkregels-blok". B:
`bron-collega-9-stappen-pipeline.md:62-76`: vijf regels; regel 5 (r74-75) = subagent-briefs herhalen de
regels [gemeten]. Gevolg: RV 0.5a neemt regel 5 mee (werkaanname); vraag: akkoord?

**T26 — RV 1-commit.** A: Cowork: `audit-volledig.mjs` uit `3b22309`. B: `3b22309` wijzigt dat bestand 5
regels; `91a5c1c` is de introductie (380 regels; nu 383) [gemeten]. Gevolg: B24.

**T27 — hCaptcha publiek.** A: Cowork: "geldt voor admin, niet publiek (redirect-map bewees plain HTTP)". B:
`docs/redirect-map.md:51-53` bewees plain HTTP alleen voor kleine partials; categorie-partials 406 (r88-90);
over volledige publieke pagina-loads bestaat geen meting; hCaptcha in het corpus alleen aan concurrente
admin-loads gekoppeld (`CLAUDE.md:29`) [gemeten]. Gevolg: SR 0 punt 3 meet het (headless eerst); tot dan is
"niet publiek" afwezigheid van bewijs.

**T28 — Live channels.** A: memory `albunyaan-platform-rebuild.md:102` "29 targets" +
`fidelity-workorder:37` "29 live channels" + archief "29 channel-covers" (`nas-archief.md:193-199`). B:
`reference/real-site-ia.json:13-15` (05-07): 21 kanalen in `liveCategory` [gemeten];
`albunyaan-platform-rebuild.md:89`: "21 live channels wiring". Gevolg: aantal [te meten] in SR 0 punt 8;
B9 noemt geen aantal; vraag: categorie-items vs kanaaldoelen?

**T29 — SR/RV in de stuurdocumenten.** A: Cowork/dit plan: vier werkstromen. B: MASTER-PLAN `:533` kent
alleen "change-control gate" + "manhaj gate"; 0 treffers op pariteit/huisstijl/apps/web/Playwright/e2e/
Codex/Cubic/gstack/Karpathy in MASTER-PLAN, TODO en PROMPTS [gemeten]; MASTER-PLAN noemt zichzelf single source
of truth (`:176-177`). Gevolg: B28.

**T30 — Ledenaantal.** A: `TODO:477-478` "928 actief, ~600 echt" / memory 07-12 "600-member migration
BLOCKER". B: `PROMPTS:540-541` (2026-07-29, na Stripe-cross-check): "588 true members, 377 ghosts, suppression
653". Gevolg: §6 punt 9 noteert beide; vraag (bij B3): TODO bijwerken?

**T31 — "Founder publiceert met de hand".** A: Cowork/MASTER-PLAN §4: standing rule ongewijzigd. B:
`PROMPTS:586-588` (2026-07-29): lijstimport gedelegeerd aan een sessie "for THIS step only", met uitgevoerde
live Brevo-writes. Gevolg: §1 regel 7 noemt de uitzondering; vraag: blijft die strikt stap-specifiek?

**T32 — Merknorm.** A: `README.md:35`: `~/Marketing-Pipelines-Albunyaan/brand/brand-manhaj.md`
("non-negotiable"). B: `packages/core/src/tokens.ts:3`: `docs/brand-manhaj.md` — bestaat niet in de repo
[gemeten]. Gevolg: B13 heeft geen eenduidig normdocument; vraag: welk bestand is bindend (vóór SR 3)?
**BESLIST founder 2026-09-03 (B13):** de gemeten storefront (SR 0/SR 2) is het bindende normdocument voor
vormgeving; `brand-manhaj.md` (welke van de twee paden ook — dat blijft de tegenspraak A/B) geldt alleen voor
inhoudsregels.

**T33 — Archiefnoemer op de statuspagina.** A: hercontrole 01-09 + audit 02-09: 16.024/16.024, ontbrekend 0.
B: `archief-status.log` 02-09 15:52: "16045 video's, 16024 klaar" [gemeten] — 21 niet-klaar, vermoedelijk de
oude "21 ontbreekt"-set (12 نكتة + 9 PREP GEWEIGERD) die per 09-01 als vervallen geboekt is
(`nas-archief.md:570-574`). Gevolg: vraag: teller bijstellen of de 21 expliciet als "bestaat niet meer bij
Uscreen" tonen — vóór het team hem als gat leest?

**T34 — Playwright-versie in het manifest.** A: Cowork: "1.61.1". B: `worker/package.json:26` `^1.50.0`
(verse install kan een andere 1.6x geven) [gemeten]. Gevolg: B21 (pinnen).

**T35 — Publicatietelling.** A: 199 published (`nas-archief.md:571`, `HERCONTROLE-2026-09-01.txt:11`,
2026-09-01). B: ≈197 (`CLAUDE.md:22`, met eenheid "collections ~692") en 197/197
(`docs/security-findings-report.md:66`) [gemeten]. Gevolg: verschil 2, definitie/datum onbekend; [te meten]
met één telling per definitie (B8).

**T36 — Ondertiteltelling.** A: `nas-archief.md:338`: "0 van 4.489". B: `nas-archief.md:418-419`: "4.494
sporen (4.460 automatisch + 34 handmatig)". Gevolg: verschil 5; [te meten] op `subtitles[].vtt_url` in
`uscreen-video-details.jsonl`; B12.

**T37 — Publieke-storefront-lezers.** A: Cowork: "worker-scripts lezen de publieke storefront via plain HTTP"
(impliciet in f). B: de twee actuele storefront-lezers (`scrape-category-order.mjs:43`,
`harvest-collection-descriptions.mjs:43`) gebruiken de twin Chrome via `connectOverCDP(:9333)`; alleen de
redirect-map-scripts zijn plain-HTTP [gemeten]. Gevolg: SR 0/SR 1 kiest bewust (headless eerst, §4 punt 5).

## §8 Wat NIET in dit plan zit, met reden

- **Kijkplatformkeuze, leden-/DB-migratie, contentstop, cutover, Uscreen-opzegging** — alleen als kop "nog
  niet gepland" (§2); bekende randvoorwaarden staan informatief in §6 punt 26–28 (geen stappen, geen poorten);
  founder: "later, niet uitgewerkt"; datum OPEN.
- **Community, bundels, mobile/TV-apps-sectie, refer-to-Uscreen** — expliciet buiten SR-scope (founder).
- **Requality/kwaliteitsronde, residual-19-upload, Bunny-debris, Bunny-key-rotatie, VPS-transfers** — vervallen
  met het Bunny-besluit; alleen nog als "formeel sluiten" in BS 5.
- **Marketing-lanen** (weekly-email-draft, weekly-push, monthly-acq-draft, taste-spec, Anouk, NL-track,
  IVOE-verzending) — lopen door onder hun eigen manhaj-gate; raken Bunny niet; hun verouderde vermeldingen in de
  TODO vallen onder B3, niet onder dit plan.
- **Installaties van Cubic/Codex/gstack/@playwright/test** — pas in RV 2 na keuring en founder-ja; RV 0/1
  installeren niets. **Van de karpathy-skills wordt alleen de inhoud overgenomen (Werkregels-blok) — nooit als
  plugin geïnstalleerd.** gstack nooit als geheel (zie §3.4).
- **Pixelvergelijking Uscreen ↔ apps/web** — meet niets zinnigs tussen twee sites (founder); SR 4 test
  structuur en teksten.
- **Draaien van de zes e2e-harnesses** — bewust niet nu (founder); RV 1c inventariseert alleen.
- **Arabische vindbaarheid / zoekwoorden per serie** — backlog ná cutover (teambesluit 2026-08-11).
- **Wijzigen van de globale `~/.claude`-configuratie** — alleen per expliciete founder-toestemming (B23).
- **Elke schrijfactie richting Bunny, Uscreen-admin (anders dan lezen), Stripe (nooit via browser-automatisering
  — `PROMPTS:451,508`) of leden** — buiten dit plan en per change-control T3.

## Basis van dit plan

- **Gemeten (2026-09-02, read-only, meetronde + verificatieronde):** alle 12 LaunchAgents en hun Bunny-raakvlak;
  verify-coverage/showcase-keten (twee `--telegram`-aanroepers; zes assen, geen Bunny-as); commit 59b8e81 en de
  untracked map; backup.log 20-08 t/m 02-09; main↔exit-phase (74); wachter-log en profielen; as6-plan.json (216/545)
  en AUDIT-VOLLEDIG.txt (28); Playwright-versies/tellingen/harness-vereisten/poorten/conventies; apps/web routes,
  nav/footer/i18n/RTL-staat, tokens/globals; reference/ (21 live channels) en var/; globale ~/.claude-staat en
  binaries; MASTER-PLAN/TODO/PROMPTS-structuur, cutover-passages en ⛔-plekken; beide memory-mappen;
  ~/.albunyaan-cc-staat. **Dekkingsgrens:** de volledigheidscriticus kreeg 5 van 7 lezersrapporten; MEMORY.md,
  MIGRATIE-WERKORDER, team-handbook en cutover-runbook zijn daarna in de meetronde van 2026-09-02 zelf volledig gelezen;
  de NAS zelf is niet benaderd (geen ssh).
- **Uit de Cowork-context (niet gemeten):** ~4,3 TB; "menselijke mappenstructuur" (wat wél gemeten is: 1794
  mappen — 1449 zonder ACL / 302 / 43 [memory `nas-archief.md:51-54`]); "Glow"; live menu/hero/footer-peiling;
  Uscreen-admin als bron (Theme Customization, Snippets, blokkenlijst) en de paginalijst van 10; formaten
  1440/390; gratis laag Cubic; Codex-eisen; gstack-eigenschappen (hook, Bun, auto-update, /ship); karpathy
  "±50 regels", "vier principes"; "57 scripts".
- **Uit geheugen (met datum; hervalideren waar oud):** AS 6/AS 10-details (02-09); wachterhistorie
  (08-26…09-02); ondertitels/#recycle/lege collecties (08-11…08-30); comments gesloten (08-07); live channels,
  WS6-kit, Zapier, Resend/SMTP, rate-limit, legal, Vercel-alias (07-05…07-13 — oudste, hervalideren);
  Uscreen-contract 30 dagen (07-05).

## Bijlage A — BS 0 meettabel (2026-09-02, `launchctl list | grep -i albunyaan` + plist + grep)

Bunny-grep: `BUNNY_API_KEY|BUNNY_|bunny_video_id|reconcile-bunny|bunnycdn|b-cdn` in het script en één laag callees.

| Agent | Start (schema) | Plist | Geladen (exit) | Bunny-raakvlak |
|---|---|---|---|---|
| archief-bijwerken | `~/.albunyaan-cc/archief-bijwerken.sh` → `worker/archief-bijwerken.mjs` (04:15) | ✅ | ✅ (4) | geen |
| archief-status | `worker/archief-status-html.mjs` (elk uur; NAS + Vercel) | ✅ | ✅ (0) | geen |
| archief-watchdog | `archief-watchdog.sh` (5 min) | ✅ | ✅ (0) | geen |
| bundle-meter | `bundle-meter.sh` (5 min) | ✅ | ✅ (0) | geen (meet en0; kan de migratie pauzeren) |
| catalog-backup | `backup-catalog.py` (03:30) | ✅ | ✅ (1) | geen (dumpt Supabase incl. kolom `bunny_video_id`) |
| migration-watchdog | `migration-watchdog.sh` (5 min) | ✅ | ✅ (0) | naam-only: `video.bunnycdn.com` in een `ps`-patroon (r75) + comment; geen API, geen Telegram; logt "ORCHESTRATOR DOWN" |
| monthly-acq-draft | `monthly-acq-draft.sh` → headless `claude -p` (1e vd maand) | ✅ | ✅ (0) | geen |
| morning-report | `morning-report.sh` (08:00) | ✅ | ✅ (0) | leest `bunny_video_id=not.is.null` via Supabase (r11); osascript, geen Telegram |
| weekly-email-draft | `weekly-email-draft.sh` → headless `claude -p` (ma 09:00) | ✅ | ✅ (0) | geen |
| weekly-metrics-digest | `~/Marketing-Pipelines-Albunyaan/scripts/collect_metrics.py` (ma 10:00) | ✅ | ✅ (0) | leest `bunny_video_id` via Supabase (r75-76); osascript |
| weekly-push | `weekly-push-notification.sh` → `tsx send-push-notification.mjs` (vr 10:00) | ✅ | ✅ (0) | geen |
| bunny-balance-watch | `bunny-balance-watch.py` (3 u) | ❌ verplaatst naar `uitgeschakeld/` | ✅ nog in geheugen (0) | de enige echte Bunny-API-call — sinds 17:41:54 no-op (kill-switch) |

Geen crontab. verify-coverage.mjs / build-library-showcase.mjs: door geen agent gestart; handmatige keten
`build-library-showcase.mjs:723` en `import-video-extras.ts:223` → `verify-coverage.mjs --telegram`.
