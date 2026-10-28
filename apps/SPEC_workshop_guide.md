# Workshop Guide — shared specification

Contract shared by the app (`apps/workshop-guide/`), the workshop notebooks
(`notebooks/workshops/`), the check library (`notebooks/workshops/_checks/`)
and Terraform (`infra/terraform/`, local only). Change it here first.

## 1. How it works

```
Participant ─ reads ─▶ Workshop Guide app (step text, blanks, drag & drop, hints, docs)
     │                         ▲ polls every 5 s (SQL warehouse)
     │ writes code             │
     ▼                         │
Workshop notebook ── check("ws_delta", "t08") ──▶ workshop_progress (Delta table)
                                                  ▲
App-checked steps (order / match) ── POST /api/progress (INSERT as app SP)
```

- Code always runs in the participant's notebook on the training cluster.
- `check()` runs hidden assertions, prints a short PASS / FAIL message in the
  notebook and appends one row to the progress table.
- The app never executes participant code. It only reads progress and records
  results of steps it can grade itself (`order`, `match`).

## 2. Progress table

`retailhub_trainer.default.workshop_progress` (name exported as `PROGRESS_TABLE`
by `notebooks/setup/00_setup.ipynb`; created by Terraform and by `00_pre_config`).

| column | type | notes |
|---|---|---|
| `user_email` | STRING | `current_user()` in notebooks, `X-Forwarded-Email` in the app |
| `workshop` | STRING | `ws_delta`, `ws_ingestion`, or `quiz` (course quiz in the app) |
| `step` | STRING | step id from the guide file, e.g. `t08`; quiz: question id `q01`..`q40` |
| `step_type` | STRING | `fill`, `order`, `match`, `code`; `quiz` for quiz answers |
| `status` | STRING | `pass` or `fail` |
| `message` | STRING | short feedback shown in the app (max 200 chars) |
| `hints_used` | INT | from the app; notebooks write NULL |
| `attempts` | INT | NULL from notebooks; app sends its counter; quiz: attempt number counted by the server |
| `source` | STRING | `notebook` or `app` |
| `ts` | TIMESTAMP | `current_timestamp()` |

Append-only. The latest row per (`user_email`, `workshop`, `step`) is the state.
Grants (classroom): app service principal `SELECT` + `MODIFY` + `USE CATALOG` / `USE SCHEMA`;
participants get **no** privilege on the table (27.10). The app grades Check and the quiz on the
server and Reset deletes only the caller's rows; `MODIFY` would let a participant bypass that from a
notebook and `SELECT` would show everyone's quiz answers. The `_checks` notebooks still run in class
but print "Progress not saved". Self-study (Free Edition, single-user mode): the participant owns
the table, so `_checks` writes to it.

## 3. Guide files

One JSON file per workshop: `notebooks/workshops/guide/ws_delta.json`,
`notebooks/workshops/guide/ws_ingestion.json`. The app copies them at build time
(`apps/workshop-guide/scripts/sync-guides`). A static HTML export for
environments without the app is generated from the same files.

```json
{
  "id": "ws_delta",
  "title": "Workshop — Delta Lake",
  "notebook": "notebooks/workshops/WORKSHOP_delta.ipynb",
  "intro": "Markdown, 2-4 sentences: what you build and why.",
  "steps": [
    {
      "id": "t01",
      "title": "Create the Delta table",
      "type": "fill",
      "optional": false,
      "explain": "Markdown, 2-5 short sentences: what this step does and why.",
      "expected": "What a correct result looks like (row count, columns).",
      "language": "sql",
      "template": "CREATE TABLE {{b1}} (\n  customer_id INT,\n  ...\n) USING {{b2}}",
      "blanks": { "b1": { "answers": ["customers_delta"], "width": 16 },
                  "b2": { "answers": ["DELTA"], "case_sensitive": false } },
      "hints": ["Direction hint", "Syntax hint", "Full solution (revealed last)"],
      "docs": [{ "label": "CREATE TABLE", "url": "https://learn.microsoft.com/azure/databricks/sql/language-manual/sql-ref-syntax-ddl-create-table-using" }],
      "check": "notebook"
    }
  ]
}
```

Step types (target mix per workshop: ~40% `fill`, ~25% `order`/`match`, ~35% `code`;
easy steps first, every `optional` step is `code`):

