# Databricks Fundamental — Szkielet prezentacji

> **Format:** 1 dzień · ~7 godzin netto · slajdy + live-demo w notebookach

---

## SEKCJA 1 — Intro i zasady (15 min)

### Slajd 1: Dobry poranek / Witamy
- Prowadzący, firma, kontekst
- Krótki przegląd agendy na dziś

### Slajd 2: O szkoleniu — do kogo jest skierowane
- Analitycy, inżynierowie danych, specjaliści BI, kadra techniczna
- Wymagania wstępne: podstawy SQL, ogólne rozumienie baz danych

### Slajd 3: Co osiągniemy dziś
- Rozumieć podstawowe składniki środowiska Databricks
- Znać Unity Catalog i Delta Lake jako fundamenty platformy
- Wczytywać dane, transformować, uruchamiać w zaplanowanym pipeline
- Być gotowym na kolejny etap ścieżki: **Databricks Explorer**

### Slajd 4: Zasady pracy
- Notebooki są już skonfigurowane — nie trzeba nic instalować
- Każdy moduł: **teoria na slajdach → live-demo → ćwiczenie**
- Kod piszemy w PySpark i SQL — mieszamy oba bez problemu
- Pytania w dowolnym momencie; na końcu każdego bloku czas na Q&A
- Przerwy: ~10 min co ~90 min, obiad ok. 13:00

---

## SEKCJA 2 — Platforma i środowisko (30 min)

### Slajd 5: Co to jest Databricks?
- Lakehouse = Data Warehouse + Data Lake w jednym
- Databricks jako platforma: compute, storage, governance, AI
- Dlaczego Delta Lake jest domyślnym formatem

### Slajd 6: Architektura platformy
- Workspace · Notebooki · Klastry · DBFS / Volumes
- Unity Catalog: katalog → schema → tabela (3-poziomowa przestrzeń nazw)
- Managed vs External tables

### Slajd 7: Klastry — typy i koszty
- All-purpose vs Job Cluster — kiedy co używać
- Autoscaling i jego wpływ na rachunek
- Złota zasada: **nie zostawiaj klastra bezczynnego**

> 🔬 **Live demo:** nawigacja po Workspace, uruchomienie klastra, pierwszy notebook

---

## SEKCJA 3 — Architektura Spark (30 min)

### Slajd 8: Jak działa Spark
- Driver + Executors — podział pracy
- Lazy evaluation: transformation vs action
- DAG i plan wykonania — po co to wiedzieć?

### Slajd 9: Tryby pracy — PySpark, SQL, Scala
- Jeden klaster, wiele języków w jednym notebooku
- `display()` vs `show()` — kiedy co używać
- Kiedy Spark jest szybszy, kiedy wolniejszy od tradycyjnego SQL

> 🔬 **Live demo:** `M02_spark_architecture.ipynb`

---

## SEKCJA 4 — Ingestion i Medallion Architecture (60 min)

### Slajd 10: Medallion Architecture
- Bronze → Silver → Gold — po co trzy warstwy?
- Reguła Bronze: **raw data only, no business logic**
- Silver: czyszczenie, typowanie, wzbogacanie
- Gold: agregacje gotowe do raportu

### Slajd 11: Wczytywanie danych
- CSV z inferred schema vs explicit `StructType`
- JSON — dlaczego zawsze explicit schema w produkcji
- Metadata columns: `_load_ts`, `_source_file`

### Slajd 12: Transformacje PySpark
- `withColumn · cast · when/otherwise · filter · drop`
- `groupBy().agg(count, sum, avg)` — podstawowe agregacje
- Tempo views i `spark.sql()`

> 🔬 **Live demo:** `M03_medallion_ingestion.ipynb`
> 💪 **Warsztat:** `WORKSHOP_ingestion.ipynb` (Tasks 03–12)

---

## SEKCJA 5 — Delta Lake (60 min)

### Slajd 13: Co daje Delta Lake
- ACID transactions w środowisku rozproszonym
- Schema Enforcement vs Schema Evolution — różnica
- `DESCRIBE HISTORY` — wersjonowanie każdej operacji

