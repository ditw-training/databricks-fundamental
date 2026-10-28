import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Guide } from '../shared/guide-schema';
import { loadGuides, parseGuide } from './guides';
import {
  buildProgressInsert,
  DEFAULT_PROGRESS_TABLE,
  parseEmailList,
  progressRowValues,
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
    expect(new Set(demo.steps.map((s) => s.type))).toEqual(new Set(['fill', 'order', 'match', 'code', 'tracks']));
    const code = demo.steps.find((s) => s.type === 'code');
    expect(code?.hints.length).toBeGreaterThan(1);
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

describe('POST /api/progress: the server grades the answer (SPEC section 11)', () => {
  const base = { workshop: 'ws_demo', hints_used: 1, attempts: 2 };
  const t03 = demo.steps.find((s) => s.id === 't03');
  if (t03?.type !== 'match') throw new Error('t03 is a match step');
  const identity = t03.pairs.map((_, i) => i);

  it('match: correct assignment -> pass with the track in the message', () => {
    const r = validateProgressPost({ ...base, step: 't03', track: 'pyspark', answer: { type: 'match', assignment: identity } }, guides);
    expect(r).toMatchObject({ ok: true, result: { status: 'pass', step_type: 'match', track: 'pyspark' } });
    if (r.ok) expect(r.result.message).toBe(`track=pyspark · All ${identity.length} pairs matched.`);
  });

  it('match: swapped terms -> fail; a term used twice never passes', () => {
    const swapped = [1, 0, ...identity.slice(2)];
    expect(validateProgressPost({ ...base, step: 't03', answer: { type: 'match', assignment: swapped } }, guides)).toMatchObject({
      ok: true,
      result: { status: 'fail' },
    });
    const twice = identity.map(() => 0);
    expect(validateProgressPost({ ...base, step: 't03', answer: { type: 'match', assignment: twice } }, guides)).toMatchObject({
      result: { status: 'fail' },
    });
  });

  it('fill: blanks graded like the client (case, spaces); track defaults to sql', () => {
    const ok = validateProgressPost({ ...base, step: 't01', answer: { type: 'fill', values: { b1: ' customers_delta ', b2: 'delta' } } }, guides);
    expect(ok).toMatchObject({ ok: true, result: { status: 'pass', step_type: 'fill', track: 'sql' } });
    const wrong = validateProgressPost({ ...base, step: 't01', answer: { type: 'fill', values: { b1: 'customers_delta' } } }, guides);
    expect(wrong).toMatchObject({ ok: true, result: { status: 'fail' } });
  });

  it('fill: grades against the exercise of the chosen track', () => {
    const sqlAnswer = { type: 'fill', values: { b1: 'INSERT', b2: 'FROM' } };
    expect(validateProgressPost({ ...base, step: 't02', track: 'sql', answer: sqlAnswer }, guides)).toMatchObject({ result: { status: 'pass' } });
    expect(validateProgressPost({ ...base, step: 't02', track: 'pyspark', answer: sqlAnswer }, guides)).toMatchObject({ result: { status: 'fail' } });
    const pyAnswer = { type: 'fill', values: { b1: 'append', b2: 'saveAsTable' } };
    expect(validateProgressPost({ ...base, step: 't02', track: 'pyspark', answer: pyAnswer }, guides)).toMatchObject({ result: { status: 'pass' } });
    // saveAsTable is case-sensitive in the guide.
    const lower = { type: 'fill', values: { b1: 'append', b2: 'saveastable' } };
    expect(validateProgressPost({ ...base, step: 't02', track: 'pyspark', answer: lower }, guides)).toMatchObject({ result: { status: 'fail' } });
  });

  it('order: exact solution passes, distractors and swaps fail; same_as uses the SQL blocks', () => {
    const solution = ['m1', 'm2', 'm3', 'm4', 'm5'];
    for (const track of ['sql', 'pyspark']) {
      const r = validateProgressPost({ ...base, step: 't04', track, answer: { type: 'order', order: solution } }, guides);
      expect(r).toMatchObject({ ok: true, result: { status: 'pass', step_type: 'order', track } });
    }
    const swapped = ['m2', 'm1', 'm3', 'm4', 'm5'];
    expect(validateProgressPost({ ...base, step: 't04', answer: { type: 'order', order: swapped } }, guides)).toMatchObject({ result: { status: 'fail' } });
    const distractor = ['m1', 'm2', 'm3', 'm4', 'd1'];
    expect(validateProgressPost({ ...base, step: 't04', answer: { type: 'order', order: distractor } }, guides)).toMatchObject({ result: { status: 'fail' } });
  });

  it('order vs fill per track in one step (t06)', () => {
    expect(validateProgressPost({ ...base, step: 't06', track: 'pyspark', answer: { type: 'order', order: ['h1', 'h2', 'h3'] } }, guides)).toMatchObject({
      result: { status: 'pass', step_type: 'order' },
    });
    expect(validateProgressPost({ ...base, step: 't06', track: 'sql', answer: { type: 'order', order: ['h1', 'h2', 'h3'] } }, guides)).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it('a forged status without an answer is rejected; a status next to a wrong answer is ignored', () => {
    expect(validateProgressPost({ ...base, step: 't03', status: 'pass', message: 'All matched.' }, guides)).toMatchObject({ ok: false, status: 400 });
    const r = validateProgressPost({ ...base, step: 't03', status: 'pass', answer: { type: 'match', assignment: [] } }, guides);
    expect(r).toMatchObject({ ok: true, result: { status: 'fail' } });
  });

  it('rejects code steps, unknown and malformed input', () => {
    const answer = { type: 'match', assignment: identity };
    expect(validateProgressPost({ ...base, step: 't07', answer }, guides)).toMatchObject({ ok: false, status: 409 });
    expect(validateProgressPost({ ...base, step: 't99', answer }, guides)).toMatchObject({ ok: false, status: 404 });
    expect(validateProgressPost({ ...base, workshop: 'ws_x', step: 't03', answer }, guides)).toMatchObject({ ok: false, status: 404 });
    expect(validateProgressPost({ ...base, step: 't03', track: 'scala', answer }, guides)).toMatchObject({ ok: false, status: 400 });
    expect(validateProgressPost({ ...base, step: "t03' OR 1=1", answer }, guides)).toMatchObject({ ok: false, status: 400 });
    expect(validateProgressPost({ ...base, step: 't03', answer: { type: 'fill', values: { b1: 'x'.repeat(501) } } }, guides)).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it('records the server grade with the caller identity (progress row values)', () => {
    const r = validateProgressPost({ ...base, step: 't03', track: 'sql', answer: { type: 'match', assignment: identity } }, guides);
    if (!r.ok) throw new Error(r.error);
    expect(progressRowValues('Anna@X.com', r.post, r.result)).toEqual({
      user_email: 'anna@x.com',
      workshop: 'ws_demo',
      step: 't03',
      step_type: 'match',
      status: 'pass',
      message: `track=sql · All ${identity.length} pairs matched.`,
      hints_used: 1,
      attempts: 2,
    });
  });
});
