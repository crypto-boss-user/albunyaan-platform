# Codex-review van het adminoppervlak (AD 0 t/m AD 2) — 2026-09-07

**Dit is de eerste keer dat stap 9 van de review-pipeline écht gedraaid heeft** in plaats van luid te
worden overgeslagen. Sinds RV 1 (2026-09-04) stond in elke commit-review-log "geen Cubic (B19 open),
geen Codex (B20 open)". Beide zijn nu beslist.

## Opzet

| | |
|---|---|
| **Reviewer** | `@openai/codex` 0.153.4, ingelogd op ChatGPT **Plus** (`fitrahtvnl@gmail.com`, plan `plus`) |
| **Kosten** | €0 — verbruik loopt op het bestaande abonnement, geen API-sleutel, geen aparte factuur |
| **Modus** | `codex exec --sandbox read-only` — Codex kon niets schrijven, committen of installeren |
| **Sturing** | `AGENTS.md` in de repo-root (invarianten, leesverbod op geheimen, ernst-schaal) |
| **Omvang** | Het volledige adminoppervlak (110 bestanden), in vier gerichte passes |
| **Duur** | 15:03:59 → 15:14:10, vier passes, alle exit 0, **geen rate limit geraakt** |
| **Opbrengst** | **16 bevindingen** (5 Important, 10 Minor, 1 Minor-UI) + **3 vragen** |
| **Privacy** | ChatGPT-databeheer *"Improve the model for everyone"* stond **uit**; de consent-pagina bevestigt dat die instelling ook voor Codex geldt. De broncode verlaat wél de machine richting OpenAI — dat is de prijs van B20. |

Codex vond geen server-side autorisatiegat, geen open redirect en geen 1000-rij-afkapping. Het bevestigde
expliciet dat de AD 2.3-fixes standhouden: prijs- en proefdaggrenzen worden in de datalaag afgedwongen,
en `rol` / `status` / `stripe_price_id` zijn niet van buitenaf te zetten.

**Steekproefcontrole (verificatie dat Codex niet fabuleert):** vier bevindingen zijn handmatig tegen de
broncode gelegd — A-1, C-1, C-3 en D-2. Alle vier correct, met exacte regelnummers. D-2 bleek zelfs
scherper dan Codex zelf stelde.

---

## Bevindingen en triage (pipeline-stap 6)

Ernst · oordeel · **FIX / DEFER / VRAAG** met reden. Een bevinding die noch gefixt noch bewust uitgesteld
is, is onafgehandeld — daarom is elke regel geclassificeerd.

### Pass A — autorisatiegrens

Codex las **alle 28 server actions in 8 bestanden**. 26 vereisen de volledige admincontrole met
minimumrol; de twee MFA-actions vereisen sessie + roster en voeren TOTP-verificatie uit. **De servergrens
houdt stand.**

| # | Ernst | Bevinding | Vindplaats | Oordeel |
|---|---|---|---|---|
| **A-1** | Minor | UI biedt Delete/Save aan rollen die de action daarna weigert. Support/editor krijgt een volledige bevestigingsflow voor een verboden actie. | `collections/page.tsx:71`, `videos/[id]/EditVideoForm.tsx:59`, `categories/[id]/page.tsx:99`, `custom-filters/page.tsx:31` | TERECHT → **FIX** |

> **Waarom dit ertoe doet:** dit is exact de bug die AD 2.3 (I-1) al ééns fixte voor *subscriptions*
> (`hasRole` → `magBewerken`, Delete-knop uit met reden). Die fix is **nooit doorgetrokken** naar de vier
> andere lijsten. Een buiten-model-reviewer zag de inconsistentie die de huis-reviewers misten omdat zij
> per commit keken, niet over het oppervlak.

**Vraag A-i:** moeten de drie legacy-redirectpagina's (`members/page.tsx:8`, `members/[id]/page.tsx:8`,
`vouchers/page.tsx:7`) ook expliciet `requireAdmin()` aanroepen? Ze verwijzen alleen naar beschermde
bestemmingen; geen datatoegang zonder MFA gevonden. → **VRAAG teamreview** (consistentie, geen gat).

### Pass B — server actions en invoervalidatie

