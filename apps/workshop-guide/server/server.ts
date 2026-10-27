import type { Request, Response } from 'express';
import { analytics, createApp, server, sql } from '@databricks/appkit';
import type { GuidesResponse, MeResponse } from '../shared/guide-schema';
import type { ParticipantRow, ProgressResponse, TrainerRow } from '../shared/progress-schema';
import { loadGuides } from './guides';
import { loadLatestProgressSql, participantRows, ProgressCache, rowsFromResult, trainerRows } from './progress-reader';
import {
  buildProgressInsert,
  parseEmailList,
  resolveProgressTable,
  resolveUserEmail,
  validateProgressPost,
} from './progress';

// Fail fast on broken configuration or guide files.
const guides = loadGuides();
const progressTable = resolveProgressTable();
const insertStatement = buildProgressInsert(progressTable);
const trainerEmails = parseEmailList(process.env.TRAINER_EMAILS);
const latestProgressSql = loadLatestProgressSql(progressTable);

console.log(
  `[workshop-guide] guides: ${[...guides.keys()].join(', ')}; progress table: ${progressTable}; trainers: ${trainerEmails.size}`,
);

createApp({
  plugins: [analytics(), server()],
  // Progress must be fresh; the server keeps its own short cache (ProgressCache).
  cache: { enabled: false },
  onPluginsReady(appkit) {
    // One statement per workshop every few seconds, shared by all participants and trainers.
    const progressCache = new ProgressCache(async (workshop) =>
      rowsFromResult(await appkit.analytics.query(latestProgressSql, { workshop: sql.string(workshop) })),
    );

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
