# Trainer Guide: Databricks Fundamental

Run sheet for the one-day course, 09:00–16:40: 395 min of teaching and workshops, 65 min of breaks.
The participant-facing agenda is in `notebooks/modules/00_intro.ipynb`; the table below is a copy of it, keep the two in sync.

Sections are named by their headings. Cell numbers shift with every edit, so this guide does not use them.

| Marker | Meaning |
|--------|---------|
| ⊕ **BONUS** | Module section outside the one-day schedule. Skip it in class; it stays for self-study and the 2-day format |
| ⭐ **OPTIONAL** | Workshop task for participants who finish early |
| **CORE** | Always cover |

---

## Agenda

| Time | Min | Block | CORE |
|------|-----|-------|------|
| 09:00 – 09:15 | 15 | **M00** Intro | Objectives, agenda, `%run ../setup/00_setup` as the environment check |
| 09:15 – 10:20 | 65 | **M01** Platform, costs, GUI | Platform map, workspace + Catalog Explorer, three-level namespace, Volumes (DBFS is legacy), Serverless / classic / SQL warehouse, costs (formula, Jobs vs All-purpose, autoscaling, auto-termination), magic commands + `%sql`, Edit Chart + Data Profile, Genie Code; one billing query as a trainer demo |
| 10:20 – 10:35 | 15 | **M02** How Spark works | Driver/executors, lazy evaluation, "SQL = PySpark, same engine", one sentence on shuffle |
| 10:35 – 10:50 | 15 | Break | |
| 10:50 – 11:45 | 55 | **M03** Medallion + ingestion | Python in 5 minutes, CSV/JSON/`read_files`, DDL schema, `display`/`show`/`describe`/`summary`, `select`/`filter`, `withColumn` + `cast` (ANSI, `try_cast`) + `when`, `groupBy.agg`, temp view + SQL, **write to Delta**; every operation with its SQL equivalent |
| 11:45 – 12:25 | 40 | **Workshop: Ingestion** | At most 8 tasks, the rest ⭐ OPTIONAL |
| 12:25 – 13:05 | 40 | Lunch | |
| 13:05 – 13:45 | 40 | **M04** Delta Lake | Table, schema enforcement/evolution, DML, MERGE, HISTORY, time travel, RESTORE; as concepts: VACUUM, UNDROP, predictive optimization / liquid clustering |
| 13:45 – 14:20 | 35 | **Workshop: Delta Lake** | 7 tasks (01, 03, 05+06, 08, 10, 12), SQL in `%sql`; 02/04/07/09/11 ⭐ OPTIONAL |
| 14:20 – 14:30 | 10 | Break | |
| 14:30 – 15:05 | 35 | **M05** Lakeflow Jobs | Ready notebooks from `materials/orchestration`, compute for jobs, parameters, simple task values, schedule, Repair run |
| 15:05 – 15:20 | 15 | **M06** Unity Catalog | Groups, `GRANT` / `SHOW GRANTS` / `REVOKE` (3 lines), Permissions tab |
| 15:20 – 16:25 | 65 | **Final Project** | Bronze ready → Silver/Gold TODO + CHECK → job with a schedule → SQL; after 25 min you may switch to the ready solutions |
| 16:25 – 16:40 | 15 | Wrap-up, quiz, next steps | |
| (optional) | (10) | **M07** Genie Agents / dashboard | Trainer demo, only if time is left |

Sum: 15 + 65 + 15 + 55 + 40 + 40 + 35 + 35 + 15 + 65 + 15 = 395 min. The minutes are estimates from the
26.10.2026 review, not a measurement; correct them after the timed dry run.

---

## Before the day

1. Account group `retailhub_analysts` exists (Settings → Identity and access → Groups). SQL `CREATE GROUP`
   creates a workspace-local group that Unity Catalog cannot grant to (`PRINCIPAL_DOES_NOT_EXIST`).
