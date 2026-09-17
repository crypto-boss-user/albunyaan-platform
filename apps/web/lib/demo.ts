/**
 * Demo-modus: een publiek doorklikbare admin op VERZONNEN gegevens.
 *
 * Waarom dit bestaat: collega's moeten de nagebouwde admin zélf kunnen doorklikken zonder account,
 * zonder TOTP, en zonder ooit een echt lid te zien (B82). Screenshots volstonden niet.
 *
 * ⚠️ Dit bestand zet een beveiligingspoort open. Daarom drie sloten, en het derde is het echte:
 *
 *  1. `ALBUNYAAN_DEMO=1` moet gezet zijn. Alleen de demo-deployment heeft dat.
 *  2. De vlag komt uitsluitend uit een SERVER-omgevingsvariabele — nooit uit een querystring,
 *     header of cookie, want die kan een bezoeker zelf zetten.
 *  3. **De demo weigert te starten zodra er productie-Supabase-gegevens in de omgeving staan.**
 *     Dat is het slot dat telt: raakt de vlag ooit per ongeluk in de echte deployment, dan blijft
 *     de poort dicht omdat die deployment wél een `SUPABASE_URL` naar het productieproject heeft.
 *     Demo-modus en productiegegevens kunnen per definitie niet samen bestaan.
 *
 * In demo-modus wordt er geen enkele database bevraagd: alles komt uit `demo-data.ts`.
 */

/** Het productieproject. Staat deze ref in de omgeving, dan is demo-modus onmogelijk. */
const PRODUCTIE_REF = 'hfqdewsybdoxlmjkjoie';

export function isDemo(): boolean {
  if (process.env.ALBUNYAAN_DEMO !== '1') return false;
  const url = process.env.SUPABASE_URL ?? '';
  if (url.includes(PRODUCTIE_REF)) return false; // slot 3 — nooit demo op productiegegevens
  return true;
}

/**
 * Elke schrijfactie is in demo-modus verboden. Niet stil negeren: de bezoeker moet zien dát het
 * geweigerd is, anders lijkt de demo kapot in plaats van alleen-lezen.
 */
export class DemoAlleenLezen extends Error {
  constructor(wat = 'Deze actie') {
    super(`${wat} werkt niet in de demo — dit is een doorkijk met verzonnen gegevens.`);
    this.name = 'DemoAlleenLezen';
  }
}

export function weigerInDemo(wat?: string): void {
  if (isDemo()) throw new DemoAlleenLezen(wat);
}
