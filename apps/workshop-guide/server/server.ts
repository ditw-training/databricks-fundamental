import type { Request, Response } from 'express';
import { analytics, createApp, createWorkspaceClient, server, sql } from '@databricks/appkit';
import type { GuidesResponse, MeResponse } from '../shared/guide-schema';
import type { ParticipantRow, ProgressResponse, TrainerRow } from '../shared/progress-schema';
import { loadGuides } from './guides';
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
  buildProgressInsert,
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
const progressTable = resolveProgressTable();
const insertStatement = buildProgressInsert(progressTable);
const trainerEmails = parseEmailList(process.env.TRAINER_EMAILS);
const latestProgressSql = loadLatestProgressSql(progressTable);
const quiz = loadQuizQuestions();
const quizKeyPath = resolveQuizKeyPath();
const quizProgressSql = loadServerSql('quiz_progress.sql', progressTable);
const quizInsert = buildQuizInsert(progressTable);

console.log(
  `[workshop-guide] guides: ${[...guides.keys()].join(', ')}; progress table: ${progressTable}; trainers: ${trainerEmails.size}; ` +
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

      app.get('/api/guides', (_req, res) => {
        const body: GuidesResponse = { guides: [...guides.values()] };
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
