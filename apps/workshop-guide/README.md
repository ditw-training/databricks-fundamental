# Workshop Guide

Databricks App (AppKit, TypeScript/React) that walks participants through the workshops
of the Databricks Fundamental training step by step. Contract with the notebooks, the
check library and Terraform: [`../SPEC_workshop_guide.md`](../SPEC_workshop_guide.md).

- Participants write and run code in their notebook. `check("ws_delta", "t08")` appends a
  row to the progress table.
- The app shows the step (explanation, blanks, drag and drop, hints, doc links) and polls
  `GET /api/progress/me` every 5 s for the live status. The server reads the progress
  table at most once per workshop every 4 s and shares the result between all users.
- Steps the app can grade itself (`order` / `match` with `"check": "app"`) are recorded with
  `POST /api/progress` (INSERT as the app service principal).
- `/trainer` shows the participant × step matrix for emails listed in `TRAINER_EMAILS`
  (`GET /api/progress/matrix`, which returns 403 for everyone else).
- `/quiz` is the course quiz (40 questions, PL/EN) in learning mode: feedback, explanation and the
  notebook section after every answer, retry until correct. Graded on the server with a private
  key; the trainer view has a Quiz tab. See [Quiz](#quiz).

## Layout

| Path | What |
|---|---|
| `server/sql/latest_progress.sql` | latest state per user and step for one workshop (`:workshop`); server only |
| `config/queries/` | no `.sql` files on purpose (see below); kept because typegen needs the folder |
| `config/guides/*.json` | guide files used at runtime (synced, committed) |
| `fixtures/ws_demo.json` | demo guide with every step type; used when no guides exist |
| `scripts/sync-guides.mjs` | copies `../../notebooks/workshops/guide/*.json` to `config/guides/` |
| `config/quiz/questions.json` | quiz questions and options, PL + EN, **no answers** (generated, committed) |
| `scripts/quiz-from-md.mjs` | builds `config/quiz/questions.json` and the private key from `../../utilization/` |
| `server/sql/quiz_progress.sql` | quiz state per participant and question (first answer, solved, attempts); server only |
| `server/quiz.ts`, `shared/quiz-schema.ts` | key loading and caching, grading, attempt numbering, rate limit; zod schemas |
| `shared/guide-schema.ts` | zod schema of the guide files and the POST body |
| `server/` | `/api/me`, `/api/guides`, `/api/progress`, `/api/progress/me`, `/api/progress/matrix`, `/api/quiz*`; guide loading and validation |
| `client/src/` | participant view (`/`), quiz (`/quiz`), trainer view (`/trainer`, tabs Workshops / Quiz) |

## Environment variables

| Variable | Where | Meaning |
|---|---|---|
| `DATABRICKS_WAREHOUSE_ID` | `app.yaml` (`valueFrom: sql-warehouse`), `.env` locally | SQL warehouse for queries and the INSERT |
| `PROGRESS_TABLE` | `app.yaml` | progress table for the INSERT and the SELECT, default `retailhub_trainer.default.workshop_progress` |
| `TRAINER_EMAILS` | `app.yaml` | comma-separated emails that may open `/trainer` |
| `QUIZ_KEY_PATH` | `app.yaml` | private quiz key in a UC volume, default `/Volumes/retailhub_trainer/default/workshop_guide_private/quiz_key.json` |
| `DEV_USER_EMAIL` | `.env` (local only) | identity when there is no `X-Forwarded-Email` header; ignored when `NODE_ENV=production` |
| `DATABRICKS_CONFIG_PROFILE` | `.env` (local only) | CLI profile for local development |

`PROGRESS_TABLE` must be a plain `catalog.schema.table` name. The server checks it at
startup and puts it in place of `{{PROGRESS_TABLE}}` in `server/sql/latest_progress.sql`.

## Deviation from the AppKit "SQL files in config/queries" rule

The AppKit skill (and SPEC section 6) put SELECT queries in `config/queries/*.sql`. This
app keeps its only SELECT in `server/sql/latest_progress.sql` instead, for security:

- The analytics plugin serves every file in `config/queries/` at
  `POST /api/analytics/query/<name>` to any signed-in user. Plugin routes are mounted
  before `server.extend()` routes, so they cannot be limited to trainers.
- A `:user_email` parameter in such a file comes from the browser, so any participant
  could read anyone's progress.

So the server runs the SQL itself with `appkit.analytics.query()` (service principal,
parameter `:workshop` bound as a statement parameter):

| Route | Who | Returns |
|---|---|---|
| `GET /api/progress/me?workshop=` | any signed-in user | own rows; email from `X-Forwarded-Email` |
| `GET /api/progress/matrix?workshop=` | `TRAINER_EMAILS` only, else 403 | rows of all participants |

Both routes read one shared, server-side result per workshop that lives 4 s (the
in-flight request is shared too, and `POST /api/progress` invalidates it). With 5 s
polling that is about one warehouse statement per 5 s per active workshop, whatever the
number of participants. Unknown workshops return 404.

The `useAnalyticsQuery` hook is not used for polling. It cannot re-run a query with
unchanged parameters (no refetch), so live status stopped after the first load.

## Guides

`npm run sync-guides` (also run by `npm run dev` and `npm run build`):

1. `../../notebooks/workshops/guide/*.json` exists → `config/guides/` is replaced with it.
2. No source folder (the build on Databricks Apps after deploy) → `config/guides/` is kept.
3. Nothing anywhere → `fixtures/ws_demo.json` is copied.

Set `GUIDES_INCLUDE_DEMO=1` to add the demo guide next to the real ones. The server
validates every guide with zod at startup and refuses to start on an invalid file; the
error names the file and field. `npm test` validates `config/guides/` and the fixture too.

Commit `config/guides/` after syncing: `databricks apps deploy` uploads only this folder.

## Quiz

The quiz has two parts that must carry the same `version`:

| File | Where | Contains |
|---|---|---|
| `config/quiz/questions.json` | app code, committed | modules, questions, options (PL + EN) |
| `quiz_key.json` | UC volume, path `QUIZ_KEY_PATH` | correct option, explanation (PL + EN), "where to learn" (module, notebook, section) |

Build both from the trainer sources (local, gitignored): `../../utilization/{en,pl}/quiz.md`
(questions and the answer key table) and `../../utilization/quiz_explanations.json`
(`{ "q01": { "section", "en", "pl" } }`, hand-written explanations):

```bash
npm run quiz-from-md     # checks 40 questions, 4 options each, PL = EN, key and explanations complete
```

It writes `config/quiz/questions.json` (commit it) and `../../utilization/quiz_key.json`. Upload the
key; the app service principal needs `READ VOLUME` on the volume (participants get nothing):

```bash
databricks volumes create retailhub_trainer default workshop_guide_private MANAGED --profile <profile>
databricks fs cp ../../utilization/quiz_key.json \
  dbfs:/Volumes/retailhub_trainer/default/workshop_guide_private/quiz_key.json --overwrite --profile <profile>
SP=$(databricks apps get workshop-guide --profile <profile> -o json | jq -r .service_principal_client_id)
databricks grants update volume retailhub_trainer.default.workshop_guide_private \
  --json "{\"changes\":[{\"principal\":\"$SP\",\"add\":[\"READ_VOLUME\"]}]}" --profile <profile>
```

In the training environment Terraform does all three (`infra/terraform`, README "Quiz key").

How it works:

- The server reads the key with the Files API as the app service principal, keeps it in memory
  and reloads it every 10 minutes. A failed reload keeps the last good key; with no good key it
  retries after 30 s. A missing, unreadable or mismatched key (other `version`, missing question)
  turns the Quiz page into "quiz not configured"; trainers see the reason there and in the Quiz tab.
- Answers are graded only on the server. The explanation is returned only after an attempt.
- Each answer appends a row to the progress table: `workshop = 'quiz'`, `step = q01..q40`,
  `step_type = 'quiz'`, `status = pass|fail`, `message` = chosen option, `attempts` = attempt
  number counted by the server from the table (not sent by the browser), `source = 'app'`.
  After a correct answer the question is closed (409). At most 5 answers per question per
  minute and user (429; in memory, per app instance).
- Score = questions answered correctly on the **first** attempt. Retries are for learning.

| Route | Who | Returns |
|---|---|---|
| `GET /api/quiz` | any signed-in user | questions (no answers), `configured`; `reason` for trainers only |
| `POST /api/quiz/answer` `{question, option, lang}` | any signed-in user | `{correct, explanation, module_ref, attempt}` |
| `GET /api/quiz/me` | any signed-in user | own state per question |
| `GET /api/quiz/review?lang=` | any signed-in user | explanations of questions the user already attempted (after reload or language switch) |
| `GET /api/quiz/stats` | `TRAINER_EMAILS` only, else 403 | state of all participants (trainer Quiz tab, polled every 5 s) |

The quiz rows share the 4 s server cache pattern of the workshops (one statement for all users);
every answer invalidates it.

Language (PL default, EN) is remembered per browser in `localStorage`, as are the wrong options
already tried. Keyboard: A–D answers, N goes to the next question.

## Local development

```bash
cd apps/workshop-guide
npm install
cat >> .env <<'EOF'
DEV_USER_EMAIL=you@example.com
TRAINER_EMAILS=you@example.com
EOF
npm run dev            # http://localhost:8000
```

`.env` (created by `databricks apps init`, not committed) holds the CLI profile and
warehouse id. Locally the queries and the INSERT run with your CLI identity.

Checks:

```bash
npm run typecheck && npm run lint && npm run lint:ast-grep && npm test
databricks apps validate --profile <profile>
```

`npm run typegen` runs as part of `prebuild`. With no `.sql` files in `config/queries/`
it generates an empty query registry. Rows from the server routes are validated with
zod on the server and in the browser (`shared/progress-schema.ts`).

Lab state (2026-10-27): `retailhub_trainer.default.workshop_progress` exists in the lab
workspace, and `databricks apps validate --profile ditwlab-admin` passes. The volume
`retailhub_trainer.default.workshop_guide_private` holds `quiz_key.json`, and the lab app's service
principal has `READ VOLUME` on it.

`DEV_USER_EMAIL` is ignored by `npm start` (production). To try the production build locally, send
the identity header yourself: `curl -H 'X-Forwarded-Email: you@example.com' localhost:<port>/api/quiz`.

## Deploy

The training environment is built with Terraform (`infra/terraform`, local only). It is
expected to create the progress table with grants, the SQL warehouse and the app
`workshop-guide` with its `sql-warehouse` resource (`CAN_USE`).

Grants the app service principal needs: `USE CATALOG` on `retailhub_trainer`,
`USE SCHEMA` on `default`, `SELECT` and `MODIFY` on the progress table, `READ VOLUME` on
`workshop_guide_private` (quiz key).

Participants only need `MODIFY` on the table (for `check()` in the notebook). SPEC
section 2 also gives them `SELECT`, which lets anyone read the whole group's progress
from a notebook. Consider dropping that grant in Terraform.

Two deploy paths. Use exactly one per workspace, never both:

**Training environment (Terraform created the app).** Terraform owns the app, its
`sql-warehouse` and `trainer-emails` resources and the secret. Deploy only the code:

```bash
npm run sync-guides   # then commit config/guides/
databricks sync . /Workspace/Users/<you>/apps/workshop-guide --profile <profile>
databricks apps deploy workshop-guide \
  --source-code-path /Workspace/Users/<you>/apps/workshop-guide --profile <profile>
```

Trainers are set with the Terraform variable `workshop_guide_trainer_emails`.

**Lab or any workspace without the Terraform app.** The bundle in this folder creates the app.
Create the secret first, then deploy:

```bash
databricks secrets create-scope workshop-guide --profile <profile>
databricks secrets put-secret workshop-guide trainer-emails --string-value "trainer@example.com" --profile <profile>
databricks bundle deploy --profile <profile> --var sql_warehouse_id=<id>
databricks bundle run app --profile <profile>
```

Running `bundle deploy` against a Terraform-built workspace would create a second owner
for the same app; do not do it there.

## Known limits

- Hints used are only stored for app-graded steps (POST). For notebook-graded steps the
  spec has notebooks write `hints_used = NULL`, so the trainer view shows no hint count there.
- Polling keeps the SQL warehouse busy during the workshop (about one statement per 5 s
  per active workshop). Browsers poll every 30 s while the tab is hidden. AppKit's own
  query cache is turned off (`cache.enabled=false`); the 4 s server cache replaces it.
- The trainer matrix shows the highest `hints_used` and `attempts` recorded for a step.
