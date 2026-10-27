import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { QuizKey, QuizProgressRow, QuizQuestions } from '../shared/quiz-schema';
import { loadServerSql } from './progress-reader';
import {
  buildQuizInsert,
  buildReview,
  describeLoadError,
  gradeAnswer,
  KeyedLock,
  loadQuizQuestions,
  nextAttempt,
  parseQuizKey,
  QuizKeyStore,
  quizParticipantRows,
  quizRowsFromResult,
  RateLimiter,
  resolveQuizKeyPath,
} from './quiz';

const quiz = loadQuizQuestions(path.resolve(__dirname, '../config/quiz'))!;

const keyFor = (q: QuizQuestions, over: Partial<QuizKey> = {}): QuizKey => ({
  version: q.version,
  answers: Object.fromEntries(
    q.questions.map((x) => [
      x.id,
      { correct: 'A', explanation: { en: `en ${x.id}`, pl: `pl ${x.id}` }, module_ref: { en: 'Module', pl: 'Moduł' } },
    ]),
  ),
  ...over,
});

const row = (over: Partial<QuizProgressRow> = {}): QuizProgressRow => ({
  user_email: 'a@x.com',
  step: 'q01',
  first_status: 'fail',
  first_option: 'B',
  passed: false,
  attempts: 1,
  max_attempt: 1,
  last_ts: '2026-10-27 10:00:00',
  ...over,
});

describe('config/quiz/questions.json', () => {
  it('has 40 questions with 4 options each, in both languages, and no answers', () => {
    expect(quiz.questions).toHaveLength(40);
    for (const q of quiz.questions) {
      expect(q.options.map((o) => o.id)).toEqual(['A', 'B', 'C', 'D']);
      expect(q.text.pl).not.toBe('');
      for (const o of q.options) expect(o.text.en && o.text.pl).toBeTruthy();
    }
    const raw = JSON.stringify(quiz);
    expect(raw).not.toMatch(/"correct"|explanation|module_ref/);
  });
});

const localKey = path.resolve(__dirname, '../../../utilization/quiz_key.json');

