# Databricks Fundamental

**One-day Databricks training** — from zero to a working data pipeline in the Medallion architecture (Bronze / Silver / Gold).

Business scenario: fictional company **RetailHub** — an online clothing store with customer, order, and product data.

---

## Table of Contents

- [About the Training](#about-the-training)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Training Schedule](#training-schedule)
- [Repository Structure](#repository-structure)
- [Datasets](#datasets)
- [Additional Materials](#additional-materials)
- [Next Steps](#next-steps)

---

## About the Training

| | |
|---|---|
| **Duration** | 1 day, 09:00–16:40: 6 h 35 min of teaching and workshops + 65 min of breaks |
| **Level** | Fundamental (beginner) |
| **Notebook language** | Python (PySpark) + SQL |
| **Environment** | Azure Databricks with Unity Catalog, or Databricks Free Edition for self-study |
| **Scenario** | RetailHub — customers, orders, products |

### Learning Objectives

After completing the training, participants will be able to:

- Navigate the workspace: notebooks, Git folders, Catalog Explorer, SQL Editor
- Choose compute (Serverless, classic cluster, SQL warehouse) and control costs: job vs all-purpose compute, autoscaling, auto-termination
- Use Unity Catalog's three-level namespace (`catalog.schema.table`) and Volumes for files
- Explain how Spark runs your code: driver and executors, lazy evaluation, one engine for SQL and PySpark
- Load CSV and JSON with an explicit schema and write the result to a Delta table (medallion architecture)
- Explore data with `display()`, `show()`, `describe()`, `summary()`, Edit Chart and Data Profile
- Transform data with `select`, `filter`, `withColumn`, `cast` / `try_cast`, `when`, `groupBy`, each with its SQL equivalent
- Ask Genie Code (formerly Databricks Assistant) to explain, write and fix code
- Change and recover Delta tables: INSERT, UPDATE, DELETE, MERGE, history, time travel, RESTORE
- Build a Lakeflow Job (formerly Workflows) with tasks, parameters, a schedule and a repair run
- Grant access with account groups: `GRANT`, `SHOW GRANTS`, `REVOKE`
- See how a Genie Agent answers natural-language questions on Gold data (optional trainer demo)

---

## Prerequisites

- Basic knowledge of SQL (no Python experience needed)
- General understanding of databases and data analysis
- Access to a Databricks environment (configured by the trainer before the session)

---

## Quick Start

> **Learning on your own?** The course is written to run on Databricks Free Edition (tested status: pending).
> See the self-study guide: [English](docs/ENG/free_edition_guide.pdf) | [Polski](docs/PL/free_edition_guide.pdf).

### 1. Environment setup (trainer, or you in self-study)

```
notebooks/setup/00_pre_config.ipynb
```

Run once before the training; in self-study set `SINGLE_USER_MODE = True` in its configuration cell first. It creates a catalog `retailhub_<name>` per participant with the schemas
`bronze`, `silver`, `gold` and `default`, the Volume `default.datasets`, and copies the `dataset/` files into it.

### 2. Clone the repository as a Git folder

Workspace → Home → **Create** → **Git folder** → `https://github.com/ditw-training/databricks-fundamental`.
Step-by-step instructions are in `notebooks/modules/00_intro.ipynb`.

### 3. Environment check

Open `notebooks/modules/00_intro.ipynb` and run the environment check. It calls the same setup notebook that every module uses:

```python
%run ../setup/00_setup
```

```python
print(f"Your catalog: {CATALOG}")
```

`00_setup` finds your catalog, checks the schemas and the Volume, and prints the catalog name.
Use that printed name wherever the materials say `retailhub_<your_name>`.

---

## Training Schedule

Same agenda as in `notebooks/modules/00_intro.ipynb`.

| Time | Block | Topics |
|------|-------|--------|
| 09:00 – 09:15 | **M00** Intro | Objectives, agenda, environment check |
| 09:15 – 10:20 | **M01** Platform, costs, GUI | Platform, workspace, Volumes, compute and costs, notebook GUI, Genie Code |
| 10:20 – 10:35 | **M02** How Spark works | How Spark runs your code; one engine for SQL and PySpark |
| 10:35 – 10:50 | Break | |
| 10:50 – 11:45 | **M03** Medallion + ingestion | Python primer, reading CSV/JSON, transforming data, writing to Delta |
| 11:45 – 12:25 | **Workshop 1 — Ingestion** | At most 8 tasks, the rest ⭐ OPTIONAL |
| 12:25 – 13:05 | Lunch | |
| 13:05 – 13:45 | **M04** Delta Lake | Delta tables, changing data, MERGE, history, time travel, RESTORE |
| 13:45 – 14:20 | **Workshop 2 — Delta Lake** | 7 tasks in SQL, the rest ⭐ OPTIONAL |
| 14:20 – 14:30 | Break | |
| 14:30 – 15:05 | **M05** Lakeflow Jobs | A job from ready notebooks: parameters, schedule, repair run |
| 15:05 – 15:20 | **M06** Unity Catalog | Groups and permissions: `GRANT`, `SHOW GRANTS`, `REVOKE` |
| 15:20 – 16:25 | **Final Project** | Bronze → Silver → Gold pipeline as a scheduled job; ready solutions if you fall behind |
| 16:25 – 16:40 | Wrap-up, quiz, next steps | |
| (optional) | **M07** Genie Agents / dashboard | Trainer demo, only if time is left |

Detailed topics and minutes per block: `notebooks/TRAINER_GUIDE.md`.

**Teaching time: 395 min (6 h 35 min)** plus 65 min of breaks and lunch. Sections marked ⊕ BONUS in the
notebooks are outside this schedule and stay in the material for self-study.

---

## Repository Structure

```
Databricks-Fundamental/
|
| notebooks/
|   modules/                      # Instructor demo notebooks
|   |   00_intro.ipynb            # Objectives, agenda, environment check
|   |   01_platform_workspace.ipynb  # Workspace, compute, costs, Volumes, charts, Genie Code
|   |   02_spark_architecture.ipynb  # Driver/executors, lazy evaluation, same engine for SQL and PySpark
|   |   03_medallion_ingestion.ipynb # Medallion, CSV/JSON, exploration, transformations, write to Delta
|   |   04_delta_fundamentals.ipynb  # DML, MERGE, history, time travel, RESTORE
|   |   05_orchestration_jobs.ipynb  # Lakeflow Jobs: tasks, parameters, schedule, repair run
|   |   06_unity_catalog.ipynb       # Account groups, GRANT / SHOW GRANTS / REVOKE
|   |   07_aibi_dashboards.ipynb     # Optional trainer demo: Genie Agents, dashboards
|   |
|   workshops/                    # Hands-on exercises (participants)
|   |   WORKSHOP_ingestion.ipynb  # After M03
|   |   WORKSHOP_delta.ipynb      # After M04
|   |   final_labs/
|   |       WORKSHOP_final_project.ipynb  # After M06 — final project
|   |       tasks/
|   |           lab_task_01_bronze.ipynb  # Task: Bronze layer
|   |           lab_task_02_silver.ipynb  # Task: Silver layer
|   |           lab_task_03_gold.ipynb    # Task: Gold layer
|   |
|   setup/
|       00_pre_config.ipynb       # Pre-training configuration (trainer)
|       00_setup.ipynb            # Participant environment setup
|       99_test_runner.ipynb      # Runs the module notebooks on a cluster (trainer)
|
| dataset/                        # Input data for exercises
|   customers/
|   |   customers.csv             # 10,000 records — historical customer data
|   |   customers_new.csv         # 114 records — batch update (MERGE demo)
|   |   customers_extented.xlsx   # Excel import demo (M03 BONUS; the typo in the name is intentional)
|   orders/
|   |   orders_batch.json         # 100,000 orders — JSON Lines (batch)
|   |   stream/                   # Orders — JSON format (3 streaming files)
|   products/
|       products.csv              # 2,000 records — product catalog
|       products.parquet          # Same catalog in Parquet (M03)
|
| docs/                           # PDF reference documents
|   ENG/                          # English versions
|   |   cheatsheet_databricks_fundamental.pdf  # Reference guide for all modules
|   |   quiz_databricks_fundamental.pdf        # Quiz: 40 questions (answers in the Workshop Guide app)
|   |   next_steps.pdf                         # What to learn next
|   |   external_connection_guide.pdf          # Connecting Unity Catalog to ADLS Gen2
|   |   pyspark_vs_sparksql.pdf                # Module 03 in PySpark and Spark SQL
|   |   free_edition_guide.pdf                 # Self-study in Databricks Free Edition
|   PL/                           # Polish versions (same documents + Databricks_Fundamentals_Altkom_PL.pdf slides)
|
| materials/
|   orchestration/                # Ready task notebooks for the Lakeflow Jobs demo (M05)
|       task_01_validate.ipynb
|       task_02_transform.ipynb
|       task_03_report.ipynb
|   volume_upload/                # Files for the M01 Volume upload demo (not copied by setup)
|       stores.csv
|       promotions.json
|
| assets/
|   images/                       # Screenshots used in notebooks
```

---

## Datasets

All data belongs to the fictional company **RetailHub**.

| File | Format | Records | Description |
|------|--------|---------|-------------|
| `dataset/customers/customers.csv` | CSV | 10,000 | Customers (ID, name, email, city, segment) |
| `dataset/customers/customers_new.csv` | CSV | 114 | New/updated customers — used in MERGE demo |
| `dataset/orders/orders_batch.json` | JSON Lines | 100,000 | Orders (ID, customer, product, amount, payment) |
| `dataset/orders/stream/*.json` | JSON | 3 files | Simulated streaming orders |
| `dataset/products/products.csv` | CSV | 2,000 | Product catalog (ID, name, price, brand) |

### Data Schemas

**customers.csv**
```
customer_id, first_name, last_name, email, phone,
city, state, country, registration_date, customer_segment
```

**orders_batch.json**
```json
{
  "order_id": "ORD00000001",
  "customer_id": "CUST005909",
  "product_id": "PROD000164",
  "store_id": "STORE017",
  "order_datetime": "2024-12-31T23:56:00",
  "quantity": 1,
  "unit_price": 206.74,
  "discount_percent": 0,
  "total_amount": 206.74,
  "payment_method": "Cash"
}
```

**products.csv**
```
product_id, product_name, subcategory_code, brand,
unit_cost, list_price, weight_kg, status
```

---

## Additional Materials

### docs/

Reference documents in two language versions with identical file names: `docs/ENG/` (English) and `docs/PL/` (Polish). The training slides are in Polish: `docs/PL/Databricks_Fundamentals_Altkom_PL.pdf`.

| File | When to use |
|------|-------------|
| `cheatsheet_databricks_fundamental.pdf` | Reference guide for all modules: PySpark, Delta Lake SQL, Lakeflow Jobs, Unity Catalog |
| `quiz_databricks_fundamental.pdf` | Self-assessment after the training: 40 questions; answers and explanations in the Workshop Guide app |
| `next_steps.pdf` | What to learn next: Free Edition, accreditation and certification, Auto Loader, Lakeflow Connect, pipelines, liquid clustering |
| `external_connection_guide.pdf` | Step-by-step connection of Unity Catalog to ADLS Gen2 |
| `pyspark_vs_sparksql.pdf` | Module 03 operations shown side by side in PySpark and Spark SQL |
| `free_edition_guide.pdf` | Taking the whole course on your own in Databricks Free Edition: setup, module-by-module notes, jobs, troubleshooting |

The PDFs are built with `scripts/build_pdfs.sh` (pandoc and WeasyPrint) from Markdown sources kept outside the repository.

### materials/orchestration/

Three ready task notebooks for the Lakeflow Jobs demo (M05). They use the Databricks sample table `samples.nyctaxi.trips`:
- `task_01_validate.ipynb` — validates the source row count and passes it on as a task value
- `task_02_transform.ipynb` — adds trip duration and cost per mile, passes the averages on as task values
- `task_03_report.ipynb` — prints the report, including the values from the transform task

### materials/volume_upload/

Two small files for the M01 demo *Upload your own files to a Volume*. `00_pre_config` copies only `dataset/`,
so these files are not in any Volume: the trainer uploads them in Catalog Explorer as a short demo.
Participants can download them from GitHub, or run the copy cell in M01, which copies them from their own Git folder:
- `stores.csv` — 100 RetailHub stores (`store_id` matches `orders_batch.json`)
- `promotions.json` — 7 promotions for Dec 2024 – Jan 2025, JSON Lines

---

## Next Steps

| Step | What | When |
|------|------|------|
| 1 | Repeat the workshops and the Final Project in **Databricks Free Edition** (`docs/ENG/free_edition_guide.pdf`) | Week 1–2 |
| 2 | **Databricks Fundamentals** at Databricks Academy: free self-paced course, then a short accreditation quiz | Week 2–3 |
| 3 | **Databricks Explorer**, the follow-up Altkom course | Month 1–2 |
| 4 | **Associate** certification: Data Engineer Associate, or Data Analyst Associate for analysts and BI | Month 3+ |

[databricks.com/learn/training](https://www.databricks.com/learn/training): free self-paced courses and practice exams.
Topics to explore next (Auto Loader, Lakeflow Connect, Lakeflow Spark Declarative Pipelines, liquid clustering and
predictive optimization, streaming, advanced Unity Catalog, MLflow) are described with code in `docs/ENG/next_steps.pdf`.

---

## Trainer Notes

### Environment Preparation

1. Create the **account group** `retailhub_analysts` (Settings → Identity and access → Groups) for the M06 GRANT demo.
   SQL `CREATE GROUP` creates a workspace-local group that Unity Catalog cannot grant to.
2. Set the training group and the storage location in the configuration cell of `notebooks/setup/00_pre_config.ipynb`
   (keep real values out of the repository), then run it. It creates for every participant the catalog `retailhub_<name>`
   with the schemas `bronze`, `silver`, `gold`, `default`, the Volume `default.datasets` with a copy of `dataset/`,
   and grants `ALL PRIVILEGES` + `MANAGE` on the catalog. No manual upload is needed.
3. At the start of the day participants run the environment check in `00_intro`. Every module calls `00_setup` with `%run`.

The trainer run sheet (minutes, CORE and BONUS per module) is in `notebooks/TRAINER_GUIDE.md`.

### Notebook Tests

```
notebooks/setup/99_test_runner.ipynb
```

Run after making changes to notebooks. It executes the module notebooks on a cluster; it does not cover the workshops or the jobs.

---

*Repository prepared for the Altcom training — Databricks Fundamental.*
