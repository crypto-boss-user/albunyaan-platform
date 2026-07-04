import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openManifest } from '../lib/manifest.ts';

function tmpManifest(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-')), 'export-manifest.jsonl');
}

describe('export manifest (PRD §4b resumability)', () => {
  it('enumerates ids as pending, once', () => {
    const m = openManifest(tmpManifest());
    expect(m.enumerate('videos', ['1', '2', '3'])).toBe(3);
    expect(m.enumerate('videos', ['2', '3', '4'])).toBe(1); // only the new one
    expect(m.stats('videos')).toMatchObject({ total: 4, pending: 4 });
  });

  it('walks pending items via next() and tracks transitions', () => {
    const m = openManifest(tmpManifest());
    m.enumerate('videos', ['a', 'b']);
    const first = m.next('videos');
    expect(first?.external_id).toBe('a');
    m.mark('videos', 'a', 'fetched', { rawPath: '/raw/videos/a.html' });
    m.mark('videos', 'a', 'parsed');
    m.mark('videos', 'a', 'upserted');
    expect(m.next('videos')?.external_id).toBe('b'); // a is done, never re-fetched
    m.mark('videos', 'b', 'upserted');
    expect(m.next('videos')).toBeNull();
    expect(m.stats('videos')).toMatchObject({ upserted: 2, pending: 0 });
    expect(m.get('videos', 'a')?.raw_path).toBe('/raw/videos/a.html');
  });

  it('crash mid-run → reopening picks up pending/failed ONLY', () => {
    const file = tmpManifest();
    {
      const m = openManifest(file);
      m.enumerate('videos', ['1', '2', '3', '4']);
      m.mark('videos', '1', 'upserted'); // done before the crash
      m.mark('videos', '2', 'fetched');
      m.mark('videos', '2', 'parsed');
      m.mark('videos', '2', 'upserted');
      m.mark('videos', '3', 'failed', { error: 'timeout' });
      // '4' still pending — crash here (no close needed: append-only log)
    }
    const resumed = openManifest(file); // fresh process replays the log
    const todo: string[] = [];
    let row;
    while ((row = resumed.next('videos'))) {
      todo.push(row.external_id);
      resumed.mark('videos', row.external_id, 'upserted');
    }
    expect(todo.sort()).toEqual(['3', '4']); // failed + pending only, 1/2 untouched
    expect(resumed.stats('videos')).toMatchObject({ total: 4, upserted: 4, pending: 0, failed: 0 });
  });

  it('failed items retry up to maxAttempts, then stop (no infinite loop)', () => {
    const m = openManifest(tmpManifest());
    m.enumerate('videos', ['x']);
    for (let i = 0; i < 3; i += 1) {
      const row = m.next('videos');
      expect(row?.external_id).toBe('x');
      m.mark('videos', 'x', 'failed', { error: `attempt ${i + 1}` });
    }
    expect(m.next('videos')).toBeNull(); // attempts exhausted — surfaced in stats, not retried forever
    expect(m.get('videos', 'x')).toMatchObject({ status: 'failed', attempts: 3, last_error: 'attempt 3' });
  });

  it('survives a torn final line (crash mid-append)', () => {
    const file = tmpManifest();
    const m = openManifest(file);
    m.enumerate('videos', ['1']);
    fs.appendFileSync(file, '{"entity":"videos","external'); // torn write
    const resumed = openManifest(file);
    expect(resumed.stats('videos').total).toBe(1);
  });
});
