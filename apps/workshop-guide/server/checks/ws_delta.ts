/**
 * Workshop 2 — Delta Lake: SQL version of notebooks/workshops/_checks/ws_delta.ipynb.
 *
 * Most steps change the real table <catalog>.bronze.lab_delta_cust_ws, so the checks read
 * it (DESCRIBE DETAIL / HISTORY, SHOW TBLPROPERTIES, information_schema). Steps whose
 * result lives only in the notebook session save it to <catalog>.default._ws_ws_delta_<step>
 * with one pre-filled line (SPEC section 7):
 *
 *   t02, t04  one row, column `error` STRING (enforcement_error / constraint_error)
 *   t09       full_history       t10  customers_v0       t11  df_ts
 *
 * Temp views (customers_csv, updates_view) do not exist on the warehouse, so step 01
 * counts the CSV file with read_files and step 08 checks the fixed batch values, like the
 * notebook checks. Step 12 accepts both forms of a full DELETE in the history.
 */
import {
  type CheckContext,
  CheckFail,
  columnsOf,
  expect,
  fmt,
  fq,
  history,
  type HistoryEntry,
  names,
  needScratch,
  pyList,
  scalar,
  str,
  type StepCheck,
  typesOf,
} from './framework';

export const WORKSHOP = 'ws_delta';
const SCHEMA = 'bronze';
const TABLE = 'lab_delta_cust_ws';

const table = (ctx: CheckContext) => fq(ctx.catalog, SCHEMA, TABLE);

/** Columns of lab_delta_cust_ws, or FAIL "run the setup cell and step 01 first". */
async function needTable(ctx: CheckContext) {
  const cols = await columnsOf(ctx, SCHEMA, TABLE);
  expect(cols, 'Table lab_delta_cust_ws not found. Run the setup cell and step 01 first.');
  return cols;
}

/** Operations from DESCRIBE HISTORY, newest first. */
const ops = (h: HistoryEntry[]) => h.map((e) => e.operation);

const count = (ctx: CheckContext, where = 'TRUE') => scalar(ctx, `SELECT count(*) AS n FROM ${table(ctx)} WHERE ${where}`);

/** The one-row `error` column saved by steps 02 and 04. */
async function savedError(ctx: CheckContext, step: string, variable: string, where: string): Promise<string | null> {
  const s = await needScratch(ctx, WORKSHOP, step, `\`${variable}\``, where);
  expect(names(s.cols).includes('error'), `The saved ${variable} has no \`error\` column. Run ${where} again with its last line unchanged.`);
  const rows = await ctx.run(`SELECT error FROM ${s.table} LIMIT 1`);
  const value = rows[0]?.error;
  return typeof value === 'string' && value ? value : null;
}

// t01: managed Delta table created from customers_csv
const t01: StepCheck = async (ctx) => {
  const cols = await needTable(ctx);
  const detail = await ctx.run(`DESCRIBE DETAIL ${table(ctx)}`);
  const format = typeof detail[0]?.format === 'string' ? detail[0].format : '';
  expect(format === 'delta', `The table format is '${format}', expected 'delta'. Create it with CREATE TABLE ... AS SELECT, without USING.`);
  expect(names(cols).includes('customer_id'), 'Column customer_id is missing. Select all columns of the view with *.');
  const n = await count(ctx);
  expect(n > 0, 'The table is empty. Load the rows with AS SELECT ... FROM customers_csv.');
  // customers_csv is a temp view of the notebook session; count its file instead.
  let src: number | null = null;
  try {
    src = await scalar(
      ctx,
      `SELECT count(*) AS n FROM read_files('/Volumes/${ctx.catalog}/default/datasets/customers/customers.csv', ` +
        `format => 'csv', header => true)`,
    );
  } catch {
    src = null;
  }
  if (src !== null && Number.isFinite(src)) {
    expect(n === src, `The table has ${fmt(n)} rows, customers_csv has ${fmt(src)}. Recreate it from the whole view with CREATE OR REPLACE.`);
  }
  return `lab_delta_cust_ws is a Delta table with ${fmt(n)} rows.`;
};

