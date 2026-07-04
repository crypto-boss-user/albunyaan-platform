import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runExport, ENTITIES, type ExportDeps } from '../uscreen-export.ts';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'phase1-export-'));
}

/** Deps that detonate on ANY touch — dry-run must never reach the network layer. */
function forbiddenDeps(): ExportDeps {
  return {
    fetchJson: async () => {
      throw new Error('NETWORK CALL IN DRY-RUN — forbidden');
    },
    openSession: async () => {
      throw new Error('BROWSER SESSION IN DRY-RUN — forbidden');
    },
    delay: async () => {
      throw new Error('delay in dry-run — nothing should be executing');
    },
  };
}

describe('uscreen-export --dry-run (stops BEFORE any network call)', () => {
  it('api strategy: plans all entities, touches nothing', async () => {
    const dir = tmp();
    const result = await runExport({
      strategy: 'api',
      dryRun: true,
      manifestPath: path.join(dir, 'manifest.jsonl'),
      rawDir: path.join(dir, 'raw'),
      deps: forbiddenDeps(),
    });
    expect(result.status).toBe('dry_run');
    expect(result.entities).toEqual(ENTITIES);
    expect(result.planned.some((l) => l.includes('USCREEN_API_KEY'))).toBe(true);
    expect(result.planned.some((l) => l.includes('politeness 2000ms'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'raw'))).toBe(false); // nothing fetched, nothing written
  });

  it('scrape strategy: plans raw-before-parse per entity, touches nothing', async () => {
    const dir = tmp();
    const result = await runExport({
      strategy: 'scrape',
      dryRun: true,
      entities: ['videos', 'categories'],
      manifestPath: path.join(dir, 'manifest.jsonl'),
      rawDir: path.join(dir, 'raw'),
      deps: forbiddenDeps(),
    });
    expect(result.status).toBe('dry_run');
    expect(result.planned.filter((l) => l.startsWith('[scrape]'))).toHaveLength(2);
    expect(result.planned.some((l) => l.includes('BEFORE parse'))).toBe(true);
    expect(result.stats.videos.total).toBe(0);
  });

  it('both strategies share ONE manifest file', async () => {
    const dir = tmp();
    const manifestPath = path.join(dir, 'manifest.jsonl');
    const a = await runExport({ strategy: 'api', dryRun: true, manifestPath, rawDir: path.join(dir, 'raw'), deps: forbiddenDeps() });
    const b = await runExport({ strategy: 'scrape', dryRun: true, manifestPath, rawDir: path.join(dir, 'raw'), deps: forbiddenDeps() });
    expect(a.planned.at(-1)).toContain(manifestPath);
    expect(b.planned.at(-1)).toContain(manifestPath);
  });
});
