# Plan Restrukturyzacji Notebooków — Databricks Fundamental

**Data:** 3 marca 2026  
**Zasada:** Intro (`00_intro.ipynb`) pomijamy — będzie budowany od nowa na końcu.

---

## Problem z obecną strukturą

| Notebook | Linie | Problem |
|----------|-------|---------|
| `01_platform_workspace` | 1 771 | Zbyt szeroki: Spark arch + Platform + Compute + Cost + GUI + UC |
| `02_elt_ingestion` | 2 799 | Najcięższy — brak wstępu Medallion, brak wizualizacji GUI |
| `03_delta_fundamentals` | 2 357 | OK, brakuje Managed vs External |
| `04_orchestration_jobs` | 918 | OK, mini-luka: brak wzmianki o Lakeflow Pipelines |
| `05_unity_catalog` | 799 | OK, ale duplikuje część M01 |
| LAB 01 | ❌ brak | Agenda go wymaga (11:00–12:00) |
| `bonus/` | ❌ pusty | Brak materiałów dla szybkich uczestników |

---

## Proponowana nowa struktura

```
notebooks/
  modules/
    00_intro.ipynb              ← rebuild od nowa (na końcu)
    01_platform_workspace.ipynb ← REFAKTORYZACJA (split + dodać sekcje)
    02_spark_architecture.ipynb ← NOWY (wydzielony z M01)
    03_medallion_ingestion.ipynb← RENAME + ROZSZERZENIE (był 02_elt)
    04_delta_fundamentals.ipynb ← ROZSZERZENIE (był 03)
    05_orchestration_jobs.ipynb ← MAŁA ZMIANA (był 04)
    06_unity_catalog.ipynb      ← ROZSZERZENIE (był 05)
    07_aibi_dashboards.ipynb    ← NOWY

  labs/
    LAB_01_platform.ipynb       ← NOWY (brak!)
    LAB_02_etl_pipeline.ipynb   ← MAŁA ZMIANA
    LAB_03_delta_lifecycle.ipynb← bez zmian
    final_labs/                 ← bez zmian
```

---

## Szczegółowy plan zmian

---

### M01 — `01_platform_workspace.ipynb` → REFAKTORYZACJA

**Akcja:** Wyciągnąć sekcję Spark Architecture do osobnego notebooka M02. Dodać Serverless i SQL Warehouse. Przerzucić głębokie UC do M06.

#### Usunąć / przenieść:
- Sekcja **"How Apache Spark Works — Distributed Execution & Lazy Evaluation"** (komórki 3–duże) → przenieść do nowego `02_spark_architecture.ipynb`
- Sekcja **Unity Catalog** (tworzenie tabel, PySpark vs SQL, parametryzacja z Widgets) → przenieść do `06_unity_catalog.ipynb`; w M01 zostawić tylko tabelę porównawczą Hive vs UC + 3-poziomowy namespace

#### Dodać:
1. **Serverless Compute** — nowa subsekcja w "Compute Resources":
   - Czym jest, kiedy startuje (<10s), billing model
   - Kiedy używać zamiast klasycznego klastra
   - Jak uruchomić w GUI

2. **SQL Warehouse** — nowa subsekcja w "Compute Resources":
   - Dla kogo (BI, analitycy, Power BI, Tableau)
   - Serverless vs Pro vs Classic warehouse
   - Jak znaleźć w GUI → SQL Editor

3. **Volumes vs DBFS** — rozszerzenie istniejącej sekcji:
   - Dodać ostrzeżenie: DBFS = deprecated pattern wg Databricks 2024+
   - Przykład: `/Volumes/catalog/schema/vol` vs `dbfs:/` — dlaczego Volumes

4. **dbutils overview** — nowa mini-sekcja (10 linii):
   - `dbutils.fs`, `dbutils.widgets`, `dbutils.notebook`, `dbutils.secrets`
   - Cheatsheet reference

#### Po zmianach M01 pokrywa:
`Lakehouse arch → Platform Elements → Compute (All-Purpose / Job / Serverless / SQL Warehouse) → Cost Management → Magic Commands → UC intro (3-level namespace only)`

---

### M02 — `02_spark_architecture.ipynb` — NOWY (wydzielony z M01)

**Akcja:** Wydzielić całą sekcję Spark Architecture z M01 do osobnego notebooka.

#### Zawartość (przeniesiona z M01 + rozszerzona):
1. Driver & Executors — architektura klastra
2. Lazy Evaluation — transformacje vs akcje (tabela)
3. DAG, Stages, Shuffles
4. Narrow vs Wide transformations
5. Catalyst Optimizer + AQE
6. **NOWE:** Praktyczne demo — kiedy kod się FAKTYCZNIE wykonuje (show która komórka triggeruje akcję)
7. **NOWE:** Spark UI — jak odczytać podstawowe informacje (Jobs, Stages, SQL query plan)

