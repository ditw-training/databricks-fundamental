/**
 * Step checks run by POST /api/check (SPEC section 7).
 *
 * A check gets a `Run` function that executes one SQL statement on the SQL warehouse
 * as the participant (OBO) and returns the rows as objects (values as the Statement
 * Execution API gives them: strings or null). It throws CheckFail with a
 * participant-facing message, or returns the PASS message. The messages mirror
 * notebooks/workshops/_checks/ws_*.ipynb.
 */

export type Row = Record<string, unknown>;
export type Run = (statement: string) => Promise<Row[]>;

export interface CheckContext {
  /** retailhub_<slug>, only [a-z0-9_] (server/slug.ts). */
  catalog: string;
  run: Run;
}

export type StepCheck = (ctx: CheckContext) => Promise<string>;

/** A failed assertion; the message is shown to the participant and recorded. */
export class CheckFail extends Error {}

export function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new CheckFail(message);
}

/** Schema that holds the scratch tables of DataFrame steps. */
export const SCRATCH_SCHEMA = 'default';

/** <catalog>.default._ws_<workshop>_<step>, e.g. retailhub_jan.default._ws_ws_ingestion_t07. */
export const scratchTableName = (workshop: string, step: string) => `_ws_${workshop}_${step}`;

const IDENT = /^[A-Za-z0-9_]+$/;

/** `catalog`.`schema`.`table`; parts are validated, never taken from the browser. */
export function fq(catalog: string, schema: string, table: string): string {
  for (const part of [catalog, schema, table]) {
    if (!IDENT.test(part)) throw new Error(`Invalid identifier "${part}"`);
  }
  return `\`${catalog}\`.\`${schema}\`.\`${table}\``;
}

/** SQL string literal for a validated identifier (used in information_schema filters). */
const lit = (value: string) => {
  if (!IDENT.test(value)) throw new Error(`Invalid identifier "${value}"`);
  return `'${value}'`;
};

export interface Column {
  name: string;
  /** Lower-case type as Spark's simpleString() prints it: string, int, date, timestamp, ... */
  type: string;
}

/** Spark type names in information_schema ("INT", "DECIMAL(10,2)") -> simpleString style. */
export function normalizeType(dataType: unknown): string {
  const t = (typeof dataType === 'string' ? dataType : '').toLowerCase();
  const map: Record<string, string> = { integer: 'int', long: 'bigint', short: 'smallint', byte: 'tinyint' };
  return map[t] ?? t;
}

/**
 * Columns of a table in table order, or null when the table does not exist (or the
 * participant cannot see it). One information_schema query, no error on a missing table.
 */
export async function columnsOf(ctx: CheckContext, schema: string, table: string): Promise<Column[] | null> {
  const rows = await ctx.run(
    `SELECT column_name, data_type FROM \`${ctx.catalog}\`.information_schema.columns ` +
      `WHERE table_schema = ${lit(schema)} AND table_name = ${lit(table)} ORDER BY ordinal_position`,
  );
  if (rows.length === 0) return null;
  return rows.map((r) => ({ name: str(r.column_name), type: normalizeType(r.data_type) }));
}

export const names = (cols: Column[]) => cols.map((c) => c.name);
export const typesOf = (cols: Column[]) => Object.fromEntries(cols.map((c) => [c.name, c.type]));

/** Text of a warehouse value; NULL prints as Python's None (like the notebook messages). */
export function str(value: unknown): string {
  if (value === null || value === undefined) return 'None';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  return JSON.stringify(value);
}

/** Number from a warehouse value ("42", 42, null -> NaN). */
export const num = (value: unknown): number => (value === null || value === undefined ? NaN : Number(value));

/** First column of the first row as a number (SELECT count(*) AS n ...). */
export async function scalar(ctx: CheckContext, statement: string): Promise<number> {
  const rows = await ctx.run(statement);
  const first = rows[0];
  return first ? num(Object.values(first)[0]) : NaN;
}

/** 1,234 like Python's f"{n:,}". */
export const fmt = (n: number) => n.toLocaleString('en-US');

/** Python-like list repr for messages: ['a', 'b']. */
export const pyList = (items: unknown[]) => `[${items.map((i) => (typeof i === 'string' ? `'${i}'` : String(i))).join(', ')}]`;

/**
 * Scratch table of a DataFrame step: its columns, or a FAIL that tells the participant
 * to run the step's save line. `what` names the DataFrame(s), `where` the step.
 */
export async function needScratch(
  ctx: CheckContext,
  workshop: string,
  step: string,
  what: string,
  where: string,
): Promise<{ table: string; cols: Column[] }> {
  const name = scratchTableName(workshop, step);
  const cols = await columnsOf(ctx, SCRATCH_SCHEMA, name);
  // Same text as _saved() in notebooks/workshops/_checks/ws_*.ipynb; `what` is kept for callers.
  void what;
  expect(cols, `Table ${name} not found. Run ${where} to the end: its last line saves your result.`);
  return { table: fq(ctx.catalog, SCRATCH_SCHEMA, name), cols };
}

/** First line of an error, without the Spark error class prefix noise, max `max` chars. */
export function firstLine(err: unknown, max = 140): string {
  const text = err instanceof Error ? err.message : String(err);
  return (text.trim().split('\n')[0] ?? '').slice(0, max) || 'unknown error';
}

/** DESCRIBE HISTORY rows, newest first. */
export interface HistoryEntry {
  version: number;
  operation: string;
  parameters: Record<string, unknown>;
}

export async function history(ctx: CheckContext, table: string): Promise<HistoryEntry[]> {
  const rows = await ctx.run(`DESCRIBE HISTORY ${table}`);
  return rows
    .map((r) => ({
      version: num(r.version),
      operation: typeof r.operation === 'string' ? r.operation : '',
      parameters: parseMap(r.operationParameters),
    }))
    .sort((a, b) => b.version - a.version);
}

/** A MAP value as the warehouse returns it (JSON text or already an object). */
export function parseMap(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value === 'string' && value.startsWith('{')) {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}
