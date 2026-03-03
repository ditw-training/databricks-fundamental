# Databricks Fundamentals Training — Audit Report

**Auditor role:** Senior Databricks Trainer + Technical Reviewer  
**Date:** 2025-07  
**Scope:** Complete training (`/notebooks/`, `/dataset/`, `/docs/`, `/materials/`)  
**Platform:** Databricks on Azure (Unity Catalog, ADLS Gen2)

---

## Executive Summary

The training is well-structured for a one-day fundamentals course. Core concepts (Medallion Architecture, Delta Lake, Unity Catalog) are covered at an appropriate depth. The lab suite is practically oriented and reflects real-world Databricks patterns. However, **several critical code defects will cause execution failures** during a live session, and **incomplete translation** remains in three notebooks.

| Dimension | Grade | Notes |
|-----------|-------|-------|
| Syllabus alignment | **B+** | 90% covered; AI Assistant gap |
| Content quality (modules) | **B** | Solid concepts; M03 translation incomplete |
| Lab quality & executability | **B-** | LAB-02 Task 08 will fail; M04 demo OOM risk |
| Setup & automation | **C+** | Hardcoded secrets, non-portable config |
| Databricks best practices | **A-** | Strong use of UC and Delta; minor anti-patterns |
| Language consistency (English) | **C** | Polish remnants in 3 notebooks |
| **OVERALL** | **B-** | Solid foundation, fixable before production use |

---

## 1. Syllabus Alignment

| # | Declared Topic | Coverage | Module |
|---|----------------|----------|--------|
| 1 | Lakehouse & Platform | Full | M00, M01 |
| 2 | Spark Architecture | Full | M02 |
| 3 | ELT Ingestion (Medallion) | Full | M03 |
| 4 | Delta Lake | Full | M04 |
| 5 | Workflows & Orchestration | Full | M05 |
| 6 | Unity Catalog | Full | M06 |
| - | AI/BI Dashboards (bonus) | Present | M07 |
| - | **Databricks AI Assistant** | **MISSING** — listed in M01 objectives, no demo exists |

**Gap:** M01 learning objectives include "Understand how the Databricks AI Assistant supports daily work" but no module contains a working AI Assistant demo cell. Participants cannot verify this objective.

**Timing risk:** Proposed schedule totals ~495 min on an 8-hour day. M03 alone is 106 cells (~70-90 min). LAB 01 is allocated 75 min for 9+ tasks. Add 15 min contingency buffer; mark LAB 01 Tasks 07-09 as optional.

---

## 2. Module-by-Module Audit

### M00 — `00_intro.ipynb` — Grade: B

| Finding | Severity | Details |
|---------|----------|---------|
| Polish in code cell `#VSC-ee8ecbb8` | MEDIUM | `print(f"  Uzytkownik:  {username}")`, `"Katalog"`, `"Problem z katalogiem — uruchom najpierw..."` |
| Per-user isolation pattern | GOOD | Uses `00_setup` to export isolated catalog/schema variables |
| Short and focused | GOOD | Appropriate welcome module |

### M01 — `01_platform_workspace.ipynb` — Grade: A-

| Finding | Severity | Details |
|---------|----------|---------|
| Missing AI Assistant demo | MEDIUM | Learning objective stated but no demo cell exists |
| `samples.nyctaxi.trips` used in demos | LOW | Participants need access to `samples` catalog |
| Very comprehensive (58 cells, ~90 min) | WARNING | Risk of time overrun in a 45 min slot |
| Excellent best-practices coverage | GOOD | Git Folders, Volumes vs DBFS, cost, auto-termination |

### M02 — `02_spark_architecture.ipynb` — Grade: A

| Finding | Severity | Details |
|---------|----------|---------|
| Uses `samples.nyctaxi.trips` | LOW | Same catalog access dependency as M01 |
| Lazy evaluation demo | EXCELLENT | Clear before/after timing, good teaching technique |
| ASCII cluster architecture diagram | GOOD | Effective for text-based notebooks |
| Catalyst Optimizer + AQE section | GOOD | Appropriate depth for fundamentals |

### M03 — `03_medallion_ingestion.ipynb` — Grade: C+

