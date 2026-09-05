# SR 4 — voortgang bouwstappen (deel 1: stappen 1–5, 2026-09-05)

Norm: B13 (1:1 gemeten storefront), plan §3.3 SR 4, `SR3-werklijst.md` §6. Mandaat: gouden regel 10 (B61) — geen tussenvragen,
aannames gemarkeerd als **aanname (aanpasbaar)**; poort = team-review van het gebouwde per stap (B62). Alles T1 (UI/CSS/copy);
auth, entitlement, playback en RLS zijn niet geraakt. Review-pipeline T1 licht per commit: stap 2 baseline · 3 koude review
(subagent met verse context, brief per regel 5) · 6 consolideren, + 7 patch/re-review waar de review een Important gaf.
Tests: Playwright-structuurtests in `apps/web/tests/`, gedraaid tegen de **productiebuild** (`pnpm build` + `next start -p 3012`,
`E2E_NO_SERVER=1 pnpm test`) — de dev-testserver deed 30–70 s per pagina door machinebelasting (load 20–25 door de eigen Chrome).
Schermafbeeldingen (1440 + 390 van de home, productiebuild) in `var/storefront-referentie/sr4/stap-N/` (gitignored, lokaal).

| stap | commit | wat veranderde | aannames (aanpasbaar) | test (uitvoer) | schermafbeelding |
|---|---|---|---|---|---|
| 1 tokenwissel | `86273a7` | Cairo (next/font/google, latin+arabic, 400–700) als kop- én broodtekstfont; kleurschema Light: body #ffffff, geen `.gradient-hero`, footer licht; `#447525` blijft; `packages/core/src/tokens.ts` als bron + `globals.css` (T16: geldt voor web/mobiel/TV) | hero tijdelijk `bg-brand-muted` tot stap 7 de fotobanner brengt; `font-extrabold` rendert als 700 (Cairo geladen 400–700 = gemeten norm; founderkeuze `weight: 'variable'` voor echte 800); admin-achtergrond verliest contrast (buiten storefront, micro-fix later) | `tests/tokens.spec.ts`: h1/body font-family ^Cairo, body rgb(255,255,255), --color-brand #447525, 0× .gradient-hero, footer niet surface-deep — 2/2 groen (4.2 s) | `sr4/stap-1/home-1440.png`, `home-390.png` |
| 2 logo + favicon | `39bcd1c` | Arabisch woordmerk (`public/brand/logo-albunyaan.png`, byte-identiek aan het gemeten asset 385×313) via next/image in header en footer, **100 px hoog zoals gemeten** (storefront: `height: 100px` in kop én voet); `public/favicon.png` 48×48 → `link rel=icon` + apple-touch-icon | kopbalk groeit mee (py-2 i.p.v. h-68); alt "Albunyaan TV" nog niet per taal (Weglot-stap 6); geen `/favicon.ico` | `tests/logo.spec.ts`: header/footer img src logo-albunyaan + alt, link[rel=icon] → favicon.png, GET /favicon.png 200 image/png — 3/3 groen | `sr4/stap-2/…` |
| 3 header-menu | `e4e0b4d` | Home · Videos · **Contact▾** (Contact, About us, Dawah) · Q&A · Coupon · **Download apps** + Log in + Sign up; zoekveld uit de kop (terug op /catalog in stap 9); dropdown = `NavDropdown.tsx`: CSS hover/focus, sluit bij klik buiten, Escape en na navigatie (alleen blur, geen state) | opent op hover (≥ 1024 px, zoals de storefront) én via Tab; nav-tekst 14 px/ink, gap-6 (storefront-nav-font ongemeten); Sign up → /login (aanmelden gesloten tot B16/B64) | `tests/header.spec.ts`: volgorde 6 top-items, dropdown 3 links, verborgen→zichtbaar via focus, Tab naar eerste link, Escape sluit, hover opent, klik About us → /about-us + paneel dicht, 1 Log in + 1 Sign up zichtbaar, 0 form[role=search] — 4/4 groen (6.3 s); de review-Important (paneel bleef open na client-side navigatie) faalde eerst tweemaal in de test en is na de blur-fix groen | `sr4/stap-3/…` |
| 4 mobiele navigatie | `e5ad482` | `MobileNav.tsx`: hamburger (aria-label Menu, `lg:hidden`) met de **11 links** in storefront-volgorde: Home · Videos · Contact (groep) · Contact · About us · Dawah · Q&A · Coupon · Download apps · Log in · Sign up; sluit bij link-klik en Escape (focus terug); Log in/Sign up in de kopcluster alleen ≥ 1024 px (storefront 390: taalknop + hamburger) | groepsregel Contact → /contact; 15 px; klik buiten het paneel sluit niet; paneel 100dvh − kop; leden zien "Account" (Sign out in het mobiele menu = open vraag) | `tests/mobile-nav.spec.ts`: 390 → hoofdmenu verborgen, scrollWidth ≤ 390 (review vond 400 px overflow), hamburger zichtbaar, 11 zichtbare links in volgorde, Escape sluit + focus, klik About us → /about-us en menu dicht; 1440 → geen hamburger — 6/6 groen (11.1 s) | `sr4/stap-4/home-1440.png`, `home-390.png`, `home-390-menu-open.png` |
| 5 footer | `167e3a6` | logo (100 px) · 6 tekstlinks · "© Albunyaan 2026" · App Store + Google Play · Instagram/Facebook/YouTube met de gemeten doelen; "Local parity build…", tagline en lange ©-zin weg; role=group; < 768 px gecentreerd zoals het 390-beeld | Donate → eigen /donate (B68); badges als tekstknoppen (geen officiële artwork in de assets); **B63: badges linken tot de cutover naar de Uscreen-apps** (founderkeuze: laten of uitzetten; runbook-regel toegevoegd); ©-jaar dynamisch | `tests/footer-blok.spec.ts`: 6 tekstlinks + 5 icoonlinks met exact de storefront-hrefs, rel=noopener, ©, geen dev-tekst, logo — 7/7 groen (5.7 s) | `sr4/stap-5/…` |

