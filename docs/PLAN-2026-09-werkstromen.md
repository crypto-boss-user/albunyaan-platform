# PLAN 2026-09 — werkstromen Albunyaan (SR storefront-pariteit · RV review · BS Bunny-stop · AS archief)

STATUS: vastgesteld 2026-09-02 (founder-akkoord), branch `exit-phase`. Eén document voor founder, team en
Claude Code. Besloten bij akkoord: B2 = ja; `~/projects/_scratch/` = ja. **Founderbeslissingen van 2026-09-03
verwerkt in §5** (B4–B6, B10, B11, B13–B18, B21–B27 besloten; B1/B3 bij Cowork; B19/B20 wachten op RV 0;
tweede ronde 2026-09-03: B7/B8/B12/B30 besloten, B28 + B1/B3 door Cowork gedaan, B9 en B29-bouwen open). **RV 0-antwoorden 2026-09-04: B46–B55; RV 1-keuring F1–F5 = B56–B60; MANDAAT founder 2026-09-04 = gouden regel 10 + B61–B71; RV 2 ingevoerd 2026-09-04; RV 2 KLAAR 2026-09-05 incl. `CLAUDE.md` (`96a86dd`, B73).**
**AS 6 UITGEVOERD 2026-09-03** (go tegen sha256 b76bb907…37ec; 279/279, sha 83/83, audit 24 = alleen AS 10).
Wachter gerepareerd (`122f7db`), handmatige ophaalronde bewezen: NAS 16.025 = Uscreen 16.025.
**Deel 6 (2026-09-04/05, B59) KLAAR:** C7+C1+C2 `cd3fbe6` (T2, pipeline 1–9, bewijs 05-09: 54 min, 0× 429, 24); groep A `d97e0e2`
en groep B `eb0f770` (23 van 31 RV 1-punten gedaan, 1 al opgelost, 5 uitgesteld met reden — §5 B59-stand; audit meldt nu 22 =
AS 10 18 + AS 1c 4, definitieverschuiving); AS 9.2 NAS-kopie gedaan en nachtelijk bewezen (5 sep); nieuwe plan-stap AS 13 (B57,
droogloop → go); nieuwe vragen/aannames B72. **Founder 2026-09-05:** B72 (a) ja (b) laten (c) alleen 1c na sha256-meting, 149 regels laten; B31 gesloten (optie B); AS 13 = GO.
**Deel 7 (2026-09-05, sessie A) KLAAR:** rooktest hook geweigerd (B77: samengesteld commando glipt door); B5 gemeten (9 agents,
laatste TAB-GC 04:19:56, uitlaad ≈ 08:28; nacht 6 sep = nog niet meetbaar); AS 13 droogloop = deel 6 (77 · 182 · 0 ontbrekend) →
go = 0 hardlinks aan te maken, live 182/182 zelfde inode, sha 10/10, audit AS 5 0; AS 13.2 `cf77eb9`; AS 1c opgeschoond
(kopie `manifest.jsonl.voor-1c-2026-09-05`, 18.416 → 18.412, audit **18** = alleen AS 10); wachter-tempo `a4669fa` (droogloop
51 min 54 s, 0× 429 — **≈ 4× langer dan vóór, B76**). Nieuw open: B74–B77. Nachtbewijs B5 + tempo: 6/7 sep.
**Deel 8 (2026-09-05 13:00–14:30, sessie A) KLAAR:** rooktest geweigerd; nacht 6 sep nog niet meetbaar (het was 13:08 op 05-09);
B74 + B75 `a6bb157` (lib/archief-plaatsing.mjs, losmap in elke directe categorie ook naast een collectie, extras-terugval
`uscreen-video-details-live.jsonl`, 4 vitest-tests); B76 wrapper-guard live bewezen (exit 8 bij draaiende audit; start zonder
audit → --dry-ronde 52 min 6 s, 0× 429); herspeling 203 video's = 5 verschil (3 kaal-plekken + 3× "Who Are We?" zonder losse plek
in 02) → **B78** (NAS-beweging, founder); **B79** 99-map-vorm. Nachtbewijs B5/tempo/AS 9.2: 6 en 7 sep.
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

10. **Mandaat founder 2026-09-04 (§5 B61; in de prompt "nieuwe gouden regel 9" genoemd — §1 telde al negen, dus 10):**
   Claude Code en Cowork werken door op basis van de aanbevelingen, **zonder tussenvragen**. Vragen alleen bij:
   **geld** (abonnementen, opzeggingen, aankopen); **onomkeerbare acties** (NAS-verplaatsingen buiten een geplande
   droogloop→go, verwijderen van data, DNS, publiek deployen); **leden, betalingen en juridische teksten**; en
   **elke wijziging aan `CLAUDE.md`**. Al het andere: doen, in het rapport markeren als **"aanname (aanpasbaar)"**,
   en het team past achteraf aan. Gevolgen: (1) de poort "team-akkoord op de werklijst" vóór SR 4 wordt
   **"team-review van het gebouwde per stap"** (B62); (2) de zes teamvragen uit `SR3-werklijst.md` §5 (1–6)
   krijgen de aanbevolen antwoorden als standaard, elk met een B-nummer (B63–B68), aanpasbaar na review;
   (3) **gouden regel 8 vervalt** binnen de repo, `var/`, `~/projects/_scratch`, `reference/` en de NAS-map
   `storefront-referentie/` — en **blijft** voor `archief-originelen/`, launchd, `~/.claude`, DNS, Stripe en elke
   schrijfactie richting Uscreen; (4) Uscreen-factuur is betaald/geregeld (B69); (5) beheerdersaccounts voor de
   proefversie: later, vlak vóór de eerste SR 4-preview (B70); (6) **AS 9.2 nieuw**: de tweede back-upkopie gaat naar
   de NAS (`/volume1/Albunyaan/db-backups/`) i.p.v. OneDrive; OneDrive-tak vervalt, FDA niet meer nodig, oude
   OneDrive-map blijft tot de founder hem zelf opruimt — uitvoering sessie A deel 6 (B71).

## §2 Werkstromen en status

