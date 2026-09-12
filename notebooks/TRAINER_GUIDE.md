# Trainer Guide — Databricks Fundamental
## In-place BONUS banners: Core + optional

**Goal:** Fit the whole syllabus — including the Final Project and AI/BI Dashboards — into one day.
**Approach:** Insert `⊕ BONUS` skip banners directly in the existing notebooks. Nothing is deleted
and nothing is duplicated into separate files; the trainer decides live what to cover.
**Net time freed:** ~2h 23min. See *Time Savings — Summary* at the end for the current numbers.

> **Status:** implemented 11 September 2026 — 15 banners across M01–M04. M06 was trimmed to
> fundamentals instead (sections removed, not bannered) — see the M06 section below.
> The per-module tables below are the original design notes; the **cell numbers in them predate
> the banner inserts** and have since shifted. Locate sections by heading, not by number.

---

## How to Read This Guide

| Symbol | Meaning |
|--------|---------|
| `⊕ BONUS` | Skip in standard 1-day training; use for 2-day or advanced groups |
| `✅ CORE` | Always cover — mandatory for Fundamentals certification readiness |
| Cell N | Jupyter cell number (1-based) in the notebook |

---

## Module-by-Module Plan

---

### M01 — Platform & Workspace (`01_platform_workspace.ipynb`)

**Core structure is solid. One section → BONUS.**

| # | Section | Cell(s) | Action | Why | Time saved |
|---|---------|---------|--------|-----|-----------|
| 1 | `### Parameterization with Databricks Widgets` | 62–66 | `⊕ BONUS` marker before cell 62 | Widgets are covered again in M05 Orchestration with full context (jobs, parameters). Introducing them in M01 adds ~10 min with no immediate payoff. | **10 min** |

**Banner to insert (new markdown cell before cell 62):**
```markdown
---
> ⊕ **BONUS — Parameterization with Widgets**
> 
> Skip in standard schedule. Widgets are explained in depth in **Module 05 — Orchestration** (job parameters, task values).  
> Cover here only if the group has time or asks about interactive notebooks.
---
```

---

### M02 — Spark Architecture (`02_spark_architecture.ipynb`)

**Three sections → BONUS. Core stays: Driver/Executors, Lazy Evaluation, DAG/Stages, Spark UI.**

| # | Section | Cell(s) | Action | Why | Time saved |
|---|---------|---------|--------|-----|-----------|
| 1 | `### Adaptive Query Execution — AQE (runtime)` (part of section 4) | 21 (AQE subsection), 23, 24 | `⊕ BONUS` marker + keep Catalyst intro as CORE | AQE is Professional-level (runtime joins, skew handling). The Catalyst intro at high level is Fundamental. | **15 min** |
| 2 | `# Full plan with Catalyst optimizations` (`explain(True)` deep dive) | 13 | `⊕ BONUS` marker before cell 13 | Reading the full physical plan (`explain(True)`) is useful for debugging but not required at Fundamental level. `explain()` without parameter = CORE. | **10 min** |
| 3 | `## Bonus — Cache and Persist` | 27–29 | Already marked "Bonus" — add standard `⊕` banner | Cell 27 header already says "Bonus". Add the trainer-skip banner for consistency. | **10 min** |

**Banner template (AQE — insert as new markdown cell before AQE subsection inside cell 21 content, or as a new cell after cell 22):**
```markdown
---
> ⊕ **BONUS — Adaptive Query Execution (AQE)**
>
> Skip in standard schedule. AQE (runtime join reordering, skew handling) is an **Associate/Professional** topic.  
> For Fundamental: it is enough to know that Catalyst optimizes the plan before execution.  
> Cells 23–24 can be skipped. Return here for advanced groups.
---
```

**Banner template (explain deep dive — insert as new markdown cell before cell 13):**
```markdown
---
> ⊕ **BONUS — Full Execution Plan (`explain(True)`)**
>
> Skip in standard schedule. Reading the physical plan in detail is a debugging skill for **advanced users**.  
> Core message: *Spark has an optimizer* — no need to read the plan output.
---
```

