# AGENTS.md — brug naar CLAUDE.md voor externe agents (Codex e.a.)

**`CLAUDE.md` in deze repo-root is de bovenliggende norm.** Bij elke tegenspraak wint `CLAUDE.md`.
Dit bestand herhaalt alleen wat een externe agent moet weten die `CLAUDE.md` niet automatisch laadt.

Dit project is het **Albunyaan-platform**: een zelfgebouwd OTT-platform dat Uscreen vervangt.
pnpm-monorepo, Next.js in `apps/web`, migratiescripts in `worker/`, Supabase als datalaag.

---

## 1. Twee modi — de opdracht zegt welke geldt

**In beide modi:** commit niet, push niet, open geen PR, installeer niets (geen npm-pakket, geen
brew-formule, geen globale tool), en draai nooit een script uit `worker/` — die praten met productie,
met Uscreen of met het NAS-archief.

### Modus A — REVIEW (standaard, `--sandbox read-only`)

Je bent reviewer, geen bouwer. **Wijzig geen enkel bestand.** Lever bevindingen als tekst met per
bevinding een **vindplaats `bestand:regel`**. Een bevinding zonder vindplaats is hier waardeloos.

### Modus B — FIX (alleen als de opdracht dat expliciet zegt, `--sandbox workspace-write`)

Je mag bestanden wijzigen, maar onder deze voorwaarden:

- **Alleen de bevindingen die de opdracht noemt.** Geen extra "verbeteringen", geen herformattering,
  geen refactor die niemand vroeg. Zie sectie 4: dit project straft ongevraagde opruiming af.
- **Bewijs elke fix.** Draai ná de wijziging de check die eerst faalde en laat zien dat hij groen wordt.
  "Gefixt" zonder een groene herhaling telt hier niet als gefixt.
  - typecontrole: `cd apps/web && npx tsc --noEmit`
  - build: `cd apps/web && pnpm build`
  - één Playwright-spec: `cd apps/web && pnpm exec playwright test tests/<naam>.spec.ts --workers=2`
- **Raak het betaalmodel niet aan.** `plans`, `stripe_price_id`, alles onder `subscriptions/` dat prijs
  of interval schrijft, en elke migratie: laat staan en meld het als vraag. Dat vereist een apart
  stopprotocol en een besluit van de eigenaar.
- **Geen schemawijziging, geen migratie, geen RLS-policy.**
- Blijkt een fix groter of risicovoller dan hij leek: **stop en meld dat**, in plaats van door te zetten.
- Sluit af met per bevinding: gewijzigde bestanden, wat je draaide, en de uitkomst.

## 2. Bestanden die je NOOIT leest of citeert

Deze bevatten productiegeheimen. Ze staan in `.gitignore` maar wél op schijf:

```
.env
.env.*
apps/web/.env.local
worker/.env
~/.albunyaan-cc/**          (o.a. cloud.env: Supabase service-role, Bunny API-sleutel)
var/**
```

Neem **nooit** een sleutelwaarde, token of wachtwoord over in je uitvoer — ook niet gedeeltelijk,
ook niet "als voorbeeld". Kom je er per ongeluk een tegen, meld dan alleen dát je hem zag en waar.

Geen persoonsgegevens van leden in je uitvoer: geen e-mailadressen, geen namen, geen betaalgegevens.
Totalen en aantallen mogen wel.

## 3. Invarianten van dit project — beoordeel hiertegen, stel ze niet ter discussie

Deze zijn met opzet zo. Melden dat ze "fout lijken" is ruis; melden dat code ze **schendt** is waardevol.

1. **RLS is deny-by-default.** De datalaag is bewust service-role-only. Echte policies + auth zijn
   vereist vóór elke publieke deploy — dat is bekend en gepland, geen nieuwe bevinding.
2. **Bunny is dood.** Het Bunny-account is op 2026-09-02 door de eigenaar gestopt. `bunny_video_id`
   en de bijbehorende iframes werken niet meer. De code blijft met opzet staan tot het
   opvolgerplatform gekozen is. Rapporteer Bunny **nergens** als werkend, en stel geen Bunny-werk voor.
3. **Uscreen niet aanraken.** Elke schrijfactie richting `app.uscreen.tv` is verboden. De
   admin-recreatie is een *nabouw*; hij mag Uscreen nooit aanroepen.
4. **Supabase REST kapt pagina's af op 1000 rijen, stil.** Elke query die meer kan opleveren moet
   pagineren of `count=exact head` gebruiken. Een ongepagineerde `range` over 1000 rijen is een
   **echte bug** — meld die.
5. **Nooit `spawnSync` in iets met parallelle workers** (blokkeert de event loop en serialiseert
   "parallelle" workers stilletjes). Strikt sequentiële CLI-scripts zijn de uitzondering.
6. **Nooit `npx` / `npm exec` voor worker-scripts** — die hangen onvoorspelbaar. Altijd het directe
   binary: `node_modules/.bin/tsx worker/<script>.ts`.

## 4. Wat in deze repo GEEN bloat is (vaste uitzondering, "B47")

Meld deze niet als "overbodig" of "kan simpeler":

- **fail-closed paden** — code die bij twijfel dichtgooit in plaats van doorlaat;
- **tellingscontroles** — dubbele verificatie van aantallen na een import of migratie;
- **opruimcode** — cleanup in `catch`/`finally`, ook als het pad zeldzaam lijkt;
- **dubbele validatie op een trust boundary** (bv. zowel bij het lezen als bij het schrijven).

Elk van deze patronen staat er na een echt incident. Ze weghalen heropent dat incident. Twijfel je,
stel dan een **vraag** in plaats van een verwijderadvies.

## 5. Waar je wél naar moet zoeken

- **Autorisatie:** ontbrekende `requireAdmin`, een route of server action die een rol niet afdwingt,
  een knop die iets toont dat de gebruiker niet mag, MFA-stepup die omzeild kan worden.
- **Trust boundary:** ongevalideerde invoer die in een query of een schrijfactie belandt; open
  redirects; injectie.
- **Datacorrectheid:** verkeerde noemer in een percentage, verkeerde periode-afbakening, de
  1000-rij-clamp, een telling die iets anders telt dan het label belooft.
- **Conditionele bijeffecten:** een schrijfactie die alleen in sommige takken gebeurt.
- **Testdekking:** een test die iets anders bewijst dan zijn titel claimt; een test zonder
  `finally`-opruiming die testdata laat staan.

## 6. Ernst-schaal die dit project gebruikt

`Critical` (blokkeert) · `Important` (moet vóór productie) · `Minor` (moet, niet blokkerend) ·
`Nit` (oordeel). Gebruik deze woorden letterlijk, dan sluit je rapport aan op de bestaande
review-pipeline in `.claude/skills/review-pipeline/`.
