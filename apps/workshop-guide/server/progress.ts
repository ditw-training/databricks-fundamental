import { progressPostSchema, type Guide, type ProgressPost, type Step } from '../shared/guide-schema';

export const DEFAULT_PROGRESS_TABLE = 'retailhub_trainer.default.workshop_progress';

const TABLE_PATTERN = /^[A-Za-z0-9_]+\.[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/;

/**
 * Progress table from PROGRESS_TABLE (default per spec). The name is interpolated
 * into the INSERT, so only plain three-part names are accepted.
 */
export function resolveProgressTable(value: string | undefined = process.env.PROGRESS_TABLE): string {
  const table = (value ?? '').trim() || DEFAULT_PROGRESS_TABLE;
  if (!TABLE_PATTERN.test(table)) {
    throw new Error(`PROGRESS_TABLE must be catalog.schema.table (letters, digits, underscore); got "${table}"`);
  }
  return table;
}

/** Comma/semicolon/space separated list -> lower-case set. */
export function parseEmailList(value: string | undefined): Set<string> {
  return new Set(
    (value ?? '')
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

type HeaderSource = { header(name: string): string | undefined };

/**
 * Participant identity. Databricks Apps sets X-Forwarded-Email for the signed-in
 * user. DEV_USER_EMAIL is only honoured outside production (local `npm run dev`).
 */
export function resolveUserEmail(
  req: HeaderSource,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const header = req.header('x-forwarded-email')?.trim();
  if (header) return header.toLowerCase();
  if (env.NODE_ENV !== 'production' && env.DEV_USER_EMAIL) {
    return env.DEV_USER_EMAIL.trim().toLowerCase();
  }
  return null;
}

export type ProgressValidation =
  | { ok: true; post: ProgressPost; step: Step }
  | { ok: false; status: number; error: string };

/**
 * Validates a POST /api/progress body: shape (zod), known workshop and step, and
 * only steps the app grades itself (order/match with "check": "app").
 */
export function validateProgressPost(body: unknown, guides: Map<string, Guide>): ProgressValidation {
  const parsed = progressPostSchema.safeParse(body);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join('.') || '(body)').join(', ');
    return { ok: false, status: 400, error: `Invalid body (fields: ${fields})` };
  }
  const post = parsed.data;
  const guide = guides.get(post.workshop);
  if (!guide) return { ok: false, status: 404, error: `Unknown workshop "${post.workshop}"` };
  const step = guide.steps.find((s) => s.id === post.step);
  if (!step) return { ok: false, status: 404, error: `Unknown step "${post.step}" in ${post.workshop}` };
  if (step.check !== 'app') {
    return { ok: false, status: 409, error: `Step "${post.step}" is graded with the Check button (POST /api/check)` };
  }
  return { ok: true, post, step };
}

/** Parameterized INSERT; values are bound as statement parameters, never interpolated. */
export function buildProgressInsert(table: string): string {
  return `INSERT INTO ${resolveProgressTable(table)}
  (user_email, workshop, step, step_type, status, message, hints_used, attempts, source, ts)
VALUES
  (:user_email, :workshop, :step, :step_type, :status, :message, :hints_used, :attempts, 'app', current_timestamp())`;
}

/** Row of a Check result (POST /api/check): hints from the app, attempts NULL (count = runs). */
export function buildCheckInsert(table: string): string {
  return `INSERT INTO ${resolveProgressTable(table)}
  (user_email, workshop, step, step_type, status, message, hints_used, attempts, source, ts)
VALUES
  (:user_email, :workshop, :step, :step_type, :status, :message, :hints_used, NULL, 'app', current_timestamp())`;
}

/**
 * "Reset my progress": removes only the caller's rows of one workshop. user_email is
 * compared in lower case because notebook rows carry current_user() as typed.
 */
export function buildProgressReset(table: string): string {
  return `DELETE FROM ${resolveProgressTable(table)}
WHERE lower(user_email) = :user_email AND workshop = :workshop`;
}