describe('quiz key', () => {
  it.skipIf(!existsSync(localKey))('local utilization/quiz_key.json matches the questions', () => {
    const parsed = parseQuizKey(readFileSync(localKey, 'utf8'), quiz);
    expect(parsed).toHaveProperty('key');
  });

  it('accepts a matching key and rejects version or coverage mismatches', () => {
    expect('key' in parseQuizKey(JSON.stringify(keyFor(quiz)), quiz)).toBe(true);
    expect(parseQuizKey(JSON.stringify(keyFor(quiz, { version: 'old' })), quiz)).toMatchObject({ reason: /version/ });
    const missing = keyFor(quiz);
    delete missing.answers.q40;
    expect(parseQuizKey(JSON.stringify(missing), quiz)).toMatchObject({ reason: /q40/ });
    const badOption = keyFor(quiz);
    badOption.answers.q01.correct = 'Z';
    expect(parseQuizKey(JSON.stringify(badOption), quiz)).toMatchObject({ reason: /q01/ });
    expect(parseQuizKey('{', quiz)).toMatchObject({ reason: /JSON/ });
  });

  it('validates QUIZ_KEY_PATH', () => {
    expect(resolveQuizKeyPath(undefined)).toMatch(/^\/Volumes\/retailhub_trainer\//);
    expect(resolveQuizKeyPath('/Volumes/c/s/v/k.json')).toBe('/Volumes/c/s/v/k.json');
    expect(() => resolveQuizKeyPath('/Volumes/c/s/v/../x.json')).toThrow();
    expect(() => resolveQuizKeyPath('/Workspace/x.json')).toThrow();
  });

  it('caches the key, reloads after the TTL and keeps the last good key on failure', async () => {
    let now = 0;
    const good = JSON.stringify(keyFor(quiz));
    const load = vi.fn<() => Promise<string>>().mockResolvedValue(good);
    const store = new QuizKeyStore(load, quiz, 600_000, 30_000, () => now);
    expect((await store.get()).key).not.toBeNull();
    await store.get();
    expect(load).toHaveBeenCalledTimes(1);
    now = 600_001;
    load.mockRejectedValueOnce(Object.assign(new Error('boom'), { statusCode: 500 }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect((await store.get()).key).not.toBeNull();
    warn.mockRestore();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('reports why there is no key and retries only after the cool-down', async () => {
    let now = 0;
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(Object.assign(new Error('Not Found'), { statusCode: 404 }));
    const store = new QuizKeyStore(load, quiz, 600_000, 30_000, () => now);
    expect(await store.get()).toMatchObject({ key: null, reason: /not found/ });
    now = 10_000;
    await store.get();
    expect(load).toHaveBeenCalledTimes(1);
    now = 31_000;
    load.mockResolvedValueOnce(JSON.stringify(keyFor(quiz)));
    expect((await store.get()).key).not.toBeNull();
  });

  it('describes permission errors', () => {
    expect(describeLoadError({ statusCode: 403, message: 'PERMISSION_DENIED' })).toMatch(/READ VOLUME/);
  });
});

describe('grading', () => {
  const key = keyFor(quiz);

  it('grades on the server and returns the explanation in the chosen language', () => {
    expect(gradeAnswer({ question: 'q01', option: 'A', lang: 'pl' }, quiz, key)).toMatchObject({
      ok: true,
      correct: true,
      explanation: 'pl q01',
      module_ref: 'Moduł',
    });
    expect(gradeAnswer({ question: 'q01', option: 'B', lang: 'en' }, quiz, key)).toMatchObject({ ok: true, correct: false });
  });

  it('rejects bad bodies, unknown questions and options', () => {
    expect(gradeAnswer({ question: 'q01', option: 'A' }, quiz, key)).toMatchObject({ ok: false, status: 400 });
    expect(gradeAnswer({ question: 'q01', option: 'A', lang: 'de' }, quiz, key)).toMatchObject({ ok: false, status: 400 });
    expect(gradeAnswer({ question: 'q99', option: 'A', lang: 'en' }, quiz, key)).toMatchObject({ ok: false, status: 404 });
    expect(gradeAnswer({ question: 'q01', option: 'E', lang: 'en' }, quiz, key)).toMatchObject({ ok: false, status: 400 });
    expect(gradeAnswer({ question: 'q01', option: 'A', lang: 'en', extra: 1 }, quiz, key)).toMatchObject({ ok: false });
  });

  it('numbers attempts from the table rows, not from the client', () => {
    expect(nextAttempt([], 'a@x.com', 'q01')).toEqual({ attempt: 1, passed: false });
    expect(nextAttempt([row({ attempts: 2, max_attempt: 2 })], 'A@x.com', 'q01')).toEqual({ attempt: 3, passed: false });
    expect(nextAttempt([row({ passed: true })], 'a@x.com', 'q01').passed).toBe(true);
    expect(nextAttempt([row({ user_email: 'b@x.com' })], 'a@x.com', 'q01').attempt).toBe(1);
  });

  it('builds the review only for attempted questions, with the answer only once passed', () => {
    const review = buildReview([row(), row({ step: 'q02', passed: true }), row({ user_email: 'b@x.com', step: 'q03' })], 'a@x.com', key, 'en');
    expect(Object.keys(review.items)).toEqual(['q01', 'q02']);
    expect(review.items.q01.correct).toBeNull();
    expect(review.items.q02.correct).toBe('A');
  });
});

describe('limits and SQL', () => {
  it('allows 5 answers per question per minute', () => {
    let now = 0;
    const limiter = new RateLimiter(5, 60_000, () => now);
    for (let i = 0; i < 5; i++) expect(limiter.allow('a:q01')).toBe(true);
    expect(limiter.allow('a:q01')).toBe(false);
    expect(limiter.allow('a:q02')).toBe(true);
    now = 60_001;
    expect(limiter.allow('a:q01')).toBe(true);
  });

  it('runs tasks with the same key one at a time', async () => {
    const lock = new KeyedLock();
    const order: string[] = [];
    const slow = (name: string, ms: number) => () =>
      new Promise<void>((r) => setTimeout(() => {
        order.push(name);
        r();
      }, ms));
    await Promise.all([lock.run('k', slow('first', 20)), lock.run('k', slow('second', 1))]);
    expect(order).toEqual(['first', 'second']);
  });

  it('uses parameters for every user value and the validated table name', () => {
    const insert = buildQuizInsert('cat.sch.tbl');
    expect(insert).toContain('INSERT INTO cat.sch.tbl');
    for (const p of [':user_email', ':step', ':status', ':message', ':attempts']) expect(insert).toContain(p);
    expect(() => buildQuizInsert('x; DROP TABLE y')).toThrow();
    const select = loadServerSql('quiz_progress.sql', 'cat.sch.tbl', path.resolve(__dirname, 'sql'));
    expect(select).toContain('FROM cat.sch.tbl');
    expect(select).toContain("workshop = 'quiz'");
  });

  it('parses warehouse rows and hides emails from participants', () => {
    const rows = quizRowsFromResult({ data: [{ ...row(), passed: 'true', attempts: '2', max_attempt: null }] });
    expect(rows[0]).toMatchObject({ passed: true, attempts: 2, max_attempt: null });
    expect(quizRowsFromResult(undefined)).toEqual([]);
    expect(() => quizRowsFromResult({ data: [{ foo: 1 }] })).toThrow();
    expect(quizParticipantRows(rows, 'A@X.com')[0]).not.toHaveProperty('user_email');
  });
});
