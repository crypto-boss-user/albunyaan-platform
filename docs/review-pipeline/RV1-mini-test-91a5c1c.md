# RV 1 — mini-test van de 9-stappen-review-pipeline op commit `91a5c1c` (2026-09-04)

STATUS: uitgevoerd 2026-09-04, sessie C (Claude Code, Fable 5.1, effort high). **Wacht op keuring** door founder + collega (plan §3.4 RV 1, poort). Niets in de code gewijzigd; niets geïnstalleerd; NAS, Uscreen, twin Chrome en wachter niet aangeraakt.

Bron van de opdracht: `docs/PLAN-2026-09-werkstromen.md` §3.4 RV 1 en §5 B24 (commit), B46–B55 (RV 0-antwoorden 2026-09-04). Brondocument: `docs/review-pipeline/bron-collega-9-stappen-pipeline.md` (stappen r82-202, regels r62-76). RV 0-rapport: `~/projects/_scratch/RV0-meetrapport-2026-09-03.md`. Ruwe stap-uitvoer (volledig): `~/projects/_scratch/rv1-stap*.md`, tijdlog `rv1-tijdlog.txt`.

## 0. Opzet

| Keuze | Waarde | Bron |
|---|---|---|
| Object | `91a5c1c` "engine-ops: audit-volledig.mjs — 12-assige reconciliatie Uscreen ↔ NAS-archief", 2026-09-02, **1 bestand, +380 regels, geheel nieuw** (`worker/audit-volledig.mjs`); file-scoped | B24 |
| Diff | `git show 91a5c1c -- worker/audit-volledig.mjs` (het hele bestand; HEAD staat 3 commits verder: `3b22309`, `e12e24a`, `8c5f60e` — bewust buiten scope, "koud") | B24 |
| Uitvoering | stappen 1, 3, 4, 5, 8, 9 elk door een **eigen subagent met verse context**; stappen 2, 6, 7 door de hoofdsessie. Elke brief herhaalt de vijf non-negotiable regels + de bloat-uitzondering + "niets bewerken/committen/installeren" + wat het mag lezen | regel 5, B46 |
| Baseline | typecheck + vitest; geen harness | B53 |
| Stap 7 | fixes **beschrijven**, niet uitvoeren (bestaande commit) | opdracht |
| Stap 9 | gstack `/review` + Cubic niet geïnstalleerd → luid gemeld; lokale `/review`-concept (gstack-checklist + 8 specialisten uit de leesclone `~/projects/_scratch/rv0/gstack/review/`) als **tekstinstructie** toegepast, ASK-modus | regel 1, B50 |
| Bloat-uitzondering | fail-closed-paden, tellingscontroles en opruimcode zijn nooit bloat, ook niet zelf-geïntroduceerd; bevragen mag, strippen nooit | B47 |
| Tier van het object | T1 (worker-script, alleen lezend naar buiten); fixes worden per stuk geclassificeerd vóór ze aangebracht zouden worden | change-control, B47 |
| Modelkeuze | sessie draait als `claude-fable-5-1`, effort high (RV 0 §1.2); subagents erven het model | B48 |

Ter kennisname: vóór deze proef is per abuis een SR 3-prompt gestart; de dev-server op :3010 draaide ±1 s (Next 16.2.10 "Ready in 592 ms"), laadde geen pagina en werd door de weigering gestopt. Het door Next herschreven `apps/web/next-env.d.ts` (1 regel) is teruggezet naar HEAD; repo schoon vóór de proef (0 dirty lines).

## 1. 9/9 stappen gelogd — tijd, uitvoerder, uitvoer

Alle tijden UTC (CEST = +2). Meetdeel: **09:48:09 → 10:09 (≈ 22 min klok)**; stappen 1/3/4 parallel, 5 en 9 parallel, 8 na 6/7. Sequentieel opgeteld: 3 + 0,1 + 6 + 1,5 + 5 + 4 + 3 + 1 + 3 ≈ **27 agent-/sessieminuten**. Tokens subagents: ≈ 543 k (S1 90 k · S3 105 k · S4 68 k · S5 109 k · S8 70 k · S9 100 k).

