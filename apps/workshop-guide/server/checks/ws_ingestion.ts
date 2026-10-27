/**
 * Workshop 1 — Ingestion: SQL version of notebooks/workshops/_checks/ws_ingestion.ipynb.
 *
 * The notebook objects are DataFrames, so every step except t11 saves its result to a
 * scratch table <catalog>.default._ws_ws_ingestion_<step> with one pre-filled line
 * (contract: apps/SPEC_workshop_guide.md, section 7). Steps with two DataFrames save
 * both in one table with a `_part` column; step 04 saves its two numbers as one row.
 * customers_df and orders_df are read back from the scratch tables of steps 03 and 05.
 *
 * A table has no row order, so (as in the notebook checks) sorting is not checked.
 */
import {
  type CheckContext,
  type Column,
  expect,
  fmt,
  fq,
  names,
  needScratch,
  num,
  pyList,
  scalar,
  str,
  type StepCheck,
  typesOf,
  columnsOf,
} from './framework';

export const WORKSHOP = 'ws_ingestion';

const scratch = (ctx: CheckContext, step: string, what: string, where: string) =>
  needScratch(ctx, WORKSHOP, step, what, where);

/** customers_df as saved by step 03. */
const customersRef = (ctx: CheckContext) => scratch(ctx, 't03', '`customers_df`', 'the step 03 cell');
/** orders_df as saved by step 05. */
const ordersRef = (ctx: CheckContext) => scratch(ctx, 't05', '`orders_df`', 'the step 05 cell');

function hasCols(cols: Column[], name: string, required: string[]) {
  const present = new Set(names(cols));
  const missing = required.filter((c) => !present.has(c));
  expect(missing.length === 0, `\`${name}\` is missing column(s) ${pyList(missing)}. Check the names and the \`.alias(...)\` / \`AS\` parts.`);
}

/** Columns of one `_part` of a two-DataFrame scratch table: non-NULL in that part. */
async function partColumns(ctx: CheckContext, table: string, cols: Column[], part: string): Promise<Column[]> {
  const candidates = cols.filter((c) => c.name !== '_part');
  if (candidates.length === 0) return [];
  const exprs = candidates.map((c, i) => `count(\`${c.name}\`) AS c${i}`).join(', ');
  const rows = await ctx.run(`SELECT ${exprs} FROM ${table} WHERE _part = '${part}'`);
  const counts = rows[0] ?? {};
  return candidates.filter((_, i) => num(counts[`c${i}`]) > 0);
}

async function needPart(ctx: CheckContext, table: string, cols: Column[], part: string, name: string, where: string) {
  expect(names(cols).includes('_part'), `The saved result has no \`_part\` column. Run ${where} again with its last line unchanged.`);
  const n = await scalar(ctx, `SELECT count(*) AS n FROM ${table} WHERE _part = '${part}'`);
  expect(n > 0, `\`${name}\` is empty or was not saved. Run ${where} again, including the last line.`);
  return { n, cols: await partColumns(ctx, table, cols, part) };
}

// t02 — CSV with an inferred schema
const t02: StepCheck = async (ctx) => {
  const { table, cols } = await scratch(ctx, 't02', '`customers_infer_df`', 'the step 02 cell');
  const n0 = names(cols);
  expect(
    n0.includes('customer_id') && n0.includes('email'),
    'Columns are named `_c0`, `_c1`, ...: the reader did not use the first row as the header. Check the `header` option.',
  );
  expect(cols.length === 10, `Expected 10 columns, got ${cols.length}. Check the format and the options.`);
  const n = await scalar(ctx, `SELECT count(*) AS n FROM ${table}`);
  expect(n > 0, '`customers_infer_df` is empty. Check the path passed to `.load(...)`.');
  return `customers_infer_df loaded: ${fmt(n)} rows, ${cols.length} columns.`;
};

// t03 — CSV with an explicit DDL schema
export const T03_COLS = [
  'customer_id', 'first_name', 'last_name', 'email', 'phone',
  'city', 'state', 'country', 'registration_date', 'customer_segment',
];

const t03: StepCheck = async (ctx) => {
  const { table, cols } = await customersRef(ctx);
  expect(
    names(cols).join(',') === T03_COLS.join(','),
    `Column names or order differ from the CSV. Got: ${pyList(names(cols))}`,
  );
  const t = typesOf(cols);
  const wrong = T03_COLS.filter((c) => t[c] !== (c === 'registration_date' ? 'date' : 'string'));
  expect(wrong.length === 0, `Wrong type for ${pyList(wrong)}: registration_date must be DATE, the other columns STRING.`);
  const rows = await ctx.run(`SELECT count(*) AS n, count_if(email LIKE '%@%') AS with_at FROM ${table}`);
  const n = num(rows[0]?.n);
  expect(n > 0, '`customers_df` is empty. Check the path and the `header` option.');
  expect(
    num(rows[0]?.with_at) > 0.9 * n,
    "Most `email` values have no '@': the schema columns are probably in the wrong order.",
  );
  return `explicit schema OK, ${fmt(n)} rows.`;
};