---

### M03 — ELT & Ingestion (`03_medallion_ingestion.ipynb`)

**Five sections → BONUS. Largest time savings. Core stays: CSV/JSON/Parquet, Transformations, Filter, Aggregations, Temp Views, Write to Delta.**

| # | Section | Cell(s) | Action | Why | Time saved |
|---|---------|---------|--------|-----|-----------|
| 1 | `### Extended Reader Options` | 13 | `⊕ BONUS` marker before cell 13 | The full table of all CSV options (sep, escape, multiLine, etc.) is reference material, not training content. Show Auto Inference + Manual Schema (cells 10–12, 14–16) as CORE. | **10 min** |
| 2 | `## Excel Import (Extended Customers)` | 29–31 | `⊕ BONUS` marker before cell 29 | Requires an external library (`spark-excel`), rarely used in modern Databricks (use CSV exports). Creates confusion about standard read formats. | **8 min** |
| 3 | `## Performance: inferSchema vs Manual Schema` | 32–35 | `⊕ BONUS` marker before cell 32 | The benchmark comparing infer vs manual schema time is a good advanced demo but not critical for understanding. Mention the concept verbally (30 sec) and move on. | **8 min** |
| 4 | `### fillna / na.drop — Handling Missing Values` | 65–66 | `⊕ BONUS` marker before cell 65 | Null handling is important but goes beyond the ELT intro scope. `isNull/isNotNull` (cell 63–64) = CORE. `fillna/dropna` = BONUS. | **5 min** |
| 5 | `### Global Temporary Views` | 85–87 | `⊕ BONUS` marker before cell 85 | Global Temp Views are rarely used — they survive cluster restart scope. Standard Temp Views (cells 77–84) = CORE. | **5 min** |

**Banner template (Extended Reader Options — insert as new markdown cell before cell 13):**
```markdown
---
> ⊕ **BONUS — Extended CSV Reader Options**
>
> Skip in standard schedule. This table lists all available CSV options (sep, escape, nullValue, etc.).  
> It is reference material — point participants to [Databricks documentation](https://docs.databricks.com) instead.  
> CORE path: Auto Inference → Manual Schema → `read_files()`.
---
```

**Banner template (Excel Import — insert as new markdown cell before cell 29):**
```markdown
---
> ⊕ **BONUS — Excel Import**
>
> Skip in standard schedule. Excel import requires the `spark-excel` external library and is rarely used  
> in production Databricks environments (prefer CSV/Parquet exports from Excel).  
> Cover only if the group specifically works with Excel data sources.
---
```

**Banner template (Performance benchmark — insert as new markdown cell before cell 32):**
```markdown
---
> ⊕ **BONUS — Performance: inferSchema vs Manual Schema (Benchmark)**
>
> Skip in standard schedule. The benchmark measures wall-clock time difference between auto and manual schema.  
> Core message (verbal, 30 sec): *"inferSchema scans the file twice — for large files prefer manual schema."*  
> Return here for groups interested in performance tuning.
---
```

**Banner template (fillna/dropna — insert as new markdown cell before cell 65):**
```markdown
---
> ⊕ **BONUS — fillna / dropna — Replacing and Dropping Nulls**
>
> Skip in standard schedule. `isNull` / `isNotNull` (above) cover the Fundamental use case.  
> `fillna` and `dropna` are Silver-layer data quality patterns — better covered in the Silver workshop.
---
```

**Banner template (Global Temp Views — insert as new markdown cell before cell 85):**
```markdown
---
> ⊕ **BONUS — Global Temporary Views**
>
> Skip in standard schedule. Global Temp Views share state across sessions within the same cluster.  
> They are rarely needed at Fundamental level — standard Temp Views (`createOrReplaceTempView`) cover 99% of use cases.
---
```

---

