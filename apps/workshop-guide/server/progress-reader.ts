import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  participantRowSchema,
  progressRowSchema,
  trainerRowSchema,
  type ParticipantRow,
  type ProgressRow,
  type TrainerRow,
} from '../shared/progress-schema';
import { resolveProgressTable } from './progress';

/** Server-only SQL (not served by the analytics plugin, see config/queries/README.md). */
export const SQL_DIR = path.resolve(process.cwd(), 'server', 'sql');

/** Reads server/sql/<file> and fills in the validated table name. */
export function loadServerSql(file: string, table: string, dir: string = SQL_DIR): string {
  const text = readFileSync(path.join(dir, file), 'utf8');
  if (!text.includes('{{PROGRESS_TABLE}}')) {
    throw new Error(`server/sql/${file} must contain {{PROGRESS_TABLE}}`);
  }
  return text.split('{{PROGRESS_TABLE}}').join(resolveProgressTable(table));
}

/** Reads server/sql/latest_progress.sql and fills in the validated table name. */
export const loadLatestProgressSql = (table: string, dir: string = SQL_DIR): string =>
  loadServerSql('latest_progress.sql', table, dir);

/** Rows from the result of appkit.analytics.query (JSON_ARRAY, INLINE). Empty result → []. */
export function rowsFromResult(result: unknown): ProgressRow[] {
  const data = (result as { data?: unknown } | null | undefined)?.data ?? [];
  const parsed = z.array(progressRowSchema).safeParse(data);
  if (!parsed.success) throw new Error('Progress table returned rows of an unexpected shape');
  return parsed.data;
}

export const participantRows = (rows: ProgressRow[], email: string): ParticipantRow[] =>
  rows.filter((r) => r.user_email === email.toLowerCase()).map((r) => participantRowSchema.parse(r));

export const trainerRows = (rows: ProgressRow[]): TrainerRow[] => rows.map((r) => trainerRowSchema.parse(r));

interface Entry<Row> {
  at: number;
  promise: Promise<{ rows: Row[]; fetchedAt: string }>;
  /** Set once the read has finished; only a finished read can be patched in place. */
  value?: { rows: Row[]; fetchedAt: string };
}

/** One row as POST /api/progress inserts it (see buildProgressInsert). */
export interface ProgressWrite {
  user_email: string;
  step: string;
  step_type: string | null;
  status: string;
  message: string | null;
  hints_used: number | null;
  attempts: number | null;
}

const trackOf = (message: string | null) => /^track=(sql|pyspark)/.exec(message ?? '')?.[1] ?? null;
const maxOf = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.max(a, b));
/** `ts` the way CAST(ts AS STRING) prints it (UTC, space instead of T). */
const sqlTs = (date: Date) => date.toISOString().replace('T', ' ').replace('Z', '');

/**
 * The rows of latest_progress.sql after one more app-graded row, without reading the table again:
 * a pass wins over a fail, else the newer row; runs + 1; MAX of hints and attempts; the track of
 * a pass joins `tracks`. Rows of other users and steps are unchanged.
 */
export function applyProgressWrite(rows: ProgressRow[], write: ProgressWrite, now: Date = new Date()): ProgressRow[] {
  const email = write.user_email.toLowerCase();
  const idx = rows.findIndex((r) => r.user_email === email && r.step === write.step);
  const prev = idx >= 0 ? rows[idx] : undefined;
  const pass = write.status === 'pass';
  const tracks = new Set((prev?.tracks ?? '').split(',').filter(Boolean));
  const track = trackOf(write.message);
  if (pass && track) tracks.add(track);
  const shown = prev && prev.status === 'pass' && !pass ? prev : null;
  const next: ProgressRow = {
    user_email: email,
    step: write.step,
    step_type: shown ? shown.step_type : write.step_type,
    status: shown ? shown.status : write.status,
    message: shown ? shown.message : write.message,
    hints_used: maxOf(prev?.hints_used ?? null, write.hints_used),
    attempts: maxOf(prev?.attempts ?? null, write.attempts),
    source: shown ? shown.source : 'app',
    ts: shown ? shown.ts : sqlTs(now),
    runs: (prev?.runs ?? 0) + 1,
    tracks: [...tracks].sort().join(','),
  };
  if (prev) return rows.map((r, i) => (i === idx ? next : r));
  const out = [...rows, next];
  out.sort((a, b) => (a.user_email === b.user_email ? (a.step < b.step ? -1 : a.step > b.step ? 1 : 0) : a.user_email < b.user_email ? -1 : 1));
  return out;
}

/**
 * One warehouse statement per workshop per `ttlMs`, shared by every participant and
 * trainer. The in-flight promise is cached too, so many tabs polling a cold warehouse
 * share one statement. Failed reads are not cached.
 */
export class ProgressCache<Row = ProgressRow> {
  private entries = new Map<string, Entry<Row>>();

  constructor(
    private readonly load: (workshop: string) => Promise<Row[]>,
    private readonly ttlMs = 4000,
    private readonly now: () => number = Date.now,
  ) {}

  get(workshop: string): Promise<{ rows: Row[]; fetchedAt: string }> {
    const hit = this.entries.get(workshop);
    if (hit && this.now() - hit.at < this.ttlMs) return hit.promise;
    const at = this.now();
    const promise = this.load(workshop).then((rows) => ({ rows, fetchedAt: new Date(at).toISOString() }));
    const entry: Entry<Row> = { at, promise };
    this.entries.set(workshop, entry);
    promise.then(
      (value) => {
        entry.value = value;
      },
      () => {
        if (this.entries.get(workshop) === entry) this.entries.delete(workshop);
      },
    );
    return promise;
  }

  /**
   * After a write the server knows the result itself: change the cached rows in place (same
   * `fetchedAt` and expiry) instead of reading the table again. A read still in flight may or may
   * not include the write, so it is dropped instead, like `invalidate`.
   */
  patch(workshop: string, change: (rows: Row[]) => Row[]): void {
    const hit = this.entries.get(workshop);
    if (!hit?.value || this.now() - hit.at >= this.ttlMs) {
      this.entries.delete(workshop);
      return;
    }
    const value = { rows: change(hit.value.rows), fetchedAt: hit.value.fetchedAt };
    this.entries.set(workshop, { at: hit.at, promise: Promise.resolve(value), value });
  }

  /** Next read goes to the table (after a POST /api/progress). */
  invalidate(workshop: string): void {
    this.entries.delete(workshop);
  }
}
