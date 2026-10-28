# Workshop Guide

Databricks App (AppKit, TypeScript/React) that walks participants through the workshops
of the Databricks Fundamental training step by step. Contract with the notebooks, the
check library and Terraform: [`../SPEC_workshop_guide.md`](../SPEC_workshop_guide.md).

- Workshops are listed in the order of the day and labelled with Roman numerals from `"number"`
  in the guide files: **Warsztat I — Ingestion** / **Workshop I — Ingestion** (`ws_ingestion`),
  **Warsztat II — Delta Lake** / **Workshop II — Delta Lake** (`ws_delta`).
- The header has a **PL | EN** switch (default PL, remembered in the browser). It changes the
  whole app, the quiz included. See [Languages](#languages).
- Each workshop has two **tracks**, **SQL** and **PySpark**, picked in the workshop header. Every
  step is an exercise (fill / order / match) done and graded **in the app**; the server grades the
  answer again and records the result. The notebook is optional. See [Two tracks](#two-tracks).
- The app shows the step (explanation, blanks, drag and drop, hints, doc links) and polls
  `GET /api/progress/me` every 5 s for the live status. The server reads the progress
  table at most once per workshop every 4 s and shares the result between all users.
- Under each exercise a collapsed **Notebook (optional)** section shows the participant's
  completed code and, where a check exists, **Check on data** / **Sprawdź na danych**: the step's
  check runs as SQL on the SQL warehouse **as the participant** (on-behalf-of-user). It is an
  optional bonus and never changes the step's result. See [Check button](#check-button).
- `/trainer` shows the participant × step matrix for emails listed in `TRAINER_EMAILS`
  (`GET /api/progress/matrix`, which returns 403 for everyone else).
- `/quiz` is the course quiz (40 questions, PL/EN) in learning mode: feedback, explanation and the
  notebook section after every answer, retry until correct. Graded on the server with a private
  key; the trainer view has a Quiz tab. See [Quiz](#quiz).
- The home page lists three items in the order of the day: **I — Ingestion**, **II — Delta Lake**,
  **III — Quiz**. Each is **locked for participants until a trainer unlocks it** in the Access panel
  of `/trainer`. The server enforces it (423). See [Trainer unlock](#trainer-unlock).

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
| `server/sql/unlock_state.sql`, `server/unlock.ts`, `shared/unlock-schema.ts` | trainer unlock: latest row per item, reducer, 423 gate helpers, POST validation; server only SQL |
| `server/sql/quiz_progress.sql` | quiz state per participant and question (first answer, solved, attempts); server only |
| `server/quiz.ts`, `shared/quiz-schema.ts` | key loading and caching, grading, attempt numbering, rate limit; zod schemas |
| `shared/guide-schema.ts` | zod schema of the guide files (variants per track) and the POST body; `resolveExercise()`; workshop labels (Roman numerals) and order |
| `shared/grading.ts` | fill / order / match grading and the `track=…` message prefix, shared by the client and the server |
| `client/src/lib/track.ts` | track per workshop in `localStorage` (`wg:<email>:<workshop>:track`, default SQL) |
| `client/src/components/NotebookSection.tsx` | collapsed "Notebook (optional)": completed code and the optional Check on data |
| `shared/guide-i18n.ts` | zod schema of the translation overlays, merge with English, overlay checks |
| `config/guides/i18n/pl/*.json` | Polish overlays used at runtime (synced, committed) |
| `client/src/i18n/` | UI dictionary (`en.ts` defines the keys, `pl.ts` must match), language context and provider |
| `server/checks/` | one check per Check-graded step (`ws_ingestion.ts`, `ws_delta.ts`), helpers (`framework.ts`), registry and error handling (`index.ts`), tests |
| `server/slug.ts` | e-mail → `retailhub_<slug>`, same rules as `user_slug_for()` in `notebooks/setup/00_setup` |
| `shared/check-schema.ts` | body of `POST /api/check`, query of `DELETE /api/progress/me` |
| `server/` | `/api/me`, `/api/guides`, `/api/check`, `/api/progress`, `/api/progress/me` (GET, DELETE), `/api/progress/matrix`, `/api/quiz*`, `/api/unlock` (GET, POST); guide loading and validation |
| `client/src/` | participant view (`/`), quiz (`/quiz`), trainer view (`/trainer`, tabs Workshops / Quiz) |

## Environment variables

| Variable | Where | Meaning |
|---|---|---|
| `DATABRICKS_WAREHOUSE_ID` | `app.yaml` (`valueFrom: sql-warehouse`), `.env` locally | SQL warehouse for queries and the INSERT |
| `PROGRESS_TABLE` | `app.yaml` | progress table for the INSERT and the SELECT, default `retailhub_trainer.default.workshop_progress` |
| `TRAINER_EMAILS` | `app.yaml` (`valueFrom: trainer-emails`) | comma-separated emails that may open `/trainer` |
| `TRAINER_ACCOUNTS` | `app.yaml` (`valueFrom: trainer-accounts`) | `TRAINER_ACCOUNTS` of `00_setup` (e-mails or logins, comma separated): their catalog is `retailhub_trainer`. `none` = no trainer accounts |
| `QUIZ_KEY_PATH` | `app.yaml` | private quiz key in a UC volume, default `/Volumes/retailhub_trainer/default/workshop_guide_private/quiz_key.json` |
| `GUIDE_DEFAULT_UNLOCKED` | `app.yaml` (optional) | state of an item with no unlock row yet: `none` (default, everything locked until a trainer unlocks it) or `all` (open, e.g. self-study). Anything else stops the server |
| `DEV_USER_EMAIL` | `.env` (local only) | identity when there is no `X-Forwarded-Email` header; ignored when `NODE_ENV=production` |
| `DEV_CHECK_AS_CLI` | `.env` (local only) | `1` = run Check with the CLI identity when there is no user token; ignored when `NODE_ENV=production` |
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
in-flight request is shared too). `POST /api/progress` updates the cached rows in place
(`applyProgressWrite`, same rules as `latest_progress.sql`) instead of dropping them; a read still
in flight is dropped instead. Reset and Check drop the cache. With 5 s polling that is about one
warehouse statement per 4-5 s per active workshop, whatever the number of participants and
answers. Unknown workshops return 404.

The `useAnalyticsQuery` hook is not used for polling. It cannot re-run a query with
unchanged parameters (no refetch), so live status stopped after the first load.

## Two tracks

SPEC section 11. In the guide JSON a step keeps its shared prose (`title`, `explain`, `expected`,
`hints`, `docs`) and gets one exercise per track:

```json
"variants": {
  "sql":     { "type": "fill", "template": "SELECT {{b1}} FROM t", "blanks": { "b1": { "answers": ["*"] } },
               "explain_extra": "optional Markdown", "hints": ["optional, replaces the shared hints"] },
  "pyspark": { "type": "order", "blocks": [{ "id": "a", "code": "..." }], "solution": ["a"], "distractors": [] }
}
```

- `type` is `fill` (`template`, `blanks`), `order` (`blocks`, `solution`, `distractors`) or `match`
  (`pairs`). Optional per variant: `language` (default `sql` / `python`), `explain_extra`, `hints`,
  `note` (one line above the exercise). Other keys are ignored.
- No exercise for a track: leave the track out, or write `{ "same_as": "sql", "note": "..." }`. Both
  tracks then show the other exercise with the note (or a default one-liner).
- A step with `variants` is a track step whatever its legacy `type` / `check` say; optional track
  steps are allowed. **Transition**: a step without `variants` still works with its legacy fields;
  legacy `fill` / `order` / `match` are graded in the app in both tracks, a legacy `code` step keeps
  the Check button as its (required) grading until it is converted.
- **Track switch**: in the workshop header, remembered per user and workshop in `localStorage`
  (SQL by default). Typed answers and revealed hints are kept per track.
- **Grading**: the browser grades at once (a fill step passes when its last blank turns correct;
  order / match on "Check"). It sends the *answer*, not a status:
  `POST /api/progress {workshop, step, track, answer: {type: fill, values} | {type: order, order} |
  {type: match, assignment}, hints_used, attempts}`. The server resolves the exercise of that track,
  grades the answer with the same code (`shared/grading.ts`) and writes the row itself: `status`,
  `step_type` (the exercise type) and `message` = `track=sql · All 3 blanks correct.`. A body with
  only `status: "pass"` is a 400. Response 201 `{status, message, step_type, track}`; 409 for a
  legacy `code` step; 429 above 30 answers per step and minute.
- **A step counts once**: `server/sql/latest_progress.sql` takes the latest *pass* row of a step (else
  the latest row), so a later failed try in the other track does not turn it red, and returns
  `tracks`, the tracks with a pass (`pyspark,sql`), from the message prefix.
- **Trainer matrix**: a cell is green when the step passed in any track; each participant row shows
  badges of the tracks used; the cell tooltip lists the passed tracks.

## Check button

**Since section 11 (two tracks)**: Check is the optional **Check on data** in the collapsed
"Notebook (optional)" section of every step that has a check in `server/checks/` (the server marks
these steps with `data_check` at startup). The result is shown under the button and stored with
`step_type = 'data_check'`, which `latest_progress.sql` leaves out, so it never changes the step.
Only legacy `code` steps (no `variants`) still use Check as their grading; the text below describes
that flow, which is the same for the bonus apart from the row's `step_type`.

1. The participant runs the step cell. Its last line saves the result: steps that change a
   real table (Bronze table, `lab_delta_cust_ws`) need nothing more; steps whose result is
   only a DataFrame or a Python value save it to the scratch table
   `<catalog>.default._ws_<workshop>_<step>`, e.g. `retailhub_jan_kowalski.default._ws_ws_ingestion_t07`.
   Steps with two DataFrames save both in one table with a `_part` column.
2. Check sends `POST /api/check {workshop, step, hints_used}`.
3. The server resolves the catalog from `X-Forwarded-Email` (`retailhub_<slug>`, or
   `retailhub_trainer` for `TRAINER_ACCOUNTS`) and runs the step's SQL with
   `appkit.analytics.asUser(req)`: the Statement Execution API on `DATABRICKS_WAREHOUSE_ID`
   with the user's token from `X-Forwarded-Access-Token`. The check sees only what the
   participant can see.
4. The assertions are evaluated on the server (`server/checks/ws_*.ts`, the same rules and
   messages as `notebooks/workshops/_checks/ws_*.ipynb`). The result is appended to the
   progress table by the app service principal (`source = 'app'`, `step_type` from the guide,
   `hints_used` from the browser, `attempts` NULL) and returned as `{status, message, recorded}`.
   The status dot changes at once; the next poll confirms it.

| Response | When |
|---|---|
| 200 `{status: pass\|fail, message}` | the check ran; a SQL error in the participant's tables is a FAIL with its first line |
| 401 | no user identity, or no user token (local development without `DEV_CHECK_AS_CLI=1`, or the app has no `sql` user scope), or no `X-Forwarded-User` (AppKit `asUser()` needs it; set by the Apps proxy, send it yourself when testing `npm start` locally) |
| 404 / 409 / 501 | unknown workshop or step / app-graded step without a check / code step without a check |
| 429 | more than one Check per user every 3 s (in memory, per app instance) |
| 502 | the app could not run SQL as the user (no `CAN_USE` on the warehouse, token or scope problem); nothing is recorded |

A check takes 1 to 10 SQL statements (about 2 to 25 s on a warm 2X-Small warehouse, step
07 of Workshop I is the slowest). Checks look at the current state of the tables, like the
notebook checks did: press Check right after the step, before the next step changes the table.

The rules match the `_checks` notebooks, which read the same saved tables. A table has no row
order, so no check tests sorting (the order is graded in the guide where it matters). Workshop II
step 01 counts `customers.csv` with `read_files`; step 12 accepts both forms of a DELETE without
WHERE in the history (`[]` and `["true"]`; the SQL warehouse and serverless write `["true"]`).

The `_checks` notebooks stay for the static HTML guide and Databricks Free Edition.

### Permissions for Check

- The app declares `user_api_scopes: [sql]` (`databricks.yml`; Terraform `databricks_app.user_api_scopes`).
  After adding a scope, users are asked to consent again the next time they open the app.
- Participants need `CAN_USE` on the app's SQL warehouse. Terraform sets the warehouse ACL with
  `databricks_permissions` (authoritative), so it lists both the training group and the app
  service principal. In the lab the `users` group already has `CAN_USE` on the warehouse.
- The participant's own catalog is theirs (`00_pre_config`), so no extra Unity Catalog grant
  is needed. `CATALOG_OVERRIDE` in `00_setup` is not known to the app: with an override, Check
  looks in the default catalog.

## Reset my progress

The participant view has **Reset my progress** next to the workshop title. After confirmation,
`DELETE /api/progress/me?workshop=ws_delta` deletes the caller's rows of that workshop only
(`WHERE lower(user_email) = <caller> AND workshop = :workshop`, run by the app service principal),
clears the browser's hint and attempt counters and saved answers (typed blanks, block order,
pairs) for that workshop and invalidates the server cache.
Notebook code and tables stay. At most 3 resets per user per minute.

## Trainer unlock

SPEC section 10. Items: `ws_ingestion` (I), `ws_delta` (II), `quiz` (III).

- **Participants** see all three cards on the home page. A locked card shows a lock and
  "Trener odblokuje to w odpowiednim momencie" / "Your trainer will unlock this at the right
  moment". The app polls `GET /api/unlock` every 5 s and refetches the guides when the state
  changes, so a change appears within about 5–10 s of the save without a reload. A participant inside a
  workshop or the quiz when it gets locked sees a "Locked by the trainer" notice instead (code in
  the notebook and saved results stay). The header Quiz tab shows a lock while the quiz is locked.
- **Trainers** (`TRAINER_EMAILS`) always see everything. `/trainer` starts with the **Access**
  (Dostęp) panel: one switch per item with a green "Unlocked" / grey "Locked" badge,
  **Unlock all** / **Lock all** (Lock all asks for confirmation; each button is disabled when it
  would change nothing), and who changed each item and when. A save takes a few seconds (one
  warehouse INSERT and a re-read); the switch moves at once and shows a spinner and "Saving…"
  meanwhile. On the home page trainers see every card open, with a "Locked for participants"
  badge on items participants still see locked.
- **Storage**: no new table. `POST /api/unlock {"item": "ws_ingestion" | "ws_delta" | "quiz" | "all",
  "on": true | false}` (trainers only, 403 otherwise) appends rows to the progress table:
  `workshop = '__unlock'`, `step = <item>`, `step_type = 'unlock'`, `status = 'on' | 'off'`,
  `user_email = <trainer>`, `source = 'trainer'`. The latest row per item wins; only rows with
  `source = 'trainer'` written by an e-mail in `TRAINER_EMAILS` count (defense in depth; only the
  app service principal can write to the table). No row = `GUIDE_DEFAULT_UNLOCKED`. The server
  reads `server/sql/unlock_state.sql` at most once every 30 s (same cache class as the progress
  reads) and drops the cache after a POST, so participants see a change at their next 5 s poll. If a read fails it keeps the last known state for at most 60 s,
  then answers 502, never "unlocked". If the re-read right after a POST fails, the POST answers
  502 ("Saved, but the new state could not be read yet") instead of stale rows.
- **Pacing, not secrecy**: the lock keeps guide and quiz content out of the browser until the
  item is unlocked (nothing of it is in the client bundle). Participants who already have the
  notebooks or the participant quiz PDF (`docs/`) can still read those, so hand out the PDF after
  the quiz if that matters.
- **Enforcement** (participants, locked item → `423` with `{"locked": true, "item": ...}`):
  `GET /api/guides/:id`, `GET /api/progress/me`, `DELETE /api/progress/me` (gate before the reset
  rate limit), `POST /api/progress`,
  `POST /api/check`, `GET /api/quiz`, `GET /api/quiz/me`, `GET /api/quiz/review`,
  `POST /api/quiz/answer`. `GET /api/guides` answers 200 but lists a locked workshop under `locked`
  with metadata only (`id`, `number`, `title`, `locked: true`): no steps, no overlay text.
- The matrix, quiz statistics and Reset never see these rows: they read one guide id or
  `workshop = 'quiz'`, and `__unlock` is not a guide id.

Try it locally (`TRAINER_EMAILS=trainer@example.com` in `.env`):

```bash
P='X-Forwarded-Email: participant@example.com'; T='X-Forwarded-Email: trainer@example.com'
curl -s -H "$P" localhost:8000/api/quiz -w ' %{http_code}\n'                 # 423 (locked by default)
curl -s -H "$T" -H 'Content-Type: application/json' -d '{"item":"quiz","on":true}' localhost:8000/api/unlock
curl -s -H "$P" localhost:8000/api/quiz -o /dev/null -w '%{http_code}\n'       # 200
```

Clean test rows afterwards: `DELETE FROM <PROGRESS_TABLE> WHERE workshop = '__unlock'` (this also
locks everything again).

## Guides

`npm run sync-guides` (also run by `npm run dev` and `npm run build`):

1. `../../notebooks/workshops/guide/*.json` exists → `config/guides/` is replaced with it.
2. No source folder (the build on Databricks Apps after deploy) → `config/guides/` is kept.
3. Nothing anywhere → `fixtures/ws_demo.json` is copied.

Set `GUIDES_INCLUDE_DEMO=1` to add the demo guide next to the real ones. The server
validates every guide with zod at startup and refuses to start on an invalid file; the
error names the file and field. `npm test` validates `config/guides/` and the fixture too.

Commit `config/guides/` after syncing: `databricks apps deploy` uploads only this folder.

## Languages

- **UI texts**: one dictionary, `client/src/i18n/en.ts` and `pl.ts`. `en.ts` defines the key set;
  `pl.ts` is typed with it, so a missing key, an extra key or a function with other parameters
  fails `npm run typecheck`. Texts with numbers are functions (Polish plurals: `plPlural`).
  Add a text: add the key to both files, use it with `const { m } = useI18n()` → `m.key`.
- **Switch**: `LangSwitch` in the header; the choice is stored in `localStorage` under `wg:lang`
  (guarded; without storage the app starts in Polish). The old quiz key `wg:quiz:lang` is read
  once as a fallback. `<html lang>` follows the choice.
- **Guide content**: English is the source (`notebooks/workshops/guide/ws_*.json`). Polish text
  lives in overlays `notebooks/workshops/guide/i18n/pl/ws_*.json`, copied by `sync-guides` to
  `config/guides/i18n/pl/`. An overlay has the guide `id` and, per step id, only `title`,
  `explain`, `expected`, `hints`, match `pairs` (`left` / `right`, leave out a side that is
  code), doc `label`s and, for track steps, `variants.{sql,pyspark}.{explain_extra, note, hints, pairs}`; `steps` can be a list with `id` or an object keyed by step id. Code
  (`template`, `blocks`, `starter`, blanks) always comes from English. An empty or missing field
  falls back to English; a list of another length than the English one is ignored. A numbered
  guide keeps its label from the number (`Warsztat I — Ingestion`), not from the overlay title.
- `GET /api/guides` returns the English guides and the overlays; the client merges them, so
  switching the language needs no request and step ids, progress and typed answers stay.
  `GET /api/guides?lang=pl` returns the guides already translated.
- At startup the server validates each overlay with zod (a broken file stops the app, like a
  broken guide) and logs overlays for unknown guides, unknown step ids, lists of another length
  and hints whose code differs from English. `npm test` fails on the same problems for the
  overlays in the source folder and in `config/guides/` (code fences in hints must be identical).
- **Stays English**: check messages from the server (they mirror the notebooks) and the result
  messages of order / match exercises that are stored in the progress table (the app shows its
  own Polish feedback next to the exercise).

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
- The quiz is a learning tool, not an assessment. The participant PDF
  (`docs/*/quiz_databricks_fundamental.pdf`) ends with the answer key, so the correct options
  are public; the private key file keeps the explanations out of the repo and makes grading
  server-side, nothing more. Do not use the scores to grade people.

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

Lab state (2026-10-27): every Check of Workshop I passes against the solved notebook in the lab
(run with the CLI identity, not yet through the deployed app with a user token). For Workshop II
the checks that do not depend on the moment (02, 03, 04, 09, 10, 11, 12) pass on the finished
table; the others need the state right after their step. The lab warehouse already gives `users`
`CAN_USE`. `retailhub_trainer.default.workshop_progress` exists in the lab
workspace, and `databricks apps validate --profile ditwlab-admin` passes. The volume
`retailhub_trainer.default.workshop_guide_private` holds `quiz_key.json`, and the lab app's service
principal has `READ VOLUME` on it.

`DEV_USER_EMAIL` is ignored by `npm start` (production). To try the production build locally, send
the identity header yourself: `curl -H 'X-Forwarded-Email: you@example.com' localhost:<port>/api/quiz`.

## E2E tests

`e2e/workshops.e2e.ts` (Playwright) runs a training day through the real UI in Polish against a
running production build and the lab warehouse. Each identity is its own browser context with the
`X-Forwarded-Email` header Databricks Apps would set. It covers: everything locked by default, the
trainer unlocking items in the Access panel (participants see it without a reload), a fresh
participant seeing no passed step and no pre-filled exercise, Workshop I completed in the SQL track
and again in the PySpark track (wrong fill and order answers first, then right ones), Workshop II in
SQL with the PySpark note on a shared step, three quiz questions, the trainer matrix with track
badges, reload and PL/EN switch mid-exercise, Reset my progress, a mobile (390x844) smoke test and
Lock all with a participant inside a workshop. Answers come from `config/guides/` and, for the quiz,
from the local `utilization/en/quiz.md` when it exists.

Start the server with a test trainer (only `@example.com` identities are used):

```bash
npm run build
DATABRICKS_APP_PORT=8765 DATABRICKS_CONFIG_PROFILE=ditwlab-admin DATABRICKS_WAREHOUSE_ID=<id> \
PROGRESS_TABLE=retailhub_trainer.default.workshop_progress \
TRAINER_EMAILS=trainer.e2e@example.com TRAINER_ACCOUNTS=none GUIDE_DEFAULT_UNLOCKED=none npm start
```

Then, in a second terminal:

```bash
BASE_URL=http://localhost:8765 npm run test:e2e     # HEADED=1 to watch it
```

- Uses the installed Google Chrome (`channel: 'chrome'`, override with `E2E_CHANNEL`), no browser
  download. One worker, tests in order (the unlock state is shared). About 3 minutes.
- Setup and teardown delete the suite's rows with `databricks experimental aitools tools query`
  (profile `E2E_DATABRICKS_PROFILE`, default `ditwlab-admin`): only `e2e-*@example.com` and
  `trainer.e2e@example.com`, including that trainer's `__unlock` rows. Other rows are never touched.
  `E2E_SKIP_CLEANUP=1` keeps them for inspection; `npm run test:e2e:cleanup` removes them later.
- Screenshots, traces and the HTML report of failures go to `e2e/artifacts/` (gitignored).
- Tests 11 and 11b cover the trainer's report "steps look passed although I did nothing": after
  Reset, and after the rows were deleted on the server while the browser kept its saved answers,
  no exercise may look solved (no green blank, no success line, no "Zapisz wynik ponownie").

## Load test

`loadtest/class-sim.mjs` simulates one class against a running server (plain `fetch`, no extra
dependencies): 15 participants `load.NN@example.com` and a trainer `load.trainer@example.com`.
Participants load the guides once, poll `GET /api/unlock` and `GET /api/progress/me` every 5 s
like the UI, and answer every step of Workshop I through `POST /api/progress` (odd numbers in the
SQL track, even numbers in PySpark, about 25% wrong first). Think time is 20-60 s divided by
`--speed`. 30% of them then answer the quiz (random option until correct). The trainer unlocks all
items at the start and polls the matrix and the unlock state every 5 s.
`loadtest/count-statements.mjs` is an optional preload that counts the SQL statements the server
sends to the warehouse, by kind and minute.

```bash
npm run build
STATEMENT_COUNT_FILE=/tmp/statements.json NODE_ENV=production DATABRICKS_APP_PORT=8791 \
DATABRICKS_CONFIG_PROFILE=ditwlab-admin DATABRICKS_WAREHOUSE_ID=<id> \
PROGRESS_TABLE=retailhub_trainer.default.workshop_progress TRAINER_EMAILS=load.trainer@example.com \
TRAINER_ACCOUNTS=none GUIDE_DEFAULT_UNLOCKED=none \
node --env-file-if-exists=./.env --import ./loadtest/count-statements.mjs dist/server.js

# second terminal
node loadtest/class-sim.mjs --base http://localhost:8791 --participants 15 --duration 600 --speed 2 \
  --out /tmp/load-report.json
databricks experimental aitools tools query --profile ditwlab-admin --warehouse <id> \
  --file loadtest/cleanup.sql
```

`loadtest/statements.sql` reads the same counts from `system.query.history` (it lags a few
minutes). It filters by `executed_by`, so it cannot separate two local servers that run with the
same CLI profile; the preload can. The trainer is `load.trainer@example.com`, not the E2E trainer,
so `cleanup.sql` (`load.%@example.com`) removes all rows of the run, `__unlock` rows included.

Result on the lab (2026-10-28, Small serverless warehouse, 10 min, speed x2, 15 + 1 users,
4,516 requests, 0 errors; every participant passed 12/12, a fresh participant got 0 progress rows):

| Endpoint | n | p50 ms | p95 ms | max ms |
|---|---:|---:|---:|---:|
| GET /api/unlock | 1,901 | 3 | 777 | 3,712 |
| GET /api/progress/me | 1,795 | 70 | 1,473 | 4,730 |
| GET /api/progress/matrix | 119 | 5 | 1,063 | 2,047 |
| GET /api/quiz/me | 306 | 247 | 1,187 | 4,143 |
| POST /api/progress | 220 | 2,252 | 5,035 | 9,231 |
| POST /api/quiz/answer | 123 | 2,151 | 3,479 | 4,471 |

Statements per minute while the class submitted answers (preload counter, second run): progress
reads 26-38, unlock reads 11-14, progress INSERTs 34-48; about 1 statement per 4-5 HTTP requests.
Polling alone is capped by the 4 s server cache (about 15 reads per minute per key, whatever the
class size): 1,381 unlock polls cost 96 statements. Progress reads grow with the answers, because
every `POST /api/progress` drops the cache. A saved answer takes 2-5 s, almost all of it the Delta
INSERT (p50 about 1.8 s on the warehouse).

What this means for a training day:

- The warehouse never auto-stops while a browser has the app open: `/api/unlock` is polled every
  5 s (30 s in a hidden tab), locked items included. Cost follows the time the app is open, not
  the time people answer.
- 2X-Small with max 1 cluster is enough for the app: peak about 1.5 statements per second, reads
  take about 0.45 s. A bigger size does not shorten the 2-5 s save, which is Delta commit time.
  Use 2 clusters only when participants run their SQL track on the same warehouse.
- Polling every 5 s can stay: the server cache, not the interval, bounds the statements.
- Done after this run: a 30 s cache for the unlock state (a trainer change drops it) and cached
  progress rows updated in place after a POST instead of re-read (see the progress routes above).


## Deploy

The training environment is built with Terraform (`infra/terraform`, local only). It is
expected to create the progress table with grants, the SQL warehouse and the app
`workshop-guide` with its `sql-warehouse` resource (`CAN_USE`).

Grants the app service principal needs: `USE CATALOG` on `retailhub_trainer`,
`USE SCHEMA` on `default`, `SELECT` and `MODIFY` on the progress table, `READ VOLUME` on
`workshop_guide_private` (quiz key).

Participants get no privilege on the progress table (Terraform grants it to the app service
principal only; `00_pre_config` section 4 revokes `SELECT, MODIFY` from participants). Check,
the quiz and Reset write as the app service principal, which grades on the server and deletes
only the caller's rows; a participant with `MODIFY` could bypass that from a notebook, and with
`SELECT` read everyone's quiz answers. The `_checks` notebooks still show PASS / FAIL in class
and print `Progress not saved` once. Self-study in Free Edition owns its own table.

Participants need `CAN_USE` on the SQL warehouse for Check ([Permissions for Check](#permissions-for-check)).

Two deploy paths. Use exactly one per workspace, never both:

**Training environment (Terraform created the app).** Terraform owns the app, its
`user_api_scopes`, its `sql-warehouse`, `trainer-emails` and `trainer-accounts` resources,
the secrets and the warehouse ACL. Deploy only the code:

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
# TRAINER_ACCOUNTS of 00_setup, or none
databricks secrets put-secret workshop-guide trainer-accounts --string-value "none" --profile <profile>
databricks bundle deploy --profile <profile> --var sql_warehouse_id=<id>
databricks bundle run app --profile <profile>
```

Running `bundle deploy` against a Terraform-built workspace would create a second owner
for the same app; do not do it there.

The secret scope and both secrets must exist before `bundle deploy`: `app.yaml` reads
`trainer-emails` and `trainer-accounts` through secret resources, and a deploy without them fails.

### After deploy

1. `databricks apps get workshop-guide --profile <profile> -o json | jq '.user_api_scopes, .resources'`
   shows `["sql"]` and the `sql-warehouse`, `trainer-emails`, `trainer-accounts` resources.
2. Open the app as a **non-admin participant** (not the trainer). Adding the `sql` scope makes
   every user accept a new consent screen once. Run 00_setup, save one step's result, press
   **Check**: PASS or FAIL means it works. "Check could not identify you to Databricks" (401)
   means the scope or the user token is missing; a permission error means the participant lacks
   `CAN_USE` on the warehouse.
3. As that participant, run `SELECT * FROM retailhub_trainer.default.workshop_progress` in a
   notebook: it must fail with a permission error.

## Known limits

- Server-side grading stops a forged `status`, not a participant who sends the right answer with
  curl: blank answers and order solutions ship to the browser in `GET /api/guides` (needed for
  instant feedback and the static HTML). Progress is a learning aid, not an assessment.

- Hints used are stored by the app (POST and Check). Rows from the `_checks` notebooks
  (self-study) have `hints_used = NULL`.
- Check rate limit and quiz rate limit live in memory per app instance.
- Polling keeps the SQL warehouse busy while any browser has the app open: about one progress
  read per 4-5 s per active workshop and one unlock read per 30 s. Browsers poll every 30 s while the tab is hidden. AppKit's own
  query cache is turned off (`cache.enabled=false`); the 4 s server cache replaces it.
- The trainer matrix shows the highest `hints_used` and `attempts` recorded for a step.
