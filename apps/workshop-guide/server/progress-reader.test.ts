import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { ProgressRow } from '../shared/progress-schema';
import {
  applyProgressWrite,
  loadLatestProgressSql,
  participantRows,
  ProgressCache,
  rowsFromResult,
  trainerRows,
  type ProgressWrite,
} from './progress-reader';

const row = (over: Partial<ProgressRow> = {}): ProgressRow => ({
  user_email: 'a@x.com',
  step: 't01',
  step_type: 'fill',
  status: 'pass',
  message: null,
  hints_used: null,
  attempts: null,
  source: 'notebook',
  ts: '2026-10-27 10:00:00',
  runs: 1,
  tracks: null,
  ...over,
});

describe('latest_progress.sql', () => {
  it('is server-only and gets the validated table name', () => {
    const sqlText = loadLatestProgressSql('cat.sch.tbl', path.resolve(__dirname, 'sql'));
    expect(sqlText).toContain('FROM cat.sch.tbl');
    expect(sqlText).toContain(':workshop');
    expect(sqlText).not.toContain(':user_email');
    expect(() => loadLatestProgressSql('x; DROP TABLE y', path.resolve(__dirname, 'sql'))).toThrow();
  });

  it('fails fast on a file without the table placeholder', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'wg-sql-'));
    writeFileSync(path.join(dir, 'latest_progress.sql'), 'SELECT 1');
    expect(() => loadLatestProgressSql('cat.sch.tbl', dir)).toThrow(/PROGRESS_TABLE/);
  });
});

describe('progress rows', () => {
  it('reads an empty result as no rows', () => {
    expect(rowsFromResult(undefined)).toEqual([]);
    expect(rowsFromResult({})).toEqual([]);
    expect(rowsFromResult({ data: [] })).toEqual([]);
  });

  it('coerces warehouse strings and rejects foreign shapes', () => {
    const [r] = rowsFromResult({ data: [{ ...row(), hints_used: '2', runs: '3' }] });
    expect(r).toMatchObject({ hints_used: 2, runs: 3 });
    expect(() => rowsFromResult({ data: [{ foo: 1 }] })).toThrow();
  });

  it('gives a participant only their own rows, without emails', () => {
    const rows = [row(), row({ user_email: 'b@x.com', status: 'fail' })];
    const mine = participantRows(rows, 'A@x.com');
    expect(mine).toHaveLength(1);
    expect(mine[0]).not.toHaveProperty('user_email');
    expect(trainerRows(rows)).toHaveLength(2);
    expect(trainerRows(rows)[0]).not.toHaveProperty('source');
  });
});

describe('ProgressCache', () => {
  it('shares one statement per workshop within the TTL, including in flight', async () => {
    let now = 0;
    const load = vi.fn((workshop: string) => Promise.resolve([row({ step: workshop })]));
    const cache = new ProgressCache(load, 4000, () => now);
    const [a, b] = await Promise.all([cache.get('ws_delta'), cache.get('ws_delta')]);
    expect(a).toBe(b);
    await cache.get('ws_ingestion');
    expect(load).toHaveBeenCalledTimes(2);
    now = 3999;
    await cache.get('ws_delta');
    expect(load).toHaveBeenCalledTimes(2);
    now = 4000;
    await cache.get('ws_delta');
    expect(load).toHaveBeenCalledTimes(3);
    cache.invalidate('ws_delta');
    await cache.get('ws_delta');
    expect(load).toHaveBeenCalledTimes(4);
  });

  it('does not cache failures', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('warehouse starting')).mockResolvedValue([row()]);
    const cache = new ProgressCache(load, 4000, () => 0);
    await expect(cache.get('ws_delta')).rejects.toThrow('warehouse starting');
    await expect(cache.get('ws_delta')).resolves.toMatchObject({ rows: [row()] });
  });
});

describe('applyProgressWrite (same rules as latest_progress.sql)', () => {
  const now = new Date('2026-10-29T12:00:00.000Z');
  const write = (over: Partial<ProgressWrite> = {}): ProgressWrite => ({
    user_email: 'B@x.com',
    step: 't02',
    step_type: 'fill',
    status: 'pass',
    message: 'track=sql · All blanks correct',
    hints_used: 1,
    attempts: 2,
    ...over,
  });

  it('adds a first row for a new user and step, sorted like the SQL', () => {
    const out = applyProgressWrite([row({ user_email: 'c@x.com' })], write(), now);
    expect(out.map((r) => r.user_email)).toEqual(['b@x.com', 'c@x.com']);
    expect(out[0]).toMatchObject({
      status: 'pass',
      runs: 1,
      tracks: 'sql',
      hints_used: 1,
      attempts: 2,
      source: 'app',
      ts: '2026-10-29 12:00:00.000',
    });
  });

  it('a later fail does not replace a pass but counts as a run', () => {
    const prev = row({ user_email: 'b@x.com', step: 't02', status: 'pass', runs: 2, tracks: 'pyspark', attempts: 5, hints_used: 0 });
    const [out] = applyProgressWrite([prev], write({ status: 'fail', message: 'track=sql · no', attempts: 3, hints_used: 2 }), now);
    expect(out).toMatchObject({ status: 'pass', ts: prev.ts, message: prev.message, runs: 3, tracks: 'pyspark', attempts: 5, hints_used: 2 });
  });

  it('a pass replaces a fail and joins the tracks; other rows stay', () => {
    const other = row({ user_email: 'b@x.com', step: 't01' });
    const prev = row({ user_email: 'b@x.com', step: 't02', status: 'fail', tracks: '', attempts: null });
    const out = applyProgressWrite([other, prev], write({ message: 'track=pyspark · ok' }), now);
    expect(out[0]).toBe(other);
    expect(out[1]).toMatchObject({ status: 'pass', tracks: 'pyspark', runs: 2, attempts: 2 });
    const both = applyProgressWrite(out, write({ message: 'track=sql · ok' }), now);
    expect(both[1].tracks).toBe('pyspark,sql');
  });

  it('a fail without earlier rows has no tracks', () => {
    const [out] = applyProgressWrite([], write({ status: 'fail' }), now);
    expect(out).toMatchObject({ status: 'fail', tracks: '', runs: 1 });
  });
});

describe('ProgressCache.patch', () => {
  it('changes a finished read in place without a new statement', async () => {
    let now = 0;
    const load = vi.fn(() => Promise.resolve([row()]));
    const cache = new ProgressCache(load, 4000, () => now);
    const first = await cache.get('ws');
    now = 1000;
    cache.patch('ws', (rows) => [...rows, row({ step: 't02' })]);
    const patched = await cache.get('ws');
    expect(load).toHaveBeenCalledTimes(1);
    expect(patched.rows).toHaveLength(2);
    expect(patched.fetchedAt).toBe(first.fetchedAt);
    now = 4000;
    await cache.get('ws');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('drops a read still in flight or missing instead of patching it', async () => {
    let resolve: (rows: ProgressRow[]) => void = () => {};
    const load = vi.fn(() => new Promise<ProgressRow[]>((r) => (resolve = r)));
    const cache = new ProgressCache(load, 4000, () => 0);
    const pending = cache.get('ws');
    const change = vi.fn((rows: ProgressRow[]) => rows);
    cache.patch('ws', change);
    resolve([row()]);
    await pending;
    expect(change).not.toHaveBeenCalled();
    load.mockImplementation(() => Promise.resolve([row()]));
    await cache.get('ws');
    expect(load).toHaveBeenCalledTimes(2);
    cache.patch('other', change);
    expect(change).not.toHaveBeenCalled();
  });
});