| Finding | Severity | Details |
|---------|----------|---------|
| Title cell still in Polish | HIGH | "ELT & Ingestion — Podstawowe operacje na danych", "Nauczysz sie wczytywac dane..." |
| Medallion section (`#VSC-5b1c0184`) entirely in Polish | HIGH | ASCII diagram with Surowe/Oczyszczone/Zagregowane; "Trzy warstwy" table |
| Definition cells in Polish | MEDIUM | `spark.read.format("csv")` definition fully in Polish (lines 249, 790) |
| GUI Visualizations section in Polish | MEDIUM | "Jedna z najwiekszych zalet Databricks...", "Uruchom komorke ponizej..." |
| `EXCEL_PATH` references `customers_extented.xlsx` | LOW | Filename typo — file exists but comment acknowledges it — confusing |
| Row count discrepancy | LOW | Module says "100 000 rows"; LAB_02 says "~5 000 rows" |
| Explicit schema demos | GOOD | Both `inferSchema` and `StructType` shown and compared |
| Auto Loader streaming section | GOOD | `cloudFiles` with checkpoint |

### M04 — `04_delta_fundamentals.ipynb` — Grade: B-

| Finding | Severity | Details |
|---------|----------|---------|
| `spark.table("customers_delta")` missing prefix in `#VSC-04df1fd9` | **CRITICAL** | Unqualified table name throws `TABLE_OR_VIEW_NOT_FOUND` without prior `USE CATALOG`. All subsequent cells use `f"{CATALOG}.{BRONZE_SCHEMA}.customers_delta"` correctly — only the initial load is broken. |
| `row_count = 10_000_000` (10M rows) | HIGH | Performance demo generates 10M synthetic rows. On shared training clusters (2-4 workers, ~15 GB RAM) this risks OOM or >5 min wait. |
| Schema evolution INSERT uses uninitialized columns | MEDIUM | `customer_segment` and `customer_tier` are inserted before `ALTER TABLE ADD COLUMN` is explicitly run. Out-of-order execution fails. |
| CRUD operations use full `{CATALOG}.{BRONZE_SCHEMA}` prefix | GOOD | Correctly qualified throughout |
| MERGE INTO example | EXCELLENT | All three WHEN clauses shown with explanatory diagram |
| Time Travel demo | GOOD | `VERSION AS OF`, `TIMESTAMP AS OF`, `DESCRIBE HISTORY` all demonstrated |
| `enableChangeDataFeed` | GOOD | Shown with use-case explanation |

### M05 — `05_orchestration_jobs.ipynb` — Grade: A-

| Finding | Severity | Details |
|---------|----------|---------|
| Fully translated to English | GOOD | Summary table and Lakeflow section complete |
| `raise Exception` for validation step | GOOD | Defensive programming pattern demonstrated |
| No hands-on exercise in module | LOW | Deferred to LAB_FINAL — acceptable for 30 min slot |

### M06 — `06_unity_catalog.ipynb` — Grade: A-

| Finding | Severity | Details |
|---------|----------|---------|
| Fully translated to English | GOOD | Data Lineage and Delta Sharing sections complete |
| Delta Sharing coverage is awareness-level | LOW | Appropriate for fundamentals scope |
| No GRANT/REVOKE exercise | LOW | Advanced topic — acceptable |

### M07 — `07_aibi_dashboards.ipynb` — Grade: B+

| Finding | Severity | Details |
|---------|----------|---------|
| Cell `#VSC-cd8679c8` still in Polish (lines 439-440) | MEDIUM | `# Drugi przyklad - trend przychodow po miesiacach` / `# Kliknij "+" -> Line Chart` |
| End-to-end demo design | GOOD | SQL Editor -> Dashboard -> Genie flow |
| Genie section | GOOD | Limitations documented clearly |
| Polish characters in demo data | INFO | Intentional (fictional Polish e-commerce scenario) |

---

## 3. Lab Audit

### LAB_01 — `LAB_01_platform.ipynb` — Grade: A-

