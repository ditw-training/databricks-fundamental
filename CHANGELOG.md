# Changelog

All notable changes to this training repository are documented here.  
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] — 2025-07-XX — *Professional DE Training — Initial Release*

### Added
- **Thematic structure** replacing day-based layout:
  - `notebooks/modules/` — 14 demo notebooks (M00–M13)
  - `notebooks/labs/` — 13 lab pairs × code + guide (LAB_01–LAB_13)
  - `notebooks/labs/pdf/` — lab PDF printouts
  - `notebooks/bonus/` — 4 bonus notebooks (B01–B04)
  - `notebooks/setup/` — cluster pre-config and workspace setup
- **Modules** merged from two source repos:
  - M04 Data Quality — from *Data Engineer TwoDays*
  - M08 Streaming & Stateful Operations — from *Data Engineer TwoDays*
  - M12 Asset Bundles & CI/CD — new topic (placeholder → to be developed)
  - M13 AI/ML for Data Engineers — from *Data Engineer TwoDays* + extended
  - M00–M03, M05–M11 — from *Data Engineer Associate* (DEA)
- **Labs** — LAB_09 (Medallion/Lakeflow) and LAB_10 (Orchestration) preserved verbatim from DEA
- **Dataset** — dual narrative:
  - `dataset/main/` + `dataset/demo/` — RetailHub scenario (inherited from DEA)
  - `dataset/workshop/` — AdventureWorks Lite scenario (from TwoDays)
- **materials/bundles/** — Databricks Asset Bundles template (`databricks.yml`)
- **Git LFS** — `.gitattributes` tracking for `*.pdf *.png *.webp *.avif *.xlsx`
- **`.gitignore`** — updated: excludes `*.pkg *.dmg *.exe *.zip`, protects `.venv/` and `utilization/`
- **README.md** — full rewrite with module map, lab map, dataset guide, training plan

### Changed
- Repository renamed from day-based `Data Engineer Associate` to thematic `Databricks-Data-Engineer-Associate`
- All notebooks renamed to `MXX_topic.ipynb` / `LAB_XX_topic[_guide].ipynb` convention

### Deprecated / Removed
- Legacy `notebooks/day1/`, `day2/`, `day3/` structure removed
- `notebooks/_import/` staging area removed

---

## [Planned] — Upcoming

### Notebooks to develop
- M12 — Asset Bundles & CI/CD (from placeholder)
- LAB_04 — Data Quality
- LAB_08 — Streaming Stateful
- LAB_12 — Asset Bundles & CI/CD
- LAB_13 — AI/ML for Data Engineers
- LAB_01–LAB_07, LAB_11 — reprogramming / content refresh

### Bonus notebooks to develop
- B02 — Performance Tuning
- B03 — Delta Sharing & Federation
