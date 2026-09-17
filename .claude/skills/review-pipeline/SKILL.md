---
name: review-pipeline
description: >
  Load AFTER any change to repo files and BEFORE calling the work done or committing it.
  The 9-step review pipeline (bloat pre → baseline → cold review → security → adversarial →
  consolidate → patch → bloat post → automated gate), weighted per albunyaan-change-control
  tier: T0 docs-only = step 3 only; T0/T1 light = steps 2, 3, 6 (+1/8 only above 100 changed lines); T2/T3 full = 1–9.
  Carries the repo's fixed exception (fail-closed paths, count checks and cleanup code are
  never bloat), rule 5 (subagent briefs repeat the rules) and the commit convention
  ("Review-log:" first line). Also load when asked "welke review-stappen horen hierbij".
---

# Review-pipeline (RV 2, ingevoerd 2026-09-04)

**Bij tegenspraak wint `CLAUDE.md`.** Daarna `albunyaan-change-control`, daarna deze skill, daarna het
brondocument. Deze skill voegt niets toe aan de non-negotiables van change-control en haalt er niets af.

Bron: `docs/review-pipeline/bron-collega-9-stappen-pipeline.md` (collega, commit B2) — de negen stappen en de
vijf regels. Meting en keuring: `docs/review-pipeline/RV1-mini-test-91a5c1c.md` (RV 1, 2026-09-04, founder-ja op
F1–F5); RV 0-meetlog lokaal op de Mac van de founder (`~/projects/_scratch/RV0-meetrapport-2026-09-03.md`, niet in de repo). Beslissingen: plan §5 B46–B60.
Gebruik in gewone taal: `docs/review-pipeline/README.md`.

## De vijf regels (non-negotiable; herhaal ze in elke subagent-brief — regel 5)

1. **Geen stil overslaan.** Een stap die niet kan draaien: zeg *welke*, *waarom*, en *wat je in plaats daarvan
   deed*. Stilte is de fout die dit hele document bestrijdt.
2. **Nooit bestaande code verwijderen zonder expliciet ja van een mens.** Bloat die de huidige wijziging zelf
   introduceert mag weg; wat al bestond wordt een VRAAG.
   **Vaste uitzondering van deze repo (founder 2026-09-04, B47):** fail-closed-paden, tellingscontroles en
   opruimcode zijn **nooit** bloat — óók niet als de huidige wijziging ze zelf introduceert. De reviewer mag ze
   bevragen ("is deze guard nodig, en waarom?"), nooit strippen. Reden: de incidentgeschiedenis in
   `albunyaan-change-control` (regel 4: on-failure `deleteVideo` + nulling `uscreen_hls_url`; MODEL
   FITNESS-stoplijst "fail-closed code *looks* removable by design"). RV 1 mat dat reviewers zónder deze zin de
   `NEGEER_MAP`-telling van `audit-volledig.mjs` als "logregel-bloat" hadden gestript — en dat dat fout was.
3. **Bewijs, geen bewering.** "Tests slagen" is een claim; de letterlijke uitvoer in het rapport (of samengevat in de
   Review-log-regel) is bewijs. Elke bevinding met `bestand:regel` en citaat. Alleen bewijs sluit een stap.
4. **Fix-rondes kweken bloat.** Daarom draait de bloat-audit twee keer: vóór de review en over de cumulatieve
   diff na de patches. RV 1: stap 8 vond 7 overlappen tussen fixes en 1 fout in de fix-beschrijving.
5. **Gedelegeerd werk erft niets.** Elke subagent-brief herhaalt deze vijf regels + de uitzondering, noemt de
   baseline die niet mag regresseren, de bestanden die niet aangeraakt mogen worden, en dat de agent niet
   commit/pusht/installeert — de hoofdsessie levert. Een ongebriefde agent claimt succes zonder iets te draaien.

## Zwaarte per tier (F3, founder 2026-09-04)

Classificeer de wijziging eerst met `albunyaan-change-control` (T0–T3). Dan:

| Tier | Stappen | Review-log in de commit-tekst |
|---|---|---|
| **T0** puur docs/comments/skills | 3 (alleen "tegenspraak met CLAUDE.md?") | `Review-log: n.v.t. — docs-only (<wat>)` |
| **T0** read-only scripts, nieuwe tests | als T0/T1 licht (rij hieronder) | 3 regels |
| **T0/T1 licht** (≤ 100 gewijzigde regels) | 2 baseline · 3 koude review · 6 consolideren | 3 regels |
| **T0/T1 > 100 regels** | 1 bloat pre · 2 · 3 · 6 · 8 bloat post | 5 regels |
| **T2/T3 volledig** | 1 t/m 9 | 9 regels; T3 daarnaast founder-ja op de actie zelf |