| # | Ernst | Bevinding | Vindplaats | Oordeel |
|---|---|---|---|---|
| **B-1** | **Important** | Filter + opties worden in losse inserts opgeslagen zonder transactie. Faalt optie 2, dan blijft een half filter staan; opnieuw indienen strandt op "already exists" — en de editor kan het niet zelf opruimen, want delete eist admin. | `packages/core/src/data/admin-content.ts:394` ← `custom-filters/actions.ts:17` | TERECHT → **DEFER** |
| **B-2** | Minor | `.slice(0, 50)` kapt opties af vóór validatie en meldt daarna "Filter created". Het formulier noemt de grens niet. | `custom-filters/actions.ts:14` | TERECHT → **FIX** |
| **B-3** | Minor | Dubbel indienen geeft twee opties met hetzelfde label; de unique-constraint op `(filter_id, slug)` pakt het niet omdat de slug op tijdstip gebaseerd is. | `admin-content.ts:410` | TERECHT → **DEFER** |
| **B-4** | Minor | Dubbel indienen na een verloren antwoord maakt een tweede plan met andere `external_id`. | `admin-plans.ts:84` ← `subscriptions/actions.ts:33` | TERECHT → **DEFER** |

**DEFER-reden B-1/B-3:** een echte fix vraagt een transactie of een compenserende delete in de datalaag —
schemawerk, dus T2 (stop-protocol) en geen losse patch tussendoor.
**DEFER-reden B-4:** `plans` is het betaalmodel. AD 2.3 classificeerde dat gebied als T2; idempotentie
daar raakt aan wat er straks afgerekend wordt. Niet zonder stop-protocol en founder-blik.

**Vraag B-i:** `subscriptions/actions.ts:24` noemt `onetime` "alleen behouden", maar accepteert de waarde
ook bij aanmaken en bij omzetting van een periodiek plan. Bedoeld of niet? → **VRAAG founder**
(raakt AD 2.3 N-3 rechtstreeks).

### Pass C — datacorrectheid van de cijfers

Geen 1000-rij-afkapping: alle tellingen gebruiken exacte HEAD-verzoeken en databasefouten worden
doorgegooid. De bewust lege betaal-/kijkmetingen zijn correct niet als bug aangemerkt.

| # | Ernst | Bevinding | Vindplaats | Oordeel |
|---|---|---|---|---|
| **C-1** | **Important** | `Upgraded`, `Downgraded` en `Pending Pausing` staan hardcoded op `0`; de datalaag telt die statussen niet. Zo'n persoon telt wel als Member maar ontbreekt in de Active-groep. | `analytics/people/page.tsx:22` (weergave `:44`), `admin-stats.ts:36` | TERECHT → **FIX** |
| **C-2** | Minor | Het label van de vorige periode trekt een hele dag van `since` af, terwijl de query tot exclusief `since` telt. Een aanmelding op de tussenliggende dag telt mee maar valt buiten het getoonde bereik. | `analytics/shell.tsx:77`, `admin-stats.ts:46` | TERECHT → **FIX** |
| **C-3** | Minor | De huidige periode heeft **geen bovengrens**: `signup_at >= since` zonder `.lt(tot)`. Een toekomstig gedateerde rij telt mee in "de afgelopen periode". | `admin-stats.ts:45`, en `countSignupsSince` op `:12` (Home) | TERECHT → **FIX** |
| **C-4** | Minor | "Past 12 months" rekent met 365 dagen; twaalf kalendermaanden kunnen er 366 zijn. | `analytics/shell.tsx:15`, berekening `:31-32` | TERECHT → **FIX** |

**Vraag C-i:** is de gekozen noemer (de som van activiteitsstatussen) de bedoelde productdefinitie? Bij
90 gewone actieve leden en 10 nieuwe leden toont "Active Members by Activity Status" `New: 100%`.
→ **VRAAG teamreview** (raakt de AD 2.5 I-2-fix; die verving één verkeerde noemer door deze).

### Pass D — gedeelde UI en tests

| # | Ernst | Bevinding | Vindplaats | Oordeel |
|---|---|---|---|---|
| **D-1** | **Important** | Settings-test zet opslaan/terugzetten/opruimen niet in `try/finally`. Faalt de assertie, dan houdt `user_fields.field_1` de testwaarde en blijven settings- en auditrijen staan. | `admin-settings.spec.ts:102`, `:110`, `:125` | TERECHT → **FIX** |
| **D-2** | **Important** | De opruiming verwijdert testplannen van **andere, gelijktijdige runs**: het DELETE-filter is de algemene prefix `TEST-AD2-plan%` en de meegegeven `id` beperkt de query niet — die dient alleen de guard. | `admin-subscriptions.spec.ts:128`, helper `tests/lib/supabase-rest.ts:133` | TERECHT → **FIX** |
| **D-3** | **Important** | De id wordt pas ná `waitForURL` vastgelegd; mislukt de redirect terwijl de create wél schreef, dan ruimt `finally` niets op. | `admin-content.spec.ts:78`, `:140`, `:172`, `:212` | TERECHT → **DEFER** |
| **D-4** | Minor | De kop-checkbox "select all" synchroniseert alleen op `change` en niet op gewijzigde zoekparameters; na Next blijft hij aangevinkt terwijl de bulkbalk `0 selected` toont. | `components/admin/VideoListControls.tsx:9`; gebruik `videos/page.tsx:91`, `:155` | TERECHT → **FIX** |
| **D-5** | Minor | De "racebestendige" telling kan een correct resultaat afkeuren: een parallelle spec maakt aan én verwijdert, waardoor de UI-waarde buiten het interval `[N, N]` valt. | `admin-analytics.spec.ts:81`, `:88`, `:93`; `admin-videos.spec.ts:15`, `:19` | TERECHT → **DEFER** |
| **D-6** | **Important** | De controle op geheime waarden leest alleen `main.innerText()`. Input-`value`'s en HTML-attributen zitten daar niet in — een geheim in een integratie-input blijft groen. | `admin-settings.spec.ts:74` | TERECHT → **FIX** |
| **D-7** | Minor | De pagineringstest controleert alleen de tekst "Showing 51–100 of", niet de rij-inhoud. Negeert de query de offset terwijl het label uit `page=2` komt, dan blijft de test groen. | `admin-videos.spec.ts:43` | TERECHT → **FIX** |

