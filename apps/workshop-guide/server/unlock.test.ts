import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GuideOverlays } from '../shared/guide-i18n';
import { loadGuides, loadOverlays } from './guides';
import { validateProgressPost } from './progress';
import { loadServerSql } from './progress-reader';
import {
  buildUnlockInsert,
  canOpen,
  guidesFor,
  lockedBody,
  parseDefaultUnlocked,
  reduceUnlock,
  UnlockFallback,
  UNLOCK_WORKSHOP,
  unlockRowsFor,
  unlockRowsFromResult,
  validateUnlockPost,
  type UnlockDbRow,
} from './unlock';

const row = (step: string, status: string, ts: string, user_email = 'trainer@example.com'): UnlockDbRow => ({
  step,
  status,
  ts,
  user_email,
});

describe('GUIDE_DEFAULT_UNLOCKED', () => {
  it('defaults to none, accepts all, rejects anything else', () => {
    expect(parseDefaultUnlocked(undefined)).toBe('none');
    expect(parseDefaultUnlocked('')).toBe('none');
    expect(parseDefaultUnlocked(' NONE ')).toBe('none');
    expect(parseDefaultUnlocked('all')).toBe('all');
    expect(() => parseDefaultUnlocked('yes')).toThrow(/none.*all/);
  });
});

describe('reduceUnlock', () => {
  it('no rows: everything locked by default, everything open with "all"', () => {
    const none = reduceUnlock([], 'none');
    expect(Object.values(none).map((r) => r.on)).toEqual([false, false, false]);
    expect(none.quiz).toEqual({ item: 'quiz', on: false, by: null, at: null });
    expect(Object.values(reduceUnlock([], 'all')).every((r) => r.on)).toBe(true);
  });

  it('the latest row per item wins, whoever wrote it, in any input order', () => {
    const rows = [
      row('ws_ingestion', 'on', '2026-10-28 10:00:00', 'a@example.com'),
      row('ws_ingestion', 'off', '2026-10-28 10:05:00.5', 'b@example.com'),
      row('ws_ingestion', 'on', '2026-10-28 10:05:00.25', 'a@example.com'),
      row('ws_delta', 'on', '2026-10-28 09:00:00'),
    ];
    for (const input of [rows, [...rows].reverse()]) {
      const s = reduceUnlock(input, 'none');
      expect(s.ws_ingestion).toMatchObject({ on: false, by: 'b@example.com', at: '2026-10-28 10:05:00.5' });
      expect(s.ws_delta.on).toBe(true);
      expect(s.quiz.on).toBe(false);
    }
  });

  it('an explicit "off" beats the "all" default; unknown items and statuses are ignored', () => {
    const s = reduceUnlock(
      [row('quiz', 'off', '2026-10-28 10:00:00'), row('ws_other', 'on', '2026-10-28 11:00:00'), row('ws_delta', 'maybe', '2026-10-28 11:00:00')],
      'all',
    );
    expect(s.quiz.on).toBe(false);
    expect(s.ws_delta).toMatchObject({ on: true, by: null });
    expect(Object.keys(s)).toEqual(['ws_ingestion', 'ws_delta', 'quiz']);
  });

  it('with a trainer list, rows from anyone else are ignored', () => {
    const rows = [row('quiz', 'on', '2026-10-28 10:00:00', 'trainer@example.com'), row('ws_delta', 'on', '2026-10-28 10:00:00', 'x@example.com')];
    const s = reduceUnlock(rows, 'none', new Set(['trainer@example.com']));
    expect(s.quiz.on).toBe(true);
    expect(s.ws_delta).toMatchObject({ on: false, by: null, at: null });
  });

  it('reads warehouse rows and rejects foreign shapes', () => {
    expect(unlockRowsFromResult(undefined)).toEqual([]);
    expect(unlockRowsFromResult({ data: [{ step: 'quiz', status: 'on', user_email: null, ts: 'x' }] })).toHaveLength(1);
    expect(() => unlockRowsFromResult({ data: [{ foo: 1 }] })).toThrow();
  });
});

