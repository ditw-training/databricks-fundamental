import type { Request, Response } from 'express';
import { analytics, createApp, createWorkspaceClient, server, sql } from '@databricks/appkit';
import { sortGuides, type GuidesResponse, type MeResponse } from '../shared/guide-schema';
import { resetQuerySchema, type CheckResponse, type ResetResponse } from '../shared/check-schema';
import type { Row } from './checks/framework';
import { runCheck, validateCheckPost } from './checks';
import { catalogFor } from './slug';
import type { ParticipantRow, ProgressResponse, TrainerRow } from '../shared/progress-schema';
import { loadGuides, loadOverlays } from './guides';
import { langSchema, localizeGuides } from '../shared/guide-i18n';
import { quizLangSchema, type QuizAnswerResponse, type QuizProgressRow, type QuizResponse } from '../shared/quiz-schema';
import {
  loadLatestProgressSql,
  loadServerSql,
  participantRows,
  ProgressCache,
  rowsFromResult,
  trainerRows,
} from './progress-reader';
import {
  buildCheckInsert,
  buildProgressInsert,
  buildProgressReset,
  parseEmailList,
  resolveProgressTable,
  resolveUserEmail,
  validateProgressPost,
} from './progress';
import {
  buildQuizInsert,
  buildReview,
  gradeAnswer,
  KeyedLock,
  loadQuizQuestions,
  nextAttempt,
  QUIZ_WORKSHOP,
  QuizKeyStore,
  quizParticipantRows,
  quizRowsFromResult,
  RateLimiter,
  resolveQuizKeyPath,
} from './quiz';

// Fail fast on broken configuration or guide files.
const guides = loadGuides();
const overlays = loadOverlays(guides);
const progressTable = resolveProgressTable();
const insertStatement = buildProgressInsert(progressTable);
const trainerEmails = parseEmailList(process.env.TRAINER_EMAILS);
// Same list as TRAINER_ACCOUNTS in 00_setup: these accounts use the catalog retailhub_trainer.
// `none` is the placeholder for "no trainer accounts" (a secret cannot be empty).
const trainerAccounts = new Set([...parseEmailList(process.env.TRAINER_ACCOUNTS)].filter((a) => a !== 'none'));
const checkInsert = buildCheckInsert(progressTable);
const progressReset = buildProgressReset(progressTable);
// Local development only: run Check with the CLI identity when there is no user token.
const devCheckAsCli = process.env.NODE_ENV !== 'production' && process.env.DEV_CHECK_AS_CLI === '1';
const latestProgressSql = loadLatestProgressSql(progressTable);
const quiz = loadQuizQuestions();
const quizKeyPath = resolveQuizKeyPath();
const quizProgressSql = loadServerSql('quiz_progress.sql', progressTable);
const quizInsert = buildQuizInsert(progressTable);

console.log(
  `[workshop-guide] guides: ${[...guides.keys()].join(', ')}; overlays: ${
    Object.entries(overlays).map(([l, o]) => `${l} (${Object.keys(o ?? {}).length})`).join(', ') || 'none'
  }; progress table: ${progressTable}; trainers: ${trainerEmails.size}; ` +
    `quiz: ${quiz ? `${quiz.questions.length} questions, key ${quizKeyPath}` : 'config/quiz/questions.json missing'}`,
);

/**
 * Reads the private quiz key from the UC volume through the Files API, as the app
 * service principal (locally: the CLI profile). The client is created on first use.
 */
let filesClient: ReturnType<typeof createWorkspaceClient> | null = null;
async function readQuizKeyFile(): Promise<string> {
  filesClient ??= createWorkspaceClient();
  const res = await filesClient.files.download({ file_path: quizKeyPath });
  if (!res.contents) throw new Error('empty response');
  return await new Response(res.contents).text();
}