| Code | Werkstroom | Status 2026-09-02 | Eerste actie |
|---|---|---|---|
| **AS** | Archief afronden (NAS) | Afrondend. **Deel 7 KLAAR 05-09:** `audit-volledig.mjs --hergebruik` op **18 punten = alleen AS 10** (18 inhoudsmappen zonder Synology-ACL, founder-vraag B72/AS 10.3); alle andere assen 0 [gemeten `audit/run-2026-09-05-deel7-na-1c.log`, 10:46]. NAS = Uscreen = 16.025/16.025, ontbrekend 0. AS 6 klaar 03-09, AS 9.2 klaar 05-09, AS 13 uitgevoerd 05-09 (`cf77eb9`), AS 1c gesloten 05-09, wachter-tempo `a4669fa`, B74/B75 `a6bb157`, B76 wrapper-guard (buiten repo) 05-09. Tellers: B5 exit-0-nachten na uitladen 0/0 (eerste = 6 sep), AS 9.2 NAS-kopieën 2 (04_1735, 05_0330). | Nachtbewijs 6/7 sep (B5, tempo, AS 9.2); B78 herstel 6 plekken (founder, NAS); B79 99-vorm (founder); AS 10.3 rechten (founder, B11) |
| **BS** | Bunny-stop-controle | Meetronde klaar (BS 0, Bijlage A). Open: launchd-restant, ruis, tellingen, tweede ⛔-ronde (incl. memory-map), half-doorgestreepte stuurdocumenten, VPS. | BS 1 na §5 B3/B4 |
| **SR** | Storefront-pariteit `apps/web` ↔ albunyaan.tv | **SR 0–SR 3 klaar 04-09; SR 4 deel 1 (stappen 1–5) gebouwd 05-09, deel 2 (stappen 7–11) gebouwd 05-09 — 20/20 tests, preview op de branch; poort = team-review per stap (B62); T2-grens zichtbaarheid gemeld (14.983 draft-video's)** (rapporten in `~/projects/_scratch/`, referentie in `reference/storefront-2026-09/` + NAS; open: SR 2b twin, SR 2c NL-IP, dan SR 3). Was: Repo heeft een 5-juli-referentie (`reference/real-site-ia.json`, 11 clone-PNG's) en een eigen skin ("saraev rebuild") [gemeten]. Geen SR-grondslag in docs/, CLAUDE.md, MASTER-PLAN, TODO of PROMPTS [gemeten, §7 T29]. | SR 0 meetronde (`_scratch` bestaat; kan starten) |
| **RV** | Review-voorzieningen + Playwright-baseline | **RV 0 klaar 03-09 · RV 1 uitgevoerd 04-09 (gekeurd F1–F5 = B56–B60) · RV 2 KLAAR 05-09 incl. CLAUDE.md** (5 commits `0df8a79`… 04-09 + `96a86dd` 05-09: Werkregels-blok + change-control-hunks, founder-akkoord incl. correctie Werkregel 1 = B73; commit-check bewezen live: rooktest geweigerd). **Deel 5 (05-09): B77 gedicht `6d1b3eb` (34/34 + 83/87, samengesteld commando live geweigerd); T18-diff klaar ter keuring `~/projects/_scratch/change-control-T18.diff`.** **Deel 6 (05-09): T18 toegepast `eb0a961` (founder-ja; + B5-notitie r42); B80 gedicht `f484be7` (B80-harness 35/61 → 76/76, B77 34/34, oud 83/87 = gelijk; `git -P commit`/`env git commit` live geweigerd) → hook = AF (founderbesluit 05-09: verdere bypass-vondsten alleen genoteerd).** Open: RV 0.6 collega, B19/B20. | SR 4 loopt (B62: review per stap); nieuwe Werkregels gelden vanaf de volgende sessie |
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
  **GEBOUWD 2026-09-03 (founder-ja, `8c5f60e` + `d0eb4b5`) [gemeten]:** stap 1c in `archief-bijwerken.mjs`, logica
  = audit-as 6 (ontdubbeld op subject_id, eerste voorkomen, aaneengesloten; herspeeld op de auditdata: identiek,
  0/33). Signaleren only: 0 regels die repareren. Handmatige ronde 14:13–14:34: exit 0 met de regel "volgorde:
  0 series afwijkend (697 gecontroleerd · 1 zonder live collectie, niet controleerbaar (2528068 = de 12 نكتة,
  T33) · 33 dubbel getoonde items ontdubbeld)". "ONVOLLEDIG" alleen als collections.index of een detail-call
  faalt; Telegram alleen als het beeld verandert (`archief/VOLGORDE-laatst.json`). Nachtelijk bewijs (04:15
  met deze code): **2/2** — 4 sep 04:28 en 5 sep 04:27, beide "volgorde: 0 series afwijkend (697 gecontroleerd)" [gemeten].

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
  **Ronde 2 — 2026-09-03 (founder-ja, T1, `8c5f60e` + `086702a` + `653d3b9` + `d0eb4b5`) [gemeten]:**
  (a) markerbestand `archief/OPHAAL-MISLUKT`: write-ahead vóór stap 5, herschreven met reden bij falen, weg bij
  succes; bestaat hij (ook leeg), dan draait de volgende ronde stap 5 óók zonder nieuwe video's; `--alleen-structuur`
  zet hem; NAS-peiling vooraf (onbereikbaar → marker + Telegram + exit 6, geen kinderen) en `archive-request-links`
  fail-closed (exit 7) als `done/` onleesbaar is met `--negeer-wachtrij`. (b) `archive-extras.mjs`: eigen lock
  `_lock-extras` (wachten max 10 min, pid in de lockmap, verweesde lock opgeruimd, anders exit 3 — nooit stil);
  audit telt sindsdien onleesbare manifestregels (AS 11c). (c) AS 6.6 — zie daar. Adversariële review (3 lenzen)
  verwerkt. **Bewijs — handmatige inhaalronde 14:13–14:34, wrapper exit 0:** marker gelezen → stap 5 gedraaid
  zonder nieuwe video's; video-ronde exit 0 (9 te doen = de 9 vervallen "PREP GEWEIGERD 404", T33); **inhaalslag
  extras: 76/76 tekstbestanden, 59/59 covers (NAS-loop "59 ok, 0 fout"), 39/39 bijlagen ("BIJLAGEN-KLAAR ok=39
  fail=0")** — dat is alles wat sinds 24-08 niet was ingelezen; marker verwijderd ("gemiste ronde ingehaald").
  Audit erna: AS 11b meldde 7 hardlink-plekken in `25 - …/72 - Security & Protection Apps/` die de bijlagen-ingest
  wél maakte maar niet in het manifest registreerde (stroom 3 werkt de `links` van een al geregistreerde bijlage
  niet bij — pre-existing codegat, open); handmatig geregistreerd (manifest 18.416 regels, kopie
  `manifest.jsonl.voor-11b-2026-09-03`) → audit weer **24 (alleen AS 10)**, AS 7/11/11c = 0. Twee ronden ervoor
  mislukten door Uscreen zelf: 13:59 `videos.index p225 → 500` (nu 2 herkansingen, `086702a`) en 14:02 `429`
  (tempo-limiet na een dag vol admin-calls; werd als "sessie verlopen, inloggen" gemeld — **vals alarm, niet
  inloggen**; nu 90 s wachten of ronde overslaan met exit 3, `653d3b9`).
  **Nacht 4 sep 04:15 [gemeten]:** wrapper "wachter klaar" 04:28:36, `launchctl` exit 0; Uscreen 16.025, 0 nieuwe
  video's; logregel `volgorde: 0 series afwijkend (697 gecontroleerd · 1 zonder live collectie, niet controleerbaar
  (2528068) · 33 dubbel getoonde items ontdubbeld)`; geen "exit null" (stap 5 niet nodig: geen marker, geen nieuwe
  video's); `OPHAAL-MISLUKT` afwezig; `VOLGORDE-laatst.json` = `{"ids":[],"onvolledig":false}`. **AS 7.1 = 1/1 volgens
  de plan-definitie** (04:1x-ronde, exit 0, 1 ronde = 1 bewijs); de ophaalstap zelf is 's nachts nog niet geraakt
  (geen nieuwe video sinds de reparatie) — dat bewijs staat op de handmatige inhaalronde van 3 sep en volgt 's
  nachts bij de eerstvolgende nieuwe video.
  **Codegaten gedicht 2026-09-04 (founder-ja, T1, één commit per gat):** (a) `0aa2980` stroom 3 registreert nieuwe
  hardlink-plekken zelf (awk-union, tmp+mv alleen bij lege wachtrij en gelijk regelaantal; stroom 2 ná stroom 3;
  getest op manifestkopie en op de NAS-awk); (b) `ec34e69` `archive-request-links` exit 4 bij echte fouten of een
  niet-verzonden wachtrij, allowlist `archief/vervallen-videos.txt` met de 9 vervallen ids + reden (worden niet
  meer aangevraagd); (c) `b0f3910` `archive-plat/-losmap/-restructure` weigeren ook bij `_lock-extras` (en de
  `_lock`-test is nu een hele regel). Bewijs (a)/(b) in de praktijk: eerstvolgende ronde met werk ("9 vervallen
  overgeslagen", AS 11b/AS 7 = 0 na een bijlagen-ingest).
  **Nacht 5 sep 04:15 [gemeten]:** wrapper "wachter klaar" 04:27:53, `launchctl` exit 0; Uscreen 16.025, 0 nieuw, dekking
  703/0/6, volgorde 0 afwijkend → **AS 7.1 = 2/2**. Wel: 04:19:56 "pagina kwijt — nieuwe tab (poging 2)" — oorzaak gemeten:
  `migration-watchdog.sh:19-36` **TAB-GC sluit ALLE app.uscreen.tv-tabs zodra er meer dan één zijn** (log 04:19:56 "closed 2
  accumulated uscreen tabs"); de tweede tab was de wees van de afgebroken auditrun van 4 sep (zie C7-bewijs). De wachter
  overleefde het door zijn eigen herkansing (F5-bewijs dat die herkansing nodig is). Gevolg: **B5 (watchdog uitladen) raakt
  nu de wachter én de audit** — zolang hij draait moet elke Chrome-gebruiker zijn tab netjes sluiten, en mogen wachter en
  audit nooit tegelijk in de twin staan (audit-kopregel: niet 03:30–≈05:30 sinds het 1.800 ms-tempo, `a4669fa`).
  **C7-bewijs (`cd3fbe6`, B59):** run 1 op 4 sep 17:49 brak om 18:22 af in de collectiefase — géén 429 (video's 16.025 in
  24 min op 1.800 ms, categorieën 25), oorzaak `pmset -g log` 18:22:35 "Entering Sleep state due to 'Clamshell Sleep'"
  (deksel dicht; de CDP-verbinding valt weg vóór de slaap wordt gelogd); C1 hield woord: 0 `*.tmp`, geen marker,
  `--hergebruik`/`as6-plan` weigerden. Run 2 op 5 sep 05:18 (HEAD-kopie, `caffeinate -i`): **GESLAAGD** — oogst compleet in 54 min (marker: `duur_s` 3219, `wachtbeurten_429` **0**, `politeness_ms` 1800),
  16.025 video's · 25 categorieën · 703 collecties, 0 foutrijen, 0 `*.tmp` over, tab gesloten; NAS-fase + rapport: **TOTAAL 24
  (alleen AS 10)** — identiek aan 03-09. Bijvangst: het node-proces bleef na "rapport ->" aan de open CDP-socket hangen
  (C11 bevestigd, handmatig beëindigd; fix in groep B). Live nagemeten (3 calls): `videos.index` geeft `total_count` op topniveau
  (16.025) + `pagination.total_pages` 641; `categories.index` `total_pages` 1 (p2 leeg) — de C14-guard van groep A leest het juiste veld.****
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
  **Fixes gedaan 2026-09-03 12:00 (founder-ja, T1, buiten de repo; kopie `backup-catalog.py.voor-as9-2026-09-03`)
  [gemeten]:** (a) `line_buffering=True`; (b) per pagina max 3 pogingen (5 s/20 s) bij timeout/verbindingsfout/
  408/429/5xx, rijtelling per tabel tegen `Prefer: count=exact` (mismatch → exit 1 + "LET OP", nooit "OK"; geen count
  → "NIET gecontroleerd"); (c) exit-3-melding noemt de oorzaak + het echte proces-binary; `--alleen-dump [--doel]`.
  Proefrun 11:56: 37/37 tabellen = count, 73.076 rijen, exit 0. De ronde van 03-09 03:30 draaide nog de OUDE code
  (exit 3) → **nacht 0/3**; eerste echte nacht = 4 sep 03:30. **Nacht 4 sep 03:30 [gemeten]:** nieuwe code draaide:
  37/37 tabellen "= count", 73.076 rijen, "BACKUP OK", maar `LastExitStatus 768` (exit 3) mét de nieuwe oorzaakregel:
  "GEEN Volledige Schijftoegang voor het python-proces …/Python.app/Contents/MacOS/Python" → FDA is nog niet
  (effectief) gegeven. Dump-deel 1/1, **exit-0-teller 0/3**; OneDrive-opruiming daarom NIET gedaan (map telt nu 55).
  Restpunten: (i) de back-up draait op de Xcode-Python
  3.9 (`…/Python.app/Contents/MacOS/Python`, FDA-pad voor de founder) — een Xcode-update kan dat pad wijzigen en de
  schijftoegang stil verliezen → eigen vaste Python + plist-wijziging, founder + guardrail: **§5 B31 (open)**;
  (ii) OneDrive-opruiming 54 → 7 pas ná één nacht exit 0 (eerste rotatie verwijdert 47 oude mappen; lokaal 14 blijven);
  (iii) `auth.users` = 0 is écht 0 — SQL `select count(*) from auth.users` op de productie-pooler 2026-09-03 13:38:
  0 (0 niet-verwijderd), `platform_admins` 0, `profiles` 3 → de back-upteller klopt; vastgelegd als feit in §6 punt 30.
- **AS 9.2 Tweede kopie naar de NAS (B70/B71, founder 2026-09-04)** — Doel: de tweede back-upkopie op de NAS i.p.v. OneDrive;
  OneDrive-tak en FDA-eis vervallen. Uitvoerder: Claude Code (T1, back-upscript buiten de repo; plist ongewijzigd). Bewijs klaar:
  één nacht exit 0 met een kopie op de NAS, telling + sha256 lokaal = NAS. Poort: founder-ja (gegeven). Tier: T1.
  **GEDAAN 2026-09-04 17:35 [gemeten]** (kopie `backup-catalog.py.voor-as92-2026-09-04`): na de dump `tar` over ssh naar
  **`/volume1/homes/mostafa/db-backups/<stamp>/`** — bewust de ssh-home en NIET de teamshare `/volume1/Albunyaan/`: de dump
  bevat PII (`people`, `leads`, `profiles`) — aanname (aanpasbaar, B72); remote `sha256sum` per bestand vergeleken met lokaal
  (mismatch → exit 3 + "LET OP"); rotatie op de NAS: 30 stempelmappen bewaren (aanname, B72), lokaal 14; OneDrive-code weg
  (de 55 oude OneDrive-mappen ruimt de founder zelf op — geen code meer die er komt). Proefrun: exit 0, 38/38 sha gelijk,
  73.079 rijen. **Nacht 5 sep 03:30 [gemeten]:** `launchctl` exit **0** (eerste nacht exit 0 sinds 20-08), 37/37 tabellen
  "= count", 73.079 rijen, "NAS-kopie OK: 38/38 … db-backups/2026-09-05_0330; 2 kopieën op de NAS" → **AS 9.1 exit-0-teller
  1/3, AS 9.2 bewezen 1/1.** B31 (eigen Python) verliest zijn hoofdreden (geen FDA-pad meer) — advies: sluiten, zie B31.

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

**AS 13 — losse video's in élke categorie (B57, F2; plan-stap, niet te verwarren met audit-as 11/12).** Founder 2026-09-04:
losse video's die Uscreen in meer dan één categorie toont krijgen een hardlink in elke categoriemap (zelfde principe als
series); audit-as 5 blijft streng. **Gemeten 2026-09-04 en herhaald 05-09 05:25 (offline op de oogst van 03-09 + NAS-scan):**
203 losse categorie-video's; **77 in >1 categorie**; die 77 hebben **182 plekken** nodig (alle 203 samen 308); **0 ontbrekend**
(audit-as 5 = 0) en `ook_in` gevuld voor 77/77 — het bestaande archief voldoet al. Het gat zit alleen in de wachter:
`worker/archief-bijwerken.mjs:565-571` plaatst een NIEUWE losse video in de laagst genummerde categorie (`nrs[0]`) met
`ook_in: []`; de eerstvolgende nieuwe losse video in twee categorieën wordt dus een audit-as-5-punt.
- **AS 13.1 Droogloop** — Doel: laten zien wat de wachter zou doen. Gemeten vóór: de tellingen hierboven. Uitvoerder: Claude
  Code. Bewijs klaar: herspeling van de nieuwe plaatsingslogica op de oogst van vandaag: `N video's · P plekken · noemer =
  aantal (video, categorie)-paren` en de uitspraak "bestaand archief: 0 verschil" (of de lijst); 0 NAS-bewegingen. Poort:
  geen (lezen). Tier: T0.
- **AS 13.2 Wachter-code** — Doel: nieuwe losse video → hardlink in elke categorie + `ook_in` gevuld (zelfde weg als series:
  `paden`-lijst → `dest` + `ook_in`, hardlinks via de bestaande stroom). Gemeten vóór: AS 13.1. Uitvoerder: Claude Code.
  Bewijs klaar: `node --check`; herspeling identiek aan AS 13.1; audit-as 5 = 0 in de eerstvolgende nacht mét een nieuwe losse
  video; review per pipeline (T2: plaatsingsbeleid raakt manifest/hardlinks). Poort: **founder-go op AS 13.1** (B57: "met
  droogloop → go, niet nu"). **Founder-go gegeven 2026-09-05 (AS 13 = GO).** Tier: T2.
- **UITGEVOERD 2026-09-05 (deel 7, founder-go B57/B72).** AS 13.1 herhaald op de oogst van 05-09 04:11 + NAS-scan 04:34
  (script `_scratch/as13-droogloop.mjs`, lijst `_scratch/AS13-droogloop-2026-09-05.txt`, sha256 70a6c3d5…): 203 losse
  categorie-video's / 308 paren; **77 in >1 categorie · 182 plekken · 0 ontbrekend · ook_in 77/77 · 0 inode-afwijkingen** —
  gelijk aan deel 6 op alle tellingen (de padenlijst van deel 6 was niet als bestand bewaard; vergelijking dus op tellingen,
  de lijst van vandaag is nu wél bewaard). **Go = 0 hardlinks aan te maken** — alle 182 plekken bestonden al: live `stat`
  182/182 zelfde inode per video, nlink ≥ plekken; sha256-steekproef 10 links = manifest 10/10; NAS 55.971 bestanden /
  37.365 inodes = scan (+0/+0); `fouten.log` 54 regels, laatste 23-08; audit `--hergebruik` 08:42: AS 5 = 0, TOTAAL 22 (vóór 1c).
  AS 13.2 wachter-code `cf77eb9` (T2, pipeline 1–9): losse video → pad in elke categorie (dest + ook_in), herspeling van de
  nieuwe lus op de oogst = 77 · 182 · ook_in 77/77. **Eerlijk:** die herspeling dekt de collectieloze populatie (69 van de 77);
  8 van de 77 zitten óók in een collectie en volgen in de wachter het seriepad → B74 (founder). Nachtbewijs "AS 5 = 0 mét een
  nieuwe losse video" volgt bij de eerstvolgende nieuwe losse video.
- **B74/B75 UITGEVOERD 2026-09-05 (deel 8, `a6bb157`, T1 pipeline 1·2·3·6·8):** plaatsingsbeleid als pure functie
  `worker/lib/archief-plaatsing.mjs` — seriepad per collectie + losmap "<cat>/<nn> - <titel>/<titel>" in ELKE directe
  categorie, ook naast een collectie (referentie: de 8 gevallen + 12/15 één-categorie-gevallen, gemeten); cover/beschrijving/
  zoekwoorden via archive-extras.mjs met terugval op `uscreen-video-details-live.jsonl` (videos.details) zolang Supabase de
  video niet kent. Elke `--dry` herspeelt het beleid: **live 05-09 14:17: 203 video's met directe categorie · 5 verschil**
  (2 alleen vorm kaal→losmap: 4333088, 4310286 ×2; 3 plekken: "Who Are We?" 1969809/1969395/1969368 alleen seriepad in 02 —
  augustus-bron kende die directe items niet) → herstel = NAS-beweging, B78. Synthetische test (2 cat + 1 collectie) groen.


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
*Stand 2026-09-04:* **SR 2a klaar** (03-09, 162 cellen/486 bestanden, `757c6b9`) en **SR 2b klaar** (04-09, admin-exports +
e-mailsjablonen + founder-twin-storefront 78 cellen, manifest 464, NAS 464/464, `aeb3aa6`); **SR 2c** (NL-IP, B39) open;
daarna SR 3. Rapporten in `~/projects/_scratch/SR2a-rapport-2026-09-03.md` en `SR2b-rapport-2026-09-04.md`.
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
*Stand 2026-09-04:* **SR 3a klaar** — eigen app gerenderd (dev-server :3010 met cloud-env, alleen lezen) op de SR 2a-matrix:
168 cellen gepland, 108 vastgelegd, 60 "ONTBREEKT (geen route)" (rawdah/live, new-payment, Language prefs, for-creative-souls,
6 checkouts) — `reference/storefront-2026-09/eigen-app/` (manifest 324 regels, fouten.log, niet-vastgelegd 60), zwaar in
`var/storefront-referentie/eigen-app-2026-09-04/`. **SR 3b klaar** — `reference/storefront-2026-09/SR3-werklijst.md`
(149 oordelen: HEEFT 33 · WIJKT AF 52 · ONTBREEKT 42 · BUITEN SCOPE 5 · TWIJFEL 17; §6 bouwvolgorde 15 stappen met tier/test/
afhankelijkheid) + `SR3-samenvatting-team.md`. **Poort open: team-akkoord op de werklijst** (expliciet, met datum) → dan SR 4
(na RV 2). Drie grootste delta's: huisstijl (Cairo/logo/lichte kleurstelling/foto-hero), homepage-blokken (9 van 13 ontbreken),
taal-laag (Weglot-vertalingen ontbreken) + mobiele navigatie ontbreekt.
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
- Poort: ~~**team-akkoord op de werklijst** (expliciet, met datum)~~ → **sinds B61/B62 (2026-09-04): team-review van het gebouwde per stap**; de zes teamvragen uit de werklijst §5 gelden als beantwoord met het advies (B63–B68). Tier: T0.

**SR 4 — Bouwen (pas na RV 2 én team-akkoord).**
*Stand 2026-09-05:* **deel 1 = stappen 1–5 gebouwd** (tokenwissel Cairo/Light, logo + favicon, header-menu met Contact▾,
mobiele hamburger, footer) — 5 commits met Review-log (`86273a7`, `39bcd1c`, `e4e0b4d`, `e5ad482`, `167e3a6`), 7/7
structuurtests groen tegen de productiebuild, `pnpm build` groen; voortgang, aannames en open vragen in
`reference/storefront-2026-09/SR4-voortgang.md`. Poort nu: **team-review van het gebouwde per stap** (B62).
**Preview-URL sinds 2026-09-05 (deel 1b, B18):** `exit-phase` gepusht (e2b30d3..f5f92c4, 61 commits, geen force) →
https://albunyaan-web-git-exit-phase-crypto-boss-users-projects.vercel.app (Vercel-build READY, 56 s); protection
gemeten AAN (Vercel Authentication "all_except_custom_domains", anoniem → 302 sso-api; geen wachtwoord-protection);
preview-env bevat `SUPABASE_SERVICE_ROLE_KEY` (naam, sinds 55 d — zelfde set als production). **Blokkade voor de
teamreview:** Vercel-team = Hobby-plan met 1 lid → teamleden komen er niet in; opties (Pro/Share-link, Protection Bypass,
schermafbeeldingen) in `reference/storefront-2026-09/SR4-teamreview-deel1.md` (NL + EN, 5 ja/nee-vragen met advies als
standaard) — founderkeuze, niets gewijzigd. Baseline herbevestigd op f5f92c4: `pnpm build` groen, Playwright 7/7 (8,1 s).
**Deel 2 = stappen 7–11 UITGEVOERD 2026-09-05** (sessie B deel 2; founder: teamreview stap 1–5 loopt parallel en blokkeert niet, B62):
5 commits met Review-log — stap 7 `164227f` (home = 13 blokken, 11 beelden byte-identiek, 8/8), stap 8 `d357f34` (About us/Dawah/Downloads/Q&A
1:1 met tekst-diff 0, Coupon publiek, Contact titel; 14/14), stap 9 `47660d0` (featured band, filterbalk + zoekveld, Channels Live eerst,
19 categorierijen in Uscreen-volgorde, /search met raster; 16/16), stap 10 `5954367` (25 categorietitels anoniem gemeten →
`reference/storefront-2026-09/categorie-titels-2026-09-05.json`, volledig raster in volgorde; 18/18), stap 11 `7689ba3` (programmapagina met
Collection/Start watching/Share/tags/playlist, `/watch` = afleveringspagina met poster + ouderlijk toezicht; 20/20). Eindstand 20/20 groen, build
groen, worker-tsc 14 (constant). Voortgang, aannames en 19 open vragen: `SR4-voortgang.md` (deel 2). **Kernbevinding (T2-grens, gemeld, niet
gebouwd):** 14.983 video's staan `draft` (member_visible=true) → onder de zichtbaarheidsregel zijn 11/686 collecties zichtbaar; daardoor
catalogus 19 rijen (storefront 24), Age 5-9 30 items (80/120), gemeten collectie My Words 0/18 → §6-normen "≥ 80" en "playlist ≥ 1 op My Words"
niet haalbaar zonder zichtbaarheidsbeslissing (na policies). Stap 6 wacht op de Weglot-inlog (B32); 12–15 na kijkplatform-/betaalbeslissing.
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
*Stand 2026-09-04:* **KLAAR** 2026-09-03 (rapport in `_scratch`; RV 0.1–0.5 gemeten: botsingstabel 27/9, /review en /cso werken los, Cubic/Codex-feiten, 4 concepten, harness-inventaris); RV 0.6 collega **open**; founder-antwoorden = §5 B46–B55.
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
*Stand 2026-09-04:* **UITGEVOERD** (sessie C): rapport `docs/review-pipeline/RV1-mini-test-91a5c1c.md` — 9/9 stappen gelogd (stap 9 luid overgeslagen: gstack/Cubic/Codex niet geïnstalleerd, lokaal /review-concept als tekst), 22 min klok, 31 geconsolideerde punten (11 Important; 25 terecht, 4 herwaardeerd, 2 onterecht), lakmoesproef: 0 strips, uitzondering (B47) corrigeerde 3× aantoonbaar, stap 8 vond 7 overlappen + 1 fout in de fix-beschrijving; 1 fix is T2 (tempo/429). **Poort open: keuring founder (F1–F5) + collega.**
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
*Stand 2026-09-05 (sessie C deel 4):* **KLAAR.** `CLAUDE.md`-diff gekeurd door de founder 2026-09-05 (gouden regel 6a) en gecommit als
`96a86dd` (Werkregels 1–7 + Commands-regel E2E/3012 + spawnSync-verfijning; change-control-hunks B56/B49/B58/B50), met één correctie
t.o.v. de gekeurde diff: Werkregel 1 = founder-ja alleen buiten het mandaat van gouden regel 10/B61 (B73). Gemeten vóór: rooktest
`git commit -m "x"` geweigerd door de PreToolUse-hook (exit 2, "REVIEW-LOG CHECK GEWEIGERD") — de commit-check is live; beide hunks
regel-voor-regel gelijk aan `diff -u` van HEAD `f008706` tegen de voorstellen (0 afwijkende regels); 0 dubbele niet-lege regels.
Pipeline-stap 3 op de nieuwe tekst: 0 harde tegenspraken, 2 spanningen gemeld en niet gewijzigd (CLAUDE.md = founder): Werkregel 1
"stoppen bij onduidelijkheid" vs regel 10 "doen + aanname markeren"; Werkregel 6 "T0/T1 = 2, 3, 6" vs SKILL.md-T0-rij "docs-only =
alleen stap 3" (kop: skill = de norm). T18 (4 dode plan-verwijzingen in SKILL.md) bewust niet meegenomen — open. De nieuwe regels
gelden vanaf de eerstvolgende sessie (CLAUDE.md wordt bij start geladen).
*Stand 2026-09-04 (sessie C deel 3, founder-ja F1–F5 = B56–B60):* **INGEVOERD** in vijf commits, elk met "Review-log:" als
eerste regel en de lichte pipeline (2, 3, 6) erop toegepast — `0df8a79` skill `review-pipeline` (+ `docs/review-pipeline/security/`),
`cd369d2` `review-cold` + `security-cso` (gstack @ `0d1bd5616c0e`, MIT, ASK-only), `86d5bc2` Playwright-baseline (runner
`worker/e2e-all.ts`, twee defaults → 3012, playwright 1.61.1 gepind, `apps/web` @playwright/test + config + 1 groene
structuurtest), `28b618c` repo-eigen `.claude/settings.json` + `review-log-check.py` (43/43 testgevallen; live na herstart),
laatste commit README + deze status. **NIET gecommit (gouden regel 6a):** `CLAUDE.md`-Werkregels-blok + change-control-hunks
(regel 2 B56, eis 3 B49, T0-gate B58, commit-conventie B50, Commands-regel B25) → `~/projects/_scratch/CLAUDE.md.diff-rv2`
ter keuring. `AGENTS.md` niet aangemaakt (B20 open). Harnesses niet gedraaid (B53). Meetcorrectie: worker-tsc-baseline =
14 pre-existing fouten (RV 1 noteerde 3 door een `tail`-artefact). **Minimale RV-set voor SR 4 is compleet** op de
CLAUDE.md-keuring na; Cubic/Codex/gstack-geheel blijven geen voorwaarde.
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
| B31 | Back-up: eigen vaste Python i.p.v. de Xcode-Python 3.9 (plist-wijziging, FDA opnieuw) — **GESLOTEN 2026-09-05 (founder): optie B, laten; met AS 9.2 geen FDA-pad meer** | founder (guardrail) | AS 9.1-bestendigheid |
| B46 | RV: Werkregel 7 "gedelegeerd werk erft niets" — **BESLOTEN 2026-09-04: ja** | founder | RV 2 (Werkregels-blok) |
| B47 | RV: bloat-uitzondering óók voor zelf-geïntroduceerde fail-closed/telling/opruimcode — **BESLOTEN 2026-09-04: ja, bewust tegen het document in** | founder | RV 1 (lakmoesproef), RV 2 (skill) |
| B48 | RV: modelregel in het Werkregels-blok — **BESLOTEN 2026-09-04: nee; alleen één verwijsregel naar het bestaande stop-protocol** | founder | RV 2 |
| B49 | RV: change-control review-eis 3 (migrate.log/Bunny) — **BESLOTEN 2026-09-04: ⛔-notitie "n.v.t. sinds 2026-09-02", niet verwijderen** | founder | RV 2 |
| B50 | RV: stap-9-gate — **BESLOTEN 2026-09-04: conventie eerst ("Review-log:" in elke commit-tekst); PreToolUse-check in repo-eigen `.claude/settings.json` pas in RV 2, met verplichte uitzondering "Review-log: n.v.t. — <reden>"** | founder | RV 1 (conventie), RV 2 (check) |
| B51 | RV: /cso-rapportlocatie — **BESLOTEN 2026-09-04: `docs/review-pipeline/security/`** | founder | RV 2 |
| B52 | RV: plugin-agents als tekst overnemen — **BESLOTEN 2026-09-04: nee zolang de licentie niet bevestigd is; lezen ter inspiratie mag** | founder | RV 2 |
| B53 | RV: RV 1-baseline — **BESLOTEN 2026-09-04: typecheck + vitest; geen harness** | founder | RV 1 (ontgrendeld) |
| B54 | RV: guardrail-valspositief — **ter kennisgeving 2026-09-04; commit-conventie: geen letterlijke gevaarlijke commando's in commit-teksten of rapporten; guardrail ongewijzigd (B23)** | founder | commit-conventie |
| B55 | RV: `blocklist.json`-testregel `code-review` — **BESLOTEN 2026-09-04: laten** | founder | — |
| B56 | RV: spawnSync-regel verfijnd (F1) — **BESLOTEN 2026-09-04:** verboden in alles met parallelle workers; elders alleen met verantwoording in de commit-tekst + commentaarregel bij de aanroep; geen ombouw van de 17 scripts | founder | change-control regel 2 (diff ter keuring), RV 2 |
| B57 | AS/RV: losse video's in >1 categorie → hardlink in elke categorie, AS 5 blijft streng (F2) — **BESLOTEN 2026-09-04**; uitvoering als nieuwe AS-stap met droogloop → go, niet nu | founder | AS (nieuw), sessie A |
| B58 | RV: pipeline goedgekeurd; tier-zwaarte T0/T1 = 2, 3, 6 (+1/8 > 100 regels), T2/T3 = 1–9; stap 5 = tweede Claude-agent tot B20 (F3) — **BESLOTEN 2026-09-04** | founder | RV 2 (ontgrendeld) |
| B59 | RV: fixes C1–C28 als aparte AS-taak op HEAD (sessie A), C7 apart als T2 (F4) — **BESLOTEN 2026-09-04** | founder | AS (nieuw) |
| B60 | RV: auteursvragen C31 (retry ooit geraakt, `--snel` ooit gebruikt) — **BESLOTEN 2026-09-04: meten in de logs; onbekend = laten staan (F5)** | founder | — |
| B61 | **MANDAAT founder 2026-09-04** (gouden regel 10): doorwerken op aanbevelingen zonder tussenvragen; vragen alleen bij geld, onomkeerbaar, leden/betalingen/juridisch, CLAUDE.md; rest = "aanname (aanpasbaar)"; gouden regel 8 vervalt binnen repo/var/_scratch/reference/NAS-storefront-referentie | founder | alle werkstromen |
| B62 | SR 4-poort: "team-akkoord op de werklijst" → **"team-review van het gebouwde per stap"** (B61 gevolg 1) | team | SR 4 |
| B63 | SR3 §5 vraag 1 "Download apps"-pagina + menu-item — **standaard = advies:** pagina + menu-item meenemen (8 items), store-links pas bij nieuwe apps, homepage-blok als beeld | team (aanpasbaar) | SR 4 |
| B64 | SR3 §5 vraag 2 lead gate — **standaard = advies:** niet 1:1 nabouwen; eigen aanmeld→betaal-flow bij B16; e-mail-capture als functie noteren | team (aanpasbaar) | betaalbeslissing |
| B65 | SR3 §5 vraag 3 "by Weglot"-link — **standaard = advies:** overnemen zoals gemeten (B32) | team (aanpasbaar) | SR 4 |
| B66 | SR3 §5 vraag 4 twee inactieve publieke landing pages — **standaard = advies:** niet bouwen; bij cutover 404 | team (aanpasbaar) | cutover |
| B67 | SR3 §5 vraag 5 live-kanalen (29) — **standaard = advies:** categorie + 29 kaarten als metadata-import bij de kijkplatformkeuze; tot dan "live kanalen volgen" | team (aanpasbaar) | kijkplatformkeuze |
| B68 | SR3 §5 vraag 6 eigen extra's — **standaard = advies:** strook + home-catalogusrijen weg, zoekveld naar catalog/search, parental controls behouden maar niet in de hero, `/donate` behouden | team (aanpasbaar) | SR 4 |
| B69 | Uscreen-factuur betaald/geregeld (founder 2026-09-04) — ter kennisname; de admin-banner "unpaid invoice" (SR 2b) is afgehandeld | founder | — |
| B70 | Beheerdersaccounts proefversie — **BESLOTEN 2026-09-04: later, vlak vóór de eerste SR 4-preview** | founder | SR 4-preview |
| B71 | **AS 9.2 nieuw:** tweede back-upkopie naar NAS `/volume1/Albunyaan/db-backups/` i.p.v. OneDrive; OneDrive-tak vervalt, FDA niet meer nodig, oude OneDrive-map blijft tot de founder opruimt — uitvoering sessie A deel 6 | founder → Claude Code (sessie A) | AS 9.2 |
| B72 | Aannames/vragen deel 6 (sessie A) — **BESLOTEN 2026-09-05 (founder):** (a) wachter-tempo 1.800 ms = **ja** (aparte T2-commit na een nacht zonder 429); (b) aannames = **laten**; (c) manifest-1c = **alleen 1c schoonmaken na sha256-meting op de NAS**, de 149 opgevolgde regels **laten** (append-only blijft) | founder → Claude Code (sessie A) | AS wachter · audit 22 → 18 | — **UITGEVOERD 05-09 (deel 7):** (a) `a4669fa`, droogloop 51 min 54 s, 0× 429 → zie B76; (c) gedaan, audit 18 (alleen AS 10)
| B73 | **Correctie Werkregel 1 in `CLAUDE.md` (founder 2026-09-05, bij akkoord op de RV 2-diff):** eerste schrijfactie = founder-ja alleen buiten het mandaat van gouden regel 10/B61 (archief-originelen, launchd, `~/.claude`, DNS, Stripe, elke schrijfactie richting Uscreen, geld, onomkeerbaar, leden/betalingen/juridisch, `CLAUDE.md`); binnen repo, `var/`, `~/projects/_scratch`, `reference/` en de NAS-map `storefront-referentie/` zonder vraag, met aanname-markering — gecommit `96a86dd` | founder | alle werkstromen |
| B74 | **Plaatsingsbeleid (uit stap 5 adversarial, deel 7):** de wachter zet een video die óók in een collectie zit alleen op het seriepad; audit-as 5 telt hem óók als losse categorie-video (23 van 203, 8 van de 77 meercategorie-gevallen) → een NIEUWE zo'n video wordt een AS 5-punt als de directe categorie ≠ seriecategorie. Vraag: serie + losse plek per directe categorie (zoals archive-structure deed)? Bouwen pas na ja (T2). | founder | AS wachter | — **UITGEVOERD 05-09 (deel 8, `a6bb157`)**: losmap in elke directe categorie ook naast een collectie; herspeling 203 → 5 verschil (B78)
| B75 | **Losmap-vorm in de wachter (pre-existing, deel 7 gezien):** de wachter maakt losse video's altijd kaal (`<cat>/<nn> - <titel>`); teambesluit 12-08 = eigen map bij extra's; `archive-extras.mjs:261` slaat kaal over → nieuwe losse video's krijgen nooit cover/beschrijving/zoekwoorden (302 losmap vs 2 kaal in het archief, 1 daarvan = de enige wachter-plaatsing tot nu, 4333088). Vraag: losmap-vorm in de wachter = eigen T2-stap? | founder | AS wachter | — **UITGEVOERD 05-09 (deel 8, `a6bb157`)**: losmap-vorm voor élke nieuwe losse video (aanname: 302 losmap vs 3 kaal), extras via videos.details-terugval; de 3 bestaande kaal-plekken = B78
| B76 | **Wachter-duur (deel 7):** B72(a) las "≈ 12 → ≈ 25 min"; gemeten met 1.800 ms: **51 min 54 s** (12,8 min vóór; ≈ 1.346 admin-calls × ~2,3 s), 04:15 → ≈ 05:10, bij nieuwe video's +5–10 min. Advies: laten (nacht, 0× 429, back-up 03:30 is dan klaar; audit-venster nu 03:30–≈05:30). Bijvangst: de wrapper `~/.albunyaan-cc/archief-bijwerken.sh` weigert NIET bij een draaiende audit (andersom wél) — twee 1,8 s-stromen = het 429-scenario van 03-09; pgrep-guard in de wrapper = launchd-mandaat → founder. Pre-existing fail-open-paden in de wachter (5xx op de proef-call = vals "sessie verlopen"; `categories.show`/collectie-detail-fout stil → 99-map/losseVideos; CDP-verlies niet herstelbaar) → één aparte T1 met het audit-patroon (tijdelijk()+MAX_5XX, C20). | founder | AS wachter | — **DEELS GEDAAN 05-09 (deel 8)**: duur laten (founder); wrapper-guard in `~/.albunyaan-cc/archief-bijwerken.sh` (exit 8 + Telegram bij draaiende audit, `"$@"`-doorgifte; live bewezen 13:17 weigering / 13:25 start); pre-existing fail-open-paden blijven een aparte T1
| B77 | **Review-log-hook (rooktest deel 7):** `git commit -m "x"` wordt geweigerd (bewezen), maar een SAMENGESTELD commando (`git status; git commit -m "x"`) glipt door: `shlex.split` houdt `status;` als één token → geen `git commit`-segment → exit 0. Fix = `shlex.shlex(..., punctuation_chars=True)` of een `;`/`&&`/`|`-split vóór shlex. Niet gedaan (buiten scope deel 7; hook = RV-werkstroom). | RV (Claude Code) | RV | — **UITGEVOERD 05-09 (sessie C deel 5, `6d1b3eb`)**: shlex punctuation-modus + segmentering op `;` `&&` `\|\|` `\|` `&` newline/regelvervolg, `( )` `{ }` en `VAR=` gestript, commenters uit; telling: oude 87-harness 81/87 → 83/87 (4 rest = 2 verouderde verwachtingen + TOCTOU + bash -c bewust open), B77-harness 21/27 vóór → 34/34 na; live rooktest `git status; git commit -m x` geweigerd. Koude review: 1 Critical (`#` verborg de commit) gefixt; rest → B80. Harness bewaard in `~/projects/_scratch/rv-hook-harness/`. De 43-lijst van 04-09 bestond alleen in een sessie-scratchpad; de bron-harness (87) is teruggevonden en nu blijvend opgeslagen.
| B78 | **Herstel van 6 plekken (herspeling deel 8, NAS-beweging):** 3 kaal → losmap (4333088 in 09; 4310286 in 07 én 08: bestand in eigen map zetten + cover/teksten) en 3× losmap in 02 voor "Who Are We?" (1969809/1969395/1969368, nu alleen seriepad; augustus-bron kende de directe items niet). Audit AS 5 = 0 (seriepad telt), dus geen gat; wel afwijking van het beleid. Vraag: uitvoeren (T2, archief-originelen = founder-ja) of laten? | founder | AS |
| B80 | **Hook-bypasses die B77 bewust open laat (koude review 05-09, pre-existing):** een onbekende git-globale vlag vóór `commit` (`git -P commit`, `--no-advice`, `--config-env=…`) en de wrappers `command`/`exec`/`env VAR=x` worden niet als commit herkend → exit 0; ook `bash -c "git commit …"` en TOCTOU op `-F` blijven open (docstring). Vraag: alle `-`-tokens vóór het subcommando als vlag overslaan + `command`/`exec`/`env` strippen (T1, ±10 regels, fail-closed-richting), of laten (conventie eerst, B50)? | founder | RV | — **UITGEVOERD 05-09 (sessie C deel 6, `f484be7`, founder-ja)**: wrappers `command`/`exec`/`env`/`nice`/`time`/`caffeinate` afgepeld tot het laatste git-token, git-globale vlaggen uitgebreid (-P, --no-advice, --config-env, …), fail-closed bij onbekende vlag vóór `commit`, wrapper zonder git-token met "commit", en `env -S` zonder kaal git-token; meerdere `-C` stapelen zoals git. Telling: B80-harness 35/61 vóór → 76/76 na (incl. koude-reviewgevallen I-1 `env X=a/git git commit`, I-2 `env -S "git ${C}"`, M-2 `-C a -C b`), B77 34/34, oude 87-harness 83/87 = gelijk (4 rest: 49/50 verouderde verwachtingen, 58 TOCTOU, 69 bash -c). Live: `git -P commit -m x` en `env git commit -m x` geweigerd vóór git draaide; `git commit -m "Review-log: n.v.t. — test"` op een schone boom doorgelaten (git: nothing to commit). **Hook = AF (founderbesluit 05-09).** Genoteerd, NIET te bouwen: git-alias via `-c alias.ci=commit` (of `~/.gitconfig`), `builtin exec git …`, `$VAR` als wrapper-argument, `sudo`/`nohup`/`xargs`/`script`-wrappers, `-F`-TOCTOU, `bash -c`. Harness: `~/projects/_scratch/rv-hook-harness/harness-b80.py`. |
| B79 | **99-map-vorm (uit stap 3 deel 8):** het archief heeft 113 losmappen "99 - Buiten categorieën/<titel> (<id>)/<titel>"; de wachter maakt in de 99-map kaal "<titel> (<id>)" (pre-existing). Vraag: losmap ook in 99? | founder | AS wachter |