| type | participant does | graded by | extra fields |
|---|---|---|---|
| `fill` | types blanks inline in the code; app validates each blank instantly; "Copy to notebook" assembles code | blanks: app; result: `check()` in notebook (`"check": "notebook"`) | `template`, `blanks` |
| `order` | drags code blocks into the right order (distractors allowed); assembled code is copied to the notebook | order: app; result: `check()` if `"check": "notebook"`, else app only (`"check": "app"`) | `blocks` (list of `{id, code}`), `solution` (ordered ids), `distractors` (ids) |
| `match` | drags terms onto descriptions | app (`"check": "app"`) | `pairs` (list of `{left, right}`) |
| `code` | writes code from scratch; hints revealed one by one (last = full solution after confirmation); doc links | `check()` in notebook | `starter` (optional comment skeleton) |

`hints`: 2-3 entries, progressive. `docs`: 1-3 links (Microsoft Learn Azure Databricks
docs preferred). All text English (notebooks are English).

## 4. Notebook layout per step

```
[markdown]  ## Step 08 — MERGE INTO (upsert)
            One sentence. Full explanation, blanks and hints: Workshop Guide app, step 08.
[code]      participant code cell (template with ____ for fill, empty with comment for code)
[code]      check("ws_delta", "t08")
```

First cells: title, link/where to find the app, `%run ../setup/00_setup`,
`%run ./_checks/ws_delta` (loads `check`). Cells follow the notebook standard:
small cells, one idea each, no timings, no "CORE path" text.

## 5. Check library

- `notebooks/workshops/_checks/_progress` — `record(workshop, step, step_type, ok, message)`
  writes to `PROGRESS_TABLE`; never raises if the write fails (prints a warning).
- `notebooks/workshops/_checks/ws_delta`, `.../ws_ingestion` — `%run ./_progress`, then
  `check(workshop, step)` dispatches to per-step functions that assert on tables /
  DataFrames in the participant's catalog (`CATALOG` from 00_setup), print
  `PASS — <message>` or `FAIL — <what is wrong, what to try>`, and call `record`.
- Checks inspect results (tables, schemas, counts), not source code.
- Must work on classic UC clusters and serverless.

## 6. App (AppKit, analytics)

- Name `workshop-guide`; SQL warehouse resource; service-principal auth for progress reads and
  writes, on-behalf-of-user (`sql` scope) only for the step checks (section 7).
- User identity from the `X-Forwarded-Email` header (server side).
- Participant view: workshop picker → step list with status dots → step pane
  (explain, interactive exercise, hints, docs, expected result, live status from
  the progress table).
- Trainer view (`/trainer`, visible to emails in `TRAINER_EMAILS` app env var):
  matrix participant × step (pass / fail / not started), hints used, last activity.
- Polling every 5 s with SQL files in `config/queries/`.
- `POST /api/progress` for `order` / `match` results (INSERT via the app SP).
- `POST /api/check` and `DELETE /api/progress/me` (section 7).

## 7. v2: "Check" button in the app (decided 27.10, implemented 27.10)

Implemented in `apps/workshop-guide` (README "Check button", "Reset my progress"): `POST /api/check`
runs `server/checks/ws_*.ts` as the user (`appkit.analytics.asUser(req)`), `DELETE /api/progress/me`
resets one workshop, `user_api_scopes: [sql]` in `databricks.yml` and Terraform, participants get
`CAN_USE` on the warehouse (Terraform `databricks_permissions`, authoritative: lists the training group
and the app service principal). `TRAINER_ACCOUNTS` reaches the app as the secret resource
`trainer-accounts` (`none` = empty). This section supersedes the `check()` parts of sections 1, 4 and 6
for the classroom; they still describe the `_checks` self-study path.

- Each notebook-graded step gets a **Check** button in the app. The participant no longer runs
  `check()` in the notebook; the notebook check cells are removed from the classroom notebooks.
- The app runs the step's check as **SQL on the SQL warehouse on behalf of the user** (OBO,
  `user_api_scopes: [sql]`, token from `X-Forwarded-Access-Token`), so it sees only what the
  participant can see in their own catalog `retailhub_<slug>` (catalog name resolved from the
  e-mail with the same slug rules as `00_setup`).
- Check definitions live in the app (`apps/workshop-guide/server/checks/ws_*.ts`, one function per
  step: SQL plus assertions evaluated server-side) and return PASS / FAIL with the same messages as
  the `_checks` notebooks; the result is written to the progress table by the app (source = `app`).
- Steps whose result is only a DataFrame in the notebook session get one pre-filled line in the
  template that saves it to a scratch table in the participant's catalog
  (e.g. `<catalog>.default._ws_<workshop>_<step>`), which the app check reads.