### M04 — Delta Lake Basics (`04_delta_fundamentals.ipynb`)

**Three sections → BONUS. Core stays: CRUD, MERGE, DESCRIBE DETAIL, History, Time Travel, VACUUM, Managed Tables.**

| # | Section | Cell(s) | Action | Why | Time saved |
|---|---------|---------|--------|-----|-----------|
| 1 | `### Example: Identity and Generated Columns` | 28–34 | `⊕ BONUS` marker before cell 28 | Identity columns (auto-increment) and Generated columns (computed expressions) are advanced DDL features. Not tested in Fundamentals exam. Heavy cluster load (500k row INSERT). | **12 min** |
| 2 | `### Example: Delta Log Internals (Deep Dive)` | 61–63 | `⊕ BONUS` marker before cell 61 | Reading raw `_delta_log/` JSON files is an internals deep dive. Great for demystifying Delta but not required knowledge for Fundamental. | **12 min** |
| 3 | `### External Table` (part of `## Managed vs External Tables`) | 93–95 | `⊕ BONUS` marker before cell 93 | External tables require an External Location in Unity Catalog — typically an admin task. In training clusters this cell often fails with `PermissionDenied`. Keep `## Managed Table` demo (cell 92) as CORE. | **8 min** |

**Banner template (Identity/Generated Columns — insert as new markdown cell before cell 28):**
```markdown
---
> ⊕ **BONUS — Identity Columns and Generated Columns**
>
> Skip in standard schedule. This demo creates a 500K-row table and showcases advanced DDL syntax  
> (auto-increment IDs, computed hash columns). These features are **not covered in the Fundamentals exam**.  
> Return here for groups building production data models.
---
```

**Banner template (Delta Log Internals — insert as new markdown cell before cell 61):**
```markdown
---
> ⊕ **BONUS — Delta Log Internals (`_delta_log/`)**
>
> Skip in standard schedule. This deep dive reads raw JSON transaction logs from `_delta_log/`.  
> Core message (verbal): *"Every Delta operation is recorded as a JSON file — that's what enables Time Travel."*  
> Return here for engineers who want to understand Delta's ACID guarantees at the storage level.
---
```

**Banner template (External Tables — insert as new markdown cell before cell 93):**
```markdown
---
> ⊕ **BONUS — External Tables**
>
> Skip in standard schedule. External Tables require a configured **External Location** in Unity Catalog  
> (admin permission). This cell will raise `PermissionDenied` on most training clusters.  
> Core message: *"Managed Tables = Databricks manages the data lifecycle. Use them by default."*
---
```

---

### M06 — Unity Catalog & Governance (`06_unity_catalog.ipynb`)

> **Superseded (11.09.2026).** The Delta Sharing banner designed below was never kept: M06 was cut
> down to the syllabus minimum — catalogs/schemas, account groups, `GRANT` / `SHOW GRANTS` / `REVOKE`.
> Removed outright: Comments & Tags, PII tag query, Data Lineage, Delta Sharing, and the data loading
> that only existed to feed them (38 → 17 cells).
>
> **Two prerequisites the old module silently lacked:**
> - An **account group** `retailhub_analysts`, created by the trainer in Settings → Identity and access →
>   Groups. SQL `CREATE GROUP` and the Workspace Groups API create *workspace-local* groups, which Unity
>   Catalog cannot grant to (`PRINCIPAL_DOES_NOT_EXIST`). `00_pre_config` Step 2b checks this.
> - **`MANAGE` on each participant's catalog.** The trainer owns the catalogs, and `ALL PRIVILEGES` does
>   not include `MANAGE`, so participants could not grant anything. `00_pre_config` now grants it.
>   Re-run `00_pre_config` on workspaces set up before this change.

*Original design notes:*

**One section → BONUS (detail level). Core intro to concept stays.**