**Sessievolgorde (founder 2026-09-03):** sessie A = AS 6 (na de schriftelijke go: 6.3–6.5), daarna AS 9.1
meten, daarna T18-herstel (diff ter keuring); sessie B = SR 0; sessie C = RV 0. **Eén werkstroom per sessie.**
Open na 2026-09-03 (tweede ronde beslissingen): **B9** (live channels) en **B29-bouwen**; B19/B20 wachten op RV 0.6
(RV 0.4 gemeten 2026-09-03). **RV 0-antwoorden 2026-09-04: B46–B55 besloten** (tabel onder B45). Alle andere B's zijn besloten, belegd (B1/B3/B28 bij Cowork, uitgevoerd 2026-09-03) of gedaan (B30).
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

**B31 — Back-up op een eigen vaste Python (nieuw 2026-09-03, open).** Vraag: `com.albunyaan.catalog-backup`
start `/usr/bin/python3`, een xcode-select-shim die exec't naar
`/Applications/Xcode.app/Contents/Developer/Library/Frameworks/Python3.framework/Versions/3.9/Resources/Python.app/Contents/MacOS/Python`
(gemeten via `ps -o comm`). Dát binary krijgt nu Volledige Schijftoegang. Een Xcode-update (nieuwe Python-versie
of -pad) verandert het binary en verliest die toegang stil — de OneDrive-rotatie faalt dan weer met exit 3. Opties:
(A) een eigen, vaste Python (bv. `/opt/homebrew/bin/python3` of een `python3 -m venv ~/.albunyaan-cc/py`) in de
plist + FDA voor dat pad; (B) laten en de exit-3-melding (die nu de oorzaak noemt) als vangnet accepteren. Wie:
founder — plist-wijziging valt onder de guardrail (launchd = founder). Advies: A met een venv-binary onder
`~/.albunyaan-cc/` (verhuist niet met Xcode); pas ná drie nachten exit 0 met de huidige opzet, zodat één variabele
tegelijk verandert. Blokkeert: niets nu; wel de bestendigheid van AS 9.1.
**Stand 2026-09-05:** met AS 9.2 (OneDrive-tak weg) is er geen FDA-pad meer dat een Xcode-update stil kan breken; het script
gebruikt alleen de standaardbibliotheek. Advies: **B31 sluiten** (optie B) — het restrisico is een Xcode-Python-versiesprong,
die de ronde luid laat falen (exit ≠ 0, launchctl), niet stil. **Founder 2026-09-05: B31 GESLOTEN, optie B.**

