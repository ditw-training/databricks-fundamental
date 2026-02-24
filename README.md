# Databricks Data Engineer — Professional Training

> **Version:** 1.0 · **Duration:** 3 days core + bonus (4th day / self-study)  
> **Runtime:** Databricks Runtime ≥ 15.4 LTS · **Catalog:** Unity Catalog required  
> **Target:** Data Engineers (primary) · AI/ML awareness (secondary)

---

## Overview

This repository provides a complete, instructor-led training programme for Data Engineers working on the Databricks Lakehouse Platform.  
Content goes beyond the scope of the *Databricks Certified Data Engineer Associate* exam and is grounded in the **official Databricks documentation** (Lakeflow, Unity Catalog, Delta Lake, Auto Loader, Structured Streaming, Asset Bundles, AI Functions).

Two learning scenarios are woven throughout the course:

| Scenario | Dataset location | Description |
|---|---|---|
| **RetailHub** | `dataset/main/` `dataset/demo/` | E-commerce orders, customers, products — streaming + batch |
| **AdventureWorks Lite** | `dataset/workshop/` | Manufacturing sales data — incremental + quality labs |

---

## Repository Structure

```
.
├── notebooks/
│   ├── setup/           # cluster pre-config & workspace bootstrap
│   ├── modules/         # M00–M13  demo / lecture notebooks
│   ├── labs/            # LAB_01–LAB_13  hands-on pair (code + guide)
│   │   └── pdf/         # printable lab sheets
│   └── bonus/           # B01–B04  advanced / self-study
├── dataset/
│   ├── main/ demo/      # RetailHub CSV / JSON source files
│   └── workshop/        # AdventureWorks Lite CSV source files
├── lakeflow/            # Lakeflow Pipeline SQL + Python examples
├── materials/
│   └── bundles/         # Databricks Asset Bundle template (databricks.yml)
├── assets/              # slide decks, images, supplementary materials
├── docs/                # cheatsheets, quiz PDFs
├── .gitattributes       # Git LFS rules for binary assets
├── .gitignore
└── CHANGELOG.md
```

---

## Training Plan

### Day 1 — Lakehouse Foundations & Ingestion

| Slot | Notebook | Topic |
|---|---|---|
| 1 | M00 | Platform intro — Databricks workspace & Unity Catalog |
| 2 | M01 | Platform & Workspace deep-dive |
| 3 | M02 | ELT Ingestion basics — COPY INTO, Auto Loader, batch |
| 4 | M03 | Delta Lake fundamentals — ACID, time travel, CDF |
| Lab | LAB_01 | Workspace exploration |
| Lab | LAB_02 | Ingestion with Auto Loader |
| Lab | LAB_03 | Delta operations |
| Lab | LAB_04 | Data Quality with Expectations |

### Day 2 — Optimization, Streaming & Advanced Transforms

| Slot | Notebook | Topic |
|---|---|---|
| 5 | M04 | Data Quality — Delta Live Tables Expectations |
| 6 | M05 | Delta optimization — Z-Order, OPTIMIZE, liquid clustering |
| 7 | M06 | Incremental processing — Auto Loader patterns |
| 8 | M07 | Advanced transformations — Window, UDF, Scala interop |
| 9 | M08 | Streaming & stateful operations — watermarks, aggregations |
| Lab | LAB_05 | Delta optimization |
| Lab | LAB_06 | Incremental with Auto Loader |
| Lab | LAB_07 | Advanced transformations |
| Lab | LAB_08 | Streaming stateful |

### Day 3 — Medallion, Orchestration & Governance

| Slot | Notebook | Topic |
|---|---|---|
| 10 | M09 | Medallion architecture with Lakeflow Pipelines |
| 11 | M10 | Orchestration — Lakeflow Jobs, task dependencies |
| 12 | M11 | Governance & Unity Catalog — lineage, tags, access control |
| 13 | M12 | Asset Bundles & CI/CD — DAB, environments, GitHub Actions |
| Lab | LAB_09 | Medallion / Lakeflow Pipeline |
| Lab | LAB_10 | Orchestration / Lakeflow Jobs |
| Lab | LAB_11 | Governance & Unity Catalog |
| Lab | LAB_12 | Asset Bundles & CI/CD |

### Bonus (Day 4 / Self-Study)

| Notebook | Topic |
|---|---|
| M13 + LAB_13 | AI & ML for Data Engineers — AI Functions, Feature Store, MLflow |
| B01 | BI & Analytics — Power BI DirectLake, Databricks SQL |
| B02 | Performance Tuning (advanced Delta + Photon) |
| B03 | Delta Sharing & Lakehouse Federation |
| B04 | Exam Prep — Data Engineer Associate |

---

## Module Reference (M00–M13)