2. Fill in the training group and storage location in the configuration cell of `notebooks/setup/00_pre_config`
   (do not commit real values), then run it. It creates `retailhub_<name>` per participant with `bronze`, `silver`,
   `gold`, `default`, the Volume `default.datasets` with a copy of `dataset/`, and grants `ALL PRIVILEGES` + `MANAGE`.
   `ALL PRIVILEGES` does not include `MANAGE`; without it participants cannot run a single `GRANT` in M06.
3. Upload `materials/volume_upload/stores.csv` and `promotions.json` for the M01 Volume demo, or plan to do it live.
4. Participants clone the Git folder before 09:00 if possible (steps in `00_intro`, section *Getting the training materials*).
5. Final Project fallback: make sure the ready Silver/Gold solutions are available to participants as read-only
   notebooks in the workspace (see `00_pre_config`), never in the public repository.

---

## Run sheet per module

### M00 Intro (`00_intro`): 15 min

- **CORE:** *Learning Objectives*, *Day Schedule*, *How the Notebooks Are Marked*, *Environment Check*
  (`%run ../setup/00_setup`, prints `CATALOG`), *Training Rules*, *RetailHub Scenario*.
- **Live:** if the Git folder is not cloned yet, do it together (*Getting the training materials*).
- **Skip in class:** *Training Materials* tables and *What's Next*: point to them, come back in the wrap-up.
- If *Catalog not found*: the participant's login is not in the training group, or `00_pre_config` was not re-run after a late joiner.

### M01 Platform, costs, GUI (`01_platform_workspace`): 65 min

Minutes per section (by heading):

| Section | Min |
|---|---|
| Databricks Platform Elements: setup, Lakehouse, key components | 8 |
| Workspace Exploration, Catalog Explorer, 3-level namespace, Git Folders | 10 |
| Volumes vs DBFS + Demo: upload your own files to a Volume (trainer) | 8 |
| Compute Resources: serverless, classic clusters, SQL warehouse | 10 |
| Cost Management + billing demo (trainer only; participants skip the query cell) | 10 |
| Magic Commands, `%sql`, Mixing Python + SQL | 7 |
| Demo Table in Unity Catalog, Edit Chart, Data Profiling | 8 |
| Genie Code | 4 |

- **CORE:** platform map, workspace and Catalog Explorer, three-level namespace, Volumes (DBFS legacy:
  not available in new workspaces from 8 October 2026), compute types (Serverless, classic, SQL warehouse),
  costs (classic = DBU + VM, serverless = DBU; Jobs vs All-purpose; autoscaling; auto-termination),
  magic commands and `%sql`, Edit Chart and Data Profile, Genie Code.
- **Trainer demo:** one billing query on `system.billing.usage` (participants usually lack access to `system`).
  Volume upload as a 2–3 min demo; participants can copy the files from their Git folder.
- **⊕ BONUS:** Hive metastore vs Unity Catalog, managed vs external tables, cluster info and monitoring,
  creating a SQL warehouse + Power BI, the other billing queries, Spot/Photon, Widgets, `%pip`, Cluster Policies,
  PySpark vs SQL comparison.

### M02 How Spark works (`02_spark_architecture`): 15 min

Minutes per section (by heading):

| Section | Min |
|---------|-----|
| Setup | 1 |
| 1. Driver & Executors | 4 |
| 2. Lazy Evaluation | 6 |
| 3. SQL and PySpark run on the same engine | 4 |

- **CORE:** driver and executors, transformations vs actions (lazy evaluation), `explain()`: the same plan for SQL
  and PySpark, one sentence: `groupBy` / `join` move data between machines (shuffle).
- **⊕ BONUS:** DAG, stages and shuffle in detail, Catalyst and AQE, Spark UI / query profile, Common Errors,
  Cache and Persist.
- Serverless and Free Edition have no Spark UI; use the query profile under the cell result.

### M03 Medallion + ingestion (`03_medallion_ingestion`): 55 min

Minutes per section (by heading):