- The `_checks/*` notebooks stay for the static HTML guide / Free Edition self-study path.
- "Reset my progress" (per workshop, after confirmation) deletes only the caller's rows of that workshop.
- Workshops are numbered in the order of the day with Roman numerals (superseded by section 9):
  **Workshop I — Ingestion**, **Workshop II — Delta Lake** (PL "Warsztat I/II"). Guide JSON gets
  `"number": 1|2` and the app lists and labels workshops by it (picker, headings,
  trainer view, static HTML). Notebook titles, 00_intro / README / TRAINER_GUIDE agenda rows use the
  same names. File names stay (`WORKSHOP_ingestion.ipynb`, `WORKSHOP_delta.ipynb`; no renames).

## 8. Course quiz (app)

- Page `/quiz`, learning mode: one question at a time, PL/EN, immediate feedback with an
  explanation and the notebook section, retry until correct. Score = correct first attempts.
- Public questions: `apps/workshop-guide/config/quiz/questions.json` (no answers). Private key
  (answers, explanations, `module_ref`): UC volume file at `QUIZ_KEY_PATH`, default
  `/Volumes/retailhub_trainer/default/workshop_guide_private/quiz_key.json`; app SP `READ VOLUME`
  only. Both built by `apps/workshop-guide/scripts/quiz-from-md.mjs` from `utilization/`; the same
  `version` in both.
- Graded on the server (`POST /api/quiz/answer`); one progress row per answer with
  `workshop = 'quiz'`, `step_type = 'quiz'`, `message` = chosen option, `hints_used` NULL,
  `source = 'app'`.
- Trainer view: Quiz tab with first-attempt score and completion per participant and the
  first-attempt correct rate per question, hardest first.
- **Learning tool, not an assessment (decided 27.10).** The participant PDF
  `docs/*/quiz_databricks_fundamental.pdf` is public and ends with the answer key, so the correct
  options are public anyway (also in git history). The private volume keeps only the explanations
  out of the repo and makes the feedback come from the server. Scores show the trainer where the
  group struggled; they are not a secret test and must not be used to grade people. Participants
  cannot read each other's quiz rows (no grant on the progress table, section 2).

## 9. Language switch and Roman numbering (decided 28.10.2026)

- One PL / EN switch in the app header (default PL, remembered in localStorage, shared with the quiz,
  which already has both languages). All UI strings come from one dictionary (`client/src/i18n/`).
- Workshop guide content stays English in `notebooks/workshops/guide/ws_*.json` (source of truth,
  matches the English notebooks). Polish text lives in overlays
  `notebooks/workshops/guide/i18n/pl/ws_*.json`: same step ids, only translatable text
  (`title`, `intro`, step `title`, `explain`, `expected`, `hints`, match `pairs` text that is prose,
  doc link `label`). Code (`template`, `blocks`, `starter`, code inside hints) is never translated.
  Missing overlay text falls back to English. `sync-guides` copies the overlays; a test checks that
  every overlay step id exists and code fences in hints are identical to the English ones.
- Check messages from the server stay English (they mirror the notebooks) unless a Polish message
  table is added later.
- Workshops are ordered by `number` and labelled with Roman numerals: PL "Warsztat I — Ingestion",
  "Warsztat II — Delta Lake"; EN "Workshop I — Ingestion", "Workshop II — Delta Lake". The same
  names are used in notebook titles, 00_intro / README / TRAINER_GUIDE agenda rows and the static HTML
  (which gets a PL and an EN page per workshop).

## 10. Quiz as item III and trainer unlock (decided 28.10.2026, next after §9)

- The home list shows three numbered items in the order of the day: I — Ingestion workshop,
  II — Delta Lake workshop, III — Quiz (PL "Warsztat I/II", "III — Quiz"; EN "Workshop I/II", "III — Quiz").
  The header keeps direct navigation, but item III is the quiz entry point.
- Trainer unlock: each item (ws_ingestion, ws_delta, quiz) is locked for participants until a
  trainer enables it in the trainer view (toggle per item, with "unlock all" / "lock all").
  Locked items show a lock and the text "Trener odblokuje to w odpowiednim momencie" /
  "Your trainer will unlock this at the right moment". Unlock state is shared by all viewers and
  polled (5 s). Trainers (TRAINER_EMAILS) always see everything.
- Enforcement is server-side: GET guides/quiz content for a locked item returns 423 for participants;
  POST /api/check, /api/progress, /api/quiz/answer for a locked item return 423.
- Storage: no new table. The app appends rows to the progress table with
  workshop = '__unlock', step = <item id>, step_type = 'unlock', status = 'on' | 'off',
  user_email = trainer e-mail, source = 'trainer'. The latest row per item wins; no row = locked
  (configurable default via env GUIDE_DEFAULT_UNLOCKED=none|all). Trainer matrix, quiz stats and
  "Reset my progress" ignore these rows.