createApp({
  plugins: [analytics(), server()],
  // Progress must be fresh; the server keeps its own short cache (ProgressCache).
  cache: { enabled: false },
  onPluginsReady(appkit) {
    // One statement per workshop every few seconds, shared by all participants and trainers.
    const progressCache = new ProgressCache(async (workshop) =>
      rowsFromResult(await appkit.analytics.query(latestProgressSql, { workshop: sql.string(workshop) })),
    );

    // ── Course quiz ──
    const keyStore = quiz ? new QuizKeyStore(readQuizKeyFile, quiz) : null;
    const quizCache = new ProgressCache<QuizProgressRow>(async () =>
      quizRowsFromResult(await appkit.analytics.query(quizProgressSql, {})),
    );
    const limiter = new RateLimiter(5, 60_000);
    // Check: at most one run per user every 3 s (each run is a few warehouse statements).
    const checkLimiter = new RateLimiter(1, 3_000);
    const resetLimiter = new RateLimiter(3, 60_000);
    const answerLock = new KeyedLock();
    if (keyStore) void keyStore.get().then((s) => s.reason && console.warn(`[workshop-guide] quiz not configured: ${s.reason}`));

    const registerQuizRoutes = (app: Parameters<Parameters<typeof appkit.server.extend>[0]>[0]) => {
      app.get('/api/quiz', (req, res) => {
        const email = resolveUserEmail(req);
        if (!email) {
          res.status(401).json({ error: 'No user identity' });
          return;
        }
        if (!quiz || !keyStore) {
          res.status(404).json({ error: 'The quiz is not part of this deployment (config/quiz/questions.json missing)' });
          return;
        }
        res.set('Cache-Control', 'no-store');
        void keyStore.get().then(({ key, reason }) => {
          const body: QuizResponse = { quiz, configured: key !== null };
          if (!key && trainerEmails.has(email)) body.reason = `${reason ?? 'unknown'} (QUIZ_KEY_PATH=${quizKeyPath})`;
          res.json(body);
        });
      });

      const readQuizRows = (req: Request, res: Response, view: 'me' | 'stats') => {
        const email = resolveUserEmail(req);
        if (!email) {
          res.status(401).json({ error: 'No user identity' });
          return;
        }
        if (view === 'stats' && !trainerEmails.has(email)) {
          res.status(403).json({ error: 'Quiz statistics are only for emails listed in TRAINER_EMAILS' });
          return;
        }
        res.set('Cache-Control', 'no-store');
        quizCache
          .get(QUIZ_WORKSHOP)
          .then(({ rows, fetchedAt }) =>
            res.json({ rows: view === 'me' ? quizParticipantRows(rows, email) : rows, fetchedAt }),
          )
          .catch((err: unknown) => {
            console.error('[workshop-guide] quiz progress read failed', err);
            res.status(502).json({ error: 'Could not read quiz progress. Retrying.' });
          });
      };
      app.get('/api/quiz/me', (req, res) => readQuizRows(req, res, 'me'));
      app.get('/api/quiz/stats', (req, res) => readQuizRows(req, res, 'stats'));

      app.get('/api/quiz/review', (req, res) => {
        const email = resolveUserEmail(req);
        if (!email) {
          res.status(401).json({ error: 'No user identity' });
          return;
        }
        const lang = quizLangSchema.safeParse(req.query.lang);
        if (!lang.success) {
          res.status(400).json({ error: 'lang must be pl or en' });
          return;
        }
        if (!keyStore) {
          res.status(404).json({ error: 'The quiz is not part of this deployment' });
          return;
        }
        res.set('Cache-Control', 'no-store');
        void (async () => {
          const { key } = await keyStore.get();
          if (!key) {
            res.status(503).json({ error: 'The quiz is not configured yet. Tell the trainer.' });
            return;
          }
          const { rows } = await quizCache.get(QUIZ_WORKSHOP);
          res.json(buildReview(rows, email, key, lang.data));
        })().catch((err: unknown) => {
          console.error('[workshop-guide] quiz review failed', err);
          if (!res.headersSent) res.status(502).json({ error: 'Could not read quiz progress.' });
        });
      });

      app.post('/api/quiz/answer', (req, res) => {
        const email = resolveUserEmail(req);
        if (!email) {
          res.status(401).json({ error: 'No user identity' });
          return;
        }
        if (!quiz || !keyStore) {
          res.status(404).json({ error: 'The quiz is not part of this deployment' });
          return;
        }
        void (async () => {
          const { key } = await keyStore.get();
          if (!key) {
            res.status(503).json({ error: 'The quiz is not configured yet. Tell the trainer.' });
            return;
          }
          const graded = gradeAnswer(req.body, quiz, key);
          if (!graded.ok) {
            res.status(graded.status).json({ error: graded.error });
            return;
          }
          const lockKey = `${email}:${graded.post.question}`;
          if (!limiter.allow(lockKey)) {
            res.status(429).json({ error: 'Too many answers to this question. Wait a minute and try again.' });
            return;
          }
          await answerLock.run(lockKey, async () => {
            const { rows } = await quizCache.get(QUIZ_WORKSHOP);
            const { attempt, passed } = nextAttempt(rows, email, graded.post.question);
            if (passed) {
              res.status(409).json({ error: 'You already answered this question correctly.' });
              return;
            }
            await appkit.analytics.query(quizInsert, {
              user_email: sql.string(email),
              step: sql.string(graded.post.question),
              status: sql.string(graded.correct ? 'pass' : 'fail'),
              message: sql.string(graded.post.option),
              attempts: sql.int(attempt),
            });
            quizCache.invalidate(QUIZ_WORKSHOP);
            const body: QuizAnswerResponse = {
              correct: graded.correct,
              explanation: graded.explanation,
              module_ref: graded.module_ref,
              attempt,
            };
            res.status(201).json(body);
          });
        })().catch((err: unknown) => {
          console.error('[workshop-guide] quiz answer failed', err);
          if (!res.headersSent) res.status(502).json({ error: 'Could not save your answer. Try again in a moment.' });
        });
      });
    };

    appkit.server.extend((app) => {
      app.get('/api/me', (req, res) => {
        const email = resolveUserEmail(req);
        if (!email) {
          res.status(401).json({ error: 'No user identity (X-Forwarded-Email header missing)' });
          return;
        }
        const body: MeResponse = { email, isTrainer: trainerEmails.has(email) };
        res.json(body);
      });

      // English guides plus the overlays; the client switches language without a refetch.
      // `?lang=pl` returns the guides already translated (handy for curl and other clients).
      app.get('/api/guides', (req, res) => {
        const sorted = sortGuides([...guides.values()]);
        if (req.query.lang === undefined) {
          const body: GuidesResponse = { guides: sorted, overlays };
          res.json(body);
          return;
        }
        const lang = langSchema.safeParse(req.query.lang);
        if (!lang.success) {
          res.status(400).json({ error: 'lang must be pl or en' });
          return;
        }
        const body: GuidesResponse = { guides: localizeGuides(sorted, overlays, lang.data), overlays: {} };
        res.json(body);
      });

      const readProgress = (
        req: Request,
        res: Response,
        view: 'me' | 'matrix',
      ) => {
        const email = resolveUserEmail(req);
        if (!email) {
          res.status(401).json({ error: 'No user identity' });
          return;
        }
        if (view === 'matrix' && !trainerEmails.has(email)) {
          res.status(403).json({ error: 'The trainer view is only for emails listed in TRAINER_EMAILS' });
          return;
        }
        const workshop = typeof req.query.workshop === 'string' ? req.query.workshop : '';
        if (!guides.has(workshop)) {
          res.status(404).json({ error: `Unknown workshop "${workshop}"` });
          return;
        }
        res.set('Cache-Control', 'no-store');
        progressCache
          .get(workshop)
          .then(({ rows, fetchedAt }) => {
            if (view === 'me') {
              const body: ProgressResponse<ParticipantRow> = { rows: participantRows(rows, email), fetchedAt };
              res.json(body);
            } else {
              const body: ProgressResponse<TrainerRow> = { rows: trainerRows(rows), fetchedAt };
              res.json(body);
            }
          })
          .catch((err: unknown) => {
            console.error('[workshop-guide] progress read failed', err);
            res.status(502).json({ error: 'Could not read progress. Retrying.' });
          });
      };

      // Own progress: the email comes from X-Forwarded-Email, never from the browser.
      app.get('/api/progress/me', (req, res) => readProgress(req, res, 'me'));
      // Whole group: trainers only (checked on the server).
      app.get('/api/progress/matrix', (req, res) => readProgress(req, res, 'matrix'));

      registerQuizRoutes(app);

      // ── Check (SPEC section 7): the step's SQL runs as the signed-in user (OBO) ──
      app.post('/api/check', (req, res) => {
        const email = resolveUserEmail(req);
        if (!email) {
          res.status(401).json({ error: 'No user identity' });
          return;
        }
        const hasToken = Boolean(req.header('x-forwarded-access-token')?.trim());
        if (!hasToken && !devCheckAsCli) {
          res.status(401).json({
            error:
              'Check needs your Databricks token (X-Forwarded-Access-Token), which only the deployed app gets ' +
              'with the user API scope "sql". Locally: set DEV_CHECK_AS_CLI=1 to check as the CLI profile.',
          });
          return;
        }
        const result = validateCheckPost(req.body, guides);
        if (!result.ok) {
          res.status(result.status).json({ error: result.error });
          return;
        }
        if (!checkLimiter.allow(email)) {
          res.status(429).json({ error: 'One check every 3 seconds. Wait a moment and press Check again.' });
          return;
        }
        const { post, step, check } = result;
        void (async () => {
          // Inside the async block: asUser() throws when the user headers are incomplete.
          const sqlAsUser = hasToken ? appkit.analytics.asUser(req) : appkit.analytics;
          const run = async (statement: string): Promise<Row[]> => {
            const out = (await sqlAsUser.query(statement, {})) as { data?: Row[] } | null | undefined;
            return out?.data ?? [];
          };
          const outcome = await runCheck(check, { catalog: catalogFor(email, trainerAccounts), run });
          if (outcome.kind === 'error') {
            console.warn(`[workshop-guide] check ${post.workshop}/${post.step} could not run: ${outcome.error}`);
            res.status(502).json({ error: outcome.error });
            return;
          }
          let recorded = true;
          try {
            // The progress row is written by the app service principal, like POST /api/progress.
            await appkit.analytics.query(checkInsert, {
              user_email: sql.string(email),
              workshop: sql.string(post.workshop),
              step: sql.string(post.step),
              step_type: sql.string(step.type),
              status: sql.string(outcome.status),
              message: sql.string(outcome.message),
              hints_used: sql.int(post.hints_used),
            });
            progressCache.invalidate(post.workshop);
          } catch (err) {
            recorded = false;
            console.error('[workshop-guide] check result insert failed', err);
          }
          const body: CheckResponse = { status: outcome.status, message: outcome.message, recorded };
          res.json(body);
        })().catch((err: unknown) => {
          console.error('[workshop-guide] check failed', err);
          if (res.headersSent) return;
          // asUser() needs X-Forwarded-Access-Token and X-Forwarded-User (both set by the
          // Databricks Apps proxy); retrying does not help, so say what is missing.
          if ((err as { code?: unknown } | null)?.code === 'AUTHENTICATION_ERROR') {
            res.status(401).json({
              error: 'Check could not identify you to Databricks (user token or X-Forwarded-User missing). Reload the app; if it persists, tell the trainer.',
            });
            return;
          }
          res.status(502).json({ error: 'The check could not run. Try again in a moment.' });
        });
      });

      // ── Reset my progress: only the caller's rows of one workshop ──
      app.delete('/api/progress/me', (req, res) => {
        const email = resolveUserEmail(req);
        if (!email) {
          res.status(401).json({ error: 'No user identity' });
          return;
        }
        const query = resetQuerySchema.safeParse(req.query);
        if (!query.success || !guides.has(query.data.workshop)) {
          res.status(404).json({ error: 'Unknown workshop' });
          return;
        }
        if (!resetLimiter.allow(email)) {
          res.status(429).json({ error: 'Too many resets. Wait a minute.' });
          return;
        }
        const { workshop } = query.data;
        appkit.analytics
          .query(progressReset, { user_email: sql.string(email), workshop: sql.string(workshop) })
          .then(() => {
            progressCache.invalidate(workshop);
            const body: ResetResponse = { ok: true };
            res.json(body);
          })
          .catch((err: unknown) => {
            console.error('[workshop-guide] progress reset failed', err);
            res.status(502).json({ error: 'Could not reset your progress. Try again in a moment.' });
          });
      });

      app.post('/api/progress', (req, res) => {
        const email = resolveUserEmail(req);
        if (!email) {
          res.status(401).json({ error: 'No user identity' });
          return;
        }
        const result = validateProgressPost(req.body, guides);
        if (!result.ok) {
          res.status(result.status).json({ error: result.error });
          return;
        }
        const { post, step } = result;
        appkit.analytics
          .query(insertStatement, {
            user_email: sql.string(email),
            workshop: sql.string(post.workshop),
            step: sql.string(post.step),
            step_type: sql.string(step.type),
            status: sql.string(post.status),
            message: sql.string(post.message),
            hints_used: sql.int(post.hints_used),
            attempts: sql.int(post.attempts),
          })
          .then(() => {
            progressCache.invalidate(post.workshop);
            res.status(201).json({ ok: true });
          })
          .catch((err: unknown) => {
            console.error('[workshop-guide] progress insert failed', err);
            res.status(502).json({ error: 'Could not save progress. Try again in a moment.' });
          });
      });
    });
  },
}).catch(console.error);