### Slajd 14: CRUD na Delta
- `INSERT INTO · UPDATE · DELETE · MERGE INTO`
- Constraints (`CHECK`) — jakość danych na poziomie tabeli
- Time Travel: `VERSION AS OF` i `TIMESTAMP AS OF`

### Slajd 15: RESTORE i odtwarzanie
- `RESTORE TABLE` — jak cofnąć przypadkowe nadpisanie
- Kiedy korzystać z time travel, a kiedy z backupu

> 🔬 **Live demo:** `M04_delta_fundamentals.ipynb`
> 💪 **Warsztat:** `WORKSHOP_delta.ipynb`

---

## SEKCJA 6 — Orchestration & Workflows (45 min)

### Slajd 16: Po co automatyzować?
- Ręczne uruchamianie notebooków → błędy, brak powtarzalności
- Job = zestaw tasków z zależnościami (DAG)
- Job Cluster vs All-purpose — dlaczego produkcja zawsze Job Cluster

### Slajd 17: Budowanie joba krok po kroku
- Task: Notebook + ścieżka + parametry
- Depends on — sekwencja Bronze → Silver → Gold
- `dbutils.notebook.exit(json)` — jak task raportuje status

### Slajd 18: Harmonogram i monitoring
- CRON: `0 0 6 * * ?` — codziennie o 6:00
- Repair Run — jak naprawić tylko failujący task
- Alerty e-mail przy sukcesie / błędzie

> 🔬 **Live demo:** `M05_orchestration_jobs.ipynb`

---

## SEKCJA 7 — Unity Catalog & AI/BI (30 min)

### Slajd 19: Unity Catalog — governance w jednym miejscu
- Centralny katalog dla całej organizacji (multi-workspace)
- Uprawnienia: `GRANT · REVOKE` na poziomie tabeli / kolumny
- Data lineage — skąd pochodzą dane w tabeli Gold

### Slajd 20: AI/BI Dashboards
- Dashboard bez exportu do zewnętrznych narzędzi
- Wizualizacje bezpośrednio z tabel Delta
- Genie — interaktywne odpowiedzi na pytania w języku naturalnym

> 🔬 **Live demo:** `M06_unity_catalog.ipynb` · `M07_aibi_dashboards.ipynb`

---

## SEKCJA 8 — Projekt końcowy (60 min)

### Slajd 21: Scenariusz
- RetailHub — pipeline zamówień od JSON do raportu dziennego
- 3 notebooki: Bronze · Silver · Gold
- Celem: uruchomić jako zaplanowany Workflow Job

### Slajd 22: Struktura projektu
```
orders_batch.json
    → lab_task_01_bronze  (ingest + metadata)
    → lab_task_02_silver  (recast + enrich + clean)
    → lab_task_03_gold    (aggregate daily revenue)
    → Databricks Workflow Job (schedule: 06:00 daily)
```

### Slajd 23: Weryfikacja
- Smoke test w notebooku głównym
- Zapytania SQL w Query Editorze do tabeli Gold
- `DESCRIBE HISTORY` — potwierdzenie że pipeline zapisał dane

> 💪 **Warsztat:** `WORKSHOP_final_project.ipynb`

---

## SEKCJA 9 — Zakończenie (15 min)

### Slajd 24: Co dziś zrobiliśmy
| Temat | Kluczowe pojęcie |
|-------|-----------------|
| Platforma | Workspace · Klastry · Unity Catalog |
| Spark | Driver/Executor · Lazy evaluation |
| Ingestion | Medallion Architecture · explicit schema |
| Delta Lake | ACID · Time Travel · RESTORE |
| Orchestration | Workflow Job · CRON · Repair Run |
| Projekt końcowy | Bronze → Silver → Gold pipeline |

### Slajd 25: Co dalej — ścieżka szkoleniowa
- **Databricks Explorer** — kolejny poziom (streaming, ML, DLT)
- Certyfikacja: Databricks Certified Associate Developer for Apache Spark
- Dokumentacja: `databricks.com/learn/training`

### Slajd 26: Q&A i feedback
- Czas na pytania
- Ankieta zwrotna (link / QR kod)
- Kontakt do prowadzącego

---

> **Legenda:**
> 🔬 Live demo — prowadzący pokazuje w notebooku
> 💪 Warsztat — uczestnicy kodują samodzielnie
