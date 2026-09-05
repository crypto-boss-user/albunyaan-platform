# Review-pipeline — hoe we hem gebruiken (in gewone taal)

STATUS: ingevoerd 2026-09-04 (RV 2, plan §3.4), na meting (RV 0) en één proef op een echte commit (RV 1). Beslissingen: plan §5 B46–B60.

## Waarom

AI-geschreven code faalt op een voorspelbare manier: het compileert, de tests slagen, en toch zit er een dode helper in, een dubbele controle, een ingeslikte fout of een gat in een vertrouwensgrens. Eén reviewer ziet dat niet, omdat één reviewer één blik heeft. De pipeline stapelt blikken (bloat, correctheid, security, tegenspraak, automatisch) en sluit pas af als er niets nieuws meer komt.

Voor deze repo geldt bovenop de negen stappen één harde regel die het collega-document niet kent: **fail-closed-paden, tellingscontroles en opruimcode zijn nooit bloat** — ook niet als de wijziging ze zelf introduceert. Een reviewer mag vragen "is deze guard nodig, en waarom?", maar nooit "haal weg". Elk van die guards is met een incident betaald (zie `albunyaan-change-control`). In de proef van 4 september zeiden twee reviewers letterlijk dat ze zonder die zin een tellingscontrole hadden geschrapt, en dat dat fout was geweest.

## De drie bestanden

| Bestand | Wat |
|---|---|
| `.claude/skills/review-pipeline/SKILL.md` | de negen stappen, de vijf regels, de zwaarte per tier, de bloat-uitzondering, de commit-conventie — **de norm** |
| `.claude/skills/review-cold/` | lokale, gepinde kopie van gstack `/review` (checklist + 8 specialisten + adversarial-sectie), alleen ASK: bewerkt nooit code |
| `.claude/skills/security-cso/` | lokale, gepinde kopie van gstack `/cso` (security-audit); rapporten in `docs/review-pipeline/security/` |

Bron van de negen stappen: `bron-collega-9-stappen-pipeline.md`. Metingen: `RV1-mini-test-91a5c1c.md` (de proef) en het RV 0-rapport in `~/projects/_scratch/`.

## Hoe zwaar, per soort wijziging

Eerst classificeer je de wijziging met `albunyaan-change-control` (T0 docs · T1 gewone code · T2 stoplijst-gebieden · T3 founder-sign-off). Dan:

| Wat je verandert | Welke stappen | Wat er in de commit-tekst komt |
|---|---|---|
| Alleen docs, comments, skills | stap 3: "spreekt dit CLAUDE.md tegen?" | `Review-log: n.v.t. — docs-only (<wat>)` |
| Gewone code, tot 100 regels | 2 baseline · 3 koude review · 6 consolideren | drie regels, één per stap |
| Gewone code, meer dan 100 regels | 1 bloat vooraf · 2 · 3 · 6 · 8 bloat achteraf | vijf regels |
| Stoplijst-gebied of founder-actie (T2/T3) | alle negen | negen regels; T3 ook founder-ja op de actie zelf |

Een stap die niet kon draaien staat er tóch in: "niet gedraaid: <reden>; in plaats daarvan: <wat>". Stil overslaan is de enige echte overtreding.

## De commit-conventie in één zin

De eerste regel van elke commit-tekst begint met `Review-log:`. Een check in de repo (`.claude/settings.json` → `.claude/hooks/review-log-check.py`) weigert een `git commit` zonder die regel. Voor docs-only commits is `Review-log: n.v.t. — <reden>` de uitdrukkelijke uitzondering; de reden is verplicht, zodat de poort nooit stil blokkeert. Bewijs dat hij werkt: 43 stdin-testgevallen op 2026-09-04 (geweigerd/doorgelaten zoals bedoeld); sinds 2026-09-05 (B77, `6d1b3eb`) keurt hij ook elk commit-segment in een samengesteld commando (`git status; git commit …`, subshell, accolades, `VAR=`-prefix, `#`-commentaar) — 34/34 nieuwe gevallen + 83/87 oude, harness in `~/projects/_scratch/rv-hook-harness/`; sinds B80 (`f484be7`, 05-09) ook wrappers (`env`/`command`/`exec`/`nice`/`time`/`caffeinate` vóór `git`) en git-globale vlaggen vóór `commit` (`git -P commit`, `-c x=y`, `-C pad`, …), fail-closed bij onbekende vormen — 76/76 B80-gevallen. **Hook = AF** (founderbesluit 05-09): verdere bypass-vondsten worden in plan §5 B80 genoteerd, niet gebouwd; `-F`-TOCTOU en `bash -c` blijven bewust open. Let op: de check is in een lopende Claude Code-sessie pas actief na een herstart. De tabel hierboven is een samenvatting; de norm met de exacte regels staat in de skill.

## Wat de baseline nu is (stap 2)

- `pnpm build`, `cd worker && node_modules/.bin/vitest run` (35 tests op 2026-09-04), `cd worker && node_modules/.bin/tsc --noEmit` (14 pre-existing fouten op 2026-09-04 — mag niet stijgen), `cd apps/web && pnpm lint` (typecheck, 0).
- `cd apps/web && pnpm test`: één Playwright-structuurtest (footer, 6 links); start zelf een dev-server op poort 3012 en stopt hem weer.
- De zes worker-harnesses (`pnpm --filter @albunyaan/worker e2e`): één commando, na elkaar, poort 3012, beide uitvoerconventies gelezen. Ze vereisen een lokale Supabase + Mailpit en draaien alleen na founder-ja. `e2e-playback-gate` is ⛔ (Bunny gestopt) en wordt standaard overgeslagen met melding.
- Niet meer geldig: de oude review-eis "kijk in migrate.log of een echte transfer slaagde" — Bunny is gestopt (2 september 2026).

## Wat we bewust niet doen

- Geen Cubic, geen Codex, geen gstack-installatie (beslissingen open of nee; alleen wat gemeten en aanwezig is telt als stap 9).
- Geen wijziging aan de globale `~/.claude`-instellingen; alleen deze repo heeft een `.claude/settings.json`.
- Geen plugin-tekst overnemen zolang de licentie niet bevestigd is.
- Geen letterlijke gevaarlijke commando's in commit-teksten of rapporten (de globale guardrail leest de hele commandotekst mee).

## Wat de subagent-brief altijd bevat (regel 5)

De vijf regels (geen stil overslaan · nooit bestaande code weg zonder ja · bewijs, geen bewering · fix-rondes kweken bloat · gedelegeerd werk erft niets), de bloat-uitzondering, de baseline die niet mag regresseren, de bestanden die niet aangeraakt mogen worden, en: niet committen, niet pushen, niets installeren. Een agent zonder die brief claimt succes zonder iets te draaien — dat is gemeten, geen vermoeden.