// t04 ⭐ — explore the customer DataFrame (total_rows, distinct_countries saved as one row)
const t04: StepCheck = async (ctx) => {
  const ref = await customersRef(ctx);
  const { table, cols } = await scratch(ctx, 't04', '`total_rows` and `distinct_countries`', 'your step 04 cell');
  hasCols(cols, 'step 04 result', ['total_rows', 'distinct_countries']);
  const rows = await ctx.run(`SELECT total_rows, distinct_countries FROM ${table} LIMIT 2`);
  expect(rows.length === 1, 'The saved step 04 result must be one row. Run the step 04 cell again.');
  const total = num(rows[0].total_rows);
  const countries = num(rows[0].distinct_countries);
  expect(Number.isInteger(total), '`total_rows` must be a Python int: call `.count()` on the DataFrame.');
  const expectedTotal = await scalar(ctx, `SELECT count(*) AS n FROM ${ref.table}`);
  expect(total === expectedTotal, `\`total_rows\` is ${fmt(total)}, but customers_df has ${fmt(expectedTotal)} rows.`);
  const expected = await scalar(ctx, `SELECT count(*) AS n FROM (SELECT DISTINCT country FROM ${ref.table})`);
  expect(countries === expected, `\`distinct_countries\` is ${str(rows[0].distinct_countries)}; count the distinct values of \`country\` instead.`);
  return `${fmt(total)} rows, ${countries} distinct country, summary computed.`;
};

// t05 — JSON orders with a schema
const t05: StepCheck = async (ctx) => {
  const { table, cols } = await ordersRef(ctx);
  hasCols(cols, 'orders_df', ['order_id', 'customer_id', 'order_datetime', 'total_amount', 'payment_method']);
  const t = typesOf(cols);
  expect(t.total_amount === 'double', '`total_amount` must be DOUBLE: pass `orders_schema` to the reader.');
  expect(t.order_datetime === 'string', '`order_datetime` must stay a STRING in this step (you cast it in step 07).');
  const rows = await ctx.run(
    `SELECT count(*) AS n, count_if(order_id LIKE 'ORD%') AS ord_ok, count(total_amount) AS amount_ok FROM ${table}`,
  );
  const n = num(rows[0]?.n);
  expect(n > 0, '`orders_df` is empty. Check the format and the path.');
  expect(
    num(rows[0]?.ord_ok) > 0.9 * n,
    '`order_id` values do not look like ORD...: the file was not parsed as JSON. Check the format name.',
  );
  const amountOk = num(rows[0]?.amount_ok);
  expect(
    amountOk > 0.9 * n,
    `Only ${fmt(amountOk)} of ${fmt(n)} rows have \`total_amount\`. Check the format name and the schema field names.`,
  );
  return `orders loaded: ${fmt(n)} rows.`;
};

// t06 ⭐ — filter customers (customers_ny_ca and customers_recent, `_part` ny_ca / recent)
const t06: StepCheck = async (ctx) => {
  const base = await customersRef(ctx);
  const where = 'your step 06 cell';
  const { table, cols } = await scratch(ctx, 't06', '`customers_ny_ca` / `customers_recent`', where);
  const nyCa = await needPart(ctx, table, cols, 'ny_ca', 'customers_ny_ca', where);
  const states = (await ctx.run(`SELECT DISTINCT state FROM ${table} WHERE _part = 'ny_ca'`)).map((r) => str(r.state));
  expect(
    states.length === 2 && states.includes('NY') && states.includes('CA'),
    `\`customers_ny_ca\` must contain the states NY and CA only, got ${pyList(states.sort())}.`,
  );
  let expected = await scalar(ctx, `SELECT count(*) AS n FROM ${base.table} WHERE state IN ('NY', 'CA')`);
  expect(nyCa.n === expected, `\`customers_ny_ca\` has ${fmt(nyCa.n)} rows, expected ${fmt(expected)}. Do not drop or duplicate rows.`);
  const recent = await needPart(ctx, table, cols, 'recent', 'customers_recent', where);
  expect(
    names(recent.cols).includes('registration_date'),
    "`customers_recent` is missing column(s) ['registration_date']. Check the names and the `.alias(...)` / `AS` parts.",
  );
  const old = await scalar(ctx, `SELECT count(*) AS n FROM ${table} WHERE _part = 'recent' AND year(registration_date) < 2025`);
  expect(old === 0, `\`customers_recent\` contains ${fmt(old)} customers registered before 2025. Compare the year with >= 2025.`);
  expected = await scalar(ctx, `SELECT count(*) AS n FROM ${base.table} WHERE year(registration_date) >= 2025`);
  expect(recent.n === expected, `\`customers_recent\` has ${fmt(recent.n)} rows, expected ${fmt(expected)}.`);
  return `NY/CA: ${fmt(nyCa.n)} rows, registered 2025+: ${fmt(recent.n)} rows.`;
};