Een stap die niet gedraaid is staat in de log als "niet gedraaid: <reden>; in plaats daarvan: <wat>" (regel 1).
**Aanscherping op change-control T0 "Gate: None" (B58):** ook T0 krijgt stap 3 en een Review-log-regel; de verwijsregel in
change-control r55 staat als hunk ter keuring in `CLAUDE.md.diff-rv2`.

## De negen stappen — met de afwijkingen van de bron

**1 Bloat-audit (pre)** — bron r82-103. Zoek: dode code, helpers met één aanroep, checks voor onmogelijke
condities, her-validatie, doorgeeffuncties, just-in-case-restanten. Onderzoek vóór je flagt (CLI-vlaggen, env,
dynamische aanroepen zijn onzichtbaar voor grep). Uitvoer: per bevinding STRIP (zelf-geïntroduceerd) / VRAAG
(pre-existing óf onder de uitzondering) / GEEN. **Elke stap-1-bevinding in een MODEL-FITNESS-gebied is een VRAAG,
nooit een strip.** Voeg een kopje *Lakmoesproef* toe: welke fail-closed-paden/tellingen/opruimcode je zag en of je
ze zonder de uitzondering had willen strippen (eerlijk).

**2 Baseline** — bron r105-114. Nu beschikbaar: `pnpm build` (Next), `cd worker && node_modules/.bin/tsc --noEmit`
(noteer bij stap 2 het aantal pre-existing fouten en eis dat het niet stijgt; gemeten 2026-09-04: 14 in 8 bestanden,
allemaal DOM-types in `page.evaluate`-callbacks en ontbrekende `playwright-core`-types — de "3" in het RV 1-rapport was een
`tail`-meetartefact), `cd worker && node_modules/.bin/vitest run` (5 bestanden, 35 tests op 2026-09-04),
`cd apps/web && pnpm lint` (tsc) en `pnpm test` (Playwright-structuurtest, start zelf een dev-server op :3012).
Schema/RLS geraakt → change-control review-eis 2 (`worker/verify-rls.ts`, exit 0). De zes e2e-harnesses
(`pnpm --filter @albunyaan/worker e2e`) alleen met lokale Supabase + Mailpit en na founder-ja (B53);
`e2e-playback-gate` nooit (⛔ B22). **Review-eis 3 (migrate.log / `/migration-status`) = n.v.t. sinds 2026-09-02**
(Bunny gestopt, B49) — log als "n.v.t.", niet als gedraaid; de ⛔-notitie in change-control r178 zelf staat als hunk ter
keuring in `CLAUDE.md.diff-rv2` (skills = grondwet). Noteer de baseline die niet mag regresseren.

**3 Koude code-review** — bron r116-125: bugs → security → correctness; lees als tegenstander. Verplichte
repo-checklist = change-control review-eisen: **1** geen tegenspraak met `CLAUDE.md` (lees hem opnieuw tegen de
diff), **4** grep de diff op `spawnSync` en `npx`, bevestig dat foutpaden opruimen, **5** blank-page-first als er
browserpagina's sluiten, **6** tellingen met paginering (1000-rij-clamp), **7** security-adjacent → stap 4/5.
Voor `spawnSync` geldt B56 (F1) **zodra de founder de bijbehorende hunk in `CLAUDE.md`/change-control heeft gekeurd**
(`~/projects/_scratch/CLAUDE.md.diff-rv2`, gouden regel 6a): verboden in alles met parallelle workers; elders alleen met
verantwoording in de commit-tekst én een commentaarregel bij de aanroep. **Tot die keuring geldt de strikte regel** van
`CLAUDE.md` ("never spawnSync in worker code") — deze skill verwijst naar B56, hij definieert regel 2 niet. Tweede lezer = een subagent met verse context (brief per regel 5).

**4 Security-review** — bron r127-136, alleen als een trust boundary geraakt wordt: auth · rollen/RLS ·
netwerkinvoer · opslag/paden · admin-paden · parsers · externe URL's · secrets · geld · proces-/gebruikersgrens.
"Geen boundary geraakt" is een **gelogd oordeel**, geen skip. Lokale hulp: `security-cso` (gepinde /cso-kopie,
rapporten naar `~/projects/_scratch/`, **niet** de repo in — `docs/review-pipeline/security/` is publiek; B51 is
ongeldig en staat open bij de founder, zie het kopje Review-log hieronder).