**Founderbeslissingen SR 2 (2026-09-03, sessie B — GO SR 2 op het SR 1-mini-testrapport 18/18/18).** In de
founder-prompt genummerd B31–B44; hier doorgenummerd vanaf het eerste vrije nummer (B31 = Xcode-Python, sessie A):
prompt B31→B32, B32→B33, B33→B34, B34→B35, B35→B36, B36→B37, B37→B38, B38→B39, B39→B40, B40→B41, B41→B42,
B42→B43, B43→B44, B44→B45. Meetbron: `~/projects/_scratch/SR0-meetrapport-2026-09-03.md` §3.

**B32 — Weglot (taal-laag van de live storefront).** Vraag: de taalwisselaar op albunyaan.tv is Weglot (client-side,
EN→AR/NL; Uscreens eigen select staat in HTML-commentaar) [gemeten SR 0 punt a]. Meenemen of eigen i18n bouwen?
**BESLOTEN founder 2026-09-03:** pariteit = Weglot óók op het nieuwe platform tot na de cutover; eigen i18n = latere
beslissing. Inlog/abonnement ligt vermoedelijk bij een collega → vraag 4 op de collega-lijst (RV 0.6); kosten
[te meten] zodra de inlog er is. SR 2: per AR/NL-cel wachten tot Weglot klaar is (kop vertaald + netwerk stil),
anders de cel als "onvolledig" in `fouten.log`.