| Finding | Severity | Details |
|---------|----------|---------|
| 9 tasks, well scoped | GOOD | Good progression for 75 min |
| Assert-based auto-checks | EXCELLENT | Immediate actionable feedback |
| `%run ../setup/00_setup` at top | GOOD | Correct per-user isolation pattern |
| Task difficulty progression | GOOD | Navigation -> SQL -> Delta — logical flow |
| Task 08 (DBU cost check) relies on GUI | LOW | Cannot be automated — acceptable |

### LAB_02 — `LAB_02_etl_pipeline.ipynb` — Grade: B-

| Finding | Severity | Details |
|---------|----------|---------|
| **Task 08: `F.hour(F.col("order_datetime"))` on StringType column** | **CRITICAL** | `order_datetime` in `bronze.lab_orders` is ingested as-is (Bronze-as-raw policy = `StringType`). `F.hour()` requires `TimestampType`. This throws `AnalysisException: cannot resolve 'hour(order_datetime)' due to data type mismatch`. Fix: `F.hour(F.col("order_datetime").cast("timestamp"))` |
| 12 tasks, comprehensive scope | GOOD | Full Bronze to Silver pipeline |
| Assert checks at each task | EXCELLENT | `assert row_count == expected` pattern |
| Explicit schema in Bronze ingest | GOOD | `StructType` shown for JSON reading |
| Appropriate hint density | GOOD | Revised in previous session |

### LAB_03 — `LAB_03_delta_lifecycle.ipynb` — Grade: A-

| Finding | Severity | Details |
|---------|----------|---------|
| Dual-path SQL / PySpark | EXCELLENT | Added previously — strong instructional decision |
| Bridge cells for SQL path | GOOD | Variables correctly set for assert checks |
| `USE CATALOG / USE SCHEMA` cell | GOOD | Handles unqualified names in SQL cells |
| MERGE, Time Travel, VACUUM, OPTIMIZE | GOOD | All major Delta operations covered |

### LAB_FINAL — `LAB_FINAL.ipynb` — Grade: B+

| Finding | Severity | Details |
|---------|----------|---------|
| 3-task end-to-end pipeline | GOOD | Bronze -> Silver -> Gold -> Workflow |
| Workflow setup relies on screenshots | LOW | Screenshots become outdated when Databricks UI changes |
| No auto-validation for Workflow task | LOW | GUI task — inherently hard to automate |
| References task sub-notebooks cleanly | GOOD | `lab_task_01_bronze` / `_02_silver` / `_03_gold` |
| `raise NotImplementedError` pattern in sub-notebooks | EXCELLENT | Clear participant skeleton |

---

## 4. Setup Notebooks Audit

### `00_pre_config.ipynb` — Grade: D+

| Finding | Severity | Details |
|---------|----------|---------|
| **`STORAGE_LOCATION` hardcoded to real Azure ADLS endpoint** | **CRITICAL** | `"abfss://unity-catalog-storage@dbstoragexlcs5kgkoop2g.dfs.core.windows.net/7405606614957089"` — a real production storage account. If committed to Git this exposes infrastructure details. Must be cleared before sharing. |
| **`TRAINING_GROUP = "admins"`** | HIGH | Assigning training participants to the `admins` group is a security risk. Use a dedicated low-privilege group (e.g. `databricks_training_users`). |
| No `.gitignore` protection | HIGH | Azure storage account name will appear in any Git history |
| `create_user_environment()` function | GOOD | Per-user catalog isolation logic is correct |
| Participant email loop | GOOD | Good automation approach for multi-user setup |

### `00_setup.ipynb` — Grade: B+

| Finding | Severity | Details |
|---------|----------|---------|
| Clean variable exports | GOOD | `CATALOG`, `BRONZE_SCHEMA`, `SILVER_SCHEMA`, `GOLD_SCHEMA`, `DATASET_PATH` |
| Validates catalog/schema/volume existence | GOOD | Guards against missing pre-configuration |
| No hardcoded secrets | GOOD | |

---

## 5. Dataset Audit

