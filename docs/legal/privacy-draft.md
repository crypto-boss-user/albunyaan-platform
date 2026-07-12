<!--
STATUS: DRAFT — NOT LEGALLY REVIEWED. Do not publish without founder + legal
sign-off. See README.md in this folder.

Clauses ported (in substance) from the live Uscreen-hosted privacy policy
are marked <!-- PORTED --> at the end of the relevant paragraph. Clauses
that are new — because the topic didn't exist on the old platform, or
because the old platform's practice is being deliberately IMPROVED/replaced
(EU storage instead of US, no bundled marketing consent, statutory 7-year
invoice retention instead of a blanket 30-day wipe, etc.) — are marked
<!-- NEW — founder review -->. See docs/legal/source-uscreen-privacy.txt for
what was found on the live site and why specific old clauses were or
weren't carried over.
-->

# Privacybeleid — Albunyaan.tv

**Laatst bijgewerkt:** [DATUM — invullen bij publicatie] <!-- NEW — founder review -->

## 1. Wie wij zijn

Stichting alAsr, gevestigd te Amsterdam, is de verwerkingsverantwoordelijke
("controller") voor de persoonsgegevens die worden verwerkt via
Albunyaan.tv. <!-- NEW — founder review: task brief names Stichting alAsr as controller; live Uscreen pages currently name "Stichting Tarbiyah Consultancy." Same discrepancy as noted in terms-draft.md — new-platform fact used here, needs founder confirmation before publishing. -->

- KvK-nummer: [KVK-NUMMER] <!-- NEW — founder review: placeholder -->
- Contact voor privacyvragen: [CONTACT-EMAIL] <!-- NEW — founder review: old site listed support@albunyaan.tv / info@albunyaan.tv; not carried over as-is since these are old-site addresses not confirmed for the new foundation entity -->

## 2. Welke gegevens wij verzamelen

| Categorie | Voorbeelden | Van wie |
|---|---|---|
| Accountgegevens | E-mailadres, naam (optioneel) | Accounthouder (ouder/voogd) |
| Abonnements- en betaalstatus | Abonnementstype, betaalstatus, factuurhistorie — **niet** je kaartgegevens zelf | Accounthouder, via Stripe |
| Kijk- en profielgegevens | Bekeken content, kijkvoortgang, profielnamen, leeftijdscategorie van kinderprofielen | Accounthouder |
| Ouderlijke pincode | Alleen gehashte (versleutelde) vorm, niet leesbaar door ons | Accounthouder |

<!-- NEW — founder review: this table replaces the old field list (Full Name, Address, Email, Phone, Country, State, Zip Code, Billing information). Address/phone/zip are dropped — the new checkout is Stripe-hosted and the platform itself does not need to collect full postal address or phone number; magic-link login is email-only per task brief. -->

Kaartgegevens (nummer, vervaldatum, CVC) worden nooit door ons ontvangen of
opgeslagen. Deze worden rechtstreeks en uitsluitend door Stripe verwerkt.
<!-- PORTED: expands on the old policy's implicit handling of "billing information" — made explicit and stronger, since card data literally never reaches our servers on the new architecture -->

**Kinderprofielen:** profielnamen en leeftijdscategorieën voor
kinderprofielen worden gekozen door de ouder/voogd, niet door het kind zelf.
Wij adviseren ouders om geen achternaam of andere identificerende informatie
in de profielnaam te gebruiken (bijvoorbeeld een voornaam of bijnaam
volstaat). <!-- NEW — founder review: no equivalent concept on old platform -->

## 3. Waarvoor wij gegevens gebruiken en op welke grondslag

| Doel | Grondslag (AVG) |
|---|---|
| Account aanmaken, inloggen via magic link, abonnement uitvoeren | Uitvoering van de overeenkomst (art. 6.1.b AVG) |
| Facturatie en administratie | Wettelijke verplichting (art. 6.1.c AVG) |
| Beveiliging, fraudepreventie, misbruik van vouchers voorkomen | Gerechtvaardigd belang (art. 6.1.f AVG) |
| Marketing-e-mail (nieuwsbrief, aanbiedingen) | Toestemming (art. 6.1.a AVG) — apart en vrij herroepbaar |

<!-- NEW — founder review: whole legal-basis table is new; old policy did not distinguish legal bases at all. Explicitly separating marketing consent from transactional/account email is a deliberate DEVIATION from the old policy's practice, see note in source-uscreen-privacy.txt: the old policy auto-enrolled users in marketing email with an opt-out that also disabled security/support updates. That practice is not carried over — it does not meet GDPR's requirements for freely given, specific consent, and is not compatible with our use of Resend (transactional) vs. Brevo (marketing) as two separate systems. -->