| # | Section | Cell(s) | Action | Why | Time saved |
|---|---------|---------|--------|-----|-----------|
| 1 | `## Delta Sharing` (full detail) | 35 | `⊕ BONUS` marker at the start of cell 35 | The concept intro (what Delta Sharing solves, key terms) is worth 2 min verbally. The full demo (CREATE SHARE, ADD TABLE, CREATE RECIPIENT, etc.) is Associate/Platform Admin level. | **10 min** |

**Banner to insert at the top of cell 35 source:**
```markdown
---
> ⊕ **BONUS — Delta Sharing (Full Demo)**
>
> **Core (2 min verbal):** Delta Sharing lets you share Delta tables with external organizations  
> without copying data. Recipient gets read-only access via an open protocol (no Databricks account needed).  
>
> Skip the SQL demo below in standard schedule. Cover in full for:
> - Groups with data sharing / cross-org analytics use cases
> - 2-day advanced format
---
```

---

## Part C — Bonus Notebooks (workshops/bonus/) — NOT BUILT

> ⛔ **Rejected during implementation.** The in-place banners keep every section in its original
> module, which serves advanced groups just as well without maintaining two copies of the same
> content. The outline below is kept only as a record of the option that was considered.

### `workshops/bonus/BONUS_spark_internals.ipynb`
Content from M02:
- Catalyst Optimizer — how the logical → physical plan compilation works
- `explain(True)` — reading the full query plan
- Adaptive Query Execution (AQE) — runtime join reordering, skew partition handling
- Cache & Persist — storage levels (MEMORY_ONLY, MEMORY_AND_DISK, DISK_ONLY)

**Target audience:** Engineers debugging slow Spark jobs; groups attending 2-day format.

---

### `workshops/bonus/BONUS_advanced_ingestion.ipynb`
Content from M01 + M03:
- Databricks Widgets — parameterizing notebooks interactively
- All CSV reader options (sep, escape, nullValue, emptyValue, multiLine, dateFormat, etc.)
- Excel Import with `spark-excel` library
- inferSchema vs Manual Schema — timing benchmark
- `fillna` / `dropna` — full null handling patterns
- Global Temporary Views — cross-session shared views

**Target audience:** Data engineers building production ingestion pipelines.

---

### `workshops/bonus/BONUS_delta_advanced.ipynb`
Content from M04 + M06:
- Identity Columns (auto-increment surrogate keys)
- Generated Columns (computed expressions stored in Delta)
- Delta Log Internals — reading `_delta_log/` JSON files manually
- External Tables — setup, External Locations, when to use vs Managed
- Delta Sharing — full demo: CREATE SHARE → ADD TABLE → ACTIVATE RECIPIENT

**Target audience:** Data engineers / platform admins; Databricks Associate exam preparation.

---

## Trainer Schedule — Standard 1-Day

Mirrors the participant-facing agenda in `notebooks/modules/00_intro.ipynb` — keep the two in sync.

| Time | Module | Notes |
|------|--------|-------|
| 09:00–09:15 | Intro + Setup | `00_setup.ipynb` |
| 09:15–10:15 | M01 — Platform & Workspace | Skip 4 BONUS: Widgets, SQL Warehouse (dup), `%pip`, PySpark-vs-SQL |
| 10:15–10:30 | ☕ Break | |
| 10:30–10:55 | M02 — Spark Architecture | Skip 3 BONUS: `explain(True)`, AQE, Cache/Persist |
| 10:55–11:40 | M03 — ELT & Ingestion | Skip 5 BONUS: Extended Options, Excel, Benchmark, fillna, Global Views |
| 11:40–12:20 | 🍽️ Lunch | |
| 12:20–13:00 | **Workshop: Ingestion** | 12 tasks + CHECK assertions |
| 13:00–13:40 | M04 — Delta Fundamentals | Skip 3 BONUS: Identity Cols, Delta Log, External Tables |
| 13:40–14:05 | **Workshop: Delta Lake** | 12 tasks + CHECK assertions |
| 14:05–14:15 | ☕ Break | |
| 14:15–14:50 | M05 — Orchestration | Full coverage. **Gap:** no Scheduling/CRON section — cover it verbally, or in the Final Project (Step 3.7) |
| 14:50–15:10 | M06 — Unity Catalog | Groups + GRANT/REVOKE only. Requires the `retailhub_analysts` account group (00_pre_config Step 2b) |
| 15:10–16:00 | **Final Project** | Syllabus §6 — **core, not optional** |
| 16:00–16:25 | M07 — AI/BI Dashboards | Syllabus §3 — **core, not BONUS** |
| 16:25–16:40 | Q&A + Summary | |

