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
| **Duration** | 1 day (~7 hours) |
| **Level** | Beginner |
| **Notebook language** | Python (PySpark) + SQL |
| **Environment** | Databricks on Azure (Unity Catalog) |
| **Scenario** | RetailHub — customers, orders, products |

### Learning Objectives

After completing the training, participants will be able to:

- Navigate the Databricks environment — notebooks, clusters, SQL Warehouse, Catalog Explorer
- Explain the difference between Serverless and classic compute, and when to use SQL Warehouse
- Understand the Lakehouse architecture — Medallion (Bronze/Silver/Gold) with Delta Lake
- Load data from CSV and JSON (`spark.read`) and write to Delta tables
- Explore data with `display()`, `show()`, `describe()` and GUI visualizations
- Apply basic PySpark transformations: `withColumn`, `when`, `cast`, `filter`
- Understand Delta Lake: ACID, Time Travel, MERGE, Managed vs External Tables
- Manage costs — cluster types, autoscaling, auto-termination
- Create and run a simple Workflow — parameterization, scheduling, Lakeflow
- Use Unity Catalog — schemas, permissions, Lineage, Delta Sharing
- Build an AI/BI Dashboard and Genie Space on Gold data

---

## Prerequisites

- Basic knowledge of SQL
- General understanding of databases and data analysis
- Access to a Databricks environment (configured by the trainer before the session)

---

## Quick Start

> **Learning on your own?** The whole course runs on Databricks Free Edition —
> see the self-study guide: [English](docs/ENG/free_edition_guide.pdf) | [Polski](docs/PL/free_edition_guide.pdf).

### 1. Environment setup (trainer)

```
notebooks/setup/00_pre_config.ipynb
```

Run once before the training — creates Unity Catalog catalogs for all participants.

### 2. Participant setup

```
notebooks/setup/00_setup.ipynb
```

Run at the beginning of the session — validates the catalog, schemas, and Volume.

### 3. Environment verification

In `notebooks/modules/00_intro.ipynb`, run the verification cell:

```python
username = spark.sql("SELECT current_user()").first()[0].split("@")[0].replace(".", "_")
catalog  = f"retailhub_{username}"
spark.sql(f"USE CATALOG {catalog}")
```

Expected result: catalog `retailhub_<your_username>` with three schemas: `bronze`, `silver`, `gold`.

---

## Training Schedule

| Time | Module | Topics |
|------|--------|--------|
| 09:00 – 09:15 | **M00** Intro & Setup | Agenda, environment verification, catalog check |
| 09:15 – 10:30 | **M01** Platform & Workspace | Workspace, notebooks, Serverless, SQL Warehouse, DBFS vs Volumes, cost management |
| 10:30 – 10:45 | Break | |
| 10:45 – 11:15 | **M02** Spark Architecture | Driver & Executors, Lazy Evaluation, DAG, Catalyst Optimizer |
| 11:15 – 12:00 | **M03** ELT & Ingestion | Medallion Architecture, loading CSV/JSON/Parquet, transformations, `display()` + GUI Viz |
| 12:00 – 12:45 | Lunch | |
| 12:45 – 13:30 | **Workshop: Ingestion** | Platform navigation, first cells, dbutils, Catalog Explorer, data loading |
| 13:30 – 14:15 | **M04** Delta Lake | ACID, Time Travel, MERGE, Managed vs External, VACUUM |
| 14:15 – 14:45 | **Workshop: Delta Lake** | Time Travel, MERGE, VACUUM — hands-on |
| 14:45 – 15:00 | Break | |
| 15:00 – 15:20 | **M05** Orchestration + Lakeflow | Workflows (Jobs), parameterization, scheduling, Lakeflow Pipelines |
| 15:20 – 15:30 | **M06** Unity Catalog | 3-level namespace, permissions, Row/Column Security, Lineage, Delta Sharing |
| 15:30 – 16:00 | **Final Workshop** | End-to-end pipeline: Bronze → Silver → Gold |
| *(if time allows)* | **Wrap-up + M07 BONUS** | Summary, next steps, AI/BI Dashboards, Genie Space |

---

## Repository Structure