## 4. Wie jouw gegevens verwerkt namens ons ("verwerkers")

| Partij | Rol | Locatie |
|---|---|---|
| Supabase | Database en accountbeheer/authenticatie | EU (Frankfurt, Duitsland) |
| Stripe | Betalingsverwerking | Verwerkt wereldwijd; EU-onderdeel van Stripe is verwerkingsverantwoordelijke voor betaalgegevens; standaardcontractbepalingen (SCC's) van toepassing waar gegevens buiten de EER worden verwerkt |
| Bunny.net | Videolevering (CDN/streaming) | Netwerk van servers wereldwijd voor snelle levering; SCC's van toepassing waar van toepassing |
| Resend | Transactionele e-mail (bijv. inloglink, bevestigingen) | Zie leverancier voor serverlocatie; SCC's van toepassing waar van toepassing |
| Plausible | Website-analyse, zonder cookies en zonder persoonlijke tracking | EU |
| Brevo | Marketing-e-mail, alleen voor contacten die daar expliciet toestemming voor hebben gegeven | EU |

<!-- NEW — founder review: entire processor table is new (reflects the new-platform stack from the task brief); old policy only said data was "stored in the United States" and did not name specific processors. This is a material change: the new platform's primary database/auth is EU-hosted (Supabase Frankfurt), unlike the old US-based storage. ASSUMPTION: exact SCC/sub-processor status for Bunny.net and Resend not independently verified in this session — founder or legal reviewer should confirm current DPA/SCC status directly with each vendor before publishing. -->

## 5. Doorgifte buiten de EER

Voor zover een verwerker gegevens buiten de Europese Economische Ruimte
verwerkt, zorgen wij ervoor dat dit gebeurt op basis van een geldig
doorgiftemechanisme, zoals de standaardcontractbepalingen (Standard
Contractual Clauses / SCC's) van de Europese Commissie. <!-- NEW — founder review -->

## 6. Bewaartermijnen

- **Accountgegevens en profielgegevens:** bewaard zolang je account actief
  is. Bij verwijdering van je account worden deze gegevens verwijderd
  binnen [X] dagen, behalve voor zover wij gegevens langer moeten bewaren
  op grond van artikel 6.3 hieronder. <!-- NEW — founder review: [X] placeholder, exact number of days to be decided by founder; old policy said a flat "30 days after account deletion, then fully removed," which is NOT carried over as a blanket promise because it conflicts with the statutory retention below -->

- **Financiële/factuurgegevens:** facturen en betaalgegevens die via Stripe
  worden verwerkt, worden bewaard gedurende de wettelijke
  bewaartermijn voor de fiscale administratie: 7 jaar, conform de
  Nederlandse Belastingdienst. <!-- NEW — founder review: statutory retention; old policy's blanket 30-day-then-gone promise did not account for this legal requirement and would have been inaccurate for the new platform -->

## 7. Jouw rechten

Je hebt het recht op inzage, rectificatie, verwijdering (recht op
vergetelheid), beperking van de verwerking, overdraagbaarheid van gegevens
(dataportabiliteit), en bezwaar tegen verwerking op basis van
gerechtvaardigd belang of tegen direct marketing.

Je kunt deze rechten uitoefenen door:
- Zelf, via je accountpagina: gegevens inzien, exporteren of je account
  (inclusief onderliggende kinderprofielen) verwijderen; of
- Door contact op te nemen via [CONTACT-EMAIL].

Wij reageren binnen de wettelijke termijn (in beginsel binnen één maand).
<!-- NEW — founder review: self-service account-page export/delete flow is new; old policy only offered an opt-out from marketing by emailing support -->

## 8. Kinderen en het Platform

Het Platform is bedoeld voor gebruik dóór kinderen, maar de
account-/contractrelatie is met de ouder of voogd, niet met het kind. Wij:

- tonen geen advertenties aan kinderen;
- gebruiken geen tracking of profilering van kinderprofielen voor
  advertentiedoeleinden;
- plaatsen geen trackingcookies of scripts van derden op profielpagina's van
  kinderen;
- laten kinderprofielen niet zelf accountgegevens of instellingen wijzigen
  buiten wat de ouder/voogd toestaat (bijv. via de ouderlijke pincode).

<!-- NEW — founder review: whole section is new; old policy had no children's-data provisions at all -->

## 9. Cookies

Wij gebruiken alleen functionele cookies die nodig zijn om het Platform te
laten werken:

- een sessiecookie om je ingelogd te houden;
- een cookie om je taalvoorkeur te onthouden;
- een cookie om te onthouden welk kinderprofiel is geselecteerd.

Wij gebruiken geen trackingcookies en geen cookies voor advertentiedoel-
einden. Onze websitestatistieken worden verzameld via Plausible Analytics,
een privacyvriendelijk analysehulpmiddel dat geen cookies gebruikt en geen
individuele bezoekers volgt. Omdat wij geen trackingcookies plaatsen, is
voor het gebruik van het Platform geen cookiebanner met toestemmingsvraag
vereist voor deze functionele cookies. <!-- NEW — founder review: whole cookie section is new; old policy described "cookies, IP addresses, browser type, device type, location, ISP" collected broadly for analytics without distinguishing functional vs. tracking. ASSUMPTION flagged: the "no cookiebanner needed" claim depends entirely on the actual implementation matching this description exactly (i.e. Plausible truly stores no cookie and no other tracking cookie is added later) — must be re-verified against the live app before publishing, and revisited immediately if any additional analytics/ad script is ever added. -->

## 10. Beveiliging

Wij nemen passende technische en organisatorische maatregelen om je
gegevens te beschermen, zoals versleuteling van gegevens onderweg (SSL/TLS)
en gehashte opslag van de ouderlijke pincode. Geen enkele methode van
opslag of verzending via internet is echter 100% veilig; wij kunnen absolute
veiligheid niet garanderen. <!-- PORTED: from old policy's "SSL encryption and other security measures... we cannot guarantee that our security measures will prevent unauthorized access" -->

## 11. Wij verkopen jouw gegevens niet

Wij verkopen, verhuren of delen je persoonsgegevens niet met derden voor hun
eigen commerciële doeleinden. Gegevens worden alleen gedeeld met de
verwerkers genoemd in artikel 4, voor de daar genoemde doeleinden. <!-- PORTED: "We do not rent, sell, or share your personal information with 3rd parties, except as listed below," from old policy -->

## 12. Bedrijfsovername

Als Stichting alAsr betrokken raakt bij een fusie, overname, of overdracht
van (een deel van) haar activiteiten, kunnen persoonsgegevens als onderdeel
daarvan worden overgedragen. Wij zullen je hierover informeren en, waar
vereist, opnieuw toestemming vragen. <!-- PORTED: from old policy's "personal information would transfer in merger or acquisition scenarios," with added notification/consent language -->

## 13. Klachtrecht

Ben je het niet eens met de manier waarop wij je gegevens verwerken? Neem
dan eerst contact met ons op via [CONTACT-EMAIL]. Je hebt daarnaast het
recht om een klacht in te dienen bij de Autoriteit Persoonsgegevens
(www.autoriteitpersoonsgegevens.nl). <!-- NEW — founder review: old policy had no reference to the Dutch DPA -->

## 14. Wijzigingen in dit beleid

Wij kunnen dit privacybeleid van tijd tot tijd wijzigen. Bij wezenlijke
wijzigingen informeren wij je per e-mail voordat de wijziging ingaat.
<!-- NEW — founder review -->

---

# English summary (informal — Dutch version above is legally binding)

<!-- NEW — founder review: whole English section is new; no English privacy policy was found on the live site (both English URL variants tried returned HTTP 404) -->

This is a plain-language summary only. **The Dutch text above is the
legally binding version.**

- **Controller:** Stichting alAsr, Amsterdam. Contact: [CONTACT-EMAIL].
- **What we collect:** email, optional name, subscription/payment status
  (never your card details — those go straight to Stripe), and
  viewing/profile data including kid-profile names and age bands, which
  parents choose (we suggest using a first name or nickname, not a full
  name).
- **Parental PIN:** stored only in hashed (encrypted) form — we can't read
  it.
- **Why we process data:** contract performance (running your membership),
  legal obligation (invoicing), legitimate interest (security/fraud
  prevention), and consent (marketing email only — separate from and never
  bundled with account/security email).
- **Who else touches your data:** Supabase (EU/Frankfurt — database and
  login), Stripe (payments), Bunny.net (video delivery), Resend
  (transactional email), Plausible (cookieless analytics, EU), Brevo
  (marketing email, opt-in only).
- **How long we keep it:** account/profile data while your account is
  active plus [X] days after deletion; invoices/payment records for 7 years
  as required by Dutch tax law, regardless of when you close your account.
- **Your rights:** access, correction, deletion, portability, and objection
  — self-service from your account page, or email [CONTACT-EMAIL].
- **Kids:** the platform is for children, but the account/contract is with
  the parent or guardian. No ads, no profiling of kids for advertising, no
  third-party trackers on child profiles.
- **Cookies:** functional only (session, language, selected profile) — no
  tracking cookies, no consent banner needed. Plausible analytics is
  cookieless.
- **Complaints:** contact us first at [CONTACT-EMAIL]; you can also
  complain to the Dutch Data Protection Authority (Autoriteit
  Persoonsgegevens).