**5 Adversarial** — bron r138-146. Tot B20 beslist: een **tweede Claude-agent in een ander prompt-frame** met als
opdracht "vind wat stap 3 miste en beargumenteer dat de wijziging fout is" (huis-methode
`docs/security-findings-report.md:5`). Vraag om: per eerdere Important bevestigd/weerlegd/herwaardeerd met
bewijsregel, nieuwe bevindingen, "de zaak tegen" in ≤ 10 regels plus eerlijk oordeel of die stand houdt, en de
lakmoesproef. RV 1: deze stap leverde 14 nieuwe punten en 4 herwaarderingen — niet overslaan bij T2/T3.

**6 Consolideren** — bron r148-158: ontdubbelen (drie reviewers, één bug), ernst Critical/Important/Minor/Nit,
per punt FIX of DEFER met reden en vervolg, oordeel TERECHT/HERWAARDEERD/ONTERECHT. **Classificeer elke fix op
tier vóór hij wordt aangebracht** (B47): een fix in een stoplijst-gebied is T2 (stop-protocol), in een T3-gebied
een founder-vraag. Een bevinding die noch gefixt noch bewust uitgesteld is, is onafgehandeld.

**7 Patch en re-review** — bron r160-165. Alleen fixes die in stap 6 geclassificeerd zijn; T2 pas na het
stop-protocol; T3 pas na founder-ja. Draai de check die faalde opnieuw en zie hem groen worden — "gefixt" zonder
dat is geen fix. Voeg nooit twee keer dezelfde telling toe (RV 1 stap 8: 7 overlappen).

**8 Bloat-audit (post)** — bron r167-175, over de cumulatieve diff, zelfde regels en zelfde uitzondering als stap 1.
Zoek verweesde helpers, dode takken uit herwerkte fixes, dubbele tellingen. Bij T0/T1 > 100 regels ook.

**9 Geautomatiseerde eindpoort** — bron r177-202. Hier: **"de reviewers die gemeten en geïnstalleerd zijn."**
Stand 2026-09-07: `review-cold` (gepinde gstack-/review-kopie, ASK-modus), `security-cso`, **en Codex**
(`@openai/codex` 0.153.4, ingelogd op ChatGPT Plus — B20 JA, kost niets extra). Aanroep altijd read-only:
`codex exec --sandbox read-only -o <rapport.md> "<prompt>"`, of `codex exec review --base main`. De repo-root
heeft een `AGENTS.md` die Codex de invarianten, het leesverbod op geheimen en de ernst-schaal meegeeft —
werkregel 7 (gedelegeerd werk erft niets) is daarmee voor Codex ingevuld.

**Cubic is toegelaten sinds 2026-09-17** (B19 HERZIEN naar JA, founder; de NEE van 07-09 stond op een verkeerde
meting — de repo is niet privé maar publiek sinds haar aanmaak op 2026-07-12, en Cubic is op publieke repos
gratis en onbeperkt). Binair: `~/.cubic/bin/cubic` (1.11.0), ingelogd op cubic.dev via GitHub; credential in
`~/.local/share/cubic/auth.json` (0600, NOOIT in de repo of een log).

**De CLI is vóórcontrole, de PR-review is de poort.** Lokale uitvoer sluit stap 9 nooit — ze bespaart alleen een
ronde door problemen te vinden vóór de push. Wat stap 9 sluit is de Cubic-review **op de PR**. Aanroep vanuit de
repo-root:

    ~/.cubic/bin/cubic review -j                        # ongecommitte wijzigingen — de gewone vóórcontrole
    ~/.cubic/bin/cubic review --base exit-phase -j      # dezelfde diff als de PR straks krijgt
    ~/.cubic/bin/cubic review --commit <sha> -j         # één commit

✅ **Stand 2026-09-17 08:14 — Cubic draait, bewezen.** De GitHub-App staat op
`crypto-boss-user/albunyaan-platform` (founder-klik); daarmee werkt ook de CLI — de eerdere
`"No active subscription"` is weg. Proef op commit `7024687` (1.549 ins., 29 code-bestanden): **2 P1-bevindingen**,
beide waar en beide precies de invariant uit `CLAUDE.md` (stille 1000-rijen-klem van Supabase REST):
`packages/core/src/data/admin-settings.ts:48` (`listPlatformAdmins()` zonder paginering of telcontrole) en
`packages/core/src/data/admin-plans.ts:79` (`createPlanAdmin()` leidt `volgorde` af uit één `.limit(1000)`).
Dit is bewijs dát Cubic werkt, **geen geslaagde poort**: die twee P1's staan nog open op `7024687` en moeten
gefixt of met founder-ja uitgesteld worden vóór die commit als gepiped geldt.
Cubic leest de repo-context dus echt mee. (Beide bevindingen zijn latent: 2 beheerders, 11 plannen.)