**Net teaching time: 6h 35min** + 65 min breaks/lunch.

---

## Implementation Checklist

**Part A + B — BONUS banners (done 11.09.2026):**

- [x] M01 — 4 banners (Widgets, SQL Warehouse duplicate, `%pip`, PySpark vs SQL) + trainer note on the duplicated *Platform Elements* opener
- [x] M02 — 3 banners (`explain(True)`, AQE, Cache & Persist)
- [x] M03 — 5 banners (Extended Options, Excel, Benchmark, fillna, Global Temp Views)
- [x] M04 — 3 banners (Identity/Generated Columns, Delta Log Internals, External Tables)
- [x] M06 — trimmed to groups + GRANT/REVOKE (38 → 17 cells); Comments, Tags, PII query, Lineage, Delta Sharing and data loading removed
- [x] `00_pre_config` — grants `MANAGE` to participants; Step 2b verifies the demo group is an account group
- [x] `00_setup` — exports `ANALYSTS_GROUP`
- [x] Verified: every banner sits directly before its section; no CORE cell depends on a variable defined in a BONUS cell
- [x] Agenda rewritten in `00_intro.ipynb` — Final Project and M07 moved into the core programme

**Rejected during implementation:**

- ⛔ **M07 — Preparing Demo Data.** Planned as BONUS, then reverted: `demo_sales_table` is not a
  fallback but the dataset the whole module runs on. The Final Project's `gold.lab_daily_orders`
  has a different schema (no `region`, no `product_category`), so it cannot replace it.
- ⛔ **Part C — `workshops/bonus/*.ipynb`.** Not built. Banners keep the content in place, which
  achieves the same result without maintaining two copies of every section.

**Still open:**

- [ ] M05 — add the missing Scheduling/CRON section (the module's own Learning Objectives promise it)
- [ ] M03 — add the `show()` / `describe()` / `summary()` demo the Topics table promises
- [ ] Verify the Jobs UI screenshots in M05 and the Final Project against the updated Lakeflow Jobs UI (GA 12.2025)
- [x] Regenerated the `docs/` PDFs (12.09.2026): new layout, English and Polish versions in `docs/ENG/` and `docs/PL/`, built from `utilization/en` and `utilization/pl` with `scripts/build_pdfs.sh`
- [ ] Test run: complete the core path within the 6h 35min budget

---

## Time Savings — Summary

| Module | Sections → BONUS | Time saved |
|--------|-----------------|-----------|
| M01 | Widgets, SQL Warehouse (dup), `%pip`, PySpark vs SQL, Platform Elements note | 30 min |
| M02 | AQE, `explain(True)`, Cache/Persist | 35 min |
| M03 | Extended Options, Excel, Benchmark, fillna, Global Views | 36 min |
| M04 | Identity Columns, Delta Log Internals, External Tables | 32 min |
| M06 | Removed: Comments & Tags, PII query, Lineage, Delta Sharing, data loading (est.) | 25 min |
| **Cuts total** | **15 banners + M06 trim** | **~2h 38min** |
| Added back | Genie Code rewrite, DBFS deprecation, `%skip` | −15 min |
| **Net freed** | | **~2h 23min** |

Reallocated: Final Project 30 → 50 min, M07 BONUS → core 25 min, M05 20 → 35 min, M06 10 → 20 min.
