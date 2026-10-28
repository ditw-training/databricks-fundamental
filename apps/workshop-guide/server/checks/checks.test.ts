import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { gradedBy, roman, sortGuides, workshopLabel, type Guide } from '../../shared/guide-schema';
import { loadGuides, parseGuide } from '../guides';
import { catalogFor, userSlugFor } from '../slug';
import { CHECKS, markDataChecks, runCheck, validateCheckPost } from './index';
import { CheckFail, type CheckContext, type Row, scratchTableName } from './framework';
import { INGESTION_CHECKS } from './ws_ingestion';
import { DELTA_CHECKS, isFullDelete } from './ws_delta';

/**
 * Fake warehouse: the first rule whose pattern matches the statement answers it.
 * Values are strings or null, as the Statement Execution API returns them.
 */
type Rule = [RegExp, Row[] | Error];
function fakeCtx(rules: Rule[], catalog = 'retailhub_jan'): CheckContext & { seen: string[] } {
  const seen: string[] = [];
  return {
    catalog,
    seen,
    run: (statement: string) => {
      seen.push(statement);
      const rule = rules.find(([re]) => re.test(statement));
      if (!rule) return Promise.reject(new Error(`unexpected statement: ${statement}`));
      return rule[1] instanceof Error ? Promise.reject(rule[1]) : Promise.resolve(rule[1]);
    },
  };
}

const colsRows = (cols: [string, string][]) => cols.map(([column_name, data_type]) => ({ column_name, data_type }));
/** information_schema.columns rule for one table. */
const columns = (table: string, cols: [string, string][]): Rule => [
  new RegExp(`information_schema\\.columns.*table_name = '${table}'`),
  colsRows(cols),
];
const noTable = (table: string): Rule => [new RegExp(`information_schema\\.columns.*table_name = '${table}'`), []];

const CUSTOMER_COLS: [string, string][] = [
  ['customer_id', 'STRING'], ['first_name', 'STRING'], ['last_name', 'STRING'], ['email', 'STRING'],
  ['phone', 'STRING'], ['city', 'STRING'], ['state', 'STRING'], ['country', 'STRING'],
  ['registration_date', 'DATE'], ['customer_segment', 'STRING'],
];

describe('participant catalog (same rules as user_slug_for in 00_setup)', () => {
  it.each([
    ['Jan.Kowalski@example.com', 'jan_kowalski'],
    ['  ANNA-MARIA.nowak+test@x.pl ', 'anna_maria_nowak_test'],
    ['123_abc@x.com', 'abc'],
    ['__x__@x.com', 'x'],
    ['1234@x.com', 'user'],
    ['zażółć@x.pl', 'za'],
  ])('%s -> %s', (email, slug) => {
    expect(userSlugFor(email)).toBe(slug);
  });

  it('maps TRAINER_ACCOUNTS (e-mail or login, any case) to retailhub_trainer', () => {
    expect(catalogFor('Trainer@Corp.com', ['trainer@corp.com'])).toBe('retailhub_trainer');
    expect(catalogFor('kzb@corp.com', [' KZB '])).toBe('retailhub_trainer');
    expect(catalogFor('kzb@corp.com', [])).toBe('retailhub_kzb');
    // A "trainer" substring is not enough.
    expect(catalogFor('trainer.one@corp.com', ['trainer@corp.com'])).toBe('retailhub_trainer_one');
  });
});

describe('check registry', () => {
  const dirs = [path.resolve('config/guides'), path.resolve('../../notebooks/workshops/guide')].filter((d) => existsSync(d));

  it.each(dirs)('has a check for every Check-graded (code) step of %s and none for unknown steps', (dir) => {
    for (const guide of loadGuides(dir).values()) {
      const checks = CHECKS[guide.id];
      if (!checks) continue; // demo guide
      const stepIds = new Set(guide.steps.map((s) => s.id));
      // Section 11: checks of app-graded steps stay as the optional "Check on data".
      expect(Object.keys(checks).filter((id) => !stepIds.has(id))).toEqual([]);
      const required = guide.steps.filter((s) => gradedBy(s) === 'notebook').map((s) => s.id);
      expect(required.filter((id) => !checks[id])).toEqual([]);
    }
  });

  it('marks the steps with a data check', () => {
    const marked = markDataChecks(loadGuides(dirs[0]));
    const ingestion = marked.get('ws_ingestion');
    if (!ingestion) return;
    for (const s of ingestion.steps) expect(s.data_check).toBe(Boolean(CHECKS.ws_ingestion[s.id]));
  });

  it('names scratch tables _ws_<workshop>_<step>', () => {
    expect(scratchTableName('ws_ingestion', 't07')).toBe('_ws_ws_ingestion_t07');
  });
});