| File | Status | Notes |
|------|--------|-------|
| `customers/customers.csv` | OK | Main customer dataset |
| `customers/customers_new.csv` | OK | Used for MERGE / incremental demo |
| `customers/customers_extented.xlsx` | TYPO | Filename `_extented_` should be `_extended_`. File exists. |
| `orders/orders_batch.json` | OK | Main orders file |
| `orders/stream/*.json` (3 files) | OK | Streaming demo files |
| `products/products.csv` | OK | |
| `products/products.parquet` | OK | Referenced in M03 parquet section |
| `dataset/demo/ingestion/orders/stream/` | OK | Additional streaming files |
| `dataset/workshop/` | OK | Complete dataset for Final Lab |

---

## 6. Databricks Best Practices Compliance

| Practice | Status | Notes |
|----------|--------|-------|
| Unity Catalog 3-level namespace | CORRECT | Used throughout all notebooks |
| Volumes for file storage (not DBFS) | CORRECT | M01 explicitly teaches the migration from DBFS |
| Explicit schema (`StructType`) for production reads | CORRECT | Shown and recommended in M03 |
| Delta Lake as default format (no raw parquet writes) | CORRECT | |
| Auto Loader (`cloudFiles`) for streaming ingest | CORRECT | M03 streaming section |
| Full `MERGE INTO` pattern (all WHEN clauses) | CORRECT | M04 |
| `OPTIMIZE` + `ZORDER` for query performance | CORRECT | LAB_03 |
| `VACUUM` with retention period warning | CORRECT | Time Travel caveat noted |
| `enableChangeDataFeed` | CORRECT | M04 |
| Warning against `inferSchema=True` in production | CORRECT | M03 adds explicit note |
| `.collect()` danger on large DataFrames | NOT COVERED | Minor — could add a one-liner note in M02 |
| Job cluster vs All-Purpose cluster cost guidance | CORRECT | M01 cost section |
| Git Folders over Workspace root | CORRECT | M01 best practices section |

---

## 7. Critical Bug Tracker

| ID | Severity | File | Location | Description | Fix Required |
|----|----------|------|----------|-------------|--------------|
| BUG-01 | **CRITICAL** | `04_delta_fundamentals.ipynb` | `#VSC-04df1fd9` | `spark.table("customers_delta")` unqualified — throws `TABLE_OR_VIEW_NOT_FOUND` | Change to `spark.table(f"{CATALOG}.{BRONZE_SCHEMA}.customers_delta")` |
| BUG-02 | **CRITICAL** | `LAB_02_etl_pipeline.ipynb` | Task 08 | `F.hour(F.col("order_datetime"))` on `StringType` column — throws `AnalysisException` | Add `.cast("timestamp")`: `F.hour(F.col("order_datetime").cast("timestamp"))` |
| BUG-03 | **CRITICAL** | `setup/00_pre_config.ipynb` | Line 96 | `STORAGE_LOCATION` hardcoded to real production Azure ADLS endpoint | Replace with `STORAGE_LOCATION = ""` and add setup instructions in comments |
| BUG-04 | HIGH | `setup/00_pre_config.ipynb` | ~Line 90 | `TRAINING_GROUP = "admins"` — assigns privileged group to participants | Change to dedicated low-privilege group |
| BUG-05 | HIGH | `04_delta_fundamentals.ipynb` | `row_count = 10_000_000` | 10M row generation — OOM/timeout risk on training clusters | Reduce to `row_count = 500_000` |
| BUG-06 | MEDIUM | `03_medallion_ingestion.ipynb` | Title, `#VSC-5b1c0184`, def. cells, GUI section | Extensive Polish text throughout module | Translate all Polish sections to English |
| BUG-07 | MEDIUM | `00_intro.ipynb` | `#VSC-ee8ecbb8` | Polish print statements: `Uzytkownik`, `Katalog`, `Problem z katalogiem` | Translate to English |
| BUG-08 | MEDIUM | `07_aibi_dashboards.ipynb` | `#VSC-cd8679c8` lines 439-440 | Two Polish-language code comments | Translate to English |
| BUG-09 | MEDIUM | `04_delta_fundamentals.ipynb` | Schema evolution section | INSERT uses `customer_segment`/`customer_tier` before `ALTER TABLE ADD COLUMN` is run | Add explicit `ALTER TABLE ... ADD COLUMN` guard cell before INSERT |