**Baseline per stap:** `pnpm build` groen (56 / 16.5 / 7.2 / 30.5 / 7.7 s), `pnpm lint` (tsc) 0 fouten (was 1 pre-existing in het
gegenereerde `.next/dev/types/validator.ts`), tests cumulatief 2 → 3 → 4 → 6 → 7 groen. Eindstand: **7/7 groen**, `git status` schoon.

**Review-uitkomsten die op de founder/het team wachten (VRAAG/DEFER):**
1. Stap 1: `font-extrabold` → `weight: 'variable'` voor echte 800, of normaliseren naar 700 (gemeten norm 400–700).
2. Stap 2: `/favicon.ico` en alt per taal (bij Weglot, stap 6).
3. Stap 3: `reference/real-site-ia.json` (5 juli) spreekt de gemeten volgorde tegen — bijwerken of markeren "vervangen door SR 2a".
4. Stap 4: Sign out voor ingelogde leden in het mobiele menu (form-slot); klik-buiten sluit het mobiele menu niet.
5. Stap 5: **B63** — Uscreen-app-links in de footer laten tot de cutover, of badges verbergen tot de nieuwe apps er zijn (nu: Uscreen-links, zoals de storefront). Orphan-CSS `.line-divider`, `.gradient-text-green`, `.glass-nav` (pre-existing): strippen of laten.

**Preview-URL:** **geen.** `vercel ls albunyaan-web` (alleen lezen, 2026-09-05 08:0x) toont als jongste preview een deploy van 23 dagen
geleden; de branch `exit-phase` staat 57 commits vóór `origin/exit-phase` en is niet gepusht (pushen = founderbesluit, B18: preview-URL
per branch). Wie de branch pusht, krijgt automatisch een Vercel-preview van deze vijf stappen.

**Volgende (deel 2, na teamreview):** stap 6 wacht op de Weglot-inlog (B32); stappen 7–11 (homepage-blokken met fotobanner,
statische pagina's 1:1, catalogus met zoekveld + filters, categoriepagina, programma-/afleveringspagina incl. de `/watch`-404).
