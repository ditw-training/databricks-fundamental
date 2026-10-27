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
| `workshop` | STRING | `ws_delta` or `ws_ingestion` |
| `step` | STRING | step id from the guide file, e.g. `t08` |
| `step_type` | STRING | `fill`, `order`, `match`, `code` |
| `status` | STRING | `pass` or `fail` |
| `message` | STRING | short feedback shown in the app (max 200 chars) |
| `hints_used` | INT | from the app; notebooks write NULL |
| `attempts` | INT | NULL from notebooks; app sends its counter |
| `source` | STRING | `notebook` or `app` |
| `ts` | TIMESTAMP | `current_timestamp()` |

Append-only. The latest row per (`user_email`, `workshop`, `step`) is the state.
Grants: training group `MODIFY` + `SELECT`, app service principal `SELECT` + `MODIFY`,
`USE CATALOG` / `USE SCHEMA` for both.

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

- Name `workshop-guide`; SQL warehouse resource; service-principal auth (no OBO).
- User identity from the `X-Forwarded-Email` header (server side).
- Participant view: workshop picker → step list with status dots → step pane
  (explain, interactive exercise, hints, docs, expected result, live status from
  the progress table).
- Trainer view (`/trainer`, visible to emails in `TRAINER_EMAILS` app env var):
  matrix participant × step (pass / fail / not started), hints used, last activity.
- Polling every 5 s with SQL files in `config/queries/`.
- `POST /api/progress` for `order` / `match` results (INSERT via the app SP).