describe('POST /api/check validation', () => {
  const guide: Guide = parseGuide({
    id: 'ws_ingestion',
    number: 1,
    title: 'Workshop I — Ingestion',
    notebook: 'notebooks/workshops/WORKSHOP_ingestion.ipynb',
    intro: '',
    steps: [
      { id: 't01', title: 'Match', type: 'match', optional: false, explain: 'x', hints: [], docs: [], check: 'app', pairs: [{ left: 'a', right: 'b' }, { left: 'c', right: 'd' }] },
      { id: 't03', title: 'Schema', type: 'code', optional: false, explain: 'x', hints: [], docs: [], check: 'notebook' },
      { id: 't99', title: 'New', type: 'code', optional: false, explain: 'x', hints: [], docs: [], check: 'notebook' },
    ],
  }, 'test');
  const guides = new Map([[guide.id, guide]]);

  it('accepts a Check-graded step and defaults hints_used to 0', () => {
    const r = validateCheckPost({ workshop: 'ws_ingestion', step: 't03' }, guides);
    expect(r.ok && r.post.hints_used).toBe(0);
    expect(r.ok && r.bonus).toBe(false);
  });

  it('accepts an app-graded step with a check as the optional bonus (SPEC section 11)', () => {
    const tracks: Guide = parseGuide({
      ...guide,
      steps: [
        {
          id: 't03', title: 'Schema', optional: false, explain: 'x',
          variants: { sql: { type: 'fill', template: 'SELECT {{b1}}', blanks: { b1: { answers: ['1'] } } } },
        },
      ],
    }, 'test');
    const r = validateCheckPost({ workshop: 'ws_ingestion', step: 't03' }, new Map([[tracks.id, tracks]]));
    expect(r.ok && r.bonus).toBe(true);
  });

  it.each([
    [{ workshop: 'ws_ingestion' }, 400],
    [{ workshop: 'x; DROP', step: 't03' }, 400],
    [{ workshop: 'ws_other', step: 't03' }, 404],
    [{ workshop: 'ws_ingestion', step: 't42' }, 404],
    [{ workshop: 'ws_ingestion', step: 't01' }, 409],
    [{ workshop: 'ws_ingestion', step: 't99' }, 501],
  ])('%j -> %i', (body, status) => {
    const r = validateCheckPost(body, guides);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(status);
  });
});

describe('runCheck', () => {
  const ctx = fakeCtx([]);
  it('PASS with the returned message, FAIL with the CheckFail message', async () => {
    expect(await runCheck(() => Promise.resolve('ok'), ctx)).toEqual({ kind: 'result', status: 'pass', message: 'ok' });
    expect(await runCheck(() => Promise.reject(new CheckFail('nope')), ctx)).toEqual({ kind: 'result', status: 'fail', message: 'nope' });
  });

  it('turns a missing catalog into a FAIL that points to 00_setup', async () => {
    const r = await runCheck(() => Promise.reject(new Error('[NO_SUCH_CATALOG_EXCEPTION] Catalog x not found')), ctx);
    expect(r).toMatchObject({ kind: 'result', status: 'fail' });
    if (r.kind === 'result') expect(r.message).toContain('00_setup');
  });

  it('reports access problems as errors (not recorded)', async () => {
    const r = await runCheck(() => Promise.reject(new Error('PERMISSION_DENIED: User does not have CAN_USE on warehouse')), ctx);
    expect(r.kind).toBe('error');
  });

  it('other SQL errors are a FAIL with the first line, max 200 chars', async () => {
    const r = await runCheck(() => Promise.reject(new Error(`[DIVIDE_BY_ZERO] boom ${'x'.repeat(300)}\nstack`)), ctx);
    expect(r).toMatchObject({ kind: 'result', status: 'fail' });
    if (r.kind === 'result') {
      expect(r.message.startsWith('SQL error: [DIVIDE_BY_ZERO] boom')).toBe(true);
      expect(r.message.length).toBeLessThanOrEqual(200);
    }
  });
});

