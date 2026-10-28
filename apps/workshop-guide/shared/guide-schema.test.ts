import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  dataCheckReachable,
  exerciseTypes,
  guideSchema,
  resolveExercise,
  saveLines,
  stepSchema,
  TRACKS,
  type Answer,
  type Step,
  type Variant,
} from './guide-schema';
import { checkFill, checkMatch, checkOrder, gradeAnswer, stripTrack, trackFromMessage, trackMessage } from './grading';

const prose = { id: 't01', title: 'T', explain: 'x', hints: ['shared hint'] };
const sqlFill = { type: 'fill', template: 'SELECT {{b1}} FROM t', blanks: { b1: { answers: ['*'] } } };
const pyOrder = {
  type: 'order',
  blocks: [
    { id: 'a', code: 'df = spark.table("t")' },
    { id: 'b', code: 'display(df)' },
    { id: 'x', code: 'df.collect()' },
  ],
  solution: ['a', 'b'],
  distractors: ['x'],
  hints: ['py hint', '```python\ndf = spark.table("t")\ndisplay(df)\n```'],
};
const parse = (raw: unknown): Step => stepSchema.parse(raw);
const guide = (steps: unknown[]) => ({ id: 'ws_x', title: 'X', notebook: 'n.ipynb', steps });

describe('variants schema (SPEC section 11)', () => {
  it('a step with variants is a track step, whatever its legacy fields say', () => {
    const step = parse({ ...prose, type: 'code', check: 'notebook', starter: '# old', variants: { sql: sqlFill, pyspark: pyOrder } });
    expect(step.type).toBe('tracks');
    expect(step.check).toBe('app');
    expect(exerciseTypes(step)).toEqual(['fill', 'order']);
  });

  it('a step without variants keeps the legacy fields (backward compatible)', () => {
    const step = parse({ ...prose, ...sqlFill });
    expect(step.type).toBe('fill');
    const r = resolveExercise(step, 'pyspark');
    expect(r).toMatchObject({ exercise: { type: 'fill' }, fallback: false, hints: ['shared hint'] });
  });

  it('resolves the chosen track, its language and hints, else shared hints', () => {
    const step = parse({ ...prose, variants: { sql: sqlFill, pyspark: pyOrder } });
    expect(resolveExercise(step, 'sql')).toMatchObject({ exercise: { type: 'fill' }, language: 'sql', hints: ['shared hint'] });
    expect(resolveExercise(step, 'pyspark')).toMatchObject({ exercise: { type: 'order' }, language: 'python', hints: pyOrder.hints });
  });

  it('falls back to the other track (missing variant or same_as) with a note', () => {
    const missing = parse({ ...prose, variants: { sql: sqlFill } });
    expect(resolveExercise(missing, 'pyspark')).toMatchObject({ shownTrack: 'sql', fallback: true, note: null, exercise: { type: 'fill' } });
    const sameAs = parse({ ...prose, variants: { sql: sqlFill, pyspark: { same_as: 'sql', note: 'SQL only' } } });
    expect(resolveExercise(sameAs, 'pyspark')).toMatchObject({ shownTrack: 'sql', fallback: true, note: 'SQL only', language: 'sql' });
  });

  it('accepts the content spellings: reuse for same_as, order ids with the completed code in solution', () => {
    const { solution: _ids, ...rest } = pyOrder;
    const step = parse({
      ...prose,
      variants: { pyspark: { ...rest, order: ['a', 'b'], solution: 'df = spark.table("t")\ndisplay(df)' }, sql: { reuse: 'pyspark', note: 'n' } },
    });
    expect(resolveExercise(step, 'pyspark').exercise).toMatchObject({ type: 'order', solution: ['a', 'b'] });
    expect(resolveExercise(step, 'sql')).toMatchObject({ shownTrack: 'pyspark', fallback: true, note: 'n' });
  });

  it('allows optional track steps (former code steps become fill/order)', () => {
    expect(guideSchema.safeParse(guide([{ ...prose, optional: true, variants: { sql: sqlFill } }])).success).toBe(true);
    expect(guideSchema.safeParse(guide([{ ...prose, optional: true, ...sqlFill }])).success).toBe(false);
  });

  it.each([
    ['no exercise at all', { sql: { same_as: 'pyspark' } }],
    ['same_as pointing to itself', { sql: sqlFill, pyspark: { same_as: 'pyspark' } }],
    ['blank without answers', { sql: { ...sqlFill, template: 'SELECT {{b1}}, {{b2}}' } }],
    ['unknown block in solution', { pyspark: { ...pyOrder, solution: ['a', 'zz'] } }],
    ['block neither solution nor distractor', { pyspark: { ...pyOrder, distractors: [] } }],
    ['unknown type', { sql: { type: 'code', starter: 'x' } }],
  ])('rejects %s', (_, variants) => {
    expect(guideSchema.safeParse(guide([{ ...prose, variants }])).success).toBe(false);
  });
});

