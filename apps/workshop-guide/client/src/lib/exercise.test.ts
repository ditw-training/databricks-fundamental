import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { guideSchema, type FillStep, type MatchStep, type OrderStep } from '../../../shared/guide-schema';
import {
  assembleFill,
  assembleOrder,
  blankInputWidth,
  blankState,
  checkMatch,
  checkOrder,
  parseTemplate,
  seededShuffle,
} from './exercise';
import { buildMatrix } from './trainer';
import { parseTs } from './status';

const demo = guideSchema.parse(JSON.parse(readFileSync(path.resolve(__dirname, '../../../fixtures/ws_demo.json'), 'utf8')));
const fill = demo.steps.find((s): s is FillStep => s.type === 'fill')!;
const order = demo.steps.find((s): s is OrderStep => s.type === 'order')!;
const match = demo.steps.find((s): s is MatchStep => s.type === 'match')!;

describe('fill', () => {
  it('sizes blanks by what was typed, not by the answer', () => {
    expect(blankInputWidth('')).toBe(8);
    expect(blankInputWidth('AS')).toBe(8);
    expect(blankInputWidth('PARQUETX_LONGER')).toBe(16);
  });

  it('splits template into text and blanks', () => {
    expect(parseTemplate('a {{b1}} b {{b2}}')).toEqual([
      { kind: 'text', value: 'a ' },
      { kind: 'blank', id: 'b1' },
      { kind: 'text', value: ' b ' },
      { kind: 'blank', id: 'b2' },
    ]);
  });

  it('validates blanks case-insensitively by default and case-sensitively on request', () => {
    expect(blankState('delta', fill.blanks.b2)).toBe('correct');
    expect(blankState('  DELTA ', fill.blanks.b2)).toBe('correct');
    expect(blankState('parquet', fill.blanks.b2)).toBe('wrong');
    expect(blankState('', fill.blanks.b2)).toBe('empty');
    const strict = { answers: ['saveAsTable'], case_sensitive: true };
    expect(blankState('saveastable', strict)).toBe('wrong');
  });

  it('assembles the final code, keeping empty blanks visible', () => {
    const code = assembleFill(fill, { b1: 'customers_delta' });
    expect(code).toContain('silver.customers_delta (');
    expect(code).toContain('USING ____');
  });
});

describe('order', () => {
  it('passes only the exact solution', () => {
    expect(checkOrder(order, order.solution).pass).toBe(true);
    const swapped = [order.solution[1], order.solution[0], ...order.solution.slice(2)];
    expect(checkOrder(order, swapped)).toMatchObject({ pass: false, correctPositions: order.solution.length - 2 });
  });

  it('reports distractors and missing blocks', () => {
    const r = checkOrder(order, [...order.solution.slice(0, -1), order.distractors[0]]);
    expect(r.pass).toBe(false);
    expect(r.distractorsUsed).toBe(1);
    expect(r.missing).toBe(1);
    expect(r.message.length).toBeLessThanOrEqual(200);
  });

  it('assembles code in answer order', () => {
    expect(assembleOrder(order, order.solution).split('\n')).toEqual(order.solution.map((id) => order.blocks.find((b) => b.id === id)?.code));
  });
});

describe('match', () => {
  it('grades pairs', () => {
    const all = Object.fromEntries(match.pairs.map((_, i) => [i, i]));
    expect(checkMatch(match, all).pass).toBe(true);
    const swapped = { ...all, 0: 1, 1: 0 };
    expect(checkMatch(match, swapped)).toMatchObject({ pass: false, correct: match.pairs.length - 2 });
  });
});

describe('helpers', () => {
  it('shuffles deterministically', () => {
    expect(seededShuffle([1, 2, 3, 4, 5], 'x')).toEqual(seededShuffle([1, 2, 3, 4, 5], 'x'));
    expect(seededShuffle([1, 2, 3, 4, 5], 'x').sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('parses warehouse timestamps as UTC', () => {
    expect(parseTs('2026-10-27 10:15:03.123')?.toISOString()).toBe('2026-10-27T10:15:03.123Z');
    expect(parseTs('2026-10-27T10:15:03Z')?.toISOString()).toBe('2026-10-27T10:15:03.000Z');
    expect(parseTs(null)).toBeNull();
  });

  it('builds the trainer matrix and pass rates', () => {
    const rows = [
      { user_email: 'a@x.com', step: 't01', status: 'pass', message: 'track=sql · ok', hints_used: null, attempts: null, ts: '2026-10-27 10:00:00', runs: 1, tracks: 'sql' },
      { user_email: 'a@x.com', step: 't03', status: 'fail', message: 'track=pyspark · 3 of 5', hints_used: 2, attempts: 1, ts: '2026-10-27 10:05:00', runs: 1, tracks: null },
      { user_email: 'b@x.com', step: 't01', status: 'fail', message: null, hints_used: null, attempts: null, ts: '2026-10-27 10:01:00', runs: 2, tracks: null },
      { user_email: 'b@x.com', step: 'gone', status: 'pass', message: null, hints_used: null, attempts: null, ts: '2026-10-27 10:09:00', runs: 1, tracks: 'pyspark' },
    ];
    const m = buildMatrix(demo, rows);
    expect(m.participants.map((p) => p.email)).toEqual(['a@x.com', 'b@x.com']);
    expect(m.participants[0]).toMatchObject({ passedRequired: 1, failing: 1, hintsTotal: 2, tracks: ['sql', 'pyspark'] });
    // Rows of steps no longer in the guide do not give a track badge.
    expect(m.participants[1].tracks).toEqual([]);
    expect(m.steps.find((s) => s.stepId === 't01')).toMatchObject({ passed: 1, attempted: 2, passRate: 0.5 });
    expect(m.lastActivity?.toISOString()).toBe('2026-10-27T10:05:00.000Z');
  });
});