⚠️ **Exit-codes zeggen op zichzelf niets — lees altijd de JSON.** Gemeten:
`exit 0` + `"issues": []` = review liep en vond niets · `exit 1` + gevulde `issues` = bevindingen ·
`exit 1` + een `error`-sleutel = de review liep **niet** (`"No active subscription."`,
`"No uncommitted changes to review."`). Een lege `issues` telt dus alleen als schoon bij **exit 0 en geen
`error`-sleutel**; in elk ander geval is stap 9 niet gedraaid en zegt de log dat (regel 1).

De JSON-sleutel is `issues`. Cubic leest zelf `CLAUDE.md`, `AGENTS.md` en `.claude/skills/` als context, dus de
invarianten en de ernst-schaal reizen mee — werkregel 7 is daarmee ook voor Cubic ingevuld; geen aparte
config nodig. `git-ai` (de code-statistiek-component van het installatiescript) is **bewust niet** geïnstalleerd
(`CUBIC_DISABLE_GIT_AI=true`): niet nodig voor reviews, en het haakt in git.

⚠️ **Stille-fout-val, fail-closed behandelen.** `-b`/`--base` verwacht een waarde. `cubic review --json -b`
(zonder branchnaam) eindigt met exit 0 en `"issues": []` — niet te onderscheiden van een schone review
(gemeten door derden: github.com/pleaseai/shunt#514). Daarom: **nooit een kale `-b`**, en een lege
uitslag telt pas als "schoon" nadat je hebt vastgesteld dát er een review liep (uitvoer niet leeg, geen
interne foutcode). Een lege `issues`-lijst zonder die vaststelling is een **niet-gedraaide stap 9**, niet een groene.

**PR-werkwijze (founder 2026-09-17).** De gratis Cubic-laag leest **pull requests**, niet lokale diffs. Daarom
landt werk vanaf nu via een PR in plaats van een directe commit op `exit-phase`:

    git switch -c stap/<korte-naam> exit-phase    # altijd expliciet vanaf exit-phase
    …werk + commit met de Review-log-regel…
    git push -u origin stap/<korte-naam>
    gh pr create --base exit-phase --title "<wat>" --body "<stappen 1-9, negen regels>"

**Alleen de hoofdsessie pusht en opent de PR.** Voor gedelegeerd werk blijft `AGENTS.md` r13 onverkort gelden
(commit niet, push niet, open geen PR, installeer niets) — werkregel 7. Een subagent levert de diff, de
hoofdsessie brengt hem naar buiten.

**Verifieer dat de PR-review echt liep** — dezelfde fail-closed regel als bij de CLI. Een PR zonder afgeronde
Cubic-check is een niet-gedraaide stap 9, geen groene. Vraag de check **altijd op de actuele kop van de PR** op,
nooit op een losse `<sha>`: een check op een oudere commit is een oude uitslag die niets zegt over de huidige diff.

    SHA=$(gh pr view <nr> --json headRefOid --jq .headRefOid)     # de kop van dit moment
    # 1 de check moet op DEZE sha staan, completed zijn én conclusion success hebben:
    gh api repos/<owner>/<repo>/commits/$SHA/check-runs \
      --jq '[.check_runs[] | select(.app.slug=="cubic-dev-ai" and .status=="completed"
             and .conclusion=="success")] | if length==1 then .[0].output.summary else "RONDE TELT NIET" end'
    # 2 alleen de bevindingen die bij DEZE sha horen (commit_id), niet alle comments op de PR.
    #   Let op: `gh api --jq` neemt GEEN --arg ("accepts 1 arg(s), received 4") — pipe naar jq:
    gh api repos/<owner>/<repo>/pulls/<nr>/comments \
      | jq -r --arg s "$SHA" '.[] | select(.user.login|startswith("cubic"))
             | select(.commit_id==$s) | .body | split("\n")[0]'

Elke andere uitkomst dan precies één `completed` + `success` op deze sha = **ronde telt niet**: `in_progress`,
afwezig, `failure`, `neutral`, of een check die bij een oudere sha hoort. De bevindingen staan als **inline
review-comments** en worden op `commit_id` aan de sha gebonden — een telling over alle PR-comments mengt oude
rondes door de nieuwe. Een `success`-check met bevindingen is geen schone ronde: `success` zegt alleen dat de
review liep, de inline-comments zeggen wat hij vond.

