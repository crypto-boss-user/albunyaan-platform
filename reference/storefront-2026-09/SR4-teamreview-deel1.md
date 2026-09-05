# SR 4 — teamreview deel 1 (stappen 1–5) · 2026-09-05

**Preview (branch `exit-phase`, commit `f5f92c4`):** https://albunyaan-web-git-exit-phase-crypto-boss-users-projects.vercel.app
(vaste branch-URL; volgt elke nieuwe push van `exit-phase`). Gebouwd door Vercel in 56 s, status READY.

**Toegang:** de preview staat achter **Vercel Authentication** (projectinstelling "Standard Protection": alle preview-URL's
vragen een Vercel-login; anoniem = omleiding naar vercel.com/sso-api). Dat is bewust: de preview is niet publiek (RLS-regel
in `CLAUDE.md`). Gemeten 2026-09-05: het Vercel-team is een **Hobby-plan met 1 lid (de founder)**. Gevolg: teamleden kunnen
er nu niet in, ook niet met een eigen Vercel-account. Opties voor de founder (niets is gewijzigd):
1. Vercel Pro (betaald, per zetel) → teamleden toevoegen aan het team, of de knop **Share** op de deployment gebruiken
   (Shareable Link, alleen Pro/Enterprise).
2. **Protection Bypass for Automation** (Settings → Deployment Protection → Protection Bypass for Automation): een geheime
   sleutel die als URL-parameter meegegeven wordt; aanname (aanpasbaar): beschikbaar op Hobby — controleren in het dashboard.
   Sleutel alleen via een privékanaal delen.
3. Zonder toegang: reviewen op de schermafbeeldingen in `var/storefront-referentie/sr4/preview/` (lokaal) + dit document,
   of tijdens een schermdeling met de founder.