// t02 (optional): schema enforcement rejected bad_df
const t02: StepCheck = async (ctx) => {
  const cols = await needTable(ctx);
  expect(
    !names(cols).includes('mood'),
    'The table has a column mood: the append evolved the schema. Start again from the setup cell and append without mergeSchema.',
  );
  expect(
    (await count(ctx, "customer_id = 'BAD001'")) === 0,
    'Row BAD001 is in the table: the bad append was accepted. Append bad_df without any schema option.',
  );
  const err = await savedError(ctx, 't02', 'enforcement_error', 'the step 02 cell');
  expect(err, 'enforcement_error is empty: the append did not run or did not fail. Replace pass with the append of bad_df to TABLE.');
  expect(
    err.toLowerCase().includes('schema'),
    `The error must come from Delta (schema mismatch), not from a typo. Your error: ${err.slice(0, 120)}`,
  );
  return 'Delta rejected bad_df (extra column mood); the table is unchanged.';
};

// t03: column loyalty_tier (STRING) added
const t03: StepCheck = async (ctx) => {
  const types = typesOf(await needTable(ctx));
  expect('loyalty_tier' in types, 'Column loyalty_tier not found. Add it with ALTER TABLE ... ADD COLUMN.');
  expect(
    types.loyalty_tier === 'string',
    `loyalty_tier has type ${types.loyalty_tier}, expected STRING. Start again from the setup cell and add it as STRING.`,
  );
  return 'Column loyalty_tier (STRING) added; existing rows have NULL in it.';
};

// t04 (optional): CHECK constraint valid_country active and enforced
const t04: StepCheck = async (ctx) => {
  await needTable(ctx);
  const props = await ctx.run(`SHOW TBLPROPERTIES ${table(ctx)}`);
  const prop = props.find((r) => r.key === 'delta.constraints.valid_country');
  const expr = typeof prop?.value === 'string' ? prop.value : '';
  expect(expr, 'Constraint valid_country not found. Add it with ALTER TABLE ... ADD CONSTRAINT valid_country CHECK (...).');
  expect(
    expr.toLowerCase().includes('country') && expr.toLowerCase().includes('null'),
    `valid_country checks '${expr}'. It must reject rows where country is NULL.`,
  );
  expect(
    (await count(ctx, "customer_id = 'BAD_C'")) === 0,
    'BAD_C is in the table, so the constraint did not stop it. Add the constraint before the INSERT.',
  );
  const err = await savedError(ctx, 't04', 'constraint_error', 'the step 04 cell');
  expect(err, 'constraint_error is empty. Insert customer BAD_C with country NULL inside the try block.');
  expect(
    err.toLowerCase().includes('constraint') || err.includes('DELTA_VIOLATE_CONSTRAINT'),
    `The error must come from the Delta constraint, not from a typo. Your error: ${err.slice(0, 120)}`,
  );
  return `Constraint valid_country (${expr}) rejected the row with a NULL country.`;
};

// t05: three test customers inserted once
const t05: StepCheck = async (ctx) => {
  await needTable(ctx);
  const rows = await ctx.run(`SELECT customer_id, country FROM ${table(ctx)} WHERE customer_id LIKE 'TEST%'`);
  const ids = rows.map((r) => str(r.customer_id)).sort();
  expect(
    ids.join(',') === 'TEST001,TEST002,TEST003',
    `Expected TEST001, TEST002, TEST003 once each, found ${ids.length ? pyList(ids) : 'none'}. Inserted twice? ` +
      "Run DELETE FROM lab_delta_cust_ws WHERE customer_id LIKE 'TEST%', then insert again.",
  );
  const bad = rows.filter((r) => r.country !== 'TestLand').map((r) => str(r.customer_id));
  expect(bad.length === 0, `country is not 'TestLand' for ${pyList(bad)}. Use the string 'TestLand' in quotes.`);
  expect(ops(await history(ctx, table(ctx))).slice(0, 5).includes('WRITE'), 'No recent WRITE version in the history. Run your INSERT statement.');
  return 'TEST001, TEST002 and TEST003 inserted in one new table version.';
};

// t06: only TEST001 updated to Poland / Gold
const t06: StepCheck = async (ctx) => {
  const cols = await needTable(ctx);
  expect(names(cols).includes('loyalty_tier'), 'Column loyalty_tier not found. Run step 03 first.');
  const rows = await ctx.run(`SELECT country, loyalty_tier FROM ${table(ctx)} WHERE customer_id = 'TEST001'`);
  expect(rows.length === 1, `TEST001 found ${rows.length} times, expected once. Run step 05 first.`);
  const got = [str(rows[0].country), str(rows[0].loyalty_tier)];
  expect(
    got[0] === 'Poland' && got[1] === 'Gold',
    `TEST001 has country=${got[0]}, loyalty_tier=${got[1]}; expected Poland and Gold.`,
  );
  const gold = await count(ctx, "loyalty_tier = 'Gold'");
  expect(gold === 1, `${fmt(gold)} rows have loyalty_tier Gold, expected 1. Limit the UPDATE with WHERE; start again from the setup cell.`);
  const moved = await count(ctx, "customer_id IN ('TEST002', 'TEST003') AND country != 'TestLand'");
  expect(moved === 0, 'TEST002 or TEST003 changed too. Only TEST001 may change: check the WHERE condition.');
  expect(ops(await history(ctx, table(ctx))).slice(0, 5).includes('UPDATE'), 'No recent UPDATE version in the history. Run your UPDATE statement.');
  return 'TEST001 updated to Poland / Gold; no other row changed.';
};

