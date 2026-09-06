import { describe, it, expect } from 'vitest';
import { plaatsVideos, vormTokens, pad99, haalCollectieDetails, zonderMislukteCollecties } from '../lib/archief-plaatsing.mjs';

// Synthetische test (B74/B75, 2026-09-05): één nieuwe video in 2 directe categorieën + 1 bekende collectie.
const ctx = () => ({
  serieVanCollectie: new Map([['555', { collection: '555', dirs: ['07 - Age 5-9/010 - Serie X'], eps: [{ id: '1', bestand: '01 - A' }, { id: '2', bestand: '02 - B' }] }]]),
  collectieInfo: new Map(),
  catVanItem: new Map([['555', ['07']]]),
  catNr: new Map([['c7', '07'], ['c12', '12']]),
  catDirNaam: new Map([['07', '07 - Age 5-9'], ['12', '12 - Kids']]),
  serieNummers: new Map([['07', 10], ['12', 3]]),
  serieBreedte: new Map([['07', 3], ['12', 3]]),
  epNummer: new Map([['555', 2]]),
  epBreedte: new Map([['555', 2]]),
  san: (naam) => String(naam).replace(/[\\/:*?"<>|]/g, '_').trim(),
});

describe('plaatsVideos (lib/archief-plaatsing.mjs)', () => {
  it('collectie + 2 directe categorieën → seriepad als dest, losmap in elke categorie als ook_in (B74)', () => {
    const c = ctx();
    const { nieuweRijen, geraakteSeries, losseVideos, lossePlekken } = plaatsVideos(
      [{ id: '9001', title: 'Nieuwe titel', collection_ids: ['555'], category_ids: ['c12', 'c7', 'c7'] }], c);
    expect(nieuweRijen).toEqual([{
      id: '9001',
      dest: '07 - Age 5-9/010 - Serie X/03 - Nieuwe titel',
      ook_in: ['07 - Age 5-9/011 - Nieuwe titel/Nieuwe titel', '12 - Kids/004 - Nieuwe titel/Nieuwe titel'],
    }]);
    expect(lossePlekken).toBe(2);
    expect(losseVideos).toEqual([]);
    expect(geraakteSeries.get('555')).toMatchObject({ nieuw: false });
    expect(c.serieVanCollectie.get('555').eps.at(-1)).toEqual({ id: '9001', bestand: '03 - Nieuwe titel' });
    expect(c.serieNummers.get('07')).toBe(11);
    expect(c.serieNummers.get('12')).toBe(4);
  });
  it("zonder collectie, 1 categorie → losmap-vorm (B75); twee video's in dezelfde categorie tellen door", () => {
    const c = ctx();
    const { nieuweRijen, losseVideos } = plaatsVideos([
      { id: '9002', title: 'Los één', collection_ids: [], category_ids: ['c12'] },
      { id: '9003', title: 'Los twee', collection_ids: [], category_ids: ['c12'] },
    ], c);
    expect(nieuweRijen.map((r) => r.dest)).toEqual(['12 - Kids/004 - Los één/Los één', '12 - Kids/005 - Los twee/Los twee']);
    expect(nieuweRijen.every((r) => r.ook_in.length === 0)).toBe(true);
    expect(losseVideos.map((v) => v.id)).toEqual(['9002', '9003']);
  });
  it('noch collectie noch categorie → losmap in de 99-map, id in de mapnaam (B79)', () => {
    const c = ctx();
    const { nieuweRijen, losseVideos, lossePlekken } = plaatsVideos([
      { id: '9004', title: 'Zwerver', collection_ids: [], category_ids: [] },
      { id: '9005', title: 'Zwerver', collection_ids: ['onbekend'], category_ids: ['geen-cat'] },   // onbekende collectie/categorie tellen niet
    ], c);
    expect(nieuweRijen).toEqual([
      { id: '9004', dest: '99 - Buiten categorieën/Zwerver (9004)/Zwerver', ook_in: [] },
      { id: '9005', dest: '99 - Buiten categorieën/Zwerver (9005)/Zwerver', ook_in: [] },
    ]);
    expect(losseVideos.map((v) => v.id)).toEqual(['9004', '9005']);
    expect(lossePlekken).toBe(0);                      // de 99-map telt niet als categorie-plek
    expect(c.serieNummers.get('07')).toBe(10);         // geen categorieteller verbruikt
  });
  it('vormTokens: serie/los/losmap/kaal per categorie, nummers tellen niet mee', () => {
    const serieDirSet = new Set(['07 - Age 5-9/010 - Serie X']);
    expect(vormTokens(['07 - Age 5-9/010 - Serie X/03 - T', '07 - Age 5-9/011 - T/T', '12 - Kids/004 - T/T', '09 - Age 16+/65 - T'], serieDirSet))
      .toEqual(['07:los:losmap', '07:serie:-', '09:los:kaal', '12:los:losmap']);
    expect(vormTokens(['99 - Buiten categorieën/Z (1)/Z', '99 - Buiten categorieën/Z (2)'], serieDirSet)).toEqual(['99:los:kaal', '99:los:losmap']);
  });
});

// B79-fixes (founder 2026-09-06): fail-closed bij een mislukte collectie-detailcall + nood-terugval in losmap-vorm.
describe('haalCollectieDetails (fail-closed) + zonderMislukteCollecties', () => {
  const geheugen = () => { const l = []; const e = []; return { log: (m) => l.push(m), logErr: (m) => e.push(m), sleep: async () => {}, l, e }; };
  it('detailcall blijft falen → collectie in mislukt, regel in fouten.log (1×), video niet geplaatst, geen 99-pad', async () => {
    const g = geheugen(); let calls = 0;
    const api = async () => { calls++; return { __err: 500 }; };
    const { collectieInfo, liveRegels, mislukt } = await haalCollectieDetails(['777'], api, g);
    expect(calls).toBe(3);                                  // 1 + 2 herkansingen
    expect([...mislukt]).toEqual(['777']);
    expect(collectieInfo.size).toBe(0); expect(liveRegels.size).toBe(0);
    expect(g.e).toHaveLength(1); expect(g.e[0]).toMatch(/^COLLECTIE-DETAILS MISLUKT 777 \(500\)/);
    const video = { id: '9010', title: 'Afl', collection_ids: ['777'], category_ids: ['c12'] };
    const { door, overgeslagen } = zonderMislukteCollecties([video], mislukt);
    expect(door).toEqual([]); expect(overgeslagen).toEqual([video]);
    const { nieuweRijen } = plaatsVideos(door, ctx());
    expect(nieuweRijen).toEqual([]);                        // niets geplaatst: geen 99-pad, geen losmap in c12
  });
  it('mislukt na één herkansing alsnog goed → geplaatst; een andere video zonder die collectie gaat gewoon door', async () => {
    const g = geheugen(); let n = 0;
    const api = async () => (++n === 1 ? { __err: 502 } : { collection: { id: 555, title: 'S', meta_title: 'Serie X', release_stage: 'published', playlist_items: [{ subject_id: 2 }, { subject_id: 9011 }] } });
    const { collectieInfo, mislukt } = await haalCollectieDetails(['555'], api, g);
    expect(mislukt.size).toBe(0); expect(g.e).toEqual([]); expect(g.l).toHaveLength(1);
    expect(collectieInfo.get('555')).toEqual({ titel: 'Serie X', volgorde: ['2', '9011'] });
    const { door, overgeslagen } = zonderMislukteCollecties([
      { id: '9011', title: 'A', collection_ids: ['555'], category_ids: [] },
      { id: '9012', title: 'B', collection_ids: [], category_ids: ['c12'] },
    ], mislukt);
    expect(door.map((v) => v.id)).toEqual(['9011', '9012']); expect(overgeslagen).toEqual([]);
  });
  it('401/403 = sessie weg: geen herkansing, geen "mislukt", maar een fout met code SESSIE (aanroeper → exit 2)', async () => {
    const g = geheugen(); let calls = 0;
    const api = async () => { calls++; return { __err: 401 }; };
    await expect(haalCollectieDetails(['777'], api, g)).rejects.toMatchObject({ code: 'SESSIE' });
    expect(calls).toBe(1); expect(g.e).toEqual([]);
  });
  it('200 zonder collection (verwijderde collectie) → ook mislukt; video in 2 collecties waarvan 1 mislukt → overgeslagen', async () => {
    const g = geheugen();
    const api = async (_pad, body) => (body.id === 1 ? { collection: null } : { collection: { id: 2, title: 'Goed', playlist_items: [] } });
    const { collectieInfo, mislukt } = await haalCollectieDetails(['1', '2'], api, g);
    expect([...mislukt]).toEqual(['1']); expect([...collectieInfo.keys()]).toEqual(['2']);
    expect(g.e).toHaveLength(1); expect(g.e[0]).toMatch(/MISLUKT 1 \(geen collectie\)/);
    const twee = { id: '9020', title: 'Dubbel', collection_ids: ['2', '1'], category_ids: ['c7'] };
    const { door, overgeslagen } = zonderMislukteCollecties([twee], mislukt);
    expect(door).toEqual([]); expect(overgeslagen).toEqual([twee]);   // fail-closed: geen deelplaatsing (na plaatsing is de video "bekend")
  });
  it('nood-terugval (archive-request-links) = dezelfde losmap-vorm als de wachter', () => {
    expect(pad99('Zwerver', '9004')).toBe('99 - Buiten categorieën/Zwerver (9004)/Zwerver');
    const { nieuweRijen } = plaatsVideos([{ id: '9004', title: 'Zwerver', collection_ids: [], category_ids: [] }], ctx());
    expect(nieuweRijen[0].dest).toBe(pad99('Zwerver', '9004'));
  });
});
