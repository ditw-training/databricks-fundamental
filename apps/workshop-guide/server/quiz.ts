/**
 * Course quiz (learning mode): public questions from config/quiz/questions.json,
 * answers and explanations from a private key file in a Unity Catalog volume
 * (QUIZ_KEY_PATH), read by the app service principal. Grading happens here only.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  quizAnswerPostSchema,
  quizKeySchema,
  quizParticipantRowSchema,
  quizProgressRowSchema,
  quizQuestionsSchema,
  type QuizAnswerPost,
  type QuizKey,
  type QuizParticipantRow,
  type QuizLang,
  type QuizProgressRow,
  type QuizQuestions,
  type QuizReviewResponse,
} from '../shared/quiz-schema';
import { resolveProgressTable } from './progress';

/** Value of the `workshop` column for quiz rows. */
export const QUIZ_WORKSHOP = 'quiz';
export const DEFAULT_QUIZ_KEY_PATH = '/Volumes/retailhub_trainer/default/workshop_guide_private/quiz_key.json';
export const QUIZ_DIR = path.resolve(process.cwd(), 'config', 'quiz');

const KEY_PATH_PATTERN = /^\/Volumes\/[A-Za-z0-9_]+\/[A-Za-z0-9_]+\/[A-Za-z0-9_]+\/[A-Za-z0-9_./-]+\.json$/;

export function resolveQuizKeyPath(value: string | undefined = process.env.QUIZ_KEY_PATH): string {
  const p = (value ?? '').trim() || DEFAULT_QUIZ_KEY_PATH;
  if (!KEY_PATH_PATTERN.test(p) || p.includes('..')) {
    throw new Error(`QUIZ_KEY_PATH must be /Volumes/<catalog>/<schema>/<volume>/<file>.json; got "${p}"`);
  }
  return p;
}

/**
 * config/quiz/questions.json, validated. A missing file disables the quiz (null);
 * an invalid file stops the server, like an invalid guide.
 */
export function loadQuizQuestions(dir: string = QUIZ_DIR): QuizQuestions | null {
  const file = path.join(dir, 'questions.json');
  if (!existsSync(file)) return null;
  return parseQuizQuestions(JSON.parse(readFileSync(file, 'utf8')));
}

export function parseQuizQuestions(data: unknown): QuizQuestions {
  const result = quizQuestionsSchema.safeParse(data);
  if (result.success) return result.data;
  const detail = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
  throw new Error(`config/quiz/questions.json is invalid: ${detail}`);
}

/** Parses and checks the key against the questions. Returns the key or the reason it cannot be used. */
export function parseQuizKey(text: string, quiz: QuizQuestions): { key: QuizKey } | { reason: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { reason: 'the key file is not valid JSON' };
  }
  const parsed = quizKeySchema.safeParse(data);
  if (!parsed.success) {
    return { reason: `the key file has an unexpected shape (${parsed.error.issues[0]?.path.join('.') || 'root'})` };
  }
  const key = parsed.data;
  if (key.version !== quiz.version) {
    return {
      reason: `key version ${key.version} does not match questions version ${quiz.version}; rerun npm run quiz-from-md and upload the new key`,
    };
  }
  for (const q of quiz.questions) {
    const a = key.answers[q.id];
    if (!a) return { reason: `the key has no answer for ${q.id}` };
    if (!q.options.some((o) => o.id === a.correct)) return { reason: `the key answer for ${q.id} is not one of its options` };
  }
  return { key };
}

export interface KeyState {
  key: QuizKey | null;
  /** Why there is no usable key (null when `key` is set). */
  reason: string | null;
}

/**
 * Loads the key through `load` (Files API) and keeps it in memory. Reloads after
 * `ttlMs` (10 min); a failed reload keeps the last good key. Without a good key a
 * failed load is retried after `retryMs`, not on every request.
 */
export class QuizKeyStore {
  private good: QuizKey | null = null;
  private reason: string | null = 'not loaded yet';
  private loadedAt = -Infinity;
  private failedAt = -Infinity;
  private inflight: Promise<KeyState> | null = null;

  constructor(
    private readonly load: () => Promise<string>,
    private readonly quiz: QuizQuestions,
    private readonly ttlMs = 10 * 60_000,
    private readonly retryMs = 30_000,
    private readonly now: () => number = Date.now,
  ) {}

  get(): Promise<KeyState> {
    const t = this.now();
    const fresh = this.good && t - this.loadedAt < this.ttlMs;
    const coolingDown = t - this.failedAt < this.retryMs;
    if (fresh || coolingDown) return Promise.resolve(this.state());
    if (!this.inflight) {
      this.inflight = this.load()
        .then((text) => {
          const parsed = parseQuizKey(text, this.quiz);
          if ('key' in parsed) {
            this.good = parsed.key;
            this.reason = null;
            this.loadedAt = this.now();
          } else {
            this.fail(parsed.reason);
          }
        })
        .catch((err: unknown) => this.fail(describeLoadError(err)))
        .then(() => this.state())
        .finally(() => {
          this.inflight = null;
        });
    }
    return this.inflight;
  }

