import { expect, test } from '@playwright/test';
import { publiekeVorm, VERBODEN_SLEUTELS, coverVanCollectie } from '../lib/api-public-shape';

/**
 * APP-3 schijf 1 — de app-API (/api/app/v1). Deze suite bewaakt het contract waar de Flutter-app
 * op gaat bouwen, en vooral de twee dingen die stil fout kunnen gaan:
 *   1. /me moet ZONDER geldige bearer-token 401 geven — nooit per ongeluk data.
 *   2. Een publiek endpoint mag geen velden lekken die op het web ook niet naar buiten gaan.
 *
 * Draait tegen de gewone testserver; er is geen ingelogde app-gebruiker nodig, want alles wat
 * authenticatie vereist wordt hier juist op WEIGEREN getest (fail-closed).
 */
const V1 = '/api/app/v1';

test.describe('app-API v1', () => {
  test('GET /catalog geeft rijen in het standaard-omhulsel', async ({ request }) => {
    const res = await request.get(`${V1}/catalog`);
    // Sinds 2026-09-10 staat het Supabase-project in restrictie (HTTP 402): de datalaag is dan
    // onbereikbaar en de route geeft correct 503. Dat is GEEN geslaagde test — luid overslaan,
    // zodat het verschil tussen "werkt" en "kon niet meten" zichtbaar blijft (werkregel 1).
    test.skip(res.status() === 503, 'Datalaag onbereikbaar (Supabase-restrictie 402) — contract niet gemeten.');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data.rows');
    expect(Array.isArray(body.data.rows)).toBe(true);
    // Zelfde samenstelling als de storefront /catalog: rijen + featured + categorieën.
    expect(Array.isArray(body.data.featured)).toBe(true);
    expect(Array.isArray(body.data.categories)).toBe(true);
  });

  test('GET /search: te korte term zoekt niet, lange term wordt geweigerd', async ({ request }) => {
    const kort = await request.get(`${V1}/search?q=a`);
    expect(kort.status()).toBe(200);
    const kortBody = await kort.json();
    expect(kortBody.data.reason).toBe('query_too_short');
    expect(kortBody.data.series).toEqual([]);
    expect(kortBody.data.episodes).toEqual([]);

    const lang = await request.get(`${V1}/search?q=${'a'.repeat(101)}`);
    expect(lang.status()).toBe(400);
    expect((await lang.json()).error.code).toBe('query_too_long');
  });

  test('GET /programs/[slug]: onbekende slug geeft 404, niet 200 met leeg', async ({ request }) => {
    const res = await request.get(`${V1}/programs/bestaat-echt-niet-${Date.now()}`);
    test.skip(res.status() === 503, 'Datalaag onbereikbaar (Supabase-restrictie 402).');
    expect(res.status()).toBe(404);
    expect((await res.json()).error.code).toBe('not_found');
  });

  /** De kern: elke vorm van een ontbrekende of kapotte token moet 401 opleveren. */
  for (const [naam, headers] of [
    ['zonder header', {}],
    ['leeg Bearer', { authorization: 'Bearer ' }],
    ['ander schema', { authorization: 'Basic abc.def.ghi' }],
    ['geen drie delen', { authorization: 'Bearer nietsjwtachtigs' }],
    ['onzin-JWT', { authorization: 'Bearer aaa.bbb.ccc' }],
    ['token in query i.p.v. header', {}],
  ] as const) {
    test(`GET /me weigert: ${naam}`, async ({ request }) => {
      const url = naam === 'token in query i.p.v. header' ? `${V1}/me?access_token=aaa.bbb.ccc` : `${V1}/me`;
      const res = await request.get(url, { headers: headers as Record<string, string> });
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe('unauthorized');
      // Niets van een lid mag meekomen in een geweigerd antwoord.
      expect(JSON.stringify(body)).not.toMatch(/@|entitlement|full_name/i);
    });
  }

  test('publieke endpoints lekken geen interne velden', async ({ request }) => {
    const res = await request.get(`${V1}/catalog`);
    test.skip(res.status() === 503, 'Datalaag onbereikbaar (Supabase-restrictie 402) — lekcontrole niet gemeten.');
    const body = await res.text();
    // Zoek op de JSON-SLEUTELVORM ("raw": …), niet op het losse woord. Twee eerdere versies waren fout:
    // 'BUNNY_' matchte hoofdlettergevoelig nooit 'bunny_video_id', en daarna matchte 'raw' ook het woord
    // "drawing" in een legitieme titel — vals alarm op echte inhoud (Cubic, PR #2).
    for (const verboden of [...VERBODEN_SLEUTELS, 'service_role']) {
      const alsSleutel = new RegExp(`"${verboden}"\\s*:`, 'i');
      expect(body, `sleutel "${verboden}" mag niet in een publiek antwoord staan`).not.toMatch(alsSleutel);
    }
  });
});

