# APP-1 — Meetrapport: de Albunyaan-telefoonapp opnieuw bouwen in Flutter

**Datum:** 2026-09-17 · **Scope (founder):** alleen de Albunyaan-**telefoonapp**, Android + iOS.
Albunyaan TV, Rabbaanie en FitrahTube blijven buiten scope (wel benoemd als cutover-gat, §7).
**Deze ronde meet en beslist. Er is geen appcode geschreven, niets geïnstalleerd, geen account
aangemaakt, geen geld uitgegeven, geen push verstuurd.**

Bronlabels: `[gemeten]` = zelf vastgesteld deze sessie · `[doc]` = uit een document/bron · `[aanname]` =
redenering, nog niet bewezen · `[te meten]` = openstaand.

---

## 0. De kern in vijf regels

1. **De huidige Uscreen-app is zélf een Flutter-app** `[gemeten]`. De keuze van de collega is dus geen
   experiment maar een gelijk-voor-gelijk herbouw.
2. **De app is veel meer dan een videocatalogus.** Uit de afhankelijkhedenlijst blijkt een
   community-module: camera, video-editor, RTMP-uitzending, GIF-kiezer en een rich-text-editor `[gemeten]`.
   Dat hoort **niet** in v1.
3. **Er is vandaag geen backend waar een app mee kan praten** `[gemeten]`. Dat is het echte werk — niet Flutter.
4. **De inhoud is niet DRM-beschermd** `[gemeten]`: geen Widevine in de APK. Dat maakt een eigen speler haalbaar.
5. **Zonder K1 (kijkplatform) is de app niet af te maken** `[doc]`. Video *is* de app.

---

## 1. M1 — APK-inventaris

Twee versies vergeleken. Beide zijn `tv.uscreen.albunyaan2`. Bestanden staan in
`~/projects/_scratch/app-1/` (**niet** in de repo).

| | oude build | huidige build |
|---|---|---|
| bestand | `mobile.apk` (van de Mac van de founder) | verse kopie van de Uscreen-S3-link |
| versie | **3.21.1** (versionCode 13) | **3.35.0** (versionCode 32) |
| grootte | 135.871.262 bytes | 125.631.879 bytes |
| sha256 | `7eed040f6ebaca247f8e14f9cd6671cc3b9b2a4f45035a8bec4bf540dfe37e95` | `b54d90d78ec49759d74e0c5425dadf8286e6e8b647274c071d1bbe65ec9aa1bf` |
| minSdk / targetSdk / compileSdk | 23 / 34 / 34 | **24 / 35 / 35** |
| ABI's | arm64-v8a, armeabi-v7a, x86, x86_64 | arm64-v8a, armeabi-v7a, x86_64 |

Alles `[gemeten]` met `unzip` + een eigen parser voor het binaire manifest
(`~/projects/_scratch/app-1/axml.py`); **`aapt`/`apkanalyzer` ontbreken en zijn niet geïnstalleerd** (§6).

**Framework** `[gemeten]`: `libflutter.so` + `libapp.so` in beide builds → Flutter, AOT-gecompileerd.
Twee `.dex`-bestanden (de Android-kant van de plugins). Geen `index.android.bundle` → geen React Native.

**Activities** `[gemeten]`: `com.example.videoapp.MainActivity`, `com.example.videoapp.SplashActivity`,
`plugins.chromecast.ExpandedControlsActivity`. De Java-pakketnaam `com.example.videoapp` is de
ongewijzigde Flutter-sjabloonnaam — een white-label-app die per klant alleen opnieuw gelabeld wordt `[aanname]`.