**De twee schone rondes zijn twee verschillende kop-sha's.** Eén ronde = één afgeronde Cubic-check op één
kop-sha. De poort sluit pas als **twee opeenvolgende kop-sha's** een afgeronde check hebben. Noteer beide sha's
plus hun uitslag in het stap-9-record; twee keer dezelfde sha is één ronde, en een lege lijst zonder afgeronde
check telt niet mee. Komt er een fix-push bij, dan begint de telling opnieuw vanaf die nieuwe kop.

⚠️ **"Schoon" = nul openstaande P0/P1 op de huidige kop — niet "geen níeuwe".** Een P1 uit ronde 1 die niet
gefixt is, is in ronde 2 niet meer "nieuw" en zou de poort anders laten sluiten met een open P1. Het onderscheid
nieuw/al-gezien dient alleen om rondes te tellen en dubbele meldingen te herkennen; het verlaagt de lat niet.
P0/P1 blokkeren tot ze gefixt zijn of met founder-ja uitgesteld staan (met reden en vervolgstap, stap 6).

Cubic reviseert de PR automatisch. De PR-tekst draagt het stap-record (bron r232-238: negen regels, één per
stap, elk met uitslag of de reden dat hij niet liep). Stap 9 sluit als **twee opeenvolgende Cubic-rondes** geen
nieuwe P0/P1 geven — na elke fix-push opnieuw. Mergen naar `exit-phase` pas daarna. De Review-log-regel in de
commit-tekst blijft gelden (B50, de hook keurt hem); de PR-tekst vervangt hem niet.

Geen gstack-binaries. Meld in de log letterlijk wat niet draaide en waarom.
**Ernst-vertaling** (stap 6 gebruikt Critical/Important/Minor/Nit, Cubic P0–P3): P0 = Critical, P1 = Important,
P2 = Minor, P3 = Nit. Blokkeren doet wat in deze repo Critical/Important is, dus P0/P1.

Exit-regel als de bron: twee opeenvolgende rondes zonder nieuwe P0/P1; P0/P1 blokkeren, P2 fixen tenzij scope
expliciet smaller, P3 is oordeel. Nooit terwijl een andere sessie in dezelfde bestanden schrijft.

## Het record: Review-log in de commit-tekst (B50)

Geen nieuwe status-.md per review. De **eerste regel** van elke commit-tekst begint met `Review-log:` (founder-instructie
RV 1/RV 2, 2026-09-04; de check accepteert de regel ook lager, B50 zegt "in de commit-tekst"); de WS-/docs-prefix met *wat er
landde* (change-control commit-conventie r123) komt op regel 3, na de lege regel — die botsing staat als hunk ter keuring in
`CLAUDE.md.diff-rv2` (aanname, aanpasbaar: subject-eerst + Review-log in de body is de alternatieve vorm). Daarna één regel
per gedraaide of luid overgeslagen stap. Voorbeeld T1 licht:

```
Review-log: 2 baseline vitest 35/35, tsc 3 pre-existing; 3 cold review subagent 2 Minor gefixt; 6 geconsolideerd 2/2 FIX
```

Docs-only: `Review-log: n.v.t. — docs-only (<wat>)` — de reden ná het streepje is verplicht, anders weigert de
commit-check (`.claude/hooks/review-log-check.py`, repo-eigen `.claude/settings.json`, B50). Rapporten van
mini-tests en audits: `docs/review-pipeline/`. **Security-rapporten (/cso) sinds 2026-09-17 NIET in de repo** —
`docs/review-pipeline/security/` is publiek, net als de rest van de repo; tot het nieuwe founder-besluit (B51 ongeldig, staat
OPEN in plan §5) gaan ze naar `~/projects/_scratch/` — dat geldt voor stap 4 én voor losse /cso-rondes, er is
geen uitzondering. Meetrondes:
`~/projects/_scratch/`. Commit-teksten en rapporten bevatten **geen letterlijke gevaarlijke commando's** (B54: de
globale guardrail matcht op de hele commandotekst, ook in heredocs).

## Model en effort

Geen eigen modelregel (B48): het stop-protocol van `albunyaan-change-control` (MODEL FITNESS) geldt — een
Sonnet-klasse sessie stopt vóór stoplijst-gebieden en vraagt om `/model` / `/effort`. Controleer welk model draait
vóór T2-werk; gemeten 2026-09-03: globale default `claude-fable-5-1[1m]`, effort high (`~/.claude/settings.json`; meetlog RV 0
§1.2, lokaal in `_scratch`).

## Wat deze skill niet doet

Geen hooks of globale settings wijzigen (B23); geen installaties (elke `pnpm add` = founder-ja); de harnesses niet
draaien zonder lokale stack (B53); Bunny nergens als werkend rapporteren (⛔ `CLAUDE.md`).