/**
 * De lekbescherming zelf, als pure functie getest: draait ZONDER server en zonder Supabase, dus
 * ook tijdens de restrictie. Dit is de test die er het meest toe doet — Cubic vond in de review dat
 * de eerste versie van deze routes `bunny_video_id` en `resources` onversneden teruggaf.
 */
test.describe('publiekeVorm — allowlist', () => {
  test('verwijdert elk verboden veld, op elk niveau', () => {
    const gif = {
      kind: 'category',
      title: 'Tafsir',
      bunny_video_id: 'LEK-1',
      resources: [{ url: 'https://voorbeeld/geheim.apk' }],
      raw: { uscreen_hls_url: 'https://stream.mux.com/token' },
      status: 'published',
      member_visible: true,
      items: [
        {
          id: 'v1',
          slug: 'les-1',
          title: 'Les 1',
          duration_seconds: 600,
          access: 'members',
          bunny_video_id: 'LEK-2',
          live_stream_url: 'rtmp://lek',
          external_id: '12345',
          videos: [{ id: 'v2', title: 'Diep', bunny_video_id: 'LEK-3', resources: ['x'] }],
        },
      ],
    };
    // Eerst bewijzen dat de detectie zelf wérkt: op de ONgesnoeide invoer moeten de sleutels
    // wél gevonden worden. Zonder deze regel zou een kapotte regex de test stil laten slagen.
    const ruw = JSON.stringify(gif);
    for (const verwacht of ['bunny_video_id', 'resources', 'raw', 'status', 'member_visible']) {
      expect(ruw, `detectie kapot: "${verwacht}" niet gevonden in de ruwe invoer`).toMatch(new RegExp(`"${verwacht}"\\s*:`, 'i'));
    }
    // En daarna: na het snoeien is geen van de verboden sleutels meer aanwezig.
    const schoon = JSON.stringify(publiekeVorm(gif));
    for (const verboden of VERBODEN_SLEUTELS) {
      expect(schoon, `sleutel "${verboden}" mag niet in de uitvoer staan`).not.toMatch(new RegExp(`"${verboden}"\\s*:`, 'i'));
    }
    expect(schoon).not.toContain('LEK-1');
    expect(schoon).not.toContain('LEK-2');
    expect(schoon).not.toContain('LEK-3');
    expect(schoon).not.toContain('stream.mux.com');
    // en het nuttige blijft wel staan
    const uit = publiekeVorm(gif) as Record<string, any>;
    expect(uit.title).toBe('Tafsir');
    expect(uit.items[0].slug).toBe('les-1');
    expect(uit.items[0].duration_seconds).toBe(600);
    expect(uit.items[0].access).toBe('members');
    expect(uit.items[0].videos[0].title).toBe('Diep');
  });

  test('onbekende velden verdwijnen standaard (fail-closed)', () => {
    const uit = publiekeVorm({ title: 'ok', een_nieuwe_kolom_van_morgen: 'geheim' }) as Record<string, unknown>;
    expect(uit).toEqual({ title: 'ok' });
  });

  test('laat null, arrays en primitieven met rust', () => {
    expect(publiekeVorm(null)).toBeNull();
    expect(publiekeVorm(['a', 'b'])).toEqual(['a', 'b']);
    expect(publiekeVorm(42)).toBe(42);
  });
});

/**
 * Regressietest voor de vondst van Cubic (17-09): de allowlist liet `series`/`episodes` vallen,
 * waardoor een geslaagde zoekopdracht leeg terugkwam. De oude test merkte dat niet, omdat hij
 * dezelfde verkeerde vorm verwachtte als de route teruggaf.
 */
