import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { ProgressRow } from '../shared/progress-schema';
import { loadLatestProgressSql, participantRows, ProgressCache, rowsFromResult, trainerRows } from './progress-reader';

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