**B33 — AR-spiegeling.** Live zet Weglot `lang=ar` maar `dir` blijft `ltr`; de spiegeling komt uit thema-CSS
[gemeten]. **BESLOTEN founder 2026-09-03:** eigen `dir=rtl` behouden; SR 3 vergelijkt het BEELD, niet het attribuut.

**B34 — Onvertaalde h3-blokken en "Download apps".** Blijven Engels in AR én NL [gemeten]. **BESLOTEN founder
2026-09-03:** norm = zoals gemeten (Engels); vertalen is een latere contentkeuze.

**B35 — support.albunyaan.tv (extern WordPress, bron van de AR-banner via Weglot-CSS).** Founder kent het niet.
**BESLOTEN founder 2026-09-03:** onderzoek T0, alleen lezen, ná de vastlegging; vastleggen in §6 als
ecosysteemkaart-regel; wie het beheert = open vraag aan het team. **Gemeten 2026-09-03 15:03 CEST (dig, curl,
WP-REST, alleen lezen):** A `46.30.213.181` + AAAA, geen CNAME; PTR `webcluster2.webpod14-cph3.one.com` →
**hoster One.com (DK)**; https werkt (Let's Encrypt-wildcard `*.albunyaan.tv`, geldig tot 2026-11-07), http wordt
níét doorgestuurd; **WordPress 7.1**, thema Divi 4.25.0 + divi-child, Apache/PHP 8.1.34/Varnish; voorpagina toont
"No Results Found" (kapotte Divi-voorpagina), enige pagina `/support/` (gewijzigd 2023-01-05), 0 berichten,
`wp-sitemap.xml` 404; media 8 stuks, laatste upload 2024-08-10 (about-us-PDF's), AR-homepage-afbeelding 2024-02-18
(= de banner die de live storefront laadt). REST-endpoint `/wp-json/wp/v2/users` toont 1 gebruiker (enumeratie
open — beveiligingspunt, geen naam vastgelegd). Sitetitel "Contact | Contact Albunyaan TV". Zie §6 punt 31.

**B36 — Sign up → `/pages/form`.** Live: Sign up-knop → `/pages/form` ("Sign in form"); `/join` geeft óók 200
[gemeten]. **BESLOTEN founder 2026-09-03:** beide vastleggen; bouwen = "buiten bouwscope tot de betaalbeslissing"
(zelfde regel als B16).

**B37 — `/pages/new-payment` vs `/pages/coupon`.** new-payment heeft h3 "Prices" + h1 "Coupon" [gemeten].
**BESLOTEN founder 2026-09-03:** beide vastleggen; bouwen coupon; new-payment = kandidaat-archief, SR 3 legt het voor.

**B38 — `/pages/for-creative-souls-159`** (vreemde sjabloonpagina "ideeVideos"). **BESLOTEN founder 2026-09-03:**
vastleggen ja, bouwen nee.

**B39 — Geo.** De founder werkt fysiek vanuit Egypte (cookie `country_code=EG`, `gon.country="EG"`, `gon.currency="EUR"`
[gemeten]); de meeste leden zitten in NL/BE. **BESLOTEN founder 2026-09-03:** elke cel krijgt het land uit de
`country_code`-cookie in het manifest; geo-gevoelige pagina's (6 checkout-varianten, home, pricing: new-payment,
coupon, join) krijgen de vlag "geo: EG — NL-meting volgt (SR 2c)"; **SR 2c** = dezelfde pagina's vanaf een
Nederlands IP (VPN op de Mac, founder regelt) vóór SR 3 erover oordeelt. Niet blokkerend voor SR 2a.

**B40 — `/pages/Language-prefs`.** Load-event komt niet binnen 60 s [gemeten]. **BESLOTEN founder 2026-09-03:**
vastleggen met `domcontentloaded` + reden in `fouten.log`.

**B41 — Wisselvallige pagina's.** 80 vs 120 links op dezelfde categoriepagina [gemeten]. **BESLOTEN founder
2026-09-03:** per cel 2 pogingen, hoogste linktelling houden; vóór elke volledige-pagina-PNG eerst naar beneden
scrollen (lui-geladen rijen); linktelling per cel in het manifest.

**B42 — Admin-exports en e-mailsjablonen (B29) via de twin Chrome = SR 2b.** **BESLOTEN founder 2026-09-03:** alleen
lezen, één pagina per keer, 1,8 s — pas ná een geslaagde 04:15-ronde (AS 7.1 1/1) en met deze regel als founder-ja.
Mislukt de nacht: founder exporteert handmatig.
**UITGEVOERD 2026-09-04 (SR 2b, commit `aeb3aa6`):** 04:15-ronde exit 0 zonder "exit null" → twin gebruikt (CDP :9333, nieuw tabblad,
≥1,8 s, alleen lezen). Thema **Glow** (id 7617, laatst opgeslagen 4 mei 2026): primaire kleur `#447525`, schema Light, logo
385×313, favicon 48×48, kop- en broodtekstfont **Cairo** → `reference/storefront-2026-09/sr2b-2026-09-04/admin/thema/theme-customization.json`.
Snippets: custom styles 0 tekens, head code 10.950 (lead-gate-redirect naar `/pages/form` + valuta-redirect EGP/SAR/MAD/IDR via
ipinfo), post-purchase 0. Blokkenlijsten: 6 thema-pagina's, 35/35 blokpanelen (Homepage 13, About us 3, coupon 5, Dawah 6,
Downloads 4, new-payment 4 met Pricing-blok); 9 landing pages in de page builder (alleen Settings-paneel, geen blokkenlijst-UI;
Checkout *OLD* en ideeVideosmiss staan op "Active: nee" maar zijn publiek 200); 4 DEPRECATED `/admin/pages` met volledige inhoud.
**E-mailsjablonen (B29): 21 stuks, onderwerp + body letterlijk** — geen apart wachtwoord-reset-sjabloon in Uscreens lijst.
Ter kennisname: de admin toont "You have an unpaid invoice" (niet aangeraakt). Rapport `~/projects/_scratch/SR2b-rapport-2026-09-04.md`.