describe('Workshop I — Ingestion checks', () => {
  it('t02: FAIL with the notebook text when the scratch table is missing', async () => {
    const r = await runCheck(INGESTION_CHECKS.t02, fakeCtx([noTable('_ws_ws_ingestion_t02')]));
    expect(r).toEqual({
      kind: 'result',
      status: 'fail',
      message: 'Table _ws_ws_ingestion_t02 not found. Run the step 02 cell to the end: its last line saves your result.',
    });
  });

  it('t02: FAIL when the header option was not used', async () => {
    const ctx = fakeCtx([columns('_ws_ws_ingestion_t02', CUSTOMER_COLS.map(([, t], i) => [`_c${i}`, t]))]);
    const r = await runCheck(INGESTION_CHECKS.t02, ctx);
    expect(r.kind === 'result' && r.message).toMatch(/header/);
  });

  it('t03: PASS for the CSV schema, quoting the catalog', async () => {
    const ctx = fakeCtx([
      columns('_ws_ws_ingestion_t03', CUSTOMER_COLS),
      [/count_if\(email LIKE/, [{ n: '10000', with_at: '9990' }]],
    ]);
    expect(await runCheck(INGESTION_CHECKS.t03, ctx)).toEqual({ kind: 'result', status: 'pass', message: 'explicit schema OK, 10,000 rows.' });
    expect(ctx.seen[1]).toContain('`retailhub_jan`.`default`.`_ws_ws_ingestion_t03`');
  });

  it('t03: FAIL on a wrong type', async () => {
    const cols = CUSTOMER_COLS.map(([n, t]) => [n, n === 'registration_date' ? 'STRING' : t] as [string, string]);
    const r = await runCheck(INGESTION_CHECKS.t03, fakeCtx([columns('_ws_ws_ingestion_t03', cols)]));
    expect(r.kind === 'result' && r.message).toBe(
      "Wrong type for ['registration_date']: registration_date must be DATE, the other columns STRING.",
    );
  });

  it('t08: FAIL when rows have the wrong tier', async () => {
    const ctx = fakeCtx([
      columns('_ws_ws_ingestion_t08', [['registration_date', 'DATE'], ['customer_tier', 'STRING']]),
      [/customer_tier IS NULL/, [{ n: '0' }]],
      [/NOT \(customer_tier <=>/, [{ n: '12' }]],
    ]);
    const r = await runCheck(INGESTION_CHECKS.t08, ctx);
    expect(r).toMatchObject({ status: 'fail', message: expect.stringMatching(/^12 rows have the wrong tier/) as unknown });
  });

  it('t10: PASS when the counts are the top 5, whatever the row order', async () => {
    const ctx = fakeCtx([
      columns('_ws_ws_ingestion_t03', CUSTOMER_COLS),
      columns('_ws_ws_ingestion_t10', [['state', 'STRING'], ['customer_count', 'BIGINT']]),
      [/SELECT customer_count FROM/, ['5', '4', '3', '2', '1'].map((n) => ({ customer_count: n }))],
      [/GROUP BY state ORDER BY n DESC LIMIT 5/, ['5', '4', '3', '2', '1'].map((n) => ({ n }))],
    ]);
    expect(await runCheck(INGESTION_CHECKS.t10, ctx)).toMatchObject({ status: 'pass', message: 'top 5 states, counts [5, 4, 3, 2, 1].' });
  });
});

describe('Workshop II — Delta Lake checks', () => {
  const TABLE_COLS: [string, string][] = [['customer_id', 'STRING'], ['country', 'STRING'], ['loyalty_tier', 'STRING']];

  it('t01: FAIL when the table is missing', async () => {
    const r = await runCheck(DELTA_CHECKS.t01, fakeCtx([noTable('lab_delta_cust_ws')]));
    expect(r).toMatchObject({ status: 'fail', message: 'Table lab_delta_cust_ws not found. Run the setup cell and step 01 first.' });
  });

  it('t02: reads the saved enforcement_error (AppKit leaves "[ERROR_CLASS] ..." text as a string)', async () => {
    const ctx = fakeCtx([
      columns('lab_delta_cust_ws', TABLE_COLS),
      [/customer_id = 'BAD001'/, [{ n: '0' }]],
      columns('_ws_ws_delta_t02', [['error', 'STRING']]),
      [/SELECT error FROM/, [{ error: '[DELTA_FAILED_TO_MERGE_FIELDS] A schema mismatch detected' }]],
    ]);
    expect(await runCheck(DELTA_CHECKS.t02, ctx)).toMatchObject({ status: 'pass' });
  });

  it('t02: FAIL when the append did not fail', async () => {
    const ctx = fakeCtx([
      columns('lab_delta_cust_ws', TABLE_COLS),
      [/customer_id = 'BAD001'/, [{ n: '0' }]],
      columns('_ws_ws_delta_t02', [['error', 'STRING']]),
      [/SELECT error FROM/, [{ error: null }]],
    ]);
    expect(await runCheck(DELTA_CHECKS.t02, ctx)).toMatchObject({ status: 'fail', message: expect.stringMatching(/^enforcement_error is empty/) as unknown });
  });

  it('t06: FAIL with country / tier of TEST001 (NULL printed as None)', async () => {
    const ctx = fakeCtx([
      columns('lab_delta_cust_ws', TABLE_COLS),
      [/WHERE customer_id = 'TEST001'/, [{ country: 'Poland', loyalty_tier: null }]],
    ]);
    expect(await runCheck(DELTA_CHECKS.t06, ctx)).toMatchObject({
      status: 'fail',
      message: 'TEST001 has country=Poland, loyalty_tier=None; expected Poland and Gold.',
    });
  });

  // operationParameters as AppKit returns it: the MAP's JSON text parsed into an object.
  const history = (entries: [number, string, Record<string, string>][]) =>
    entries.map(([version, operation, operationParameters]) => ({ version: String(version), operation, operationParameters }));

  it.each([
    [{ predicate: '["true"]' }, true], // SQL warehouse / serverless
    [{ predicate: '[]' }, true],
    [{}, true],
    [{ predicate: '["(customer_id#1 IN (TEST002,TEST003))"]' }, false],
  ])('isFullDelete(%j) = %s', (parameters, full) => {
    expect(isFullDelete({ version: 1, operation: 'DELETE', parameters })).toBe(full);
  });

  it('t12: PASS after DELETE without WHERE and RESTORE (history from the lab)', async () => {
    const ctx = fakeCtx([
      columns('lab_delta_cust_ws', TABLE_COLS),
      [/DESCRIBE HISTORY/, history([
        [6, 'DELETE', { predicate: '["customer_id#1 IN (TEST002,TEST003)"]' }],
        [7, 'MERGE', { predicate: '["(customer_id#2 = customer_id#3)"]' }],
        [8, 'DELETE', { predicate: '["true"]' }],
        [9, 'RESTORE', { version: '7' }],
      ])],
      [/VERSION AS OF 7/, [{ n: '10002' }]],
      [/count\(\*\) AS n FROM .* WHERE TRUE/, [{ n: '10002' }]],
    ]);
    expect(await runCheck(DELTA_CHECKS.t12, ctx)).toEqual({
      kind: 'result',
      status: 'pass',
      message: '10,002 rows are back; DELETE and RESTORE are in the history.',
    });
  });

  it('t12: FAIL when the RESTORE is missing', async () => {
    const ctx = fakeCtx([
      columns('lab_delta_cust_ws', TABLE_COLS),
      [/DESCRIBE HISTORY/, history([[8, 'DELETE', { predicate: '["true"]' }]])],
    ]);
    expect(await runCheck(DELTA_CHECKS.t12, ctx)).toMatchObject({ status: 'fail', message: expect.stringMatching(/^No RESTORE/) as unknown });
  });
});

describe('workshop numbering', () => {
  const g = (id: string, title: string, number?: number) => ({ id, title, number });
  it('labels and sorts by number', () => {
    expect(workshopLabel(g('ws_delta', 'Workshop — Delta Lake', 2))).toBe('Workshop II — Delta Lake');
    expect(workshopLabel(g('ws_delta', 'Workshop 2 — Delta Lake', 2))).toBe('Workshop II — Delta Lake');
    expect(workshopLabel(g('ws_delta', 'Workshop II — Delta Lake', 2), 'pl')).toBe('Warsztat II — Delta Lake');
    expect(workshopLabel(g('ws_ingestion', 'Warsztat I — Ingestion', 1), 'en')).toBe('Workshop I — Ingestion');
    expect(workshopLabel(g('ws_demo', 'Demo'))).toBe('Demo');
    expect(workshopLabel(g('ws_demo', 'Demo'), 'pl')).toBe('Demo');
    expect(sortGuides([g('ws_demo', 'Demo'), g('ws_delta', 'D', 2), g('ws_ingestion', 'I', 1)]).map((x) => x.id)).toEqual([
      'ws_ingestion',
      'ws_delta',
      'ws_demo',
    ]);
  });
  it('writes Roman numerals', () => {
    expect([1, 2, 3, 4, 5, 9, 10, 14, 40, 99].map(roman)).toEqual(['I', 'II', 'III', 'IV', 'V', 'IX', 'X', 'XIV', 'XL', 'XCIX']);
  });
});