  private fail(reason: string) {
    this.failedAt = this.now();
    if (this.good) {
      // Keep serving the last good key; retry after the cool-down.
      console.warn(`[workshop-guide] quiz key reload failed, keeping the previous key: ${reason}`);
      this.loadedAt = this.now() - this.ttlMs + this.retryMs;
    } else {
      this.reason = reason;
    }
  }

  private state(): KeyState {
    return this.good ? { key: this.good, reason: null } : { key: null, reason: this.reason };
  }
}

/** Short, trainer-readable reason from a Files API error. */
export function describeLoadError(err: unknown): string {
  const e = err as { statusCode?: number; message?: string } | null;
  const code = e?.statusCode;
  const raw = (e?.message ?? String(err)).replace(/\s+/g, ' ').trim();
  const detail = /"message"\s*:\s*"([^"]+)"/.exec(raw)?.[1] ?? raw.slice(0, 160);
  if (code === 404 || /not.?found/i.test(raw)) return 'key file not found in the volume (upload utilization/quiz_key.json)';
  if (code === 403 || /permission|forbidden|denied/i.test(raw)) {
    return `no permission to read the key file; grant the app service principal READ VOLUME (${detail})`;
  }
  return `could not read the key file (${detail})`;
}

export type GradeResult =
  | { ok: true; post: QuizAnswerPost; correct: boolean; explanation: string; module_ref: string }
  | { ok: false; status: number; error: string };

/** Validates the POST body and grades it against the key. Pure; no I/O. */
export function gradeAnswer(body: unknown, quiz: QuizQuestions, key: QuizKey): GradeResult {
  const parsed = quizAnswerPostSchema.safeParse(body);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join('.') || '(body)').join(', ');
    return { ok: false, status: 400, error: `Invalid body (fields: ${fields})` };
  }
  const post = parsed.data;
  const question = quiz.questions.find((q) => q.id === post.question);
  if (!question) return { ok: false, status: 404, error: `Unknown question "${post.question}"` };
  if (!question.options.some((o) => o.id === post.option)) {
    return { ok: false, status: 400, error: `Question ${post.question} has no option "${post.option}"` };
  }
  const answer = key.answers[post.question];
  if (!answer) return { ok: false, status: 503, error: 'The quiz key has no answer for this question' };
  return {
    ok: true,
    post,
    correct: answer.correct === post.option,
    explanation: answer.explanation[post.lang],
    module_ref: answer.module_ref[post.lang],
  };
}

/** Attempt number for the next answer and whether the question is already passed. */
export function nextAttempt(rows: QuizProgressRow[], email: string, question: string): { attempt: number; passed: boolean } {
  const row = rows.find((r) => r.user_email === email.toLowerCase() && r.step === question);
  if (!row) return { attempt: 1, passed: false };
  return { attempt: Math.max(row.attempts, row.max_attempt ?? 0) + 1, passed: row.passed };
}

/** Sliding-window limit: at most `max` calls per key in `windowMs`. In memory, per app instance. */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly max = 5,
    private readonly windowMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  allow(key: string): boolean {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((h) => t - h < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(t);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.prune(t);
    return true;
  }

  private prune(t: number) {
    for (const [k, v] of this.hits) if (v.every((h) => t - h >= this.windowMs)) this.hits.delete(k);
  }
}

/** Runs tasks with the same key one after another (attempt numbers stay unique). */
export class KeyedLock {
  private tails = new Map<string, Promise<unknown>>();

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(key) ?? Promise.resolve();
    const next = prev.catch(() => undefined).then(task);
    this.tails.set(key, next);
    void next.catch(() => undefined).finally(() => {
      if (this.tails.get(key) === next) this.tails.delete(key);
    });
    return next;
  }
}

/** Explanations for the questions `email` has attempted; the correct option only once passed. */
export function buildReview(rows: QuizProgressRow[], email: string, key: QuizKey, lang: QuizLang): QuizReviewResponse {
  const items: QuizReviewResponse['items'] = {};
  for (const r of rows) {
    if (r.user_email !== email.toLowerCase()) continue;
    const a = key.answers[r.step];
    if (!a) continue;
    items[r.step] = { explanation: a.explanation[lang], module_ref: a.module_ref[lang], correct: r.passed ? a.correct : null };
  }
  return { items };
}

/** Rows of server/sql/quiz_progress.sql. Empty result → []. */
export function quizRowsFromResult(result: unknown): QuizProgressRow[] {
  const data = (result as { data?: unknown } | null | undefined)?.data ?? [];
  const parsed = z.array(quizProgressRowSchema).safeParse(data);
  if (!parsed.success) throw new Error('Quiz progress query returned rows of an unexpected shape');
  return parsed.data;
}

export const quizParticipantRows = (rows: QuizProgressRow[], email: string): QuizParticipantRow[] =>
  rows.filter((r) => r.user_email === email.toLowerCase()).map((r) => quizParticipantRowSchema.parse(r));

/** Parameterized INSERT of one quiz answer; hints_used is NULL for the quiz. */
export function buildQuizInsert(table: string): string {
  return `INSERT INTO ${resolveProgressTable(table)}
  (user_email, workshop, step, step_type, status, message, hints_used, attempts, source, ts)
VALUES
  (:user_email, '${QUIZ_WORKSHOP}', :step, 'quiz', :status, :message, NULL, :attempts, 'app', current_timestamp())`;
}
