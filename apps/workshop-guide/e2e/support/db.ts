/**
 * Test-data cleanup in the progress table: setup / teardown, and test 11b, which deletes one
 * participant's rows to simulate rows removed outside the app.
 *
 * Deletes ONLY the identities this suite creates: `e2e-*@example.com` participants and the
 * `trainer.e2e@example.com` trainer (including its `__unlock` rows). Real users' rows and rows of
 * other test tools (e.g. `load.*@example.com`) are never touched.
 */
import { execFileSync } from 'node:child_process';

export const TRAINER_EMAIL = 'trainer.e2e@example.com';
export const PARTICIPANT_PREFIX = 'e2e-';

const PROFILE = process.env.E2E_DATABRICKS_PROFILE ?? process.env.DATABRICKS_CONFIG_PROFILE ?? 'ditwlab-admin';
const TABLE = process.env.PROGRESS_TABLE ?? 'retailhub_trainer.default.workshop_progress';

if (!/^[A-Za-z0-9_]+\.[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/.test(TABLE)) throw new Error(`Bad PROGRESS_TABLE: ${TABLE}`);

/** WHERE clause that matches the suite's identities only. */
export const TEST_ROWS = `(lower(user_email) LIKE '${PARTICIPANT_PREFIX}%@example.com' OR lower(user_email) = '${TRAINER_EMAIL}')`;

export function runSql(statement: string): unknown {
  const out = execFileSync(
    'databricks',
    ['experimental', 'aitools', 'tools', 'query', '--profile', PROFILE, statement],
    {
      encoding: 'utf8',
      timeout: 180_000,
    }
  );
  try {
    return JSON.parse(out);
  } catch {
    return out;
  }
}

export function countTestRows(): number {
  const rows = runSql(`SELECT count(*) AS n FROM ${TABLE} WHERE ${TEST_ROWS}`) as { n: string }[];
  return Number(rows[0]?.n ?? 0);
}

export function deleteTestRows(): number {
  const before = countTestRows();
  if (before > 0) runSql(`DELETE FROM ${TABLE} WHERE ${TEST_ROWS}`);
  return before;
}

/**
 * Deletes one suite participant's rows of one workshop, as if they were removed outside the app
 * (trainer cleanup, lab rebuild). Refuses any identity that is not an `e2e-*@example.com` one.
 */
export function deleteParticipantRows(email: string, workshop: string): void {
  const e = email.toLowerCase();
  if (!/^e2e-[a-z0-9-]+@example\.com$/.test(e) || !/^[a-z0-9_]+$/.test(workshop)) {
    throw new Error(`refusing to delete rows of ${email} / ${workshop}`);
  }
  runSql(`DELETE FROM ${TABLE} WHERE lower(user_email) = '${e}' AND workshop = '${workshop}'`);
}