describe('enforcement', () => {
  const state = reduceUnlock([row('ws_ingestion', 'on', '2026-10-28 10:00:00')], 'none');

  it('participants open only unlocked items; trainers open everything', () => {
    expect(canOpen(state, 'ws_ingestion', false)).toBe(true);
    expect(canOpen(state, 'ws_delta', false)).toBe(false);
    expect(canOpen(state, 'quiz', false)).toBe(false);
    expect(canOpen(state, 'ws_delta', true)).toBe(true);
    expect(canOpen(state, 'quiz', true)).toBe(true);
    expect(lockedBody('quiz')).toMatchObject({ locked: true, item: 'quiz' });
  });

  it('participants do not see which trainer changed an item', () => {
    expect(unlockRowsFor(state, false)[0].by).toBeNull();
    expect(unlockRowsFor(state, true)[0].by).toBe('trainer@example.com');
  });

  const guides = loadGuides(path.resolve(__dirname, '../config/guides'));
  const overlays: GuideOverlays = loadOverlays(guides, path.resolve(__dirname, '../config/guides'), () => {});
  const sorted = [...guides.values()];

  it('locked guides come as metadata only, without steps or overlay text', () => {
    const view = guidesFor(sorted, overlays, state, false);
    expect(view.guides.map((g) => g.id)).toEqual(['ws_ingestion']);
    expect(view.locked).toEqual([{ id: 'ws_delta', number: 2, title: guides.get('ws_delta')!.title, locked: true }]);
    expect(view.locked[0]).not.toHaveProperty('steps');
    expect(Object.keys(view.overlays.pl ?? {})).toEqual(['ws_ingestion']);
  });

  it('trainers get every guide and overlay', () => {
    const view = guidesFor(sorted, overlays, state, true);
    expect(view.guides).toHaveLength(2);
    expect(view.locked).toEqual([]);
    expect(Object.keys(view.overlays.pl ?? {}).sort()).toEqual(['ws_delta', 'ws_ingestion']);
  });

  it('unlock rows never reach the matrix, quiz stats or reset (not a guide id)', () => {
    const r = validateProgressPost(
      { workshop: UNLOCK_WORKSHOP, step: 'quiz', status: 'pass', message: '', hints_used: 0, attempts: 1 },
      guides,
    );
    expect(r).toMatchObject({ ok: false, status: 404 });
    expect(guides.has(UNLOCK_WORKSHOP)).toBe(false);
  });
});

describe('POST /api/unlock', () => {
  it('is for trainers only', () => {
    expect(validateUnlockPost({ item: 'quiz', on: true }, false)).toMatchObject({ ok: false, status: 403 });
  });

  it('validates the body and expands "all"', () => {
    expect(validateUnlockPost({ item: 'quiz', on: true }, true)).toMatchObject({ ok: true, items: ['quiz'] });
    expect(validateUnlockPost({ item: 'all', on: false }, true)).toMatchObject({
      ok: true,
      items: ['ws_ingestion', 'ws_delta', 'quiz'],
    });
    expect(validateUnlockPost({ item: 'ws_other', on: true }, true)).toMatchObject({ ok: false, status: 400 });
    expect(validateUnlockPost({ item: 'quiz', on: 'yes' }, true)).toMatchObject({ ok: false, status: 400 });
  });

  it('writes special rows with bound values only', () => {
    const insert = buildUnlockInsert('cat.sch.tbl');
    expect(insert).toContain('INSERT INTO cat.sch.tbl');
    expect(insert).toContain("'__unlock'");
    expect(insert).toContain("'unlock'");
    expect(insert).toContain("'trainer'");
    expect(insert).toMatch(/:user_email.*:status/s);
    expect(insert).toContain('split(:items');
  });

  it('reads the latest row per item, not per trainer', () => {
    const text = loadServerSql('unlock_state.sql', 'cat.sch.tbl', path.resolve(__dirname, 'sql'));
    expect(text).toContain('FROM cat.sch.tbl');
    expect(text).toContain('PARTITION BY step ORDER BY ts DESC');
    expect(text).toContain("workshop = '__unlock'");
    expect(text).toContain("source = 'trainer'");
    expect(text).toContain('split(:trainers');
  });
});

describe('UnlockFallback', () => {
  const open = reduceUnlock([row('quiz', 'on', '2026-10-28 10:00:00')], 'none');
  const closed = reduceUnlock([], 'none');

  it('serves the last good state only within the window', () => {
    let now = Date.parse('2026-10-28T10:00:00Z');
    const fb = new UnlockFallback(60_000, () => now);
    expect(fb.recent()).toBeNull();
    fb.remember(open, '2026-10-28T10:00:00.000Z');
    now += 59_000;
    expect(fb.recent()?.state.quiz.on).toBe(true);
    now += 2_000;
    expect(fb.recent()).toBeNull();
  });

  it('an older read that finishes later does not overwrite a newer one', () => {
    const fb = new UnlockFallback(60_000, () => Date.parse('2026-10-28T10:00:10Z'));
    fb.remember(open, '2026-10-28T10:00:05.000Z');
    fb.remember(closed, '2026-10-28T10:00:01.000Z');
    expect(fb.recent()).toMatchObject({ fetchedAt: '2026-10-28T10:00:05.000Z' });
    expect(fb.recent()?.state.quiz.on).toBe(true);
  });
});