| Stap | Gedraaid? | Tijd (UTC) | Uitvoerder | Uitvoer (kort) |
|---|---|---|---|---|
| 1 Bloat-audit (pre) | ja | 09:48:42–09:51:37 | subagent | 13 bevindingen: 3 STRIP (r118 gokketen, r214 eerste tak, r174 `mtime`), 3 VRAAG (retry r64-80, `--snel`, loop-caps), 7 GEEN. Lakmoes: zie §3 |
| 2 Baseline | ja | 09:48:09–09:48:15 | hoofdsessie | `node --check` HEAD OK + 91a5c1c OK · `worker: tsc --noEmit` **rc=2, 3 pre-existing fouten** (`playwright-core`-types in `uscreen-login.ts:19`, `uscreen-scraper.ts:16,56`; `.mjs` valt buiten `include: **/*.ts`, dus niet dit bestand) · `vitest run` **5 bestanden, 35/35 pass, 1,18 s**. Baseline die niet mag regresseren: 35/35 + 3 tsc-fouten (niet meer) |
| 3 Koude code-review | ja | 09:49:06–09:55:16 | subagent | 22 bevindingen: 0 Critical · 9 Important · 8 Minor · 5 Nit. Checklist eis 1/4/5/6 beantwoord (§4) |
| 4 Security-review | ja | 09:49:31–09:51:07 | subagent | raakt trust boundaries: **ja** (admin-sessie via CDP, ssh-procesgrens, parser van NAS-uitvoer, lokale opslag, infra-gegevens); 9 punten: 3 Important, 3 Minor, 2 Nit, 1 geen |
| 5 Adversarial | ja | 09:58:36–10:03:44 | subagent (brief: "vind wat gemist is, beargumenteer dat het fout is") | 11 eerdere Importants herbeoordeeld (7 bevestigd, 4 herwaardeerd), 8 brief-hypothesen weerlegd met data, **14 nieuwe** (5 Important); "zaak tegen" + eerlijk oordeel: houdt gedeeltelijk stand |
| 6 Consolidatie | ja | 10:04–10:08 | hoofdsessie | 62 ruwe punten → **31 geconsolideerde** (11 Important · 12 Minor · 8 Nit/beleid); per punt bron, oordeel, beslissing, tier |
| 7 Patch & re-review | ja — **beschreven, niet uitgevoerd** | 10:04–10:08 | hoofdsessie | 22 FIX beschreven, 5 DEFER met reden + vervolg, 2 n.v.t., 2 GEEN/VRAAG; tier per fix: 20 T1, **1 T2 (C7 tempo/429)**, 1 T0 (tests), 2 founder-vragen. Geen check "groen zien worden" — luid gemeld |
| 8 Bloat-audit (post) | ja | 10:08:31–10:09 | subagent (over origineel + beschreven fixes) | **7 overlappen** tussen fixes die bij uitvoering dubbele tellingen/regels geven; **1 fout in de stap-7-beschrijving** (`werk._info` breekt r371 `v.length` → NaN in TOTAAL); 3 samenvoegingen; 3 fixes teruggeduwd als "meer dan de taak vraagt"; r118/r214/r174 herbeoordeeld |
| 9 Automated gate | **NIET gedraaid als voorgeschreven** — luid: gstack `/review`, Cubic, Codex niet geïnstalleerd; in plaats daarvan: gstack-checklist + 8 specialisten als tekstinstructie, ASK-modus | 09:59:12–10:02:13 | subagent | "Pre-Landing Review: 9 issues (2 critical, 7 informational)", alle ASK; 6 van 8 specialisten dispatched (api-contract, data-migration: scope), 0 security-bevindingen; overgeslagen gstack-stappen benoemd (preamble/telemetrie, Greptile, VERSION-queue, slop-scan, TODOS.md, review-log, Codex-pass, Fix-First). Exit-regel "twee schone rondes" n.v.t. (diff verandert niet) |

## 2. Bevindingen — geconsolideerd, met terecht/onterecht

Volledige tabel (31 rijen, bron per rij, fix-beschrijving per rij) in `~/projects/_scratch/rv1-stap6-7-consolidatie.md`. Hier de kern.

**Important (11), alle TERECHT tenzij vermeld:**