```
Databricks-Fundamental/
|
| notebooks/
|   modules/                      # Instructor demo notebooks
|   |   00_intro.ipynb            # Agenda, schedule, environment verification
|   |   01_platform_workspace.ipynb  # Workspace, Serverless, SQL Warehouse, costs
|   |   02_spark_architecture.ipynb  # Driver/Executors, Lazy Eval, DAG, Catalyst
|   |   03_medallion_ingestion.ipynb # Medallion architecture, CSV/JSON/Parquet
|   |   04_delta_fundamentals.ipynb  # ACID, Time Travel, MERGE, VACUUM
|   |   05_orchestration_jobs.ipynb  # Workflows, CRON, Lakeflow Pipelines
|   |   06_unity_catalog.ipynb       # UC, permissions, Lineage, Delta Sharing
|   |   07_aibi_dashboards.ipynb     # Optional: Dashboards, Genie Space
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
|       99_test_runner.ipynb      # Automated notebook tests
|
| dataset/                        # Input data for exercises
|   customers/
|   |   customers.csv             # 10,000 records — historical customer data
|   |   customers_new.csv         # 114 records — batch update (MERGE demo)
|   |   customers_extented.xlsx   # Excel import demo (M03 BONUS; the typo in the name is intentional)
|   orders/
|   |   orders_batch.json         # Orders — JSON format (batch)
|   |   stream/                   # Orders — JSON format (3 streaming files)
|   products/
|       products.csv              # 2,000 records — product catalog
|       products.parquet          # Same catalog in Parquet (M03)
|
| docs/                           # PDF reference documents
|   ENG/                          # English versions
|   |   cheatsheet_databricks_fundamental.pdf  # Reference guide for all modules
|   |   quiz_databricks_fundamental.pdf        # Quiz: 40 questions with answer key
|   |   next_steps.pdf                         # What to learn next
|   |   external_connection_guide.pdf          # Connecting Unity Catalog to ADLS Gen2
|   |   pyspark_vs_sparksql.pdf                # Module 03 in PySpark and Spark SQL
|   PL/                           # Polish versions (same documents + Databricks_Fundamentals_Altkom_PL.pdf slides)
|
| materials/
|   orchestration/                # Sample notebooks for Workflows demo (M05)
|       task_01_validate.ipynb
|       task_02_transform.ipynb
|       task_03_report.ipynb
|   volume_upload/                # Files uploaded BY HAND in the M01 Volume demo (not copied by setup)
|       stores.csv
|       promotions.json
|
| assets/
|   images/                       # Screenshots used in notebooks
|
| scripts/                        # Utility scripts (generation, fixes)
|
```

---

## Datasets

All data belongs to the fictional company **RetailHub**.

| File | Format | Records | Description |
|------|--------|---------|-------------|
| `dataset/customers/customers.csv` | CSV | 10,000 | Customers (ID, name, email, city, segment) |
| `dataset/customers/customers_new.csv` | CSV | 114 | New/updated customers — used in MERGE demo |
| `dataset/orders/orders_batch.json` | JSON | ~10,000 | Orders (ID, customer, product, amount, payment) |
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
| `cheatsheet_databricks_fundamental.pdf` | Reference guide for all seven modules: PySpark, Delta Lake SQL, Lakeflow Jobs, Unity Catalog |
| `quiz_databricks_fundamental.pdf` | Self-assessment after the training: 40 questions with an answer key |
| `next_steps.pdf` | What to learn next: certification, Auto Loader, Lakeflow Pipelines, streaming, performance |
| `external_connection_guide.pdf` | Step-by-step connection of Unity Catalog to ADLS Gen2 |
| `pyspark_vs_sparksql.pdf` | Module 03 operations shown side by side in PySpark and Spark SQL |
| `free_edition_guide.pdf` | Taking the whole course on your own in Databricks Free Edition: setup, module-by-module notes, jobs, troubleshooting |

The PDFs are built with `scripts/build_pdfs.sh` (pandoc and WeasyPrint) from Markdown sources kept outside the repository.

### materials/orchestration/

Three sample notebooks used in the Workflows demo (M05):
- `task_01_validate.ipynb` — validates the source row count and passes it on as a task value
- `task_02_transform.ipynb` — adds trip duration and cost per mile, passes the averages on as task values
- `task_03_report.ipynb` — prints the report, including the values from the transform task

### materials/volume_upload/

Two small files for the M01 demo *Upload your own files to a Volume*. `00_pre_config` copies only `dataset/`,
so these files are **not** in any volume — the trainer uploads them by hand in Catalog Explorer:
- `stores.csv` — 100 RetailHub stores (`store_id` matches `orders_batch.json`)
- `promotions.json` — 7 promotions for Dec 2024 – Jan 2025, JSON Lines

---

## Next Steps

After completing the training:

| Step | What | When |
|------|------|------|
| 1 | Repeat the workshops on your own cluster | Week 1–2 |
| 2 | **Databricks Explorer** follow-up course (AutoLoader, DLT, advanced UC) | Month 1 |
| 3 | **Databricks Academy** — Data Engineer learning path | Month 2 |
| 4 | Exam: **Databricks Certified Data Engineer Associate** | Month 3 |
| 5 | Specialty track: ML, Professional, or SQL Analytics | Month 4–6 |

[databricks.com/learn/training](https://www.databricks.com/learn/training) — free self-paced courses + practice exams

### Topics Waiting for You

| Topic | What it does |
|-------|-------------|
| **AutoLoader** | Incremental file ingestion from cloud storage — no re-scanning |
| **Lakeflow Pipelines** | Declarative ETL with built-in data quality rules (formerly Delta Live Tables) |
| **Structured Streaming** | Real-time pipelines with micro-batch or continuous processing |
| **Unity Catalog (advanced)** | Row-level security, column masking, automatic data lineage |
| **MLflow** | Experiment tracking and model registry built into Databricks |
| **OPTIMIZE + ZORDER** | File compaction and co-location — up to 10x faster queries |

---

## Trainer Notes

### Environment Preparation

1. Run `notebooks/setup/00_pre_config.ipynb` before the training — creates Unity Catalog catalogs (`retailhub_<username>`) for each participant with three schemas: `bronze`, `silver`, `gold`.
2. Upload files from the `dataset/` directory to the `datasets` Volume in each participant's catalog.
3. At the start of the session: participants run `notebooks/setup/00_setup.ipynb`.

### Notebook Tests

```
notebooks/setup/99_test_runner.ipynb
```

Run after making changes to notebooks — automatically validates notebook structure.

---

*Repository prepared for the Altcom training — Databricks Fundamental.*