**Uzasadnienie:** To jest osobny, spójny temat. Oddzielenie pozwoli trenerowi pominąć lub skrócić ten temat dla nietech grup bez dotykania M01.

---

### M03 — `03_medallion_ingestion.ipynb` — RENAME + ROZSZERZENIE (był `02_elt_ingestion.ipynb`)

**Akcja:** Zmienić nazwę i dodać sekcję wstępną o architekturze Medalionowej.

#### Dodać na początku (przed CSV loading):
**Nowa sekcja: "Architektura Medalionowa — Bronze / Silver / Gold"**
- Co to jest i dlaczego Databricks to promuje
- Bronze: surowe dane as-is, tylko audit columns
- Silver: czyszczone, walidowane, wzbogacone  
- Gold: agregacje, biznesowe KPI, gotowe dla BI
- Diagram: plik → Bronze Delta → Silver Delta → Gold Delta
- Demo: jak nasze dane CSV/JSON pasują do Bronze
- Tabela: co robimy w każdej warstwie w tym module

**Nowa sekcja: "GUI Visualizations — Edit Chart"** (po sekcji `display()`):
- Jak stworzyć wykres z `display()` wynikowego DataFrame
- Kliknij "+" → typ wykresu (Bar, Line, Scatter, Area)
- Konfiguracja X osi, Y osi, koloru grupowania
- Demo z customers CSV: bar chart – revenue by region
- Zapisanie wykresu do dashboardu (pin to dashboard — preview)

#### Zmiana nazwy pliku:
`02_elt_ingestion.ipynb` → `03_medallion_ingestion.ipynb`

---

### M04 — `04_delta_fundamentals.ipynb` — ROZSZERZENIE (był `03_delta_fundamentals.ipynb`)

**Akcja:** Dodać sekcję Managed vs External Tables. Przenieść numer.

#### Dodać (po sekcji "Creating the First Delta Table"):
**Nowa sekcja: "Managed vs External Tables"**
- Managed: Databricks zarządza plikami i metadanymi → DROP TABLE usuwa dane
- External: Databricks zarządza tylko metadanymi → DROP TABLE zachowuje pliki
- Kiedy używać każdego
- Demo: CREATE TABLE vs CREATE TABLE LOCATION 'path'
- Implikacje dla VACUUM i retencji danych

#### Zmiana nazwy pliku:
`03_delta_fundamentals.ipynb` → `04_delta_fundamentals.ipynb`

---

### M05 — `05_orchestration_jobs.ipynb` — MAŁA ZMIANA (był `04_orchestration_jobs.ipynb`)

**Akcja:** Dodać wzmiankę o Lakeflow Pipelines. Zmienić numer.

#### Dodać (po głównej sekcji UI DEMO):
**Nowa mini-sekcja: "Co dalej — Lakeflow Pipelines (Spark Declarative Pipelines)"**
- 10–15 linii świadomości: czym jest, kiedy stosować zamiast klasycznych Jobs
- Deklaratywny pipeline vs imperatywny notebook
- "Temat Databricks Explorer — wrócimy do tego w kolejnym kroku ścieżki"

#### Zmiana nazwy pliku:
`04_orchestration_jobs.ipynb` → `05_orchestration_jobs.ipynb`

---

### M06 — `06_unity_catalog.ipynb` — ROZSZERZENIE (był `05_unity_catalog.ipynb`)

**Akcja:** Przyjąć sekcje z M01 (tworzenie tabel, PySpark vs SQL). Dodać nowe tematy.

#### Przyjąć z M01:
- Sekcja: "Creating a Table in Unity Catalog" (tworzenie tabel managed)
- Sekcja: "Parameterization with Databricks Widgets" (lub przenieść do M01/M03)
- Sekcja: "Comparison PySpark vs SQL"

#### Dodać nowe:
1. **Managed vs External Tables** (jeśli nie zmieści się w M04, może być tu):
   - Albo cross-reference do M04

2. **Data Lineage w praktyce**:
   - Catalog Explorer → Lineage tab — co widać po stworzeniu tabeli
   - Jak odczytać graf zależności

3. **Delta Sharing — świadomość** (5 min):
   - Co to jest, do czego służy
   - "Temat Databricks Explorer"

---

### M07 — `07_aibi_dashboards.ipynb` — NOWY

**Dla kogo:** Data analysts, BI specialists, power users — kluczowa funkcja 2024/2025.

#### Zawartość:
1. **SQL Editor w Databricks**
   - Jak otworzyć (Workspace → SQL Editor)
   - Połączenie z SQL Warehouse
   - Pisanie zapytań, historia, schemat

2. **AI/BI Dashboards**
   - Tworzenie nowego dashboardu
   - Dodawanie widżetów: tabela, wykres słupkowy, KPI tile
   - Konfiguracja filtrów (date picker, dropdown)
   - Publikowanie dla innych użytkowników