**Wat er is gemeten op de preview (2026-09-05, ingelogd via de founder-browser, alleen lezen):** home, `/about-us` en
`/contact` tonen het gebouwde: font Cairo op h1 én body, body wit (#ffffff), `--color-brand #447525`, logo 100 px in kop
en voet, favicon `/favicon.png`, menu Home · Videos · Contact▾ · Q&A · Coupon · Download apps + Log in + Sign up, footer 6
tekstlinks + 2 badges + 3 social-iconen, geen horizontale overflow op 390 (scrollWidth 390), hamburger + taalknop op 390.
Schermafbeeldingen: `sr4/preview/home-1440.png`, `home-390.png`, `about-us-1440.png`, `contact-1440.png`.

## Per stap: wat vergelijken met welk SR 2a-beeld

Referentiebeelden: `var/storefront-referentie/sr2a-2026-09-03/png/` (lokaal op de Mac) = NAS
`/volume1/Albunyaan/storefront-referentie/sr2a-2026-09-03/png/`. Norm B13: 1:1 met de gemeten storefront; **geen
pixelvergelijking**, wel: zelfde onderdelen, zelfde volgorde, zelfde doelen.

| stap | preview-pad | vergelijk met | waarop letten |
|---|---|---|---|
| 1 tokenwissel | `/` | `home__1440__en__anoniem.png`, `home__390__en__anoniem.png` | Cairo als font, witte achtergrond, groen #447525; de hero is nog een egaal groen vlak (fotobanner komt in stap 7) |
| 2 logo + favicon | `/` (kop en voet), browsertab | `home__1440__en__anoniem.png` | Arabisch woordmerk 100 px hoog in kop én voet; favicon in de tab |
| 3 header-menu | `/`, hover/Tab op "Contact" | `home__1440__en__anoniem.png` + live albunyaan.tv (SR 2a heeft geen beeld met open dropdown — aanname) | volgorde Home · Videos · Contact▾ (Contact, About us, Dawah) · Q&A · Coupon · Download apps; Log in + Sign up rechts; geen zoekveld in de kop |
| 4 mobiele navigatie | `/` op een telefoon of 390 px breed; tik op ☰ | `home__390__en__anoniem.png` + live albunyaan.tv op een telefoon (open menu niet in SR 2a — aanname) | 390: alleen logo, taalknop, hamburger; open menu = 11 links in storefront-volgorde; Escape/link sluit |
| 5 footer | `/`, `/about-us`, `/contact` (onderaan) | `home__1440__en__anoniem.png`, `page-about-us__1440__en__anoniem.png`, `page-contact__1440__en__anoniem.png` | logo · Videos · Q&A · Contact · Donate · Terms of service · Privacy policy · © Albunyaan 2026 · App Store/Google Play · Instagram/Facebook/YouTube; < 768 px gecentreerd |

## Vijf ja/nee-vragen (standaardantwoord = het advies, B61; "ja" = akkoord met het advies)

1. **Stap 1, letterdikte.** Kopjes staan op 700 (gemeten norm: Cairo 400–700). Advies: **zo laten**; geen extra gewicht 800
   laden. — ja/nee
2. **Stap 2, favicon.ico en alt-tekst per taal.** Advies: **uitstellen** tot stap 6 (Weglot); nu alleen `/favicon.png`. — ja/nee
3. **Stap 3, oude referentie `reference/real-site-ia.json` (5 juli) spreekt de gemeten volgorde tegen.** Advies: in het
   bestand **markeren "vervangen door SR 2a (2026-09-03)"**, niet verwijderen. — ja/nee
4. **Stap 4, ingelogde leden.** Advies: **Sign out in het mobiele menu toevoegen** zodra de ingelogde header-variant aan de
   beurt is (T2, na deel 2); klik-buiten sluit het menu niet (zoals nu). — ja/nee
5. **Stap 5, B63 app-badges.** De badges linken nu naar de Uscreen-apps (zoals de storefront). Advies: **zo laten tot de
   cutover** (runbook-regel staat er al); de drie verweesde CSS-klassen (`.line-divider`, `.gradient-text-green`,
   `.glass-nav`, pre-existing) **laten staan** tot stap 7–11 ze raakt. — ja/nee

Antwoorden graag met nummer + ja/nee (+ één zin bij "nee"). Geen antwoord vóór deel 2 begint = standaardantwoord.

---

# SR 4 — team review part 1 (steps 1–5) · 2026-09-05 (English)

**Preview (branch `exit-phase`, commit `f5f92c4`):** https://albunyaan-web-git-exit-phase-crypto-boss-users-projects.vercel.app
(stable branch URL; follows every new push of `exit-phase`). Built by Vercel in 56 s, status READY.

**Access:** the preview sits behind **Vercel Authentication** ("Standard Protection": every preview URL asks for a Vercel
login; anonymous visitors are redirected to vercel.com/sso-api). This is intentional: the preview is not public (RLS rule in
`CLAUDE.md`). Measured 2026-09-05: the Vercel team is a **Hobby plan with 1 member (the founder)**. So team members cannot
open it today, even with their own Vercel account. Options for the founder (nothing has been changed):
1. Vercel Pro (paid, per seat) → add team members, or use the **Share** button on the deployment (Shareable Link, Pro/Enterprise only).
2. **Protection Bypass for Automation** (Settings → Deployment Protection): a secret key passed as a URL parameter;
   assumption (adjustable): available on Hobby — verify in the dashboard. Share the key only through a private channel.
3. Without access: review from the screenshots in `var/storefront-referentie/sr4/preview/` (local) + this document, or in a
   screen-share with the founder.

**Measured on the preview (2026-09-05, logged in via the founder's browser, read-only):** home, `/about-us` and `/contact`
show what was built: Cairo on h1 and body, white body, brand #447525, logo 100 px in header and footer, favicon
`/favicon.png`, menu Home · Videos · Contact▾ · Q&A · Coupon · Download apps + Log in + Sign up, footer 6 text links + 2
badges + 3 social icons, no horizontal overflow at 390 px, hamburger + language button at 390 px.

## Per step: what to compare with which SR 2a capture

Reference captures: `var/storefront-referentie/sr2a-2026-09-03/png/` (local on the Mac) = NAS
`/volume1/Albunyaan/storefront-referentie/sr2a-2026-09-03/png/`. Norm B13: 1:1 with the measured storefront; **no pixel
comparison** — same parts, same order, same link targets.

| step | preview path | compare with | look for |
|---|---|---|---|
| 1 tokens | `/` | `home__1440__en__anoniem.png`, `home__390__en__anoniem.png` | Cairo font, white background, green #447525; the hero is still a flat green block (photo banner arrives in step 7) |
| 2 logo + favicon | `/` (header and footer), browser tab | `home__1440__en__anoniem.png` | Arabic wordmark 100 px high in header and footer; favicon in the tab |
| 3 header menu | `/`, hover/Tab on "Contact" | `home__1440__en__anoniem.png` + live albunyaan.tv (SR 2a has no open-dropdown capture — assumption) | order Home · Videos · Contact▾ (Contact, About us, Dawah) · Q&A · Coupon · Download apps; Log in + Sign up on the right; no search field in the header |
| 4 mobile navigation | `/` on a phone or at 390 px; tap ☰ | `home__390__en__anoniem.png` + live albunyaan.tv on a phone (open menu not in SR 2a — assumption) | 390: only logo, language button, hamburger; open menu = 11 links in storefront order; Escape/link closes it |
| 5 footer | `/`, `/about-us`, `/contact` (bottom) | `home__1440__en__anoniem.png`, `page-about-us__1440__en__anoniem.png`, `page-contact__1440__en__anoniem.png` | logo · Videos · Q&A · Contact · Donate · Terms of service · Privacy policy · © Albunyaan 2026 · App Store/Google Play · Instagram/Facebook/YouTube; centred below 768 px |

## Five yes/no questions (default answer = the advice, B61; "yes" = agree with the advice)

1. **Step 1, font weight.** Headings render at 700 (measured norm: Cairo 400–700). Advice: **keep**; do not load an extra 800 weight. — yes/no
2. **Step 2, favicon.ico and per-language alt text.** Advice: **defer** to step 6 (Weglot); only `/favicon.png` for now. — yes/no
3. **Step 3, old reference `reference/real-site-ia.json` (5 July) contradicts the measured order.** Advice: **mark it
   "superseded by SR 2a (2026-09-03)"** inside the file, do not delete. — yes/no
4. **Step 4, logged-in members.** Advice: **add Sign out to the mobile menu** when the logged-in header variant is built
   (T2, after part 2); click-outside does not close the menu (as now). — yes/no
5. **Step 5, B63 app badges.** The badges currently link to the Uscreen apps (like the storefront). Advice: **keep until
   the cutover** (runbook line already added); the three orphan CSS classes (`.line-divider`, `.gradient-text-green`,
   `.glass-nav`, pre-existing) **stay** until steps 7–11 touch them. — yes/no

Please answer with number + yes/no (+ one sentence if "no"). No answer before part 2 starts = default answer.
