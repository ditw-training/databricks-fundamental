import { describe, expect, it } from 'vitest';
import { formatAgo } from '../lib/status';
import { en } from './en';
import { pl } from './pl';
import { plPlural } from './plural';

describe('UI dictionary', () => {
  it('both languages have the same keys, no empty texts and functions with the same parameters', () => {
    expect(Object.keys(pl).sort()).toEqual(Object.keys(en).sort());
    for (const [key, value] of Object.entries(en)) {
      const other = (pl as Record<string, unknown>)[key];
      expect(typeof other, key).toBe(typeof value);
      if (typeof value === 'string') {
        expect(value.trim(), key).not.toBe('');
        expect((other as string).trim(), key).not.toBe('');
      } else {
        expect((other as (...a: unknown[]) => unknown).length, key).toBe(value.length);
      }
    }
  });

  it('Polish plurals', () => {
    expect([1, 2, 4, 5, 12, 22, 25].map((n) => plPlural(n, 'krok', 'kroki', 'kroków'))).toEqual([
      'krok',
      'kroki',
      'kroki',
      'kroków',
      'kroków',
      'kroki',
      'kroków',
    ]);
    expect(pl.stepCount(12, 2)).toBe('12 kroków + 2 opcjonalne');
    expect(en.stepCount(1, 0)).toBe('1 step');
    expect(en.stepCount(8, 4)).toBe('8 steps + 4 optional');
    expect(pl.stepCount(8, 4)).toBe('8 kroków + 4 opcjonalne');
    expect(pl.lastCheck('przed chwilą', 1)).toBe('Ostatnie sprawdzenie przed chwilą · 1 uruchomienie');
  });

  it('formats "ago" in the UI language', () => {
    const now = new Date('2026-10-28T10:00:00Z');
    expect(formatAgo(new Date('2026-10-28T09:55:00Z'), now, 'pl')).toBe('5 min temu');
    expect(formatAgo(new Date('2026-10-28T09:55:00Z'), now)).toBe('5 min ago');
  });

  it('English exercise messages match what is stored in the progress table', () => {
    expect(en.orderResult({ pass: false, total: 4, correctPositions: 2, distractorsUsed: 1, missing: 2 })).toBe(
      '2 of 4 blocks in the right place. 1 block does not belong here. 2 blocks are missing.'
    );
    expect(en.matchResult(true, 0, 5)).toBe('All 5 pairs matched.');
  });
});
