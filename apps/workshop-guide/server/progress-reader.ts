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
    promise.catch(() => {
      if (this.entries.get(workshop) === entry) this.entries.delete(workshop);
    });
    return promise;
  }

  /** Next read goes to the table (after a POST /api/progress). */
  invalidate(workshop: string): void {
    this.entries.delete(workshop);
  }
}
