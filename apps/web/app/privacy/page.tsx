import LegalPage from '../../components/LegalPage';

export const metadata = { title: 'Privacy policy — Albunyaan TV' };

/**
 * Ported from docs/legal/privacy-draft.md — DRAFT, pending founder + legal
 * sign-off (see docs/legal/README.md). Keep this page in sync with that file;
 * it is the source of truth for what changed vs. the old Uscreen-hosted policy
 * and why (docs/legal/source-uscreen-privacy.txt).
 */
export default function PrivacyPage() {
  return (
    <LegalPage label="Legal" title="Privacybeleid — Albunyaan.tv">
      <p>
        <strong>Laatst bijgewerkt:</strong> <code>[DATUM — invullen bij publicatie]</code>
      </p>

      <h2>1. Wie wij zijn</h2>
      <p>
        Stichting alAsr, gevestigd te Amsterdam, is de verwerkingsverantwoordelijke
        (&ldquo;controller&rdquo;) voor de persoonsgegevens die worden verwerkt via Albunyaan.tv.
      </p>
      <ul>
        <li>KvK-nummer: <code>[KVK-NUMMER]</code></li>
        <li>Contact voor privacyvragen: <code>[CONTACT-EMAIL]</code></li>
      </ul>

      <h2>2. Welke gegevens wij verzamelen</h2>
      <table>
        <thead>
          <tr><th>Categorie</th><th>Voorbeelden</th><th>Van wie</th></tr>
        </thead>
        <tbody>
          <tr><td>Accountgegevens</td><td>E-mailadres, naam (optioneel)</td><td>Accounthouder (ouder/voogd)</td></tr>
          <tr><td>Abonnements- en betaalstatus</td><td>Abonnementstype, betaalstatus, factuurhistorie — <strong>niet</strong> je kaartgegevens zelf</td><td>Accounthouder, via Stripe</td></tr>
          <tr><td>Kijk- en profielgegevens</td><td>Bekeken content, kijkvoortgang, profielnamen, leeftijdscategorie van kinderprofielen</td><td>Accounthouder</td></tr>
          <tr><td>Ouderlijke pincode</td><td>Alleen gehashte (versleutelde) vorm, niet leesbaar door ons</td><td>Accounthouder</td></tr>
        </tbody>
      </table>
      <p>
        Kaartgegevens (nummer, vervaldatum, CVC) worden nooit door ons ontvangen of opgeslagen.
        Deze worden rechtstreeks en uitsluitend door Stripe verwerkt.
      </p>
      <p>
        <strong>Kinderprofielen:</strong> profielnamen en leeftijdscategorieën voor kinderprofielen
        worden gekozen door de ouder/voogd, niet door het kind zelf. Wij adviseren ouders om geen
        achternaam of andere identificerende informatie in de profielnaam te gebruiken
        (bijvoorbeeld een voornaam of bijnaam volstaat).
      </p>

      <h2>3. Waarvoor wij gegevens gebruiken en op welke grondslag</h2>
      <table>
        <thead><tr><th>Doel</th><th>Grondslag (AVG)</th></tr></thead>
        <tbody>
          <tr><td>Account aanmaken, inloggen via magic link, abonnement uitvoeren</td><td>Uitvoering van de overeenkomst (art. 6.1.b AVG)</td></tr>
          <tr><td>Facturatie en administratie</td><td>Wettelijke verplichting (art. 6.1.c AVG)</td></tr>
          <tr><td>Beveiliging, fraudepreventie, misbruik van vouchers voorkomen</td><td>Gerechtvaardigd belang (art. 6.1.f AVG)</td></tr>
          <tr><td>Marketing-e-mail (nieuwsbrief, aanbiedingen)</td><td>Toestemming (art. 6.1.a AVG) — apart en vrij herroepbaar</td></tr>
        </tbody>
      </table>

      <h2>4. Wie jouw gegevens verwerkt namens ons (&ldquo;verwerkers&rdquo;)</h2>
      <table>
        <thead><tr><th>Partij</th><th>Rol</th><th>Locatie</th></tr></thead>
        <tbody>
          <tr><td>Supabase</td><td>Database en accountbeheer/authenticatie</td><td>EU (Frankfurt, Duitsland)</td></tr>
          <tr><td>Stripe</td><td>Betalingsverwerking</td><td>Verwerkt wereldwijd; EU-onderdeel van Stripe is verwerkingsverantwoordelijke voor betaalgegevens; standaardcontractbepalingen (SCC&rsquo;s) van toepassing waar gegevens buiten de EER worden verwerkt</td></tr>
          <tr><td>Bunny.net</td><td>Videolevering (CDN/streaming)</td><td>Netwerk van servers wereldwijd voor snelle levering; SCC&rsquo;s van toepassing waar van toepassing</td></tr>
          <tr><td>Resend</td><td>Transactionele e-mail (bijv. inloglink, bevestigingen)</td><td>Zie leverancier voor serverlocatie; SCC&rsquo;s van toepassing waar van toepassing</td></tr>
          <tr><td>Plausible</td><td>Website-analyse, zonder cookies en zonder persoonlijke tracking</td><td>EU</td></tr>
          <tr><td>Brevo</td><td>Marketing-e-mail, alleen voor contacten die daar expliciet toestemming voor hebben gegeven</td><td>EU</td></tr>
        </tbody>
      </table>

      <h2>5. Doorgifte buiten de EER</h2>
      <p>
        Voor zover een verwerker gegevens buiten de Europese Economische Ruimte verwerkt, zorgen
        wij ervoor dat dit gebeurt op basis van een geldig doorgiftemechanisme, zoals de
        standaardcontractbepalingen (Standard Contractual Clauses / SCC&rsquo;s) van de Europese
        Commissie.
      </p>

      <h2>6. Bewaartermijnen</h2>
      <p>
        <strong>Accountgegevens en profielgegevens:</strong> bewaard zolang je account actief is.
        Bij verwijdering van je account worden deze gegevens verwijderd binnen{' '}
        <code>[X]</code> dagen, behalve voor zover wij gegevens langer moeten bewaren op grond van
        artikel 6.3 hieronder.
      </p>
      <p>
        <strong>Financiële/factuurgegevens:</strong> facturen en betaalgegevens die via Stripe
        worden verwerkt, worden bewaard gedurende de wettelijke bewaartermijn voor de fiscale
        administratie: 7 jaar, conform de Nederlandse Belastingdienst.
      </p>

      <h2>7. Jouw rechten</h2>
      <p>
        Je hebt het recht op inzage, rectificatie, verwijdering (recht op vergetelheid), beperking
        van de verwerking, overdraagbaarheid van gegevens (dataportabiliteit), en bezwaar tegen
        verwerking op basis van gerechtvaardigd belang of tegen direct marketing.
      </p>
      <p>Je kunt deze rechten uitoefenen door:</p>
      <ul>
        <li>
          Zelf, via je accountpagina: gegevens inzien, exporteren of je account (inclusief
          onderliggende kinderprofielen) verwijderen; of
        </li>
        <li>Door contact op te nemen via <code>[CONTACT-EMAIL]</code>.</li>
      </ul>
      <p>Wij reageren binnen de wettelijke termijn (in beginsel binnen één maand).</p>

      <h2>8. Kinderen en het Platform</h2>
      <p>
        Het Platform is bedoeld voor gebruik dóór kinderen, maar de account-/contractrelatie is
        met de ouder of voogd, niet met het kind. Wij:
      </p>
      <ul>
        <li>tonen geen advertenties aan kinderen;</li>
        <li>gebruiken geen tracking of profilering van kinderprofielen voor advertentiedoeleinden;</li>
        <li>plaatsen geen trackingcookies of scripts van derden op profielpagina&rsquo;s van kinderen;</li>
        <li>
          laten kinderprofielen niet zelf accountgegevens of instellingen wijzigen buiten wat de
          ouder/voogd toestaat (bijv. via de ouderlijke pincode).
        </li>
      </ul>

      <h2>9. Cookies</h2>
      <p>Wij gebruiken alleen functionele cookies die nodig zijn om het Platform te laten werken:</p>
      <ul>
        <li>een sessiecookie om je ingelogd te houden;</li>
        <li>een cookie om je taalvoorkeur te onthouden;</li>
        <li>een cookie om te onthouden welk kinderprofiel is geselecteerd.</li>
      </ul>
      <p>
        Wij gebruiken geen trackingcookies en geen cookies voor advertentiedoeleinden. Onze
        websitestatistieken worden verzameld via Plausible Analytics, een privacyvriendelijk
        analysehulpmiddel dat geen cookies gebruikt en geen individuele bezoekers volgt. Omdat wij
        geen trackingcookies plaatsen, is voor het gebruik van het Platform geen cookiebanner met
        toestemmingsvraag vereist voor deze functionele cookies.
      </p>

      <h2>10. Beveiliging</h2>
      <p>
        Wij nemen passende technische en organisatorische maatregelen om je gegevens te
        beschermen, zoals versleuteling van gegevens onderweg (SSL/TLS) en gehashte opslag van de
        ouderlijke pincode. Geen enkele methode van opslag of verzending via internet is echter
        100% veilig; wij kunnen absolute veiligheid niet garanderen.
      </p>

      <h2>11. Wij verkopen jouw gegevens niet</h2>
      <p>
        Wij verkopen, verhuren of delen je persoonsgegevens niet met derden voor hun eigen
        commerciële doeleinden. Gegevens worden alleen gedeeld met de verwerkers genoemd in artikel
        4, voor de daar genoemde doeleinden.
      </p>

      <h2>12. Bedrijfsovername</h2>
      <p>
        Als Stichting alAsr betrokken raakt bij een fusie, overname, of overdracht van (een deel
        van) haar activiteiten, kunnen persoonsgegevens als onderdeel daarvan worden overgedragen.
        Wij zullen je hierover informeren en, waar vereist, opnieuw toestemming vragen.
      </p>

      <h2>13. Klachtrecht</h2>
      <p>
        Ben je het niet eens met de manier waarop wij je gegevens verwerken? Neem dan eerst contact
        met ons op via <code>[CONTACT-EMAIL]</code>. Je hebt daarnaast het recht om een klacht in
        te dienen bij de Autoriteit Persoonsgegevens (www.autoriteitpersoonsgegevens.nl).
      </p>

      <h2>14. Wijzigingen in dit beleid</h2>
      <p>
        Wij kunnen dit privacybeleid van tijd tot tijd wijzigen. Bij wezenlijke wijzigingen
        informeren wij je per e-mail voordat de wijziging ingaat.
      </p>

      <hr />

      <h2>English summary (informal — Dutch version above is legally binding)</h2>
      <p>
        This is a plain-language summary only. <strong>The Dutch text above is the legally binding
        version.</strong>
      </p>
      <ul>
        <li><strong>Controller:</strong> Stichting alAsr, Amsterdam. Contact: <code>[CONTACT-EMAIL]</code>.</li>
        <li>
          <strong>What we collect:</strong> email, optional name, subscription/payment status
          (never your card details — those go straight to Stripe), and viewing/profile data
          including kid-profile names and age bands, which parents choose (we suggest using a
          first name or nickname, not a full name).
        </li>
        <li><strong>Parental PIN:</strong> stored only in hashed (encrypted) form — we can&rsquo;t read it.</li>
        <li>
          <strong>Why we process data:</strong> contract performance (running your membership),
          legal obligation (invoicing), legitimate interest (security/fraud prevention), and
          consent (marketing email only — separate from and never bundled with account/security
          email).
        </li>
        <li>
          <strong>Who else touches your data:</strong> Supabase (EU/Frankfurt — database and
          login), Stripe (payments), Bunny.net (video delivery), Resend (transactional email),
          Plausible (cookieless analytics, EU), Brevo (marketing email, opt-in only).
        </li>
        <li>
          <strong>How long we keep it:</strong> account/profile data while your account is active
          plus <code>[X]</code> days after deletion; invoices/payment records for 7 years as
          required by Dutch tax law, regardless of when you close your account.
        </li>
        <li>
          <strong>Your rights:</strong> access, correction, deletion, portability, and objection —
          self-service from your account page, or email <code>[CONTACT-EMAIL]</code>.
        </li>
        <li>
          <strong>Kids:</strong> the platform is for children, but the account/contract is with the
          parent or guardian. No ads, no profiling of kids for advertising, no third-party
          trackers on child profiles.
        </li>
        <li>
          <strong>Cookies:</strong> functional only (session, language, selected profile) — no
          tracking cookies, no consent banner needed. Plausible analytics is cookieless.
        </li>
        <li>
          <strong>Complaints:</strong> contact us first at <code>[CONTACT-EMAIL]</code>; you can
          also complain to the Dutch Data Protection Authority (Autoriteit Persoonsgegevens).
        </li>
      </ul>
    </LegalPage>
  );
}
