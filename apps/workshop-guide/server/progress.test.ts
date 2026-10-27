import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Guide } from '../shared/guide-schema';
import { loadGuides, parseGuide } from './guides';
import {
  buildProgressInsert,
  DEFAULT_PROGRESS_TABLE,
  parseEmailList,
  resolveProgressTable,
  resolveUserEmail,
  validateProgressPost,
} from './progress';

const fixturePath = path.resolve(__dirname, '../fixtures/ws_demo.json');
const demo: Guide = parseGuide(JSON.parse(readFileSync(fixturePath, 'utf8')), 'ws_demo.json');
const guides = new Map([[demo.id, demo]]);

const headers = (h: Record<string, string>) => ({ header: (name: string) => h[name.toLowerCase()] });

describe('guide files', () => {
  it('demo fixture is valid and covers every step type', () => {
    expect(new Set(demo.steps.map((s) => s.type))).toEqual(new Set(['fill', 'order', 'match', 'code']));
    const code = demo.steps.find((s) => s.type === 'code' && !s.optional);
    expect(code?.hints).toHaveLength(3);
    expect(code?.docs.length).toBeGreaterThan(0);
  });

  it('every synced guide in config/guides is valid', () => {
    const loaded = loadGuides(path.resolve(__dirname, '../config/guides'));
    expect(loaded.size).toBeGreaterThan(0);
  });

  it('multi-line hints wrap their code in a ``` fence (markdown would merge the lines)', () => {
    const loaded = loadGuides(path.resolve(__dirname, '../config/guides'));
    const unfenced = [...loaded.values(), demo].flatMap((g) =>
      g.steps.flatMap((s) =>
        s.hints.flatMap((h, i) => (h.includes('\n') && !h.includes('```') ? [`${g.id} ${s.id} hint ${i + 1}`] : [])),
      ),
    );
    expect(unfenced).toEqual([]);
  });

  it('rejects a fill step whose blank has no answers', () => {
    const broken = structuredClone(JSON.parse(readFileSync(fixturePath, 'utf8')) as { steps: { blanks?: object }[] });
    broken.steps[0].blanks = { b1: { answers: ['x'] } };
    expect(() => parseGuide(broken, 'broken.json')).toThrow(/b2/);
  });

  it('rejects an optional step that is not code', () => {
    const broken = JSON.parse(readFileSync(fixturePath, 'utf8')) as { steps: { optional: boolean }[] };
    broken.steps[0].optional = true;
    expect(() => parseGuide(broken, 'broken.json')).toThrow(/must be type "code"/);
  });
});

describe('identity and configuration', () => {
  it('uses X-Forwarded-Email, lower-cased', () => {
    expect(resolveUserEmail(headers({ 'x-forwarded-email': 'Anna.Nowak@Example.com' }), {})).toBe('anna.nowak@example.com');
  });

  it('falls back to DEV_USER_EMAIL only outside production', () => {
    expect(resolveUserEmail(headers({}), { NODE_ENV: 'development', DEV_USER_EMAIL: 'dev@example.com' })).toBe('dev@example.com');
    expect(resolveUserEmail(headers({}), { NODE_ENV: 'production', DEV_USER_EMAIL: 'dev@example.com' })).toBeNull();
  });

  it('parses TRAINER_EMAILS', () => {
    expect(parseEmailList(' A@x.com, b@x.com;c@x.com ')).toEqual(new Set(['a@x.com', 'b@x.com', 'c@x.com']));
    expect(parseEmailList(undefined).size).toBe(0);
  });

  it('accepts only plain three-part progress table names', () => {
    expect(resolveProgressTable(undefined)).toBe(DEFAULT_PROGRESS_TABLE);
    expect(resolveProgressTable('cat.sch.tbl')).toBe('cat.sch.tbl');
    expect(() => resolveProgressTable('cat.sch.tbl; DROP TABLE x')).toThrow();
    expect(() => resolveProgressTable('tbl')).toThrow();
  });

  it('builds a parameterized INSERT', () => {
    const stmt = buildProgressInsert('cat.sch.tbl');
    expect(stmt).toContain('INSERT INTO cat.sch.tbl');
    expect(stmt).toContain(':user_email');
    expect(stmt).toContain("'app'");
  });
});

describe('POST /api/progress validation', () => {
  const body = { workshop: 'ws_demo', step: 't03', status: 'pass', message: 'All 5 pairs matched.', hints_used: 1, attempts: 2 };

  it('accepts an app-graded step', () => {
    const r = validateProgressPost(body, guides);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.step.type).toBe('match');
  });

  it('rejects notebook-graded, unknown and malformed input', () => {
    expect(validateProgressPost({ ...body, step: 't01' }, guides)).toMatchObject({ ok: false, status: 409 });
    expect(validateProgressPost({ ...body, step: 't99' }, guides)).toMatchObject({ ok: false, status: 404 });
    expect(validateProgressPost({ ...body, workshop: 'ws_x' }, guides)).toMatchObject({ ok: false, status: 404 });
    expect(validateProgressPost({ ...body, status: 'done' }, guides)).toMatchObject({ ok: false, status: 400 });
    expect(validateProgressPost({ ...body, message: 'x'.repeat(201) }, guides)).toMatchObject({ ok: false, status: 400 });
    expect(validateProgressPost({ ...body, step: "t03' OR 1=1" }, guides)).toMatchObject({ ok: false, status: 400 });
  });
});