| Section | Min |
|---------|-----|
| Setup + Python You Need for PySpark | 7 |
| Medallion Architecture | 4 |
| CSV Import: inferred and explicit schema | 8 |
| JSON Import | 4 |
| Data Exploration | 5 |
| read_files() + Write to Delta | 7 |
| DataFrame Transformations: select, withColumn, cast, when | 10 |
| Filtering Data | 3 |
| Aggregations | 3 |
| Temporary Views & SQL | 4 |

- **CORE:** Python in 5 minutes, medallion architecture, CSV with inferred vs explicit schema (DDL string next to
  `StructType`), JSON, `read_files`, `display` / `show` / `describe` / `summary` on orders, `select` / `filter`,
  `withColumn` + `cast` (ANSI error, `try_cast`) + `when`, one `groupBy().agg()`, temp view + `spark.sql`,
  write to Delta. Show the one-line SQL equivalent for every operation.
- **⊕ BONUS:** extended reader options, JSON options table, Parquet, Excel, inferSchema benchmark,
  `withColumnRenamed` / `drop` / `distinct` / `orderBy` / `isin` / min-max / HAVING variants, fillna / dropna,
  string functions, global temporary views, complex SQL.
- Hand out `docs/*/pyspark_vs_sparksql.pdf` to SQL-only participants.

### Workshop: Ingestion (`WORKSHOP_ingestion`): 40 min

- **CORE:** at most 8 tasks, ending with the Bronze Delta write (raw data + load metadata).
  Schemas can be written as DDL strings; aggregation and filter tasks can be solved in SQL.
- **⭐ OPTIONAL:** the remaining tasks (see *Tasks at a Glance* in the notebook).
- Solution: `utilization/solutions/WORKSHOP_ingestion_solution.ipynb` (local only).

### M04 Delta Lake (`04_delta_fundamentals`): 40 min

Minutes per section (by heading):

| Section | Min |
|---------|-----|
| Setup | 1 |
| Delta Lake Core Features (first table, schema enforcement and evolution) | 12 |
| CRUD Operations & MERGE | 8 |
| Metadata and Analytics | 3 |
| Time Travel and RESTORE (incl. VACUUM and retention) | 10 |
| Managed vs External Tables (incl. DROP and UNDROP) | 4 |
| Common Errors + Summary | 2 |

- **CORE:** create table, schema enforcement and evolution, INSERT / UPDATE / DELETE, MERGE, DESCRIBE HISTORY,
  time travel, RESTORE (only within the retention window).
- **Concepts, 2 min:** VACUUM removes old data files, not the `_delta_log`; time travel is not a backup;
  DROP + UNDROP for managed tables; predictive optimization and liquid clustering on Unity Catalog managed tables.
- **⊕ BONUS:** identity and generated columns, constraints, `_delta_log` internals, VACUUM demo,
  external tables, multi-table transactions, troubleshooting.

### Workshop: Delta Lake (`WORKSHOP_delta`): 35 min

- **CORE:** tasks 01, 03, 05+06, 08 (MERGE), 10, 12. SQL in `%sql` cells; Python only in CHECK cells.
- **⭐ OPTIONAL:** tasks 02, 04, 07, 09, 11.
- Solution: `utilization/solutions/WORKSHOP_delta_solution.ipynb` (local only).

### M05 Lakeflow Jobs (`05_orchestration_jobs`): 35 min

Minutes per section (by heading):

| Section | Min |
|---------|-----|
| Task Types in Lakeflow Jobs | 3 |
| Compute for Jobs | 3 |
| Demo Notebooks (Task 1–3 code walkthrough) | 5 |
| [UI DEMO] Creating Multi-task Job — Steps 1–5 | 10 |
| Step 6: Schedule | 3 |
| Step 7: Run and monitor | 3 |
| Step 8: Different parameters → failure → Repair run | 4 |
| [UI DEMO] Options, Retry and Alerting | 2 |
| [UI DEMO] SQL Editor | 2 |