**B43 — UA.** **BESLOTEN founder 2026-09-03:** gewone Chrome-UA blijft de norm (wat leden zien); één extra load
zonder UA-override alleen ter kennisname, niet in de matrix.

**B44 — Videopagina (type 8).** **BESLOTEN founder 2026-09-03:** in SR 2b via de founder-sessie in de twin (alleen
kijken, geen klikken die iets wijzigen), 2 formaten × 3 talen — geen testaccount (B14 blijft nee).
**UITGEVOERD 2026-09-04 (SR 2b, `aeb3aa6`):** founder-sessie via de impersonatie-link van de Website-app (`/bullet/go-to-a-website?impersonated=true`)
→ storefront ingelogd. Afleveringspagina `/programs/collection-my-words-ar?cid=2696154&permalink=01-80f683` in 6 cellen
(speler aanwezig). Checkout ×5 + `/join` leiden óók ingelogd naar `/pages/form` (lead gate uit de head code, los van inloggen);
daarom 36 extra cellen met de client-side vlag `alb_lead_allow_ts` gezet (geen formulier verzonden): checkout-egp/mad/sar/idr
vastgelegd, `/pages/checkout` → `checkout-idr` (valuta-redirect vanaf dit IP), `/join` blijft → `/pages/form`. Totaal stap 5:
**78 cellen / 234 bestanden**, sessie "founder-twin", land EG, geo-vlag SR 2c. Viewport 390 via `setViewportSize` (geen mobiele UA).

