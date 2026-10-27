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

## Layout

| Path | What |
|---|---|
| `server/sql/latest_progress.sql` | latest state per user and step for one workshop (`:workshop`); server only |
| `config/queries/` | no `.sql` files on purpose (see below); kept because typegen needs the folder |
| `config/guides/*.json` | guide files used at runtime (synced, committed) |
| `fixtures/ws_demo.json` | demo guide with every step type; used when no guides exist |
| `scripts/sync-guides.mjs` | copies `../../notebooks/workshops/guide/*.json` to `config/guides/` |
| `shared/guide-schema.ts` | zod schema of the guide files and the POST body |
| `server/` | `/api/me`, `/api/guides`, `/api/progress`, `/api/progress/me`, `/api/progress/matrix`; guide loading and validation |
| `client/src/` | participant view (`/`), trainer view (`/trainer`) |

## Environment variables

| Variable | Where | Meaning |
|---|---|---|
| `DATABRICKS_WAREHOUSE_ID` | `app.yaml` (`valueFrom: sql-warehouse`), `.env` locally | SQL warehouse for queries and the INSERT |
| `PROGRESS_TABLE` | `app.yaml` | progress table for the INSERT and the SELECT, default `retailhub_trainer.default.workshop_progress` |
| `TRAINER_EMAILS` | `app.yaml` | comma-separated emails that may open `/trainer` |
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
workspace, and `databricks apps validate --profile ditwlab-admin` passes.

## Deploy

The training environment is built with Terraform (`infra/terraform`, local only). It is
expected to create the progress table with grants, the SQL warehouse and the app
`workshop-guide` with its `sql-warehouse` resource (`CAN_USE`).

Grants the app service principal needs: `USE CATALOG` on `retailhub_trainer`,
`USE SCHEMA` on `default`, `SELECT` and `MODIFY` on the progress table.

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