// t07 (optional): TEST002 and TEST003 deleted, TEST001 kept
const t07: StepCheck = async (ctx) => {
  await needTable(ctx);
  const ids = new Set(
    (await ctx.run(`SELECT customer_id FROM ${table(ctx)} WHERE customer_id LIKE 'TEST%'`)).map((r) => str(r.customer_id)),
  );
  const left = ['TEST002', 'TEST003'].filter((id) => ids.has(id));
  expect(left.length === 0, `Still in the table: ${pyList(left)}. Delete both with one DELETE ... WHERE customer_id IN (...).`);
  expect(
    ids.has('TEST001'),
    'TEST001 is missing: the DELETE removed too much. Run steps 05 and 06 again, then delete only TEST002 and TEST003.',
  );
  expect(ops(await history(ctx, table(ctx))).slice(0, 5).includes('DELETE'), 'No recent DELETE version in the history. Run your DELETE statement.');
  return 'TEST002 and TEST003 deleted; TEST001 kept.';
};

/**
 * The fixed batch of step 08 (WORKSHOP_delta, ready cell): TEST001 and the first customer
 * of the CSV are updated, MERGE_NEW is inserted. The first customer's id is not known
 * here, so it is found by its new first_name.
 */
export const T08_BATCH = [
  { label: 'TEST001', where: "customer_id = 'TEST001'", first_name: 'MergedAlice', loyalty_tier: 'Platinum' },
  { label: 'The existing customer from updates_view', where: "first_name = 'MergedProd'", first_name: 'MergedProd', loyalty_tier: 'Silver' },
  { label: 'MERGE_NEW', where: "customer_id = 'MERGE_NEW'", first_name: 'NewViaMerge', loyalty_tier: null },
] as const;

// t08: MERGE updated 2 customers and inserted 1, nothing else removed
const t08: StepCheck = async (ctx) => {
  const cols = await needTable(ctx);
  expect(names(cols).includes('loyalty_tier'), 'Column loyalty_tier not found. Run step 03 first.');
  for (const s of T08_BATCH) {
    const rows = await ctx.run(`SELECT first_name, loyalty_tier FROM ${table(ctx)} WHERE ${s.where}`);
    if (s.label.startsWith('The existing') && rows.length === 0) {
      throw new CheckFail(`${s.label} does not have the values from updates_view. Check WHEN MATCHED ... UPDATE SET.`);
    }
    expect(rows.length === 1, `${s.label} found ${rows.length} times, expected once. Check ON and WHEN NOT MATCHED ... INSERT.`);
    expect(
      rows[0].first_name === s.first_name && (rows[0].loyalty_tier ?? null) === s.loyalty_tier,
      `${s.label} does not have the values from updates_view. Check WHEN MATCHED ... UPDATE SET.`,
    );
  }
  const others = await count(ctx, "customer_id != 'TEST001' AND customer_id != 'MERGE_NEW' AND NOT (first_name <=> 'MergedProd')");
  expect(
    others > 0,
    'Only the batch rows are left: a NOT MATCHED BY SOURCE ... DELETE removed the others. Start again from the setup cell.',
  );
  expect(ops(await history(ctx, table(ctx))).slice(0, 5).includes('MERGE'), 'No recent MERGE version in the history. Run your MERGE statement.');
  return `MERGE applied: ${T08_BATCH.length} batch rows match updates_view, the other ${fmt(others)} customers are kept.`;
};

// t09 (optional): full_history holds DESCRIBE HISTORY
const t09: StepCheck = async (ctx) => {
  const s = await needScratch(ctx, WORKSHOP, 't09', 'full_history', 'your step 09 cell');
  expect(names(s.cols).includes('operation'), 'full_history has no operation column, so it is not the result of DESCRIBE HISTORY.');
  const found = (await ctx.run(`SELECT operation FROM ${s.table}`)).map((r) => str(r.operation));
  const missing = ['UPDATE', 'MERGE'].filter((o) => !found.includes(o));
  expect(missing.length === 0, `${pyList(missing)} not found in full_history. Run steps 06 and 08, then run step 09 again.`);
  return `full_history has ${found.length} versions, including UPDATE and MERGE.`;
};