// t07 — new columns and cast (customers_enriched and orders_typed, `_part` customers / orders)
const t07: StepCheck = async (ctx) => {
  const where = 'the step 07 cell';
  const { table, cols } = await scratch(ctx, 't07', '`customers_enriched` / `orders_typed`', where);
  const cust = await needPart(ctx, table, cols, 'customers', 'customers_enriched', where);
  hasCols(cust.cols, 'customers_enriched', ['first_name', 'last_name', 'full_name', 'registration_year']);
  const yearType = typesOf(cols).registration_year;
  expect(yearType === 'int', `\`registration_year\` must be INT, got ${yearType.toUpperCase()}. Use the year function on registration_date.`);
  const bad = await scalar(
    ctx,
    `SELECT count(*) AS n FROM ${table} WHERE _part = 'customers' AND first_name IS NOT NULL AND last_name IS NOT NULL ` +
      `AND NOT (full_name <=> concat_ws(' ', first_name, last_name))`,
  );
  expect(bad === 0, `${fmt(bad)} rows have a wrong \`full_name\`. Expected first name, one space, last name.`);

  const orders = await ordersRef(ctx);
  await needPart(ctx, table, cols, 'orders', 'orders_typed', where);
  const tsType = typesOf(cols).order_ts as string | undefined;
  expect(tsType === 'timestamp', `\`order_ts\` must be TIMESTAMP, got ${tsType ?? 'None'}. Cast \`order_datetime\` to timestamp.`);
  const src = await scalar(ctx, `SELECT count(order_datetime) AS n FROM ${orders.table}`);
  const dst = await scalar(ctx, `SELECT count(order_ts) AS n FROM ${table} WHERE _part = 'orders'`);
  expect(src === dst, `${fmt(src - dst)} non-NULL \`order_datetime\` values became NULL in \`order_ts\`.`);
  return 'full_name, registration_year and order_ts OK.';
};

// t08 — conditional column customer_tier
const t08: StepCheck = async (ctx) => {
  const { table, cols } = await scratch(ctx, 't08', '`customers_tiered`', 'the step 08 cell');
  hasCols(cols, 'customers_tiered', ['customer_tier', 'registration_date']);
  const nulls = await scalar(ctx, `SELECT count(*) AS n FROM ${table} WHERE customer_tier IS NULL`);
  expect(nulls === 0, `\`customer_tier\` has ${fmt(nulls)} NULL values. Add the final \`.otherwise(...)\` / ELSE branch.`);
  const good =
    "CASE WHEN year(registration_date) >= 2025 THEN 'New' WHEN year(registration_date) >= 2024 THEN 'Regular' ELSE 'Loyal' END";
  const bad = await scalar(ctx, `SELECT count(*) AS n FROM ${table} WHERE NOT (customer_tier <=> ${good})`);
  expect(bad === 0, `${fmt(bad)} rows have the wrong tier. Check the thresholds and that the >= 2025 branch comes first.`);
  const tiers = (await ctx.run(`SELECT DISTINCT customer_tier FROM ${table} ORDER BY customer_tier`)).map((r) =>
    str(r.customer_tier),
  );
  return `tiers ${pyList(tiers)}, every row correct.`;
};

// t09 — aggregation by payment method (row order is not checked: a table has none)
const t09: StepCheck = async (ctx) => {
  const orders = await ordersRef(ctx);
  const { table, cols } = await scratch(ctx, 't09', '`payment_stats`', 'the step 09 cell');
  hasCols(cols, 'payment_stats', ['payment_method', 'order_count', 'total_revenue', 'avg_order_value']);
  const rows = await ctx.run(
    `SELECT count(*) AS n, count(DISTINCT payment_method) + max(CASE WHEN payment_method IS NULL THEN 1 ELSE 0 END) AS methods, ` +
      `sum(order_count) AS orders FROM ${table}`,
  );
  const exp = await ctx.run(
    `SELECT count(DISTINCT payment_method) + max(CASE WHEN payment_method IS NULL THEN 1 ELSE 0 END) AS methods, count(*) AS orders ` +
      `FROM ${orders.table}`,
  );
  const missing = await scalar(
    ctx,
    `SELECT count(*) AS n FROM (SELECT DISTINCT payment_method FROM ${orders.table}) o ` +
      `LEFT ANTI JOIN ${table} p ON o.payment_method <=> p.payment_method`,
  );
  const n = num(rows[0]?.n);
  expect(
    missing === 0 && num(rows[0]?.methods) === num(exp[0]?.methods) && n === num(exp[0]?.methods),
    '`payment_stats` must have exactly one row per payment method (NULL included). Group by `payment_method`.',
  );
  expect(num(rows[0]?.orders) === num(exp[0]?.orders), '`order_count` values do not add up to all orders. Count rows with COUNT(*).');
  return `${n} payment methods aggregated.`;
};