| C | Regels | Bevinding | Gevonden door | Fix (beschreven) | Tier |
|---|---|---|---|---|---|
| C1 | r90/139 'w', r94, r196, r232 | oogst niet atomair; afgekapte/gemengde JSONL zonder marker; `--hergebruik` meet stil op oude oogst (data: videos 11:27, collecties 11:34, rapport 14:38); `readJsonl` slikt stil | S3, S5 (te mild), S9 | tmp+rename; `oogst-klaar.json`; weigeren zonder marker; oogst-mtime in kop; verworpen regels tellen | T1 |
| C2 | r59-60, r161 | tab sluiten vóór nieuwe open; laatste-pagina-regel (change-control regel 3) niet afgedwongen | S3, S4, S9, S5 | eerst `newPage`, dan sluiten; r161 alleen als `pages().length > 1` | T1 (regel 3 = non-negotiable patroon) |
| C3 | r144/244, r278, r39-40, r92-106, r294 | 5 stille uitvalgroepen niet geteld (collecties met `__err`; **30 categorie-items noch video noch collectie**; verworpen JSONL-regels; dubbele video-ids over pagina's; series zonder `NN -`) | S3, S5, S4, S9 | tellingen in het **bestaande `info`-object** (S8-correctie), rapportregels in stijl r316-317 | T1 (guard toevoegen) |
| C4 | r302-303, r376 | `--snel` laat 3 assen weg maar drukt "compleet én correct" | S3, S5 | `'niet gemeten'`; "compleet" alleen bij 12/12 | T1 |
| C5 | r187, r365-367 | AS 10 fail-open (alleen "Linux mode" telt; tool-fout → "zichtbaar"; `2>&1` verbergt exitstatus); 6/24 punten zijn werkmappen | S3, S4, S5, S9 | positief matchen; `as10_onmeetbaar` in TOTAAL; NEGEER_MAP toepassen (naar module-scope, S8) | T1 |
| C6 | r335 | AS 12 toetst alleen `kind==='video'`: 1.104 niet-video-rijen / 2.947 plekken nooit op inode getoetst; "0 afwijkingen" te breed | **S5 (nieuw)** | conditie `!r.dest`; of "N rijen niet getoetst" | T1 |
| C7 | r105/121/124/137/157, r70, r94 | tempo 70–130 ms tegen 1.800 ms-politeness; geen 429-afhandeling (429 → "sessie ongeldig — founder moet inloggen"); **bewezen gevolg: wachter 03-09 14:02 onderuit door 429** | **S5 (nieuw)**, S9 | 1.800 ms; 429 → 90 s + één herhaling, exit-code 3 (hergebruik `archief-bijwerken.mjs:178-188`, S8) | **T2** |
| C8 | geheel, r201-202 | geen samenloop-guard met de 04:15-wachter (zelfde Chrome + manifest); `cat manifest.jsonl` tijdens append → halve regel stil weg | **S5 (nieuw)**, S9 | pgrep/pidfile-check (audit-kant); wachter-kant = ander bestand → DEFER; "één ssh-sessie" **teruggeduwd door S8** (nieuwe parsercode) | T1 |
| C9 | r276-282 vs `archief-bijwerken.mjs:565-571` | AS 5 eist elke categorie, plaatsingsbeleid kiest één map (77 losse video's in >1 categorie) | S3, S5 | **DEFER → founder-vraag** (beleid) | — |
| C10 | r244, r247 | bewustLeeg-conditie nutteloos voor lege, dempend voor bewust-leeg-met-items; "(bewust leeg: 6)" zonder controle | S3 ("omgekeerd"), **S5 herwaardeerd** | scherper maken, niet strippen | T1 |
| C11 | r51, r161, r380 | geen `browser.close()` → CDP-socket houdt proces open (vermoeden; zusterscripts sluiten wél) | S3, S5 | `browser.close()` + één proefdraai (`--hergebruik` maskeert) | T1 |

**Minor (12):** C12 AS 6 (ontdubbeling al gefixt `e12e24a`; `x!==i+1` = founder-definitie B30 → **ONTERECHT** als bug) · C13 newline in bestandsnaam (S4 Important → **S5 herwaardeerd Minor**: enige schrijver saneert control chars; fix goedkoop, eerst `find --version` op NAS) · C14 caps stil / geen servertotaal / `categories.index` alleen p1 · C15 AS 7 ⊂ AS 11b (dubbel in TOTAAL; label ≠ meting) · C16 twee media-definities + `.jpeg`-covers (5) · C17 geen omgekeerde as (structuur 16.046 vs Uscreen 16.025; 4 dubbele manifest-rijen) — **S8: samenvoegen met C15** · C18 AS 2 toetst structuur, niet NAS · C19 timeout-melding zonder reden; exit-codes 1/2/4 ongedocumenteerd · C20 geen retry op context na Chrome-start (**S8: één fix met C24**) · C21 geen historie (DEFER) · C28 geen fixture-tests voor 12 assen (**S8: in beschreven vorm teruggeduwd** — vereist eerst refactor van top-level side effects; alternatief: golden-test op `werklijst.json` via `--hergebruik` met NAS-stub).

**Nit/beleid (8):** C22 r118 gokketen (S1 STRIP; **S8: STRIP alléén samen met C22's exit-bij-0 — strippen van tolerantie + toevoegen van guard**) · C23 `JSON.stringify` ≠ shell-escape (latent, comment) · C24 (→ C20) · C25 hostnaam in code (bestaande conventie, 15 bestanden; DEFER) · C26 r174 `mtime` STRIP terecht (dood veld; samen met C13) · **r214 eerste tak: S1 STRIP → S5 "tolerantiepad" → S8 "eerste tak = exacte pad, strippen breekt AS 1/3/5 volledig"** → GEEN; vraag hoort bij de tweede tak (C16) · C27 spawnSync → founder-vraag (§4) · C29 `-exec {} +` (vervalt door C13, S8) · C30 ongebruikte oogstvelden GEEN · C31 auteursvragen (retry ooit geraakt? `--snel` ooit gebruikt?).

**Telling terecht/onterecht (over de 31 geconsolideerde punten):** 25 TERECHT · 4 HERWAARDEERD (C10 te zwaar geformuleerd, C13 te zwaar, C27 als bug onterecht/als proces terecht, r214-strip) · 2 ONTERECHT (C12b AS 6-definitie; C26-r214 als STRIP). Van de ruwe 62: 3 herwaarderingen kwamen uit stap 5, 2 uit stap 8 — beide "tegenspreek"-stappen leverden dus correcties op die de eerste reviewers misten.

**Wat de latere commits al deden (buiten scope, ter controle van terecht):** `3b22309` (215 → 28 punten) en `e12e24a` (AS 6 ontdubbeling op video_id, altijd gemeld) bevestigen onafhankelijk dat C12a, C5-werkmappen ("omstreden") en C9 reële valse werkpunten in `91a5c1c` gaven. Welke van de overige 31 in HEAD al zijn opgelost is **niet** beoordeeld (koud).

## 3. Lakmoesproef — merkte enige bevinding een fail-closed-pad of tellingscontrole als bloat aan?

**Uitkomst: nee, geen enkele bevinding beveelt aan een fail-closed-pad, tellingscontrole of opruimcode te strippen. Maar de reflex was er, en de uitzondering (B47) was in drie gevallen aantoonbaar nodig.**

| Plek | Aard | Wat de reviewers eerlijk meldden |
|---|---|---|
| r313-317 `NEGEER_MAP` + `genegeerd`-telling + rapportregel | tellingscontrole | **S1: "dit is de plek waar de uitzondering mij corrigeert"** — zonder uitzondering 2 regels "logregel-bloat" gestript; dat oordeel zou fout zijn (laatste run: 19.104 buiten beschouwing naast AS 7 = 0). S5: getoetst of 19.104 te ruim is — nee, ijkpunt. **S8: eerste reflex "logruis", teruggefloten door r310-312.** S9: reflex kwam op, niet aangemerkt. |
| r45 `process.exit(1)`, r51-53 `exit(4)`, r83-86 sessiecheck `exit(2)`, r94/117/133 `throw` op `__err` | fail-closed | S1: "in geen enkel regime strippen"; S9: "geen seconde overwogen"; S8: "meteen als load-bearing gelezen". Enige VRAAG: waarom code 4 (S1) → C19 |
| r59 `isClosed()` + `catch`; r161 `page.close()` | opruimcode | S1: "ja, half" (her-validatie-reflex) → VRAAG; S9 reflex → niet aangemerkt; S8/C11: reflex "proces eindigt toch" → niet gevolgd. Netto-oordeel: opruimcode blijft, C2 maakt hem juist strenger |
| r92/115/131 loop-caps | guard | S1: "ja, half" (magisch getal) → VRAAG in de omgekeerde richting: guard moet **luider** falen (C14). S8: reflex "3000 bereik je nooit" → niet gevolgd (cap ligt niet ver van 16.024/paginagrootte) |
| r244 `bewustLeeg` | tellingscontrole (foute) | S5: reflex "no-op" → niet strippen, scherper maken (C10) |
| r214 eerste tak | tolerantie-/exacte pad | S1 STRIP → S5 "tolerantiepad, niet strippen" → S8 "exacte pad, strippen breekt alles". Drie lezingen, één conclusie: niet strippen |
| De tellingen die de fixes zelf toevoegen (C3/C4/C5/C14/C17) | tellingscontroles | S8: reflex "vijf `_info`-regels ook als ze 0 zijn = logregel-bloat" → niet gevolgd (HEAD `e12e24a`: "ALTIJD gemeld, ook als 0"). Wél gehandhaafd: geen telling twee keer (7 overlappen) — dat is ontdubbelen van de meting, geen strippen |

Conclusie voor de skill (RV 2): de uitzondering werkt alleen als hij **letterlijk in elke brief staat** — S1 en S8 zeggen expliciet dat de tekst hen corrigeerde. En stap 8 bewijst dat de fix-ronde zelf bloat kweekt (7 overlappen, 1 kapotte telling) — de tweede audit is niet optioneel.

## 4. Botsingen met change-control

| # | Botsing | Uitkomst in deze proef | Gevolg voor RV 2 |
|---|---|---|---|
| 1 | **Regel 2 "Never `spawnSync` in worker code"** vs r23/r43 | S3: ONTERECHT als bug (strikt sequentieel; incident = serialisatie van parallelle workers; 17 zusterscripts idem). S5: TERECHT als **proces** — stil afgeweken, commit noemt het niet; zusterwachter koos bewust async "(change-control regel 2)". S9: beleidskeuze | **Founder-vraag F1:** regel 2 verfijnen tot "in parallelle pipelines; elders alleen met expliciete verantwoording in de commit-tekst", of async wrapper voor alle 17 bestanden? |
| 2 | **Regel 3 / review-eis 5 blank-page-first** vs r59-60, r161 | alle vier reviewers: TERECHT, niet afgedwongen; zusterscripts `audit-eind.mjs`, `audit-serie-extras.mjs` doen hetzelfde, `archive-request-links.mjs:259` doet het goed | C2 fix T1; skill-regel blijft; eis 5 in de review-checklist van stap 3 heeft gewerkt (gevonden door S3, S4 én S9) |
| 3 | **MODEL FITNESS-stoplijst "concurrency values / harvest politeness"** vs C7 | fix C7 raakt de 1,8 s-politeness/hCaptcha-koppeling → **T2**; in deze proef alleen beschreven; uitvoering vereist stop-protocol + founder-ja + geslaagde 04:15-ronde | tier-classificatie vóór fixen (B47) werkte: 1 van 22 fixes bleek T2 |
| 4 | **Review-eis 3 (migrate.log/Bunny)** | n.v.t. voor dit bestand; sinds 02-09 dood (B49) | ⛔-notitie in RV 2 |
| 5 | **Bloat-uitzondering (B47) vs document r67-69 "self-introduced may be removed on sight"** | 3 plekken waar de uitzondering corrigeerde (§3); 0 strips van guards | uitzondering letterlijk in skill én in elke brief |
| 6 | **Tier T0 "None" vs pipeline verplicht** (RV 0 botsing rij 5) | dit object is T1; volledige pipeline gedraaid als proef; doorlooptijd 22 min klok / ≈ 543 k subagent-tokens voor 380 regels | tier-zwaarte (T0/T1 licht = 2, 3, 6) blijft het voorstel; volledig alleen T2/T3 |
| 7 | **Record in PR-body (document E5) vs commit-tekst (B50)** | dit rapport = record; commit-tekst begint met "Review-log: n.v.t. — docs-only" | conventie bewezen bruikbaar |
| 8 | **Guardrail §1.3 RV 0** | rapport en commit-tekst bevatten geen letterlijke gevaarlijke commando's (B54) | — |

## 5. Wat op keuring wacht

**Founder:**
- F1 spawnSync-beleid (botsing 1): regel 2 verfijnen of 17 bestanden ombouwen?
- F2 AS 5 vs plaatsingsbeleid (C9): AS 5 toetst alleen `nrs[0]`, of bijwerken vult `ook_in`?
- F3 Keuring van deze proef als geheel: is de gemeten pipeline (9 stappen, 22 min, 31 punten, 0 strips) het proces dat RV 2 moet vastleggen? Voorstel tier-zwaarte: T0/T1 = stappen 2, 3, 6 (+ 1/8 alleen bij >100 regels); T2/T3 = 1–9.
- F4 Of de fixes C1–C28 (T1) op HEAD worden uitgevoerd als aparte AS/BS-taak (buiten RV; C3 dan tegen HEAD herlezen, S8) — en C7 (T2) apart, met stop-protocol.
- F5 Auteursvragen C31: is de retry "pagina kwijt" ooit geraakt; is `--snel` ooit gebruikt?

**Collega (RV 0.6, nog open):** gstack als geheel; Cubic PR vs CLI; Codex-abonnement — plus nu: is stap 5 met een tweede Claude-agent (ander prompt-frame) voldoende, gezien dat die stap in deze proef 14 nieuwe punten en 4 herwaarderingen opleverde? (raakt B20)

**Niet gedaan in deze proef (bewust, per opdracht):** geen code gewijzigd; geen fix uitgevoerd of groen gezien; script niet gedraaid (raakt Uscreen/NAS/twin); harnesses niet gedraaid (B53); gstack/Cubic/Codex niet geïnstalleerd; HEAD-versie niet beoordeeld (koud, B24 file-scoped op `91a5c1c`).