**B45 — P = 27 bevestigd.** **BESLOTEN founder 2026-09-03:** 8 URL-typen / 27 concrete pagina's (SR0-rapport §2);
`category-Age 5-9` + `category-channels` bevestigd; de 23 overige categorieën als lijst in het manifest
(`reference/storefront-2026-09/sr2a-2026-09-03/categorieen-lijst.json`). Matrix SR 2a = 27 × 2 × 3 × anoniem =
162 cellen × 3 artefacten = 486 bestanden. **UITGEVOERD 2026-09-03 (SR 2a, commit `757c6b9`):** gepland 162, gelukt 162,
mislukt 0, geen 429, 204 loads @1,8 s zonder hard bot-check-signaal; 486 bestanden lokaal = 486 op NAS, sha256+bytes
486/486; fouten.log 122 regels (36 client-side omleidingen checkout/join → `/pages/form`, 28 herbeoordeeld, 8 cellen van
2 pagina's zonder Weglot-script, 6× B40, 16 opmerkingen). Catalogus-linktelling wisselt 256–466 per poging (B41 toegepast,
4 cellen uit poging 2). Rapport `~/projects/_scratch/SR2a-rapport-2026-09-03.md`. Open: SR 2b (twin, B42/B44), SR 2c (NL-IP, B39).

**B46–B55 — RV 0-antwoorden (founder 2026-09-04, op `~/projects/_scratch/RV0-meetrapport-2026-09-03.md` §8).**
Tabel vraag → B-nummer → besluit:

| §8-vraag | B | Besluit founder 2026-09-04 |
|---|---|---|
| 1 Werkregel 7 (subagent-briefs erven niets) | **B46** | **Ja.** Elke subagent-brief herhaalt de regels. |
| 2 Bloat-uitzondering ook voor zelf-geïntroduceerde code | **B47** | **Ja, bewust tegen het document in:** fail-closed-paden, tellingscontroles en opruimcode zijn in deze repo nooit bloat, ook niet als de wijziging ze zelf introduceert. De reviewer mag ze bevragen ("is deze guard nodig, en waarom?"), nooit strippen. Reden in de skill: de incidentgeschiedenis (change-control regel 4, MODEL FITNESS-stoplijst). |
| 3 Modelregel in het Werkregels-blok | **B48** | **Nee:** alleen het bestaande stop-protocol (change-control MODEL FITNESS); één verwijsregel in het Werkregels-blok, geen tweede modelregel. |
| 4 Review-eis 3 (migrate.log/Bunny) | **B49** | **Ja:** in RV 2 markeren "n.v.t. sinds 2026-09-02" — ⛔-notitie, niet verwijderen. |
| 5 Stap-9-gate binnen B23 | **B50** | **Conventie eerst** (RV 1: "Review-log:" in elke commit-tekst); de PreToolUse-check in een repo-eigen `.claude/settings.json` pas in RV 2, met verplichte expliciete uitzondering "Review-log: n.v.t. — <reden>" voor docs-only commits, zodat de gate nooit stil blokkeert. |
| 6 /cso-rapportlocatie | **B51** | `docs/review-pipeline/security/` (repo is privé; `security-findings-report.md` staat daar ook). |
| 7 Plugin-agents als tekst overnemen | **B52** | **Nee** zolang hun licentie niet bevestigd is (LICENSE leeg). Lezen ter inspiratie mag; geen tekst kopiëren. |
| 8 RV 1-baseline | **B53** | **Ja:** typecheck + vitest; geen harness (vereist lokale Supabase + Mailpit). |
| 9 Guardrail-valspositief | **B54** | Ter kennisgeving. Commit-conventie: geen letterlijke gevaarlijke commando's in commit-teksten of rapporten; guardrail zelf ongewijzigd (B23). |
| 10 `blocklist.json`-testregel | **B55** | Laten. |

**B56–B60 — RV 1-keuring (founder 2026-09-04, op `docs/review-pipeline/RV1-mini-test-91a5c1c.md` §5 F1–F5).**
F1 → **B56** regel 2 (spawnSync) verfijnd: verboden in alles met parallelle workers; elders alleen met verantwoording in de
commit-tekst en een commentaarregel bij de aanroep; geen ombouw van de 17 scripts (tekstvoorstel in `~/projects/_scratch/CLAUDE.md.diff-rv2`, ter keuring).
F2 → **B57** losse video's in >1 categorie krijgen een hardlink in elke categorie (zelfde principe als series); AS 5 blijft
streng; uitvoering als nieuwe AS-stap met droogloop → go, niet nu. F3 → **B58** pipeline goedgekeurd; tier-zwaarte T0/T1 =
stappen 2, 3, 6 (+1/8 alleen bij > 100 regels), T2/T3 = 1–9; stap 5 = tweede Claude-agent in ander frame tot B20 beslist.
F4 → **B59** fixes C1–C28 als aparte AS-taak op HEAD (sessie A), C7 apart als T2. F5 → **B60** auteursvragen: meten in de logs;
onbekend = laten staan. **RV 2 ingevoerd 2026-09-04** (§3.4).
**Stand B59 (2026-09-05):** C7+C1+C2 `cd3fbe6` (T2, pipeline 1–9; bewijs 05-09, zie AS 7.1); **groep A `d97e0e2`** (C3 C4 C5 C6
C10 C14 C15 C16 C17 C18 C22 C26 + C29; T1 > 100 regels = stappen 1·2·3·6·8 met 4 subagents; stap 3 vond 2 Important in mijn
eigen fixes: AS 12 per rij gaf 24 valse punten, servertotaal las het verkeerde veld; stap 8 vond nog een verzwakte guard —
allebei hersteld en met synthetische gevallen bewezen); **groep B `eb0f770`** (C8 samenloop-guard exit 5, C11 CDP-disconnect,
C13/C29 NUL-scan, C19 NAS-foutreden, C20 verbind-lus + herverbinden, C23, C24). **Telling over de 31 punten: 23 gedaan** (C1–C8,
C10, C11, C13–C20 incl. C24, C22, C23, C26, C29) · **1 al opgelost in HEAD** (C12, `e12e24a`) · **5 uitgesteld met reden**
(C9 = AS 13/B57 plaatsingsbeleid; C21 historie van rapporten; C25 hostnaam in code = conventie in 15 bestanden; C27 spawnSync =
F1-hunk ter keuring, commentaarregel wél gezet; C28 fixture-tests vereisen refactor van de top-level side effects — alternatief:
golden-test op `werklijst.json` via `--hergebruik` met NAS-stub) · **C30 GEEN** · C31 = F5 (gemeten, hieronder).
**Uitkomst-definitie verschoven, bewust:** de audit meldt nu **22** open punten = AS 10 **18 inhoudsmappen** (de 6 werkmappen
staan apart in `_info`, C5) + **AS 1c 4** échte dubbele manifest-video-regels (2117375, 2117368, 2116510 — met twee
verschillende sha256's — en 2114217; manifest-hygiëne, geen archiefgat; opruimen raakt de NAS → founder, zie B72). Nieuwe
info-tellers: 149 opgevolgde manifestregels (append-only), 1 `buiten-uscreen`-video, 4 `.mp4` als bijlage, 30 categorie-items
die noch video noch collectie zijn (live channels e.d.), 21 vervallen ids zonder bestand.
**Stand B60/F5 [gemeten in de logs, 2026-09-05]:** de "pagina kwijt"-herkansing is **6× geraakt** — wachter 4× (2 sep 11:11,
3 sep 14:17, 4 sep 04:19, 5 sep 04:19) en audit 2× (3 sep 11:27; 4 sep 18:22) — en **5 van de 6 vallen tot op de seconde samen
met een TAB-GC-regel van de migration-watchdog** (§6 punt 32); de zesde was de clamshell-slaap, waar geen herkansing kan
helpen; de C7-bewijsrun van 05-09 raakte de herkansing 0×. Oordeel: herkansing blijft (B60: geraakt = laten); de oorzaak verdwijnt met B5. `--snel` heeft **0 sporen** in
logs, shell-history en memory → onbekend, blijft staan (B60).

**B61–B71 — MANDAAT founder 2026-09-04 (gouden regel 10) en gevolgen.** Tekst van het mandaat: §1 regel 10. B62 verandert
de SR 4-poort van akkoord-vooraf in review-achteraf per stap. B63–B68 zetten de adviezen uit `reference/storefront-2026-09/SR3-werklijst.md`
§5 (vragen 1–6) als standaard neer — het team past achteraf aan; §5-vragen 7–17 van die lijst volgen dezelfde regel (advies =
standaard, "aanname (aanpasbaar)" in het rapport) zonder eigen B-nummer. B69 sluit de "unpaid invoice"-melding uit SR 2b.
B70 en B71 zijn plannings-/uitvoeringsbesluiten (sessie A deel 6 voor AS 9.2: back-upscript `backup-catalog.py` schrijft de
tweede kopie naar de NAS-map `db-backups/` — nooit in `archief-originelen/`; OneDrive-tak en FDA-eis vervallen).

**B72 — Aannames uit deel 6 (aanpasbaar, B61) + één vraag (nieuw 2026-09-05, open).** (a) **Vraag:** krijgt de wachter
(`archief-bijwerken.mjs`) hetzelfde tempo als de audit (1.800 ms tussen admin-calls, nu ≈ 70–130 ms + 90 s bij 429)? Het is
dezelfde Uscreen-limiet; de wachterronde wordt dan ≈ 12 → ≈ 25 min (in de nacht geen bezwaar). T2 (harvest-tempo), niet
gedaan zonder ja. (b) Aannames: 429-budget in de audit = 3 wachtbeurten per run; foutdrempel oogst = 0 foutrijen;
NAS-kopie van de back-up in de ssh-home `/volume1/homes/mostafa/db-backups/` (PII, buiten de teamshare); KEEP_NAS = 30
stempelmappen (≈ 30 × 6 MB); OneDrive-restant (55 mappen) opruimen = founder, geen code. (c) **Vraag (nieuw, uit groep A):**
audit-as 1c meldt 4 video's met twee manifestregels (her-downloads met hetzelfde `dest`; 2116510 zelfs met twee verschillende
sha256's, gelijke bytes) — de append-only regel van 11-08 verbiedt zelf opruimen. Laten staan als open punt (dan blijft de
audit op 22 hangen), of één keer schoonmaken met kopie `manifest.jsonl.voor-1c-<datum>` na een sha256-meting van het bestand op
de NAS (T2, NAS-beweging)? Advies: (a) ja, in een aparte T2-commit na een nacht zonder 429; (b) laten; (c) schoonmaken na
meting, in één beweging met de 149 opgevolgde regels alleen als het team de append-only regel wil loslaten — anders alleen 1c.
Blokkeert: niets. **Founder 2026-09-05: (a) ja; (b) laten; (c) alleen 1c, na sha256-meting van het bestand op de NAS, met kopie
`manifest.jsonl.voor-1c-<datum>`; de 149 opgevolgde regels laten (append-only blijft). AS 13 = GO (AS 13.2 mag; T2, pipeline 1–9).**