// t10: customers_v0 is version 0 of the table
const t10: StepCheck = async (ctx) => {
  const s = await needScratch(ctx, WORKSHOP, 't10', 'customers_v0', 'your step 10 cell (end your statement with ;)');
  const cols = names(s.cols);
  expect(cols.includes('customer_id'), 'customers_v0 has no customer_id column. Select all columns with *.');
  expect(!cols.includes('loyalty_tier'), 'customers_v0 has loyalty_tier, so it is not version 0 (the column came in step 03).');
  const n0 = await scalar(ctx, `SELECT count(*) AS n FROM ${s.table}`);
  const test = await scalar(ctx, `SELECT count(*) AS n FROM ${s.table} WHERE customer_id = 'TEST001'`);
  expect(test === 0, 'customers_v0 contains TEST001 (inserted in step 05), so it is not version 0.');
  await needTable(ctx);
  const n = await count(ctx);
  return `customers_v0 is version 0: ${fmt(n0)} rows, no loyalty_tier (current table: ${fmt(n)} rows).`;
};

// t11 (optional): df_ts is the table at the time of the INSERT from step 05
const t11: StepCheck = async (ctx) => {
  const s = await needScratch(ctx, WORKSHOP, 't11', 'df_ts', 'your step 11 cell');
  expect(names(s.cols).includes('customer_id') && names(s.cols).includes('country'), 'df_ts must be TABLE read with TIMESTAMP AS OF ts_str (all columns).');
  const rows = await ctx.run(`SELECT country FROM ${s.table} WHERE customer_id = 'TEST001'`);
  expect(rows.length === 1, 'df_ts has no TEST001, so ts_insert is earlier than the INSERT of step 05.');
  const country = str(rows[0].country);
  expect(
    country === 'TestLand',
    `TEST001 has country ${country} in df_ts, expected TestLand. Use the exact INSERT time, with microseconds.`,
  );
  return 'df_ts shows the table at the INSERT of step 05: TEST001 still has country TestLand.';
};

/**
 * A DELETE without WHERE (the accident). Older runtimes record an empty predicate; the SQL
 * warehouse and serverless record ["true"] (seen in the lab on 2026-10-27).
 */
export const isFullDelete = (e: HistoryEntry) => {
  if (e.operation !== 'DELETE') return false;
  let p = e.parameters.predicate;
  if (typeof p === 'string' && p.startsWith('[')) {
    try {
      p = JSON.parse(p) as unknown;
    } catch {
      /* keep the text */
    }
  }
  if (Array.isArray(p)) p = p.length === 0 ? '' : p.length === 1 ? p[0] : 'many';
  if (p === undefined || p === null) return true;
  const text = (typeof p === 'string' ? p : JSON.stringify(p)).trim().toLowerCase();
  return text === '' || text === 'true';
};

// t12: accidental DELETE undone with RESTORE
const t12: StepCheck = async (ctx) => {
  await needTable(ctx);
  const h = await history(ctx, table(ctx));
  const accident = h.find(isFullDelete);
  expect(accident, 'No DELETE after safe_version. Run the accident first: DELETE FROM without WHERE.');
  const restore = h.find((e) => e.operation === 'RESTORE' && e.version > accident.version);
  expect(restore, 'No RESTORE after safe_version. Roll the table back to safe_version with RESTORE.');
  const newerDelete = h.find((e) => e.operation === 'DELETE' && e.version > restore.version);
  expect(!newerDelete, 'The newest RESTORE is older than the DELETE. Run RESTORE after the accident.');
  const before = await scalar(ctx, `SELECT count(*) AS n FROM ${table(ctx)} VERSION AS OF ${accident.version - 1}`);
  expect(
    before > 0,
    'The table was already empty before the accident. Restore to the version before the DELETE (see DESCRIBE HISTORY), then run the ready cell again.',
  );
  const n = await count(ctx);
  expect(n === before, `The table has ${fmt(n)} rows, expected ${fmt(before)} as before the accident. Restore to safe_version.`);
  return `${fmt(n)} rows are back; DELETE and RESTORE are in the history.`;
};

export const DELTA_CHECKS: Record<string, StepCheck> = {
  t01, t02, t03, t04, t05, t06, t07, t08, t09, t10, t11, t12,
};