- **CORE:** name mapping (Workflows → Lakeflow Jobs, menu **Jobs & Pipelines**), compute for jobs
  (serverless, job compute, all-purpose), a 3-task job from the ready notebooks in `materials/orchestration`,
  job vs task parameters, task values (`taskValues.get(taskKey="validate", ...)`), schedule (Quartz cron,
  `Europe/Warsaw`, leave it **Paused**), *Run now with different parameters* with a too high `min_rows` →
  failed task → Repair run.
- Task names matter: `transform` reads from the task named `validate`, `report` from `transform`.
  A wrong name makes the task fail, which is a good lead-in to Repair run.
- **⊕ BONUS:** Lakeflow Spark Declarative Pipelines (formerly Delta Live Tables), system tables beyond one
  trainer query, If/Else and For Each tasks.

### M06 Unity Catalog (`06_unity_catalog`): 15 min

Minutes per section (by heading):

| Section | Min |
|---------|-----|
| Setup | 1 |
| Unity Catalog Architecture | 2 |
| Your catalog and schemas | 1 |
| Groups -- who gets access | 3 |
| GRANT / SHOW GRANTS / REVOKE | 5 |
| Catalog Explorer: Permissions tab | 2 |
| Summary | 1 |

- **CORE:** account groups vs workspace-local groups, `GRANT` (USE CATALOG, USE SCHEMA, SELECT),
  `SHOW GRANTS`, `REVOKE`, then the same in the **Permissions** tab of Catalog Explorer.
- Requires the account group `retailhub_analysts` and `MANAGE` on the participant catalogs (see *Before the day*).
- Free Edition has no account console; the notebook explains the single-user variant.

### Final Project (`WORKSHOP_final_project` + `tasks/lab_task_01..03`): 65 min

- **CORE:** Bronze is ready → complete Silver and Gold (TODO + CHECK) → job with three tasks, job parameters
  `catalog` and `source_path` and a paused schedule → SQL checks 1 and 2.
- **Cut-off:** after 25 min participants who are behind switch to the ready solution notebooks and still build the job.
- Expected: Bronze 100,000 rows; Gold 32 rows (one per day, 2024-12-31 to 2025-01-31).
- **Optional:** SQL checks 3–4, an active trigger a few minutes ahead.

### Wrap-up: 15 min

- Quiz (`docs/*/quiz_databricks_fundamental.pdf`), next steps (`docs/*/next_steps.pdf`), Free Edition guide for self-study.

### M07 Genie Agents / dashboard (`07_aibi_dashboards`): optional, 10 min

- Outside the grid. Show a Genie Agent (formerly Genie Space) only if the project ends early, at the cost of wrap-up.
- Requirements: pro or serverless SQL warehouse, Databricks SQL entitlement, partner-powered AI features enabled.
  Check them in the training workspace before the day.
- The dashboard builder is self-study.

---

## Open items

- [x] M05: scheduling / CRON section (done)
- [x] M03: `show()` / `describe()` / `summary()` demo (done)
- [ ] Verify the Jobs UI screenshots in M05 and the Final Project against the current Lakeflow Jobs UI
- [ ] Rebuild the `docs/` PDFs after every change to `utilization/en` or `utilization/pl` (`scripts/build_pdfs.sh`)
- [ ] Test run on the classic shared cluster and on Free Edition (serverless): `99_test_runner`, workshops with solutions, both jobs
- [ ] Timed dry run of the CORE path against the 395-minute agenda; then correct the minutes in `00_intro`, README and this guide

---

## History

- **11.09.2026:** BONUS banners inserted in place in M01–M04; M06 cut to groups + GRANT/REVOKE
  (Comments, Tags, PII query, Lineage, Delta Sharing removed). Separate `workshops/bonus/` notebooks were
  considered and rejected: banners keep each section in its module without a second copy.
- **13.09.2026:** CRON trigger in M05, `show` / `describe` / `summary` in M03, M07 made optional.
- **26.10.2026:** review against the Fundamental level; one agenda (above), M07 outside the grid,
  further sections moved under ⊕ BONUS, run sheet by headings instead of cell numbers.