---

## 8. Grading Summary

| Component | Grade | Score /10 |
|-----------|-------|-----------|
| M00 Welcome | B | 7.0 |
| M01 Platform | A- | 8.5 |
| M02 Spark Architecture | A | 9.0 |
| M03 ELT Ingestion | C+ | 6.0 |
| M04 Delta Lake | B- | 6.5 |
| M05 Orchestration | A- | 8.5 |
| M06 Unity Catalog | A- | 8.5 |
| M07 AI/BI Dashboards | B+ | 7.5 |
| LAB_01 Platform | A- | 8.5 |
| LAB_02 ETL Pipeline | B- | 6.5 |
| LAB_03 Delta Lifecycle | A- | 8.5 |
| LAB_FINAL | B+ | 7.5 |
| Setup Notebooks | C+ | 5.5 |
| Dataset Files | B+ | 7.5 |
| **OVERALL TRAINING** | **B-** | **7.3 / 10** |

---

## 9. Remediation Plan

### Priority 1 — Must Fix Before Any Live Session (~30 min total)

| ID | Task | File |
|----|------|------|
| P1-A | Fix `spark.table("customers_delta")` to use fully-qualified name | `04_delta_fundamentals.ipynb` |
| P1-B | Fix `F.hour()` on StringType: add `.cast("timestamp")` | `LAB_02_etl_pipeline.ipynb` |
| P1-C | Empty `STORAGE_LOCATION` hardcoded value + add setup comments | `setup/00_pre_config.ipynb` |
| P1-D | Replace `TRAINING_GROUP = "admins"` with low-privilege group | `setup/00_pre_config.ipynb` |
| P1-E | Reduce synthetic row count from 10M to 500K | `04_delta_fundamentals.ipynb` |

### Priority 2 — Fix Before Sharing Externally (~97 min total)

| ID | Task | File |
|----|------|------|
| P2-A | Translate M03 Polish sections (title + Medallion + definitions + GUI) | `03_medallion_ingestion.ipynb` |
| P2-B | Translate M00 Polish print statements | `00_intro.ipynb` |
| P2-C | Translate M07 Polish comment cell `#VSC-cd8679c8` | `07_aibi_dashboards.ipynb` |
| P2-D | Add `ALTER TABLE ADD COLUMN` guard before schema evolution INSERT | `04_delta_fundamentals.ipynb` |
| P2-E | Add AI Assistant demo section (5-10 min) to M01 | `01_platform_workspace.ipynb` |

### Priority 3 — Nice to Have

| ID | Task | File |
|----|------|------|
| P3-A | Rename `customers_extented.xlsx` to `customers_extended.xlsx` and update references | dataset + M03 |
| P3-B | Add timing estimates to LAB_01; mark Tasks 07-09 as optional | `LAB_01_platform.ipynb` |
| P3-C | Add `.collect()` large DataFrame warning to M02 | `02_spark_architecture.ipynb` |
| P3-D | Replace LAB_FINAL Workflow screenshots with text-based instructions | `LAB_FINAL.ipynb` |
| P3-E | Align orders row count reference ("100 000" vs "~5 000") between M03 and LAB_02 | M03 + LAB_02 |
| P3-F | Add `.gitignore` to prevent accidental commit of `00_pre_config.ipynb` | repo root |

---

## 10. Final Verdict

The training is **production-ready after fixing the 5 Priority-1 blockers** (estimated total effort: ~30 minutes).

The content is technically accurate, well-aligned with real-world Databricks usage patterns, and pedagogically sound. The lab suite is the strongest asset: practical, assert-validated, and built around the coherent RetailHub e-commerce scenario.

**Main weaknesses:**
1. Incomplete English translation in M03 (BUG-06)
2. Two code defects that will break live sessions: `spark.table()` unqualified (BUG-01) and `F.hour()` on StringType (BUG-02)
3. Setup notebook with exposed production Azure infrastructure credentials (BUG-03)

After Priority-1 + Priority-2 fixes, this training deserves a solid **B+ / 8.0 out of 10**.

---

*Report: static analysis of notebook sources, syllabus cross-reference, and Databricks best practices review.*