**Permissies (17, identiek in beide builds)** `[gemeten]`:
`INTERNET`, `ACCESS_NETWORK_STATE`, `WAKE_LOCK`, `VIBRATE`, `POST_NOTIFICATIONS`,
`RECEIVE_BOOT_COMPLETED`, `SCHEDULE_EXACT_ALARM`, `BIND_JOB_SERVICE`, `FOREGROUND_SERVICE`,
`FOREGROUND_SERVICE_DATA_SYNC`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, **`CAMERA`**, **`RECORD_AUDIO`**,
`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `CHANGE_WIFI_MULTICAST_STATE`, `DUMP`.
`CAMERA` + `RECORD_AUDIO` + multicast horen bij de community-/uitzendmodule, niet bij kijken.

**Deep links** `[gemeten]`: `albunyaan.tv`.

**Native bibliotheken** `[gemeten]` — het verschil tussen de builds is veelzeggend:
oud had `librtmp.so` + `librtmpdroid.so` (RTMP-uitzenden) en `libcrypto/libssl`;
de huidige build heeft die niet meer, maar wél `libdartjni.so`, `libdatastore_shared_counter.so`,
`libsurface_util_jni.so`. Beide hebben `libsentry*.so` en `libsqlite3.so`.

**SDK-sporen** `[gemeten]`: Firebase/FCM (49 treffers), Sentry (18), Google Play Billing (6),
Chromecast (2), WebView (2), flutter_local_notifications (2). **Geen** OneSignal, **geen** Amazon IAP
(die zit wél in de TV-APK), **geen Widevine/DRM**.

### 1a. Afhankelijkhedenlijst uit `NOTICES` `[gemeten]`

De huidige build bevat een `NOTICES.Z` met **374 pakketten** (inclusief transitieve en C-bibliotheken).
De app-bepalende keuzes:

| Gebied | Pakketten | Betekenis voor ons |
|---|---|---|
| **Speler** | `video_player` (+`_android`, `_avfoundation`), `audio_session`, `wakelock_plus`, `visibility_detector` | Uscreen gebruikt de **standaard Flutter-speler**, geen eigen ExoPlayer-integratie. Speelt HLS native. Wij kunnen hetzelfde doen. |
| **Navigatie/state** | `go_router`, `provider`, `get_it`, `rxdart`, `equatable` | Gangbare, saaie keuzes. Prima om over te nemen. |
| **Netwerk/opslag** | `dio`, `http`, `connectivity_plus`, `drift`, `sqflite`, `sqlite3_flutter_libs`, `shared_preferences`, `flutter_cache_manager`, `cached_network_image` | Lokale database (drift/sqlite) → offline-catalogus en downloadadministratie. |
| **Auth** | `google_sign_in`, `sign_in_with_apple` | Sociale login. Wij kiezen e-mailcode (§4) — sociale login is een **vraag**, geen gegeven. |
| **Betalen** | `in_app_purchase` (+`_android`, `_storekit`) | In-app aankopen via Google/Apple. Wij willen dat juist **niet** (afdracht + afhankelijkheid). |
| **Push/meting** | `firebase_messaging`, `firebase_core`, `flutter_local_notifications`, `sentry_flutter`, **`clarity_flutter`** | Firebase = Google. Clarity = Microsoft-sessieopnames — privacyvraag (B82). |
| **Community (grote scope-vondst)** | `camera`, `image_picker`, `video_editor`, `get_thumbnail_video`, `flutter_upchunk`, `tus_client_dart`, `haishin_kit` (RTMP), `giphy_get`, `flutter_quill` (+bridges), `table_calendar`, `in_app_review`, `share_plus`, `gal`, `permission_handler` | Leden kunnen posten, media uploaden, video bewerken en uitzenden. **Buiten v1** — dit is een eigen product. |
| **AI** | `dart_openai`, `google_generative_ai` | Uscreen heeft AI-functies in de app `[gemeten]`; wat ze doen is `[te meten]`. Niet overnemen zonder reden. |
| **i18n** | `intl`, `timezone`, `flutter_timezone`, `timeago` | Arabisch/Nederlands/Engels is gewoon te doen. |

**Niet in de lijst** `[gemeten]`: geen Widevine/DRM, geen ExoPlayer-DRM, geen downloadmanager voor
versleutelde media. Offline downloads (als ze bestaan) zijn dus gewone bestanden `[aanname]`.

---

## 2. M1b — Schermblauwdruk: **openstaand, handleiding voor de founder**

`[te meten]` — **en dit is de belangrijkste openstaande meting van APP-1.**

Een APK kan niet worden teruggedraaid naar Flutter-broncode, en dat willen we ook niet (het is
Uscreens eigendom). Wat we herbouwen zijn de **schermen en stromen**. Daarvoor moet de app dráaien, en
dat kan hier niet: er is geen emulator en geen Android SDK (§6), en een APK draait niet op een Mac.

**Wat de founder doet (±30 minuten, eigen Android-telefoon, eigen account):**

1. Installeer de huidige app (of gebruik de al geïnstalleerde) en zet de taal op **Arabisch**.
2. Maak van elk scherm een screenshot, in deze volgorde. Zet ze in
   `~/projects/_scratch/app-1/screens/` met de naam `ar-<nummer>-<scherm>.png`:
   1 splash · 2 login (leeg) · 3 login (code/foutmelding) · 4 home · 5 categorie-overzicht ·
   6 categoriepagina · 7 seriepagina · 8 videopagina · 9 speler staand · 10 speler fullscreen ·
   11 zoeken (leeg) · 12 zoeken (resultaten) · 13 profielkiezer · 14 PIN-scherm · 15 ouderlijk toezicht ·
   16 live · 17 favorieten · 18 verder kijken · 19 downloads · 20 instellingen · 21 account/abonnement ·
   22 een lege staat · 23 een foutmelding (zet wifi uit).
3. Herhaal 4 t/m 10 in het **Engels** (`en-<nummer>-<scherm>.png`) — genoeg om te zien wat er met de
   RTL-spiegeling gebeurt.
4. Maak één schermopname van ±60 s: home → serie → video starten → fullscreen → terug.

**Privacy:** de screenshots mogen accountgegevens bevatten en gaan daarom **nooit** de repo in — de repo
is publiek. In het rapport komt alleen een schermkaart (scherm → wat het toont → waarheen het navigeert),
zonder afbeeldingen van ledengegevens (B82).

Zonder deze stap bouwen we in APP-2 op aannames over de interface.

---

## 3. M2 — Feature-pariteit

| Feature | Uscreen-app | ons webplatform vandaag | voorstel app-v1 |
|---|---|---|---|
| Inloggen | sociale login + e-mail `[gemeten: google_sign_in, sign_in_with_apple]` | magic link via `signInWithOtp` `[gemeten: apps/web/app/auth/actions.ts:48]` | **ja** — e-mail**code** (§4). Sociale login = VRAAG |
| Catalogus/rijen | ja `[aanname]` | `getCatalogRows`, `getCategoryRows` `[gemeten: packages/core/src/data/catalog.ts:91,129]` | **ja** |
| Serie-/programmapagina | ja `[aanname]` | `getProgramBySlug` `[gemeten: catalog.ts:305]` | **ja** |
| Video afspelen | `video_player`, HLS, geen DRM `[gemeten]` | **alleen iframe-embed** `[gemeten: apps/web/lib/bunny-embed.ts]` | **ja, maar hangt aan K1** |
| Zoeken | ja `[aanname]` | `searchCatalog` `[gemeten: search.ts:50]` | **ja** |
| Profielen + ouderlijke PIN | `[te meten]` | volledig `[gemeten: packages/core/src/data/parental.ts]` | **ja** |
| Abonnement/betalen | in-app aankopen `[gemeten: in_app_purchase]` | Stripe op het web `[gemeten: apps/web/app/join]` | **nee** — betalen op de website. Scheelt 15–30 % afdracht en een storeafhankelijkheid |
| Push | Firebase `[gemeten]` | — | **later** (FCM = Google; eigen beslissing) |
| Chromecast | ja `[gemeten]` | — | **later** |
| Offline downloads | waarschijnlijk `[aanname: drift/sqflite + cache]` | — | **later** |
| Live | RTMP in de oude build `[gemeten]` | `getLiveRow` als catalogusrij; géén `/live`-pagina `[gemeten]` | **later** |
| Favorieten | `[te meten]` | **bestaat niet** — geen tabel, geen code `[gemeten]` | **later** (nieuwe tabel nodig) |
| Verder kijken | `[te meten]` | tabel `watch_progress` bestaat, **nul code** `[gemeten]` | **later** |
| Reacties | `[te meten]` | tabel `video_comments`, 0 rijen, geen member-UI `[gemeten]` | **nee** |
| Community (posten, camera, video-editor, uitzenden, GIF's) | ja `[gemeten]` | — | **nee** — eigen product, geen v1 |
| AI-functies | `dart_openai`, `google_generative_ai` `[gemeten]` | — | **nee** |
| Sessieopname (Clarity) | ja `[gemeten]` | — | **nee** — privacy (B82) |

Alles met `[te meten]` wordt beslist ná de schermblauwdruk (§2).

---

## 4. M3 — Backendgereedheid

**Vandaag kan een app nergens mee praten** `[gemeten]`:

- `apps/web/app/api/` bevat exact twee routes: `health/route.ts` en `stripe/webhook/route.ts`.
  Geen geversioneerde API, geen JSON-catalogus, niets app-gerichts.
- Alle memberfunctionaliteit is Server Components + Server Actions op een **cookie**-sessie
  (`apps/web/lib/session.ts`). Een telefoonapp heeft **bearer-tokens** nodig; cookies werken daar niet zo.
- De datalaag `packages/core/src/data/*` draait op de **service-role-sleutel**, die per definitie álle RLS
  omzeilt. Die sleutel mag **nooit** in een app (change-control regel 8).

**Twee architecturen:**

**(a) Dunne, geversioneerde API in Next.js — `/api/app/v1/...`**
De route-handler leest de bearer-token van de gebruiker, bepaalt wie het is, en roept dan de bestaande
functies uit `packages/core` aan.
*Voor:* hergebruikt `catalog.ts`, `search.ts`, `entitlements.ts`, `parental.ts` — dezelfde
zichtbaarheidsregels en toegangscontrole als het web, dus één waarheid. De speel-URL wordt serverkant
gemaakt, zodat de ondertekensleutel de app nooit in gaat. Werkt met de datalaag zoals die is.
*Tegen:* nieuw oppervlak dat onderhouden en beveiligd moet worden; de tokencontrole moet in elke route
foutloos zijn.

**(b) App praat rechtstreeks met Supabase (anon-sleutel + RLS)**
*Voor:* geen eigen API; realtime en auth uit de doos.
*Tegen, en dit is beslissend* `[gemeten]`: vandaag onmogelijk zonder nieuwe migraties.
`category_items` heeft **nul policies** (`supabase/migrations/0013_structure_fidelity.sql:36`) → de hele
categoriebrowse komt leeg terug. `videos.member_visible` heeft **geen kolomrecht** voor anon/authenticated
(`0012_member_visible_flag.sql:12`) — terwijl dát de echte zichtbaarheidswaarheid is (**15.180** video's,
tegenover 197 met `status='published'`). Er zijn **nergens** INSERT/UPDATE/DELETE-policies, dus verder
kijken, favorieten en PIN-wijzigingen kunnen niet. En de zichtbaarheidsregel staat in TypeScript
(`catalog.ts:29-40`), niet in de database — bij (b) zou die regel gedupliceerd moeten worden.

> **Aanbeveling: (a).** Niet omdat (b) slecht is, maar omdat (b) betekent dat de toegangsregels op twee
> plekken moeten kloppen — en de helft daarvan bestaat nog niet. (a) hergebruikt wat al gereviewd is.

**Authenticatie** `[gemeten]`: `signInWithOtp` wordt al gebruikt, maar als magic **link**
(`token_hash` in een URL). In een app wil je een **6-cijferige code** die de gebruiker overtypt.
Supabase stuurt beide als er geen `emailRedirectTo` wordt meegegeven `[aanname, te bevestigen]`.
Gunstig: `getOtpRequestClient` (`apps/web/lib/supabase/server.ts:48`) forceert al de *implicit*-flow
juist omdát PKCE de token aan één apparaat bindt — precies wat een app nodig heeft.

**Afspelen** `[gemeten]`: `signedEmbedUrl` levert een **iframe-pagina**, geen HLS-manifest, en tekent met
een server-only sleutel. Een native Flutter-speler heeft dus óf een WebView op diezelfde URL, óf een nieuw
endpoint dat per verzoek een speel-URL aanmaakt. Twee dingen om bij K1 mee te nemen: het token is nu
`sha256(sleutel + videoId + expires)` — geen HMAC — en is 6 uur lang herbruikbaar zonder IP- of
referer-binding.

---

## 5. M4 — Distributie

### Android
- **APK-hosting:** de huidige links staan op Uscreens S3 (`unode1.s3.amazonaws.com`) en sterven bij de
  cutover `[doc: plan §6 punt 14]`. Beide links leven nu nog (HTTP 200, `[gemeten]`). We hebben inmiddels
  een werkend, gratis alternatief bewezen: **GitHub Releases** (17-09 gebruikt voor de bijlagen).
- **De nieuwe app kan niet over de oude heen updaten** `[doc]`: andere pakketnaam én een andere
  ondertekensleutel. Elk lid moet de oude app verwijderen en de nieuwe installeren → ledencommunicatie
  plannen, en het is meteen de kans om de pakketnaam goed te zetten.
- **Google developer-verificatie** `[doc]`: vanaf 2027 wereldwijd installeren gecertificeerde toestellen
  alleen nog wrijvingsloos APK's van geverifieerde ontwikkelaars; onverifieerd betekent een "advanced flow"
  met een dag wachttijd. Handhaving start 30-09-2026 in Brazilië, Indonesië, Singapore en Thailand.
  Dit is **geen** Play Store-listing — het is eenmalig registreren (identiteit of D-U-N-S, $25).
- **Ondertekensleutel:** wie hem kwijtraakt kan die app nooit meer updaten. Custodie = founder, met twee
  offline back-ups. De sleutel gaat **nooit** in de repo (die is publiek).

### iOS
| Route | Los van Apple? | Bereikt wie | Oordeel |
|---|---|---|---|
| **PWA (Zet op beginscherm)** | ja | iedereen, wereldwijd | **Startpad.** Sinds iOS 26 opent een op het beginscherm gezette site standaard als web-app; webpush werkt pas ná die installatie. Installeren is handwerk → uitlegpagina nodig. Videobeperkingen (fullscreen, AirPlay, achtergrondaudio) `[te meten]` |
| App Store, "reader app" (geen in-app aankopen) | nee: review + $99/jr | iedereen | later, alleen als het team de Apple-afhankelijkheid accepteert |
| EU-webdistributie | nee: notarisatie + 5 % CTC | **alleen EU** | niet doen — Egypte, Marokko e.a. vallen buiten |
| Enterprise-cert / TestFlight / ad-hoc / hertekenen | nee | niet bruikbaar voor leden | geen optie |

---

## 6. M5 — Toolchain (alleen gemeten, niets geïnstalleerd)

`[gemeten]` — **vrijwel alles ontbreekt:**

| Nodig | Status |
|---|---|
| Flutter SDK | **ontbreekt** |
| Dart | **ontbreekt** (komt met Flutter) |
| Android SDK / platform-tools (`adb`) | **ontbreekt** |
| Android-emulator | **ontbreekt** |
| JDK (Java) | **ontbreekt** |
| `aapt` / `apkanalyzer` | **ontbreekt** (deze meting is daarom met een eigen parser gedaan) |
| Xcode | **aanwezig** (`/Applications/Xcode.app`) |
| `unzip`, `python3`, `curl`, `shasum` | aanwezig |
| vrije schijfruimte | ±61 GB |

Voor APP-2 is minimaal nodig: Flutter SDK (±3 GB incl. Dart), Android SDK + platform-tools + één
systeem-image voor de emulator (±10 GB), een JDK (±300 MB). Xcode staat er al. **Installeren is een
founder-beslissing** en gebeurt niet in deze ronde.

---

## 7. M6 — Publiek, en wat er nog meer omvalt

- **±55 % van de accounts is via de apps aangemaakt** `[doc: K1-memo §E6, K0 §4.4]`. Zonder eigen app
  verliezen we de ingang van de meerderheid.
- **±1.287 leden hebben push aanstaan** `[doc: worker/send-push-notification.mjs:2]`. Push zit niet in v1;
  dat kanaal valt bij de cutover dus weg tot er een pushkeuze is.
- **Buiten scope maar wél stervend bij de cutover** `[gemeten: apps/web/app/download-app/page.tsx]`:
  de Albunyaan TV-app (`tv.uscreen.albunyaan2tv`, met Amazon IAP), **Rabbaanie** (`com.rabbaanie.app`)
  en **FitrahTube**. Alle vier de APK-links staan op Uscreens S3. Dit is een openstaand gat, geen plan.

---

## 8. Beslislijst (founder/team)

| # | Vraag | Advies |
|---|---|---|
| **A-1** | **iOS-pad**: PWA bij de start, of meteen de App Store? | **PWA** bij de start; reader app later, alleen als het team Apple accepteert |
| **A-2** | **Google developer-verificatie** vóór 2027 (identiteit/D-U-N-S + $25) — kost geld | **ja, als organisatie**, ruim vóór de handhaving |
| **A-3** | **Pakketnaam — permanent**, wijzigen betekent dat iedereen opnieuw installeert | **`tv.albunyaan.app`** |
| **A-4** | **Custodie ondertekensleutel** — kwijt = nooit meer updaten | **founder**, met twee offline back-ups, nooit in de repo |
| **A-5** | **TV-apps** (Albunyaan TV) en de zusterapps (Rabbaanie, FitrahTube) | nu buiten scope; Flutter zo opzetten dat een TV-versie later kan |
| **A-6** | **K1 kijkplatform** — blokkeert afspelen, dus de app | beslissen vóór APP-3 |
| **A-7** | **Push-provider** — FCM is Google | v1 zonder push; aparte beslissing daarna |
| **A-8** | **Sociale login** (Google/Apple) zoals Uscreen nu heeft? | advies **nee** in v1: e-mailcode volstaat en scheelt twee afhankelijkheden |
| **A-9** | **Betalen in de app** — Uscreen gebruikt in-app aankopen | advies **nee**: betalen op de website, scheelt 15–30 % afdracht |
| **A-10** | **Schermblauwdruk** (§2): wie maakt de screenshots, en wanneer? | founder, ±30 min op een eigen telefoon — blokkeert APP-2 |

---

## 9. Voorstel APP-2 (mini-test) — **nog niet bouwen**

Pas beginnen ná teamreview van dit rapport en na antwoord op A-3, A-4 en de toolchain-installaties.

**Bouwen:** `flutter create` in `apps/mobile` (Android + iOS, geen webtarget) · inloggen met e-mailcode →
lijst met series → seriepagina → één HLS-testvideo die speelt · Arabisch RTL + NL/EN · huisstijl van het
web, geen nieuw ontwerp. **Niet:** push, betalen, downloads, live, profielen, community.

**Succescriteria (met geplakte uitvoer als bewijs):**
1. `flutter analyze` 0 meldingen; `flutter test` groen (minimaal een widgettest voor login en de lijst).
2. Release-APK gebouwd; grootte + sha256 gerapporteerd; op een echte telefoon geïnstalleerd en de
   testvideo speelt.
3. `flutter build ios --no-codesign` compileert.
4. `git status` toont geen keystore of geheim; de anon-sleutel is de enige sleutel in de app.
5. `pnpm build` en de bestaande e2e-suite van `apps/web` blijven groen (geen regressie).

---

## 10. Wat er in deze ronde níet kon (werkregel 1)

| Niet gedaan | Waarom | In plaats daarvan |
|---|---|---|
| M1b schermblauwdruk | geen emulator, geen Android SDK; een APK draait niet op een Mac | stap-voor-stap handleiding voor de founder (§2); blijft `[te meten]` |
| `aapt`/`apkanalyzer`-uitlezing | niet geïnstalleerd, en installeren mocht niet | eigen AXML-parser — levert dezelfde velden `[gemeten]` |
| Functies van de Uscreen-app bevestigen (favorieten, verder kijken, downloads, live) | vereist de draaiende app | gemarkeerd `[te meten]`, beslissing ná §2 |
| Wat de AI-functies doen | zelfde reden | `[te meten]` |

---

**Bronnen.** Opdracht en kaders: `Claude outputs/APP-flutter-plan-and-claude-code-prompts.md` (collega,
2026-09-17) — dat bestand is **bewust niet gecommit**; het staat lokaal en de map is uitgesloten via
`.gitignore`, omdat deze repo publiek is en het document nog niet door het team is vastgesteld.
Metingen van deze sessie: `~/projects/_scratch/app-1/` (APK's, `axml.py`, `inspect.py`).
Repo-bronnen zoals in de tekst geciteerd, met bestand en regelnummer.
