import LegalPage from '../../components/LegalPage';

export const metadata = { title: 'Terms of service — Albunyaan TV' };

/**
 * Ported from docs/legal/terms-draft.md — DRAFT, pending founder + legal
 * sign-off (see docs/legal/README.md). Keep this page in sync with that file;
 * it is the source of truth for what changed vs. the live Uscreen-hosted terms
 * and why (docs/legal/source-uscreen-terms.txt).
 */
export default function TermsPage() {
  return (
    <LegalPage label="Legal" title="Servicevoorwaarden — Albunyaan.tv">
      <p>
        <strong>Laatst bijgewerkt:</strong> <code>[DATUM — invullen bij publicatie]</code>
        <br />
        <strong>Aanbieder:</strong> Stichting alAsr, gevestigd te Amsterdam
        <br />
        <strong>KvK-nummer:</strong> <code>[KVK-NUMMER]</code>
        <br />
        <strong>Contact:</strong> <code>[CONTACT-EMAIL]</code>
      </p>

      <h2>1. Toepasselijkheid</h2>
      <p>
        Deze servicevoorwaarden zijn van toepassing op elk gebruik van het platform Albunyaan.tv
        (hierna: &ldquo;het Platform&rdquo;), aangeboden door Stichting alAsr (hierna:
        &ldquo;wij&rdquo;, &ldquo;ons&rdquo;). Door een account aan te maken of een abonnement af
        te sluiten, ga je akkoord met deze voorwaarden.
      </p>

      <h2>2. Het Platform</h2>
      <p>
        Het Platform biedt via internet (web en, indien beschikbaar, mobiele apps) toegang tot
        video- en audiocontent voor kinderen, gebaseerd op de islamitische traditie. Toegang wordt
        verleend op abonnementsbasis.
      </p>

      <h2>3. Account en registratie</h2>
      <p>
        3.1. Een account wordt aangemaakt met een e-mailadres. Inloggen gebeurt via een
        &ldquo;magic link&rdquo; die per e-mail wordt verstuurd — er is geen wachtwoord.
      </p>
      <p>
        3.2. Een account wordt aangemaakt en beheerd door een volwassene (ouder of voogd).
        Kinderprofielen (&ldquo;huishoudprofielen&rdquo;) worden binnen het account aangemaakt
        door deze volwassene en kunnen worden beveiligd met een ouderlijke pincode. De
        accounthouder is verantwoordelijk voor het gebruik van het Platform door kinderen aan wie
        hij of zij toegang geeft, en voor het geheimhouden van de pincode.
      </p>
      <p>
        3.3. Je bent verantwoordelijk voor de juistheid van de gegevens die je bij registratie
        opgeeft en voor alle activiteit die via jouw account plaatsvindt.
      </p>

      <h2>4. Abonnementen en prijzen</h2>
      <p>4.1. Het Platform is beschikbaar via de volgende abonnementsvormen:</p>
      <ul>
        <li>€6,50 per maand</li>
        <li>€65 per jaar</li>
      </ul>
      <p>
        4.2. Betalingen worden verwerkt door Stripe. Wij ontvangen en bewaren zelf geen
        betaalkaartgegevens; deze worden uitsluitend door Stripe verwerkt.
      </p>
      <p>
        4.3. Abonnementen worden automatisch verlengd (maandelijks of jaarlijks, afhankelijk van
        je keuze) totdat je opzegt.
      </p>
      <p>
        4.4. Prijzen kunnen worden gewijzigd. Bij een prijswijziging word je vooraf per e-mail
        geïnformeerd en kun je opzeggen voordat de nieuwe prijs ingaat.
      </p>

      <h2>5. Herroepingsrecht (bedenktijd) bij digitale content</h2>
      <p>
        5.1. Als consument heb je op grond van Europees en Nederlands recht normaal gesproken 14
        dagen bedenktijd na het sluiten van een overeenkomst op afstand, waarbinnen je de
        overeenkomst kosteloos kunt herroepen.
      </p>
      <p>
        5.2. Omdat het Platform digitale inhoud levert die niet op een fysieke drager staat, vragen
        wij bij het afrekenen jouw uitdrukkelijke toestemming om direct te starten met de levering
        van de dienst, en erken je dat je daarmee je herroepingsrecht verliest zodra de uitvoering
        van de overeenkomst is begonnen. Zonder deze toestemming kun je niet direct na aankoop
        toegang krijgen tot het Platform.
      </p>
      <p>
        5.3. Deze toestemming wordt apart en expliciet gevraagd tijdens het afrekenproces
        (checkout), naast — niet in plaats van — de acceptatie van deze voorwaarden.
      </p>

      <h2>6. Opzeggen</h2>
      <p>
        6.1. Je kunt je abonnement op elk moment opzeggen, zelf en direct, via het klantportaal
        (Stripe Customer Portal), toegankelijk vanuit je accountpagina.
      </p>
      <p>
        6.2. Opzegging gaat in aan het einde van de lopende betaalperiode. Je houdt toegang tot het
        Platform tot die datum. Er wordt geen (aanvullende) teruggave van reeds betaalde bedragen
        gedaan voor de resterende periode, tenzij dwingend consumentenrecht dit vereist.
      </p>
      <p>6.3. Aan opzegging zijn geen kosten verbonden.</p>

      <h2>7. Vouchers en tegoedbonnen</h2>
      <p>7.1. Vouchers zijn niet overdraagbaar en kunnen niet worden ingewisseld voor geld.</p>
      <p>
        7.2. Elke voucher heeft een vervaldatum die op de voucher zelf of in de begeleidende
        e-mail wordt vermeld. Na de vervaldatum kan de voucher niet meer worden gebruikt.
      </p>
      <p>7.3. Bij misbruik of vermoeden van fraude kunnen wij een voucher ongeldig verklaren.</p>

      <h2>8. Toegestaan gebruik</h2>
      <p>
        8.1. Je gebruikt het Platform uitsluitend voor persoonlijk, niet-commercieel gebruik
        binnen je eigen huishouden.
      </p>
      <p>
        8.2. Het is niet toegestaan om: het Platform te gebruiken voor onwettige doeleinden; de
        beveiliging van het Platform te omzeilen of te testen zonder toestemming; content te
        kopiëren, te herdistribueren, openbaar te maken of te downloaden buiten de functionaliteit
        die het Platform daarvoor zelf biedt; de app of website te decompileren, te
        reverse-engineeren of aan te passen.
      </p>
      <p>
        8.3. Wij verlenen je een persoonlijke, niet-exclusieve, niet-overdraagbare licentie om
        content op het Platform te bekijken zolang je abonnement actief is. Deze licentie geeft
        geen eigendomsrecht op de content.
      </p>

      <h2>9. Beschikbaarheid en aansprakelijkheid</h2>
      <p>
        9.1. Wij spannen ons in om het Platform beschikbaar en foutloos te laten functioneren,
        maar garanderen dit niet. Het Platform wordt geleverd &ldquo;zoals het is&rdquo; (&ldquo;as
        is&rdquo;).
      </p>
      <p>
        9.2. Wij zijn niet aansprakelijk voor schade als gevolg van onderbrekingen, storingen, of
        tijdelijke ontoegankelijkheid van het Platform, tenzij sprake is van opzet of grove
        nalatigheid onzerzijds.
      </p>
      <p>
        9.3. Onze aansprakelijkheid is in alle gevallen beperkt tot het bedrag dat je in de twaalf
        maanden voorafgaand aan de schadeveroorzakende gebeurtenis aan ons hebt betaald. Wij zijn
        niet aansprakelijk voor indirecte schade of gevolgschade.
      </p>
      <p>
        9.4. Niets in deze voorwaarden beperkt aansprakelijkheid die naar Nederlands recht niet mag
        worden uitgesloten of beperkt (zoals bij opzet of bewuste roekeloosheid).
      </p>

      <h2>10. Wijzigingen</h2>
      <p>
        Wij kunnen deze voorwaarden wijzigen. Bij een wezenlijke wijziging informeren wij je per
        e-mail voordat de wijziging ingaat. Als je niet akkoord gaat, kun je je abonnement opzeggen
        zoals beschreven in artikel 6.
      </p>

      <h2>11. Toepasselijk recht en geschillen</h2>
      <p>
        Op deze voorwaarden is Nederlands recht van toepassing. Geschillen worden voorgelegd aan de
        bevoegde rechter in Nederland, onverminderd het recht van consumenten om zich te wenden tot
        de rechter van hun eigen woonplaats waar dwingend recht dit voorschrijft.
      </p>

      <h2>12. Contact</h2>
      <p>
        Vragen over deze voorwaarden kun je richten aan <code>[CONTACT-EMAIL]</code>.
      </p>

      <hr />

      <h2>English summary (informal — Dutch version above is legally binding)</h2>
      <p>
        This is a plain-language summary only. <strong>The Dutch text above is the legally binding
        version.</strong>
      </p>
      <ul>
        <li>
          <strong>Who we are:</strong> Albunyaan.tv is operated by Stichting alAsr, a foundation
          based in Amsterdam, Netherlands. (<code>[KVK-NUMMER]</code> placeholder — pending.)
        </li>
        <li>
          <strong>What it is:</strong> a subscription video platform for children, built on the
          Islamic tradition.
        </li>
        <li>
          <strong>Account:</strong> email-based, no password — you log in with a magic link sent to
          your inbox. The account is created and managed by a parent/guardian; kid profiles inside
          the household account can be PIN-protected.
        </li>
        <li>
          <strong>Price:</strong> €6.50/month or €65/year, billed via Stripe. We never see or store
          your card details.
        </li>
        <li>
          <strong>Cancel any time:</strong> self-service via the Stripe Customer Portal from your
          account page. Cancellation takes effect at the end of the period you&rsquo;ve already
          paid for — no fees, no need to call anyone.
        </li>
        <li>
          <strong>14-day right of withdrawal:</strong> under EU consumer law you normally have 14
          days to cancel a distance contract for free. Because this is digital content, we ask for
          your explicit consent at checkout to start delivering the service immediately — which
          means you give up that 14-day right once playback/access has started.
        </li>
        <li>
          <strong>Vouchers:</strong> non-transferable, cannot be exchanged for cash, and expire on
          the date shown on the voucher.
        </li>
        <li>
          <strong>Fair use:</strong> personal, household use only — no redistribution, scraping, or
          reverse engineering.
        </li>
        <li>
          <strong>Liability:</strong> the service is provided &ldquo;as is&rdquo;; our liability is
          capped at what you paid us in the past 12 months, except where Dutch law doesn&rsquo;t
          allow that cap (e.g. intentional harm).
        </li>
        <li>
          <strong>Governing law:</strong> the Netherlands, without prejudice to your rights as an EU
          consumer to bring a claim in your own country of residence.
        </li>
      </ul>
    </LegalPage>
  );
}