**B73 — Correctie Werkregel 1 (founder 2026-09-05, besloten bij het akkoord op `_scratch/CLAUDE.md.diff-rv2`).** De gekeurde
concepttekst zei "Eerste schrijfactie van een werkstroom = founder-ja" — dat was gouden regel 8 vóór het mandaat. De gecommitte tekst
(`96a86dd`) volgt gouden regel 10/B61: founder-ja alleen buiten het mandaat (archief-originelen, launchd, `~/.claude`, DNS, Stripe,
elke schrijfactie richting Uscreen, geld, onomkeerbaar, leden/betalingen/juridisch, `CLAUDE.md`); binnen repo, `var/`,
`~/projects/_scratch`, `reference/` en de NAS-map `storefront-referentie/` zonder vraag, met aanname-markering. Gemeld en niet
gewijzigd (CLAUDE.md = founder): de zin "stoppen bij onduidelijkheid" in dezelfde Werkregel botst in lezing met "doen + aanname
markeren" binnen het mandaat; en Werkregel 6 "T0/T1 = 2, 3, 6" is grover dan de skill ("docs-only = alleen stap 3") — de kop van het
blok zegt dat de skill de norm is. Blokkeert: niets.

**B72 — uitgevoerd 2026-09-05 (deel 7).** (a) tempo `a4669fa` (T2, pipeline 1–9, rapport `_scratch/deel7-pipeline-rapport.md`):
api() met 1.800 ms sinds het einde van de vorige call, 429 = 90 s × max 3, daarna Telegram + exit 3; losse sleeps weg (aanname);
tab dicht vóór exit 3. Bewijs: droogloop 10:46–11:38 = 51 min 54 s, exit 0, 0× 429, 0× "pagina kwijt", 16.025 video's, 703
collecties. (c) AS 1c: NAS-meting per video (sha256 + bytes) tegen beide manifestregels — 2117375, 2117368, 2114217: beide regels
gelijk aan het bestand → oudste (23-08) verwijderd; 2116510: regel 18007 (sha 6f0ac8…) ≠ bestand (40a3f7…) → die verwijderd, regel 18160 blijft.
Kopie `manifest.jsonl.voor-1c-2026-09-05` (18.416 regels) naast het manifest (18.412; sha 205ab186…); audit daarna: AS 1c 0,
AS 11/12 0, **TOTAAL 18 = alleen AS 10**. Append-only blijft de norm; dit is de ene gedocumenteerde uitzondering (memory).

**B74–B77 — nieuw uit deel 7 (2026-09-05, open).** Zie de tabel: B74 plaatsingsbeleid video-in-collectie-én-categorie (founder),
B75 losmap-vorm in de wachter (founder), B76 wachter-duur ≈ 52 min + wrapper-samenloop + pre-existing fail-open-paden (founder /
aparte T1), B77 hook-bypass bij samengesteld commando (RV). Blokkeert: niets; B74/B75 wel vóór "AS 5 = 0" als nachtbewijs mag gelden.

**B74–B76 — uitgevoerd 2026-09-05 (deel 8).** Code `a6bb157` (T1 > 100 regels, pipeline 1·2·3·6·8, rapport
`_scratch/deel8-pipeline-rapport.md`; koude review 0 Critical/2 Important: I-1 weerlegd met live-call, I-2 gefixt = herkansing +
teller). Bewijs: offline én live herspeling (`--dry` via de wrapper 13:25–14:17, 52 min 6 s, exit 0, 0× 429) = 203 video's,
5 verschil (B78); synthetische test groen. B76: wrapper weigert met exit 8 + Telegram bij een draaiende audit (live: 13:17
geweigerd, 13:25 gestart zonder audit); plist en launchctl niet aangeraakt. **Nachtbewijs 6 sep nog niet meetbaar** op 05-09.

**B78/B79 — nieuw uit deel 8 (open, founder).** Zie de tabel. Blokkeert: niets.

**Tempo-regel (founder 2026-09-03, geldt voor elke publieke meting):** sessie A kreeg vandaag HTTP 429 van Uscreen.
Bij een 429 op een publieke pagina: STOP, 10 minuten wachten, één keer hervatten vanaf de cel waar het stond; bij een
tweede 429 definitief stoppen, het manifest sluiten (gepland/gelukt/niet gedaan) en melden. Nooit doorhameren.

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
30. **Productie heeft nog geen accounts, ook geen beheerders** [gemeten 2026-09-03 13:38, SQL via de
    Supabase-pooler, alleen lezen]: `auth.users` 0 (0 niet-verwijderd), `platform_admins` 0, `profiles` 3 (rijen
    zonder auth-gebruiker). **Herkomst gemeten 2026-09-04 (SQL, alleen lezen):** het zijn de drie demo-profielen uit
    `worker/seed-catalog.ts:187-189` (`uuidFor('profiles:demo:…')`: Abu Yusuf adult, Yusuf kid 7-9, Maryam kid 4-6)
    in één demo-huishouden, alle drie aangemaakt 2026-07-06 04:13 bij het seeden van de catalogus (commit `93c94a4`,
    parental-control-tabellen uit migratie 0002); `watch_progress` 0, `households` 1. Geen echte leden. **Voorstel
    (open, geen actie):** laten staan tot de leden-/DB-migratie en dan als eerste stap van de delta-import
    verwijderen (of expliciet als demo-huishouden houden) — vastleggen in `docs/cutover-runbook.md` stap 2.
    Randvoorwaarde vóór een teamkeuring op een preview (SR 4/B18): er is niets om mee in te loggen;
    testaccounts/beheerders zijn een bewuste, latere stap (RLS-regel, B14).

31. **DNS/e-mail/support-subdomein van albunyaan.tv (ecosysteemkaart, B35, gemeten 2026-09-03 15:03 CEST, `dig`):**
    NS `ns01/ns02.one.com` → **de DNS-zone staat bij One.com**. Apex A `34.120.223.236` en `www` CNAME `lb.uscreen.io`
    = Uscreen. **MX** `albunyaan-tv.mail.protection.outlook.com` = **Microsoft 365** (e-mail info@/support@ loopt dus
    via een M365-tenant; mailboxbestaan niet getest — alleen lezen); SPF `include:spf.protection.outlook.com
    include:_custspf.one.com -all`; DMARC `p=none; rua=…@dmarc.brevo.com`; Brevo-verificatie-TXT aanwezig;
    `autodiscover` → Microsoft; `mail`/`smtp`/`imap`/`autoconfig` → One.com-IP `46.30.213.181`.
    `support.albunyaan.tv` → One.com-webhosting, WordPress 7.1/Divi, levert de AR-banner van de live storefront
    (details §5 B35). **Regel voor de cutover-DNS-wijziging: alleen apex A + `www` CNAME wisselen; MX, SPF, DMARC,
    autodiscover (e-mail) en het `support`-subdomein moeten blijven werken.** Wie One.com (DNS + hosting) en de
    M365-tenant beheert = open vraag aan het team (collega-lijst RV 0.6).
32. **De migration-watchdog sluit tabs van de wachter en de audit** [gemeten 2026-09-05]: `migration-watchdog.sh:19-36` (elke
    5 min) sluit ALLE `app.uscreen.tv`-tabs in de twin zodra er meer dan één zijn — bedoeld tegen tab-ophoping van de migratie
    (2026-07-09), maar de migratie is voorbij en de twin wordt nu door wachter en audit gebruikt. 5 sep 04:19:56: "closed 2
    accumulated uscreen tabs" = wachter-tab + wees-tab van de clamshell-afgebroken auditrun (4 sep 18:22, §3.1 AS 7.1); 4 sep
    04:19:15 idem met de starttab van `start-twin.sh` (die opent Chrome op `app.uscreen.tv/manage/videos` en telt dus mee).
    Alle 4 "pagina kwijt"-regels van de wachter en 1 van de 2 van de audit vallen op de seconde samen met een TAB-GC-regel
    (`watchdog.log`: 02-09 11:11, 03-09 11:27/14:17, 04-09 04:19, 05-09 04:19) — de herkansing (F5) vangt precies dit op.
    Zolang B5 niet uitgevoerd is: één Chrome-gebruiker tegelijk, tabs netjes sluiten (C2/C1 doen dat), audit nooit 03:30–≈05:30 (wachter loopt sinds `a4669fa` tot ≈ 05:10).
    Clamshell-slaap (deksel dicht) negeert `caffeinate` en verbreekt de CDP-verbinding: lange runs alleen met open deksel.

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
(Time Machine/transcript)? **05-09 (sessie C deel 5):** herstel onmogelijk (0 treffers onder ~, geen Time Machine, niet in
de session-transcripts); de enige overlevende bron is memory `~/.claude/projects/-Users-a2020-Fable-5-PLAN/memory/uscreen-exit-backend-phase.md`
(r26 Workstreams WS0–WS10, r12 founder-modelbesluit 2026-07-12). Diffvoorstel voor de vier regels (nu `SKILL.md:45,127,153,196`)
met per regel de bron: `~/projects/_scratch/change-control-T18.diff` (`git apply --check` OK, niet toegepast — skills = grondwet, ter keuring). **05-09 (sessie C deel 6): TOEGEPAST `eb0a961` na founder-ja** (diff letterlijk, comm-vergelijking 0 afwijkende regels; grep-commando r196 live rc 0, 2 treffers r12/r26) plus één extra regel op founder-instructie: r42 Watchdog ⛔-notitie "Uitgeladen 2026-09-05 (B5; plist in `~/Library/LaunchAgents/uitgeschakeld/`). Historisch:" vóór de bestaande tekst. **T18 gesloten.**

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
