import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_TRACK, hasChosenTrack, parseTrack, parseTracks, readTrack, trackKey, writeTrack } from './track';

/** Minimal localStorage for the node test environment. */
function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  };
}

describe('track persistence (per user and workshop)', () => {
  const g = globalThis as { window?: unknown };
  beforeEach(() => {
    g.window = { localStorage: fakeStorage() };
  });
  afterEach(() => {
    delete g.window;
  });

  it('defaults to SQL and remembers the choice per workshop', () => {
    expect(readTrack('a@x.com', 'ws_delta')).toBe(DEFAULT_TRACK);
    writeTrack('a@x.com', 'ws_delta', 'pyspark');
    expect(readTrack('a@x.com', 'ws_delta')).toBe('pyspark');
    expect(readTrack('a@x.com', 'ws_ingestion')).toBe('sql');
    expect(readTrack('b@x.com', 'ws_delta')).toBe('sql');
  });

  it('knows whether the participant has picked a track yet (first-visit chooser)', () => {
    expect(hasChosenTrack('a@x.com', 'ws_delta')).toBe(false);
    writeTrack('a@x.com', 'ws_delta', 'sql');
    expect(hasChosenTrack('a@x.com', 'ws_delta')).toBe(true);
    expect(hasChosenTrack('a@x.com', 'ws_ingestion')).toBe(false);
    (g.window as { localStorage: Storage }).localStorage.setItem(trackKey('a@x.com', 'ws_ingestion'), '"scala"');
    expect(hasChosenTrack('a@x.com', 'ws_ingestion')).toBe(false);
  });

  it('ignores unknown stored values and works without storage', () => {
    (g.window as { localStorage: Storage }).localStorage.setItem(trackKey('a@x.com', 'ws_delta'), '"scala"');
    expect(readTrack('a@x.com', 'ws_delta')).toBe('sql');
    delete g.window;
    expect(readTrack('a@x.com', 'ws_delta')).toBe('sql');
    expect(() => writeTrack('a@x.com', 'ws_delta', 'pyspark')).not.toThrow();
  });

  it('parses track values and lists', () => {
    expect(parseTrack('pyspark')).toBe('pyspark');
    expect(parseTrack(42)).toBe('sql');
    expect(parseTracks('pyspark,sql,java')).toEqual(['pyspark', 'sql']);
    expect(parseTracks(null)).toEqual([]);
  });
});