| ID | File | Source | Key Topics |
|---|---|---|---|
| M00 | M00_intro.ipynb | DEA | Databricks architecture, Unity Catalog, DBR |
| M01 | M01_platform_workspace.ipynb | DEA | Workspace, clusters, SQL warehouse, repos |
| M02 | M02_elt_ingestion.ipynb | DEA | COPY INTO, Auto Loader, batch patterns |
| M03 | M03_delta_fundamentals.ipynb | DEA | ACID transactions, time travel, CDF, DML |
| M04 | M04_data_quality.ipynb | TwoDays | DLT Expectations, quarantine, quality metrics |
| M05 | M05_delta_optimization.ipynb | DEA | OPTIMIZE, Z-Order, liquid clustering, vacuuming |
| M06 | M06_incremental_autoloader.ipynb | DEA | `cloudFiles`, schema evolution, checkpointing |
| M07 | M07_advanced_transforms.ipynb | DEA | Window functions, UDFs, higher-order functions, Scala |
| M08 | M08_streaming_stateful.ipynb | TwoDays | Watermarks, stateful aggregations, trigger modes |
| M09 | M09_medallion_lakeflow.ipynb | DEA | Bronze→Silver→Gold, Lakeflow Pipelines, SDP |
| M10 | M10_orchestration_jobs.ipynb | DEA | Lakeflow Jobs, task dependencies, repair, alerts |
| M11 | M11_governance_unity_catalog.ipynb | DEA | Lineage, data tags, row/col security, metastore admin |
| M12 | M12_asset_bundles_cicd.ipynb | placeholder | DAB, `bundle init/deploy/run`, dev→staging→prod, GitHub Actions |
| M13 | M13_ai_ml_for_de.ipynb | TwoDays | AI Functions, Feature Store, MLflow, Model Registry |

---

## Lab Reference (LAB_01–LAB_13)

Each lab has two files:
- `LAB_XX_<topic>.ipynb` — student hands-on code
- `LAB_XX_<topic>_guide.ipynb` — instructor solution guide

| LAB | Topic | Status |
|---|---|---|
| LAB_01 | platform_workspace | to reprogram |
| LAB_02 | elt_ingestion | to reprogram |
| LAB_03 | delta_fundamentals | to reprogram |
| LAB_04 | data_quality | placeholder — to develop |
| LAB_05 | delta_optimization | to reprogram |
| LAB_06 | incremental_autoloader | to reprogram |
| LAB_07 | advanced_transforms | to reprogram |
| LAB_08 | streaming_stateful | placeholder — to develop |
| LAB_09 | medallion_lakeflow | **preserved from DEA — production ready** |
| LAB_10 | orchestration_jobs | **preserved from DEA — production ready** |
| LAB_11 | governance_unity_catalog | to reprogram |
| LAB_12 | asset_bundles_cicd | placeholder — to develop |
| LAB_13 | ai_ml_for_de | placeholder — to develop |

---

## Bonus Reference

| ID | File | Content |
|---|---|---|
| B01 | B01_bi_analytics.ipynb | Power BI DirectLake, Databricks SQL dashboards |
| B02 | B02_performance_tuning.ipynb | Advanced Photon, caching, partition strategy *(to develop)* |
| B03 | B03_delta_sharing_federation.ipynb | Delta Sharing protocol, Lakehouse Federation *(to develop)* |
| B04 | B04_exam_prep_dea.ipynb | DEA exam topic review and practice questions |

---

## Setup

### Prerequisites

- Databricks workspace with Unity Catalog enabled
- Databricks Runtime ≥ 15.4 LTS (Photon recommended for bonus labs)
- Default catalog: `training` (or update in `notebooks/setup/00_pre_config.ipynb`)
- Personal Access Token or OAuth configured for CLI use

### First Time

```bash
# 1. Clone repo
git clone https://github.com/<org>/Databricks-Data-Engineer-Associate.git
cd Databricks-Data-Engineer-Associate

# 2. (Optional) Install Git LFS to avoid downloading large binary files on clone
git lfs install
git lfs pull

# 3. Configure Databricks CLI
databricks configure --profile training

# 4. Run setup notebook in your cluster
# Open:  notebooks/setup/00_setup.ipynb
# Then:  notebooks/setup/00_pre_config.ipynb
```

### Trainer Setup (before training)

1. Clone the repository to your Databricks Workspace via **Repos** or **Git folders** (Unity Catalog)
2. Open `notebooks/setup/00_pre_config.ipynb`
   - Set storage account URL for Unity Catalog external location
   - Set training group name (e.g. `training-de`)
   - Run all cells — creates individual catalogs/schemas per participant
3. Distribute workspace URL and credentials to participants

### Asset Bundles (CI/CD demo)

```bash
cd materials/bundles

# Edit databricks.yml — fill in workspace hosts and catalog names

databricks bundle validate
databricks bundle deploy -t dev
databricks bundle run de_training_orchestration_job -t dev
```

---

## Documentation References

| Topic | Link |
|---|---|
| Delta Lake | https://docs.databricks.com/delta/index.html |
| Auto Loader | https://docs.databricks.com/ingestion/auto-loader/index.html |
| Lakeflow Pipelines (DLT) | https://docs.databricks.com/aws/en/dlt/ |
| Lakeflow Jobs | https://docs.databricks.com/aws/en/jobs/ |
| Unity Catalog | https://docs.databricks.com/data-governance/unity-catalog/index.html |
| Structured Streaming | https://docs.databricks.com/structured-streaming/index.html |
| Asset Bundles | https://docs.databricks.com/dev-tools/bundles/index.html |
| AI Functions | https://docs.databricks.com/sql/language-manual/functions/ai_query.html |
| MLflow on Databricks | https://docs.databricks.com/mlflow/index.html |
| Databricks SQL | https://docs.databricks.com/sql/index.html |

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

---

## Project: RetailHub

Core modules use the **RetailHub** narrative — an e-commerce analytics platform:

- **Catalog:** `retailhub_{username}`
- **Schemas:** `bronze` (raw), `silver` (cleaned), `gold` (aggregated)
- **Data sources:** Customers (CSV), Products (CSV), Orders (JSON + streaming)
- **Pipeline:** Raw files → Bronze → Silver → Gold → Reports

Workshop labs additionally use **AdventureWorks Lite** (manufacturing/sales dataset in `dataset/workshop/`).

---

*Altkom Akademia — Data Engineering Training Materials*