describe('grading shared by client and server', () => {
  it('fill, order and match', () => {
    const fill = { template: 'SELECT {{b1}}', blanks: { b1: { answers: ['*'], case_sensitive: false } } };
    expect(checkFill(fill, { b1: ' * ' })).toMatchObject({ pass: true, message: 'All 1 blank correct.' });
    expect(checkFill(fill, {})).toMatchObject({ pass: false });
    expect(checkOrder(pyOrder as never, ['a', 'b']).pass).toBe(true);
    expect(checkOrder(pyOrder as never, ['b', 'a']).pass).toBe(false);
    const pairs = { pairs: [{ left: 'A', right: '1' }, { left: 'B', right: '2' }] };
    expect(checkMatch(pairs, { 0: 0, 1: 1 }).pass).toBe(true);
    expect(checkMatch(pairs, { 0: 1, 1: 0 }).pass).toBe(false);
    expect(checkMatch(pairs, { 0: 0 }).pass).toBe(false);
  });

  it('puts the track in front of the message and reads it back', () => {
    const msg = trackMessage('pyspark', 'All 3 pairs matched.');
    expect(msg).toBe('track=pyspark · All 3 pairs matched.');
    expect(trackFromMessage(msg)).toBe('pyspark');
    expect(trackFromMessage('PASS — table found')).toBeNull();
    expect(stripTrack(msg)).toBe('All 3 pairs matched.');
    expect(trackMessage('sql', 'x'.repeat(300))).toHaveLength(200);
  });
});

describe('save lines for the optional data check', () => {
  const solution = 'SELECT 1;\n\n-- optional: saves your result for the Check on data button\nCREATE OR REPLACE TABLE default._ws_x AS SELECT 1;';
  it('takes the tail of the completed solution from the marker comment', () => {
    expect(saveLines(solution)).toBe('-- optional: saves your result for the Check on data button\nCREATE OR REPLACE TABLE default._ws_x AS SELECT 1;');
    expect(saveLines('x = 1\n# saves your result so the app can check it\ndf.write.saveAsTable(t)')).toMatch(/^# saves.*\ndf\.write/);
    expect(saveLines('SELECT 1;')).toBeNull();
  });

  it('keeps them on the parsed variant (fill and order) and hides an unreachable check', () => {
    const step = parse({
      ...prose,
      variants: {
        sql: { ...sqlFill, solution: 'SELECT * FROM t' },
        pyspark: { ...pyOrder, solution: undefined, order: ['a', 'b'], hints: undefined, distractors: ['x'] },
      },
    });
    expect(resolveExercise(step, 'sql').exercise).not.toHaveProperty('save');
    expect(dataCheckReachable(step, 'sql')).toBe(true);
    const withSave = parse({
      ...prose,
      variants: {
        sql: { ...sqlFill, solution: 'SELECT * FROM t' },
        pyspark: { ...pyOrder, order: ['a', 'b'], solution: 'df = spark.table("t")\n# optional: saves your result for the Check on data button\ndf.write.saveAsTable("s")' },
      },
    });
    const shown = resolveExercise(withSave, 'pyspark').exercise;
    expect(shown).toMatchObject({ type: 'order', solution: ['a', 'b'] });
    expect(shown?.save).toContain('saveAsTable');
    expect(dataCheckReachable(withSave, 'pyspark')).toBe(true);
    expect(dataCheckReachable(withSave, 'sql')).toBe(false);
  });
});

/** The answer that the guide itself says is right: first accepted blank answers, solution order, identity pairs. */
function solutionAnswer(ex: Variant): Answer {
  if (ex.type === 'fill') return { type: 'fill', values: Object.fromEntries(Object.entries(ex.blanks).map(([id, b]) => [id, b.answers[0]])) };
  if (ex.type === 'order') return { type: 'order', order: [...ex.solution] };
  return { type: 'match', assignment: ex.pairs.map((_, i) => i) };
}

describe('real workshop guides (config/guides): every track exercise passes with its own solution', () => {
  const dir = path.resolve(__dirname, '../config/guides');
  const files = readdirSync(dir).filter((f) => /^ws_.*\.json$/.test(f) && f !== 'ws_demo.json');
  const cases = files.flatMap((file) => {
    const guide = guideSchema.parse(JSON.parse(readFileSync(path.join(dir, file), 'utf8')));
    return guide.steps.flatMap((step) =>
      TRACKS.map((track) => ({ name: `${guide.id} ${step.id} ${track}`, step, track })),
    );
  });

  it('finds the workshop guides', () => {
    expect(files.length).toBeGreaterThanOrEqual(2);
    expect(cases.length).toBeGreaterThan(0);
  });

  it.each(cases)('$name', ({ step, track }) => {
    const { exercise } = resolveExercise(step, track);
    expect(exercise, 'every step is graded in the app').not.toBeNull();
    const ex = exercise as Variant;
    expect(gradeAnswer(ex, solutionAnswer(ex))?.pass).toBe(true);
    if (ex.type === 'order') {
      expect(gradeAnswer(ex, { type: 'order', order: [...ex.solution].reverse() })?.pass).toBe(false);
    }
    if (ex.type === 'fill') {
      expect(gradeAnswer(ex, { type: 'fill', values: {} })?.pass).toBe(false);
    }
  });

  it('every save line the check needs is reachable in at least one track', () => {
    for (const { step } of cases) {
      expect(TRACKS.some((t) => dataCheckReachable(step, t)), step.id).toBe(true);
    }
  });
});
