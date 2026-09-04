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
rapporten in `docs/review-pipeline/security/`, B51).

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
Stand 2026-09-04: `review-cold` (gepinde gstack-/review-kopie, ASK-modus) en `security-cso` — geen Cubic
(B19 open), geen Codex (B20 open), geen gstack-binaries. Meld in de log letterlijk wat niet draaide en waarom.
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
mini-tests, audits en /cso: `docs/review-pipeline/` (security in `docs/review-pipeline/security/`, map aangemaakt in RV 2). Meetrondes:
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