test('publiekeVorm behoudt zoekresultaten (series + episodes)', () => {
  const uit = publiekeVorm({
    q: 'tafsir',
    series: [{ title: 'Serie', slug: 's', episodeCount: 3, thumbnail_url: null }],
    episodes: [{ id: 'e1', title: 'Aflevering', slug: 'a1', bunny_video_id: 'LEK' }],
  }) as Record<string, any>;
  expect(uit.series).toHaveLength(1);
  expect(uit.series[0].title).toBe('Serie');
  expect(uit.episodes).toHaveLength(1);
  expect(uit.episodes[0].slug).toBe('a1');
  expect(JSON.stringify(uit)).not.toContain('LEK');
});

/** Cubic PR #2: een losse video kwam leeg terug omdat alleen `videos` (meervoud) op de lijst stond. */
test('publiekeVorm behoudt een losse video (Program kind=video)', () => {
  const uit = publiekeVorm({
    kind: 'video',
    video: { id: 'v9', slug: 'losse-les', title: 'Losse les', duration_seconds: 42, bunny_video_id: 'LEK' },
  }) as Record<string, any>;
  expect(uit.kind).toBe('video');
  expect(uit.video?.slug).toBe('losse-les');
  expect(uit.video?.duration_seconds).toBe(42);
  expect(JSON.stringify(uit)).not.toContain('LEK');
});

/**
 * Cubic PR #2, en het kostte drie rondes voordat ik het toegaf: de programmapagina van het web
 * gebruikt `collection.raw?.cover_url` als poster (programs/[slug]/page.tsx:126). De serializer
 * gooit `raw` weg, dus zonder een afgeleid `cover`-veld toont de app een andere afbeelding.
 */
test('coverVanCollectie volgt dezelfde keuze als de webpagina', () => {
  // 1. ingestelde cover wint
  expect(
    coverVanCollectie({ raw: { cover_url: 'https://x/cover.jpg' }, episodes: [{ thumbnail_url: 'https://x/ep.jpg' }] }),
  ).toBe('https://x/cover.jpg');
  // 2. anders de eerste aflevering mét thumbnail
  expect(
    coverVanCollectie({ raw: null, episodes: [{ thumbnail_url: null }, { thumbnail_url: 'https://x/ep2.jpg' }] }),
  ).toBe('https://x/ep2.jpg');
  // 3. een LEGE string is een ingestelde waarde (web gebruikt `??`), dus geen terugval
  expect(coverVanCollectie({ raw: { cover_url: '' }, episodes: [{ thumbnail_url: 'https://x/ep.jpg' }] })).toBe('');
  // 4. anders niets — en nooit undefined
  expect(coverVanCollectie({ raw: null, episodes: [] })).toBeNull();
  expect(coverVanCollectie(null)).toBeNull();
});

test('de gesnoeide vorm behoudt cover maar nooit raw', () => {
  const uit = publiekeVorm({
    kind: 'series',
    collection: { title: 'Serie', slug: 's', cover: 'https://x/cover.jpg', raw: { cover_url: 'https://x/cover.jpg', geheim: 1 } },
  }) as Record<string, any>;
  expect(uit.collection.cover).toBe('https://x/cover.jpg');
  expect(JSON.stringify(uit)).not.toMatch(/"raw"\s*:/);
  expect(JSON.stringify(uit)).not.toContain('geheim');
});

/**
 * Demo-modus leunt op één regel per admin-action (`weigerInDemo()`). Eén vergeten action = een gat
 * waardoor een demo-bezoeker zou kunnen schrijven. Cubic wees daar terecht op: handmatig herhaalde
 * bewaking hoort door een test bewaakt te worden, niet door oplettendheid.
 */
test('elke admin-action heeft een demo-weigering direct na zijn rolcontrole', () => {
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const wortel = path.resolve(__dirname, '..', 'app', 'admin');

  const bestanden: string[] = [];
  (function loop(d: string) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) loop(p);
      else if (e.name === 'actions.ts') bestanden.push(p);
    }
  })(wortel);

  expect(bestanden.length, 'er moeten admin-action-bestanden zijn').toBeGreaterThan(0);

  const gaten: string[] = [];
  for (const f of bestanden) {
    const regels = fs.readFileSync(f, 'utf8').split('\n');
    regels.forEach((r, i) => {
      if (!/await requireAdmin(PreMfa)?\(/.test(r)) return;
      const volgende = (regels[i + 1] ?? '') + (regels[i + 2] ?? '');
      if (!volgende.includes('weigerInDemo')) {
        gaten.push(`${path.relative(wortel, f)}:${i + 1}`);
      }
    });
  }
  expect(gaten, `deze acties missen weigerInDemo(): ${gaten.join(', ')}`).toEqual([]);
});