**DEFER-reden D-3:** de fix vraagt een herontwerp van hoe de content-specs hun id bemachtigen (REST-lookup
op de eigen prefix vóór de redirect). Dat raakt vier testblokken tegelijk en verdient een eigen ronde.
**DEFER-reden D-5:** dit is de bekende, al eerder waargenomen flake in `videos-detail`/`catalog`
(review-logs `aab30cb`, `17e548a`). Echte isolatie vraagt een eigen testdatabase of serialisatie —
een aparte beslissing, geen patch.

---

## Stand van de triage

| | Aantal |
|---|---|
| **FIX — aangebracht en groen** | 10 — D-1, D-2, D-6, D-7 (`a922993`) · A-1, B-2, C-1, C-2, C-3, C-4 (`2fcd7bd`) |
| **DEFER** met reden | 6 — B-1, B-3, B-4, D-3, D-4, D-5 |
| **VRAAG** | 3 — A-i (teamreview), B-i (founder), C-i (teamreview) |
| **ONTERECHT** | 0 |

Geen enkele bevinding is onafgehandeld.

**D-4 is tijdens stap 7 van FIX naar DEFER verplaatst.** De kop-checkbox in `VideoListControls.tsx`
stuurt de bulk-selectie aan; hem laten reageren op gewijzigde zoekparameters is geen losse regel maar
een gedragswijziging in een pad zonder test die dat gedrag vastlegt. Eerst die test, dan de fix —
anders is het een blinde wijziging in precies het soort pad waar deze review er vier van vond.

**Bewijs stap 7:** `a922993` admin-settings + admin-videos + admin-subscriptions + raamwerk 6/6 (1,6 min);
`2fcd7bd` admin-analytics + admin-content + admin-videos + admin-home + admin-raamwerk 10/10 (6,3 min),
opruimtellingen alle 0. tsc 0 en `pnpm build` exit 0 bij beide.

---

## Wat dit zegt over de pipeline

1. **Een buiten-model-reviewer vindt een ander soort bug.** De huis-reviewers (Claude-subagenten) werken
   per commit en zagen elke AD-stap los. Codex kreeg het hele oppervlak en vond daardoor **inconsistenties
   tussen stappen** — A-1 is een fix die in AD 2.3 wél en op vier andere plekken níet is aangebracht.
2. **Codex controleert claims van eerdere fixes.** D-2 laat zien dat de AD 2.3 I-2-fix zwakker is dan zijn
   eigen commit-tekst zegt ("eigen prefix + eigen id" — de id beperkt de DELETE niet). C-2 doet hetzelfde
   voor de AD 2.5 N-13-fix. Dat is precies wat een tweede lezer moet doen.
3. **Testkwaliteit was het zwakste gebied.** Vijf van de zeven D-bevindingen gaan over tests die groen
   kunnen zijn terwijl de functie stuk is (D-6, D-7) of die rommel achterlaten (D-1, D-2, D-3).
4. **De invarianten uit `AGENTS.md` werkten.** Codex meldde expliciet "geen 1000-rij-afkapping gevonden"
   en liet de bewust lege betaalmetingen met rust in plaats van ze als bug te rapporteren — het las de
   B47-uitzondering en hield zich eraan.

## Reproduceren

```bash
codex exec --sandbox read-only -o <rapport.md> "<prompt>"   # gerichte pass op een bestandsset
codex exec review --base main                                # diff-review tegen de basisbranch
```

De vier pass-prompts staan in het sessie-scratchpad (`run-codex-passes.sh`). `AGENTS.md` in de repo-root
wordt automatisch geladen en levert de invarianten, het leesverbod op geheimen en de ernst-schaal.
