import { expect, test } from '@playwright/test';
import { publiekeVorm, VERBODEN_SLEUTELS } from '../lib/api-public-shape';

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
    for (const verboden of ['uscreen_hls_url', 'service_role', 'BUNNY_', 'live_stream_url', 'member_visible']) {
      expect(body).not.toContain(verboden);
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
    const schoon = JSON.stringify(publiekeVorm(gif));
    for (const verboden of VERBODEN_SLEUTELS) {
      expect(schoon, `veld ${verboden} mag niet in de uitvoer staan`).not.toContain(verboden);
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