// t10 ⭐ — SQL on temp views (top_states; row order is not checked)
const t10: StepCheck = async (ctx) => {
  const base = await customersRef(ctx);
  const { table, cols } = await scratch(ctx, 't10', '`top_states`', 'your step 10 cell');
  hasCols(cols, 'top_states', ['state', 'customer_count']);
  const counts = (await ctx.run(`SELECT customer_count FROM ${table} ORDER BY customer_count DESC`)).map((r) =>
    num(r.customer_count),
  );
  expect(counts.length === 5, `Expected 5 rows, got ${counts.length}. Limit the result to the top 5.`);
  const top = (
    await ctx.run(`SELECT count(*) AS n FROM ${base.table} GROUP BY state ORDER BY n DESC LIMIT 5`)
  ).map((r) => num(r.n));
  expect(
    counts.join(',') === top.join(','),
    'The counts are not the 5 largest per state. Group by `state`, count all rows and sort by `customer_count` descending before LIMIT.',
  );
  return `top 5 states, counts ${pyList(counts)}.`;
};

// t11 — Bronze Delta table (a real table, no scratch table)
const t11: StepCheck = async (ctx) => {
  const raw = await customersRef(ctx);
  const target = `${ctx.catalog}.bronze.lab_ingestion_customers`;
  const cols = await columnsOf(ctx, 'bronze', 'lab_ingestion_customers');
  expect(cols, `Table ${target} not found. Run the write part of the step 11 cell.`);
  const expected = [...names(raw.cols), '_load_ts', '_source_file'].sort();
  expect(
    names(cols).sort().join(',') === expected.join(','),
    `\`customers_bronze\` must be the raw customers_df plus \`_load_ts\` and \`_source_file\`, nothing else. Got ${pyList(names(cols))}`,
  );
  expect(typesOf(cols)._load_ts === 'timestamp', '`_load_ts` must be TIMESTAMP: use the current timestamp function.');
  const table = fq(ctx.catalog, 'bronze', 'lab_ingestion_customers');
  const n = await scalar(ctx, `SELECT count(*) AS n FROM ${table}`);
  const rawN = await scalar(ctx, `SELECT count(*) AS n FROM ${raw.table}`);
  expect(n === rawN, `Bronze keeps every source row: expected ${fmt(rawN)}, the table has ${fmt(n)}. Use mode overwrite, no filters.`);
  const paths = await scalar(ctx, `SELECT count(*) AS n FROM ${table} WHERE _source_file LIKE '%customers.csv%'`);
  expect(paths > 0, '`_source_file` does not contain the path of customers.csv. Take it from the hidden `_metadata` column.');
  return `${fmt(n)} rows written to ${target}.`;
};

// t12 ⭐ — join orders with customers (orders_enriched / orders_by_country, `_part` enriched / by_country)
const t12: StepCheck = async (ctx) => {
  const orders = await ordersRef(ctx);
  const customers = await customersRef(ctx);
  const where = 'your step 12 cell';
  const { table, cols } = await scratch(ctx, 't12', '`orders_enriched` / `orders_by_country`', where);
  const enriched = await needPart(ctx, table, cols, 'enriched', 'orders_enriched', where);
  hasCols(enriched.cols, 'orders_enriched', [
    'order_id', 'customer_id', 'first_name', 'last_name', 'country', 'total_amount', 'payment_method',
  ]);
  const expected = await scalar(
    ctx,
    `SELECT count(*) AS n FROM ${orders.table} o LEFT JOIN ${customers.table} c ON o.customer_id = c.customer_id`,
  );
  expect(
    enriched.n === expected,
    `\`orders_enriched\` has ${fmt(enriched.n)} rows, a left join gives ${fmt(expected)}. Use a left join on customer_id, no filters.`,
  );
  const stats = await needPart(ctx, table, cols, 'by_country', 'orders_by_country', where);
  hasCols(stats.cols, 'orders_by_country', ['country', 'order_count', 'total_revenue']);
  const ordersN = await scalar(ctx, `SELECT count(*) AS n FROM ${orders.table}`);
  return `${fmt(enriched.n)} enriched orders (more than ${fmt(ordersN)}: duplicate customer IDs), ${stats.n} countries.`;
};

export const INGESTION_CHECKS: Record<string, StepCheck> = {
  t02, t03, t04, t05, t06, t07, t08, t09, t10, t11, t12,
};