3. **AI/BI Genie**
   - Tworzenie Genie Space
   - Dodawanie tabel do Genie
   - Zadawanie pytań w języku naturalnym
   - Ograniczenia i kiedy używać

4. **Demo end-to-end:**
   - Gold table z LAB FINAL → AI/BI Dashboard z 3 wykresami → Genie pytanie o top customers

---

### LAB 01 — `LAB_01_platform.ipynb` — NOWY (PILNE)

**Agenda wymaga tego labu (11:00–12:00, 60 min).**

#### Zawartość:
```
Task 01 — Uruchom klaster / wybierz Serverless
Task 02 — Nawigacja Workspace: znajdź swój katalog w Catalog Explorer
Task 03 — Pierwsza komórka Python: spark.version, dbutils.notebook.getContext()
Task 04 — Magic commands: %sql SELECT current_user(), %fs ls /
Task 05 — Volumes: utwórz volume i sprawdź pusty folder
Task 06 — Unity Catalog: SHOW CATALOGS, SHOW SCHEMAS IN <catalog>
Task 07 — Pierwsza tabela Delta: CREATE TABLE z prostymi danymi
Task 08 — Cost check: znajdź swój klaster w Compute → sprawdź DBU
```

---

### LAB 02 — `LAB_02_etl_pipeline.ipynb` — MAŁA ZMIANA

#### Dodać na początku:
- Sekcja "Kontekst: gdzie jesteśmy w architekturze Medalionowej"
- Diagram: ten lab = Bronze + Silver layers
- Tabela: co wchodzi, co wychodzi z każdej warstwy

---

## Nowy harmonogram (propozycja)

| Czas | Moduł | Temat | Czas trwania |
|------|-------|-------|-------------|
| 09:00–09:15 | M00 | Welcome & Setup (nowe intro) | 15 min |
| 09:15–10:00 | M01 | Platform, Compute, Cost, Magic Commands | 45 min |
| 10:00–10:30 | M02 | Spark Architecture (Driver/Executor, Lazy Eval) | 30 min |
| 10:30–10:45 | ☕ Break | | |
| 10:45–12:00 | LAB 01 | Platform exploration | 75 min |
| 12:00–13:00 | 🍽️ Lunch | | |
| 13:00–13:20 | M03 wstęp | Architektura Medalionowa | 20 min |
| 13:20–14:30 | M03 | Ingestion CSV/JSON + transformacje + GUI Viz | 70 min |
| 14:30–15:00 | M04 | Delta Lake (CRUD, MERGE, Time Travel) | 30 min |
| 15:00–15:15 | ☕ Break | | |
| 15:15–15:45 | M05 | Workflows & Automation | 30 min |
| 15:45–16:00 | M06 | Unity Catalog (lineage, permissions) | 15 min |
| 16:00–16:20 | M07 | AI/BI Dashboards & Genie (demo) | 20 min |
| 16:20–17:00 | Final Project | End-to-end pipeline + schedule | 40 min |
| 17:00–17:15 | Wrap-up | Q&A | 15 min |

> **Uwaga:** To jest nadal napięte. M03 (ingestion) jest bardzo bogaty — trener powinien wybrać sekcje do pominięcia (np. Excel import, Global Temp Views) lub rozważyć 2-dniowy format.

---

## Podsumowanie zmian

| Notebook | Zmiana | Priorytet |
|----------|--------|-----------|
| `LAB_01_platform.ipynb` | 🆕 Stworzyć od zera | 🔴 PILNE |
| `07_aibi_dashboards.ipynb` | 🆕 Stworzyć od zera | 🟠 WAŻNE |
| `02_spark_architecture.ipynb` | 🆕 Wydzielić z M01 | 🟠 WAŻNE |
| `01_platform_workspace.ipynb` | ✏️ Usunąć Spark arch, dodać Serverless + SQL Warehouse + Volumes | 🟠 WAŻNE |
| `03_medallion_ingestion.ipynb` | ✏️ Rename + dodać Medallion + GUI Viz | 🟠 WAŻNE |
| `04_delta_fundamentals.ipynb` | ✏️ Rename + dodać Managed vs External | 🟡 ZALECANE |
| `05_orchestration_jobs.ipynb` | ✏️ Rename + mini-sekcja Lakeflow Pipelines | 🟡 ZALECANE |
| `06_unity_catalog.ipynb` | ✏️ Rename + przyjąć sekcje z M01 + Lineage + Delta Sharing | 🟡 ZALECANE |
| `LAB_02_etl_pipeline.ipynb` | ✏️ Dodać kontekst Medalionowy | 🟡 ZALECANE |
| `00_intro.ipynb` | 🔄 Rebuild od nowa (na końcu) | — |
