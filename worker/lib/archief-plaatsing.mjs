/**
 * archief-plaatsing.mjs — het plaatsingsbeleid van de wachter (archief-bijwerken.mjs) als pure functie,
 * zodat dezelfde regels offline herspeeld (AS 13.1 "herspeling", --dry) en getest (vitest) kunnen worden.
 *
 * Regels (teambesluiten 2026-08-11/12, AS 13/B57 2026-09-05, B74/B75 2026-09-05):
 *  - collectie  → aflevering in ELKE seriemap van die collectie (dirs), nummer achteraan (append-only);
 *  - directe categorie → eigen losmap "<categoriemap>/<nn> - <titel>/<titel>" in ELKE directe categorie,
 *    óók als de video daarnaast in een collectie zit (B74; referentie = de 8 bestaande gevallen in het
 *    archief, bv. 1772838: seriepad 08/127 + losmap 08/147 + losmap 09/63);
 *  - losmap-vorm (B75, correctie 1b 12-08): cover.jpg, beschrijving.txt en zoekwoorden.txt staan naakt in
 *    die map — archive-extras.mjs vult ze (kaal = per structuur-regel "zonder extra's" en wordt overgeslagen);
 *  - noch collectie noch categorie → losmap "99 - Buiten categorieën/<titel> (<id>)/<titel>" (B79, founder
 *    2026-09-05: de wachter volgt het archief — de 113 bestaande losse 99-plekken hebben allemaal die vorm; het id in
 *    de mapnaam blijft, want zonder categorie-volgnummer is het de enige ontdubbelaar bij gelijke titels).
 *  dest = eerste seriepad (categorieën oplopend), anders eerste losse pad; de rest = ook_in — de hardlinks
 *  maakt de bestaande ophaalstroom (archive-request-links.mjs 'links' → archive-fetch.sh make_links).
 *
 * ctx (alles Maps op string-ids; worden GEMUTEERD — tellers lopen door, eps van geraakte series groeien):
 *   serieVanCollectie  cid → { collection, dirs[], eps[{id,bestand}] }   (structuur-series.jsonl)
 *   collectieInfo      cid → { titel, volgorde[] }                       (details van nieuwe collecties)
 *   catVanItem         collectie-id → [nr]                               (categories.show; voor nieuwe series)
 *   catNr              categorie-id → "07"                               (categories.index)
 *   catDirNaam         "07" → "07 - العمر - Age 5-9"
 *   serieNummers/serieBreedte  "07" → hoogste serienummer / cijferbreedte
 *   epNummer/epBreedte         cid → hoogste afleveringnummer / cijferbreedte
 *   san(naam, waar)    naamhygiëne van de aanroeper
 */
export function plaatsVideos(nieuweVideos, ctx) {
  const { serieVanCollectie, collectieInfo, catVanItem, catNr, catDirNaam, serieNummers, serieBreedte, epNummer, epBreedte, san } = ctx;
  const volgendeSerieNr = (nr) => {
    const n = (serieNummers.get(nr) ?? 0) + 1;
    serieNummers.set(nr, n);
    return String(n).padStart(serieBreedte.get(nr) ?? 2, '0');
  };
  const nieuweRijen = [];
  const geraakteSeries = new Map();
  const losseVideos = [];        // zonder (bekende) collectie — informatief voor de logregel
  let lossePlekken = 0;
  for (const v of nieuweVideos) {
    const paden = [];
    // ── seriepaden: elke bekende of nieuwe collectie, categorieën oplopend ──
    const cids = (v.collection_ids ?? []).filter((c) => serieVanCollectie.has(c) || collectieInfo.has(c));
    const gesorteerd = cids.slice().sort((a, b) => {
      const na = (catVanItem.get(a) ?? ['99'])[0] ?? '99';
      const nb = (catVanItem.get(b) ?? ['99'])[0] ?? '99';
      return na.localeCompare(nb);
    });
    for (const cid of gesorteerd) {
      let s = serieVanCollectie.get(cid);
      if (!s) {
        const nrs = catVanItem.get(cid) ?? ['99'];
        const naam = san(collectieInfo.get(cid)?.titel ?? `collectie ${cid}`, `serie ${cid}`);
        const dirs = nrs.map((nr) => `${catDirNaam.get(nr) ?? '99 - Buiten categorieën'}/${volgendeSerieNr(nr)} - ${naam}`);
        s = { collection: cid, dirs, eps: [] };
        serieVanCollectie.set(cid, s);
        geraakteSeries.set(cid, { nieuw: true, serie: s });
        epNummer.set(cid, 0);
        epBreedte.set(cid, 2);
      } else if (!geraakteSeries.has(cid)) {
        geraakteSeries.set(cid, { nieuw: false, serie: s });
      }
      const n = (epNummer.get(cid) ?? 0) + 1;
      epNummer.set(cid, n);
      const bestand = `${String(n).padStart(epBreedte.get(cid) ?? 2, '0')} - ${san(v.title, `video ${v.id}`)}`;
      s.eps.push({ id: v.id, bestand });
      for (const d of s.dirs) paden.push(`${d}/${bestand}`);
    }
    // ── losse plekken: eigen losmap in ELKE directe categorie (B74/B75; AS 13/B57) ──
    // Set: een dubbel category_id zou anders twee serienummers in dezelfde map verbruiken.
    const nrs = [...new Set((v.category_ids ?? []).map((c) => catNr.get(String(c))).filter(Boolean))].sort();
    // naam alleen saneren als hij gebruikt wordt (anders een tweede, misleidende regel in structuur-hernoemd.log)
    const naam = nrs.length || !cids.length ? san(v.title, `losse video ${v.id}`) : null;
    for (const nr of nrs) paden.push(`${catDirNaam.get(nr)}/${volgendeSerieNr(nr)} - ${naam}/${naam}`);
    lossePlekken += nrs.length;
    if (!cids.length) losseVideos.push(v);
    if (!paden.length) paden.push(`99 - Buiten categorieën/${naam} (${v.id})/${naam}`);   // losmap-vorm (B79)
    nieuweRijen.push({ id: v.id, dest: paden[0], ook_in: paden.slice(1) });
  }
  return { nieuweRijen, geraakteSeries, losseVideos, lossePlekken };
}

/**
 * Vorm-tokens van een padenlijst, voor de herspeling tegen structuur.jsonl: per pad "<nr>:<serie|los>:<losmap|kaal>".
 * Nummers tellen bewust niet mee (append-only: een herspeling nummert altijd anders); het gaat om
 * "in welke categorie, als serie-aflevering of als losse plek, en in welke vorm".
 */
export function vormTokens(paden, serieDirSet) {
  return [...new Set(paden.map((p) => {
    const d = p.split('/');
    const nr = d[0].slice(0, 2);
    const serie = serieDirSet.has(d.slice(0, -1).join('/'));
    return `${nr}:${serie ? 'serie' : 'los'}:${serie ? '-' : d.length >= 3 ? 'losmap' : 'kaal'}`;
  }))].sort();
}
