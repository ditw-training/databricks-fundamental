# Databricks Fundamental — Szkielet prezentacji

> **Format:** 1 dzień · ~7 godzin netto · teoria w slajdach → praktyka w notebookach

---

## SEKCJA 1 — Wprowadzenie (15 min)

### Slajd 1: Agenda i cel dnia
- Pełna agenda z podziałem na bloki i przybliżonymi czasami
- Cel praktyczny: po szkoleniu samodzielnie zbudujesz pipeline Bronze→Silver→Gold
- Przerwy: ~10 min co ~90 min, obiad ok. 13:00
- Pytania w dowolnym momencie; dedykowany Q&A na końcu każdego bloku

### Slajd 2: Do kogo skierowane jest to szkolenie
- Analitycy danych, inżynierowie danych, specjaliści BI, kadra techniczna
- Wymagania wstępne: podstawy SQL, orientacja w relacyjnych bazach danych
- Nie wymagamy znajomości Pythona — uczymy PySpark od podstaw w kontekście

### Slajd 3: Czego dziś się nauczymy
| Blok | Umiejętność |
|------|-------------|
| Platforma | Poruszanie się po środowisku Databricks, praca z klastrami |
| Spark | Rozumienie modelu wykonania, pisanie transformacji |
| Ingestion | Wczytywanie CSV/JSON, budowanie warstwy Bronze i Silver |
| Delta Lake | ACID, CRUD, Time Travel, RESTORE |
| Orchestration | Workflow Job, harmonogram CRON, Repair Run |
| Projekt końcowy | Kompletny pipeline danych jako zaplanowany job |

### Slajd 4: Jak działa środowisko szkoleniowe
- Środowisko gotowe — notebooki skonfigurowane, klaster uruchomiony
- Każdy blok: teoria na slajdach → samodzielna praca w notebooku
- Kod piszemy w **PySpark** i **SQL** — oba języki w jednym notebooku
- Wyniki ćwiczeń są widoczne od razu po uruchomieniu komórki

---

## SEKCJA 2 — Platforma Databricks (30 min)

### Slajd 5: Czym jest Databricks?
- Unified Data Intelligence Platform — jedno miejsce na inżynierię, analitykę i AI
- Historia: powstał jako odpowiedź twórców Apache Spark na potrzeby enterprise
- Lakehouse = połączenie zalet Data Lake (tanie storage, dowolny format) i Data Warehouse (transakcje, governance, wydajność)
- Pozycja na rynku: alternatywa i uzupełnienie dla Snowflake, BigQuery, Synapse

### Slajd 6: Główne składniki platformy
- **Workspace** — środowisko pracy: notebooki, repozytoria, pipelines, jobs
- **Compute** — klastry Spark zarządzane przez Databricks; płacisz za DBU × czas
- **Storage** — dane trzymane w cloud storage (ADLS, S3, GCS); Databricks nie przechowuje danych
- **Unity Catalog** — centralny katalog metadanych i governance dla całej organizacji
- **Delta Lake** — warstwa transakcyjna nad plikami Parquet; domyślny format tabeli

### Slajd 7: Przestrzeń nazw Unity Catalog
- Trzypoziomowa hierarchia: `katalog.schema.tabela`
- **Katalog** — granica środowiska (np. `dev`, `prod`, `szkolenie`)
- **Schema** — logiczna grupa tabel (odpowiednik database w klasycznym SQL)
- **Tabela** — Managed (UC zarządza lokalizacją) vs External (wskazujesz ścieżkę)
- Uprawnienia dziedziczne: `GRANT USE CATALOG` → `USE SCHEMA` → `SELECT`

### Slajd 8: Klastry — typy i zasady użycia
- **All-purpose cluster** — interaktywna praca w notebookach; dzielony między użytkownikami
- **Job cluster** — tworzony na czas joba, usuwany po zakończeniu; tańszy, izolowany
- **SQL Warehouse** — dedykowany compute dla SQL Analytics i dashboardów
- Autoscaling: klaster skaluje liczbę workerów wg aktualnego obciążenia
- **Zasada ekonomii:** klaster bezczynny > 10 min to zbędny koszt — używaj auto-terminate
- DBU (Databricks Unit) — jednostka rozliczeniowa; cena zależy od typu klastra i chmury

---

## SEKCJA 3 — Architektura Apache Spark (30 min)

### Slajd 9: Model wykonania Spark — Driver i Executors
- **Driver** — jeden węzeł; kompiluje kod, buduje DAG, koordynuje zadania
- **Executor** — 1..N węzłów roboczych; wykonują taski i przechowują dane w pamięci
- **Partycja** — podstawowa jednostka równoległości; jeden task = jedna partycja
- Dane nigdy nie opuszczają klastra do momentu wywołania akcji (`collect`, `write`, `show`)
- Shuffle — najdroższy element pipeline'u: przenosi dane między partycjami przez sieć

### Slajd 10: Lazy evaluation — transformacje vs akcje
- **Transformacja** — leniwa; buduje plan, nie wykonuje obliczeń (`select`, `filter`, `withColumn`, `join`)
- **Akcja** — wyzwala wykonanie całego planu (`count`, `show`, `display`, `write`, `collect`)
- Korzyść: Spark optymalizuje cały łańcuch transformacji przed wykonaniem (Catalyst Optimizer)
- **Praktyczna rada:** nie wywołuj `.collect()` na dużych DataFrame — ładuje wszystko do pamięci Drivera

### Slajd 11: DAG i plan wykonania
- DAG (Directed Acyclic Graph) — sekwencja kroków od źródła do wyniku
- **Logical Plan** → **Optimized Logical Plan** → **Physical Plan** → wykonanie
- Predicate pushdown — Spark przesuwa filtry jak najbliżej źródła danych
- Column pruning — odczytuje tylko potrzebne kolumny z Parquet
- Spark UI: zakładki Jobs, Stages, SQL — gdzie szukać wąskich gardeł

### Slajd 12: PySpark DataFrame API — czytanie kodu
- DataFrame = tabela rozproszona z niemutowalnym schematem
- Łańcuchowanie metod: `df.filter(...).withColumn(...).groupBy(...).agg(...)`
- `col("nazwa")` vs `df["nazwa"]` — kiedy która forma; unikaj `f.col` w złączeniu z innym df
- `display(df)` — Databricks-specific; renderuje tabelę z paginacją w notebooku
- `df.show(n, truncate=False)` — czyste Spark API; działa poza Databricks
- `spark.sql("SELECT ...")` — SQL inline; zwraca DataFrame, można chainować dalej

---

## SEKCJA 4 — Ingestion i Medallion Architecture (60 min)

### Slajd 13: Medallion Architecture — po co trzy warstwy?
- Wzorzec architektoniczny rekomendowany przez Databricks dla Data Lakehouse
- Cel: oddzielenie **surowca** (Bronze) od **jakości** (Silver) od **biznesu** (Gold)
- Każda warstwa to oddzielna tabela Delta — można ją odpytać, audytować, przywrócić
- Awaria w Silver nie niszczy Bronze — zawsze można przeliczyć od nowa

### Slajd 14: Warstwa Bronze — zasady
- **Raw as-is:** wczytaj dokładnie to, co przyszło ze źródła — bez filtrowania, bez biznesowej logiki
- Wszystkie kolumny jako `StringType` — brak interpretacji typów przy ingestion
- Dwa obowiązkowe metadane: `_load_ts` (`current_timestamp()`) i `_source_file` (`input_file_name()`)
- Format docelowy: Delta — ACID, schema enforcement, możliwość time travel
- Explicit schema (`StructType`) — nigdy `inferSchema` w produkcji (double-scan, brak gwarancji)

### Slajd 15: Explicit schema — StructType i StructField
```python
from pyspark.sql.types import StructType, StructField, StringType

schema = StructType([
    StructField("order_id",    StringType(), nullable=False),
    StructField("customer_id", StringType(), nullable=True),
    StructField("total_amount", StringType(), nullable=True),
    # ...
])
```
- `nullable=False` na kluczach — wychwytuje braki już przy odczycie
- Dlaczego wszystko `StringType` w Bronze? JSON i CSV nie mają typów — to Twój kod je nadaje

### Slajd 16: Warstwa Silver — czyszczenie i typowanie
- **Recast:** zmiana `StringType` → typy docelowe (`TimestampType`, `DoubleType`, `IntegerType`)
- Użycie `to_timestamp(col("order_datetime"), "yyyy-MM-dd'T'HH:mm:ss")` — jawny format
- **Wzbogacanie:** nowe kolumny pochodne (`net_amount`, `order_tier`)
- **Filtrowanie:** usuwanie wierszy z nullami na kluczowych polach
- **Czyszczenie:** usuwanie kolumn technicznych (`_source_file`) niepotrzebnych w dół
- Tryb zapisu: `mode("overwrite")` + `option("overwriteSchema", "true")`

### Slajd 17: Typowe transformacje PySpark — ściągawka
| Operacja | Kod |
|----------|-----|
| Zmiana typu | `col("x").cast(DoubleType())` |
| Parsowanie daty | `to_timestamp(col("x"), "pattern")` |
| Wartość warunkowa | `when(cond, val).otherwise(other)` |
| Zaokrąglenie | `round(col("x"), 2)` |
| Stała | `lit(0)` |
| Ekstrakcja daty | `to_date(col("ts"))` |
| Filtr nulli | `col("x").isNotNull()` |
| Usunięcie kolumny | `.drop("col_name")` |

### Slajd 18: Warstwa Gold — agregacje
- Cel: **jeden wiersz = jeden wymiar biznesowy** (np. jeden dzień, jedna kategoria)
- Zawsze budowana od nowa z Silver: `mode("overwrite")` bez `overwriteSchema`
- `groupBy("order_date").agg(count("*"), sum("net_amount"), round(avg("net_amount"), 2))`
- Używaj `net_amount` (po rabacie), nie `total_amount`
- Gold jest **stabilna** — schema nie zmienia się między runami; raporty polegają na stałej strukturze

---

## SEKCJA 5 — Delta Lake (60 min)

### Slajd 19: Czym różni się Delta od zwykłego Parquet?
- Parquet = pliki na dysku; brak transakcji, brak atomowości, brak wersjonowania
- Delta = Parquet + **transaction log** (`_delta_log/`) — każda operacja zapisuje JSON z metadanymi
- Kompaktacja (`OPTIMIZE`) i indeksowanie (`Z-ORDER`) — wydajność zapytań na dużych tabelach
- `VACUUM` — usuwa stare pliki; uważaj na retencję przy time travel

### Slajd 20: ACID w praktyce
- **Atomicity** — albo cały `MERGE` się udaje, albo nic
- **Consistency** — schema enforcement: wstawienie złego typu → błąd, nie cicha korupcja
- **Isolation** — równoległe zapisy nie psują siebie nawzajem (optimistic concurrency)
- **Durability** — zacommitowany rekord jest w transaction logu; awaria klastra nie gubi danych
- Przykład: dwa joby piszą jednocześnie do tej samej tabeli — Delta rozstrzyga konflikt przez CAS

### Slajd 21: Schema Enforcement vs Schema Evolution
- **Schema Enforcement** (domyślnie ON) — zapis z innym schematem → `AnalysisException`; chroni integralność
- **Schema Evolution** — `option("mergeSchema", "true")` — pozwala dodawać nowe kolumny
- `overwriteSchema` — nadpisuje schemat przy `mode("overwrite")`; używać świadomie
- Kiedy co: enforcement w produkcji, evolution przy migracji lub stopniowym wdrożeniu nowych pól

### Slajd 22: CRUD na tabelach Delta
```sql
-- INSERT
INSERT INTO catalog.schema.orders VALUES (...)

-- UPDATE
UPDATE catalog.schema.orders SET status = 'cancelled' WHERE order_id = 'X'

-- DELETE
DELETE FROM catalog.schema.orders WHERE order_date < '2023-01-01'

-- MERGE (upsert)
MERGE INTO target USING source ON target.id = source.id
  WHEN MATCHED THEN UPDATE SET *
  WHEN NOT MATCHED THEN INSERT *
```
- `MERGE` = atomowy upsert; jeden statement, brak race condition
- Constraints: `ALTER TABLE t ADD CONSTRAINT chk CHECK (amount > 0)`

### Slajd 23: Time Travel — wersjonowanie danych
- Każdy `INSERT`, `UPDATE`, `DELETE`, `OPTIMIZE` tworzy nową wersję w transaction logu
- Odpytywanie historycznej wersji:
  ```sql
  SELECT * FROM orders VERSION AS OF 3
  SELECT * FROM orders TIMESTAMP AS OF '2024-01-15'
  ```
- `DESCRIBE HISTORY orders` — pełna historia operacji z timestampem i użytkownikiem
- Domyślna retencja: **30 dni** (konfigurowane przez `delta.logRetentionDuration`)

### Slajd 24: RESTORE — cofanie zmian
```sql
RESTORE TABLE orders TO VERSION AS OF 2
RESTORE TABLE orders TO TIMESTAMP AS OF '2024-01-10 08:00:00'
```
- RESTORE tworzy nową wersję (nie usuwa historii) — sam RESTORE jest audytowalny
- Przypadkowy `DELETE` lub `OVERWRITE` → RESTORE to szybsze niż restore z backupu
- Ograniczenie: dane muszą być w retencji (pliki nie usunięte przez `VACUUM`)

---

## SEKCJA 6 — Orchestration i Workflows (45 min)

### Slajd 25: Po co orkiestracja?
- Ręczne uruchamianie notebooków = brak powtarzalności, brak audytu, brak alertów
- Workflow Job = zadeklarowany DAG tasków z harmonogramem i monitoringiem
- Różnica od klasycznego schedulera (cron): zależności między taskami, retry, repair run
- Job Cluster: tworzony automatycznie przed runiem, usuwany po — brak idle cost

### Slajd 26: Anatomia Workflow Job
- **Task** — jednostkowy krok: notebook, Python script, SQL, Delta Live Tables pipeline
- **Depends on** — krawędź DAG; task Silver startuje dopiero po sukcesie Bronze
- **Parameters** — przekazywane do notebooku przez `dbutils.widgets` lub `sys.argv`
- **Cluster** — każdy task może mieć własny klaster lub dzielić jeden (shared job cluster)
- **Retries** — automatyczne ponowienie przy błędzie; konfigurowalne per task

### Slajd 27: Raportowanie statusu z notebooka
```python
import json
dbutils.notebook.exit(json.dumps({
    "status": "SUCCESS",
    "table": "gold.lab_daily_orders",
    "rows": row_count
}))
```
- `dbutils.notebook.exit()` wysyła string do nadrzędnego joba — używaj JSON
- Status `"FAILED"` lub nieobsłużony wyjątek → task oznaczany jako Failed
- Downstream taski nie startują dopóki upstream nie zwróci sukcesu

### Slajd 28: Harmonogram i monitoring
- **CRON Quartz syntax:** `0 0 6 * * ?` = codziennie o 06:00
- Triggery: Manual · CRON · File arrival · Continuous
- **Repair Run** — rerunnuje **tylko** failujące taski, nie cały job; oszczędza czas i pieniądze
- Alerty: e-mail / webhook przy Start, Success, Failure, Skipped
- Metrics panel: czas wykonania, koszt per run, historia ostatnich N runów

---

## SEKCJA 7 — Unity Catalog i AI/BI (30 min)

### Slajd 29: Unity Catalog — governance dla całej organizacji
- Jeden katalog metadanych dla wszystkich workspace'ów w ramach jednego konta Databricks
- Przed UC: każdy workspace miał własne Hive metastore — silosy danych
- **Data lineage** — automatyczne śledzenie przepływu danych między tabelami (column-level lineage)
- **Audit log** — każdy SELECT, INSERT, GRANT zapisywany; kto, kiedy, co
- **Tags i komentarze** — dokumentacja tabel i kolumn bezpośrednio w katalogu

### Slajd 30: Model uprawnień
- `GRANT privilege ON object TO principal`
- Przywileje: `USE CATALOG / USE SCHEMA / SELECT / MODIFY / CREATE TABLE / ALL PRIVILEGES`
- Hierarchia: uprawnienie na katalogu dziedziczy się na scheme i tabelach
- Row-level i column-level security: filtrowanie danych bez tworzenia widoków
- Service principals — automatyczne joby nigdy nie używają konta osobistego

### Slajd 31: AI/BI Dashboards
- Dashboardy bezpośrednio w Databricks — bez exportu do Tableau, Power BI
- Źródło: dowolna tabela Delta lub wynik SQL; odświeżanie on-demand lub CRON
- Typy wykresów: bar, line, scatter, pie, counter, heatmap, map
- **Genie** — asystent AI; użytkownik zadaje pytanie w języku naturalnym, Genie generuje SQL i wykres
- Dostęp przez link — bez konta Databricks dla odbiorcy końcowego (w odpowiedniej konfiguracji)

---

## SEKCJA 8 — Projekt końcowy: RetailHub Pipeline (60 min)

### Slajd 32: Scenariusz biznesowy
- Firma RetailHub przetwarza zamówienia klientów z wielu kanałów (JSON batch)
- Cel: codziennie o 06:00 odświeżyć raport dzienny przychodów w tabeli Gold
- Dane wejściowe: `orders_batch.json` — surowe zamówienia (1 plik = 1 dzień)
- Wynik końcowy: tabela `gold.lab_daily_orders` — jeden wiersz na dzień, 4 kolumny

### Slajd 33: Architektura pipeline'u
```
orders_batch.json  (raw source)
        │
        ▼
lab_task_01_bronze   →  bronze.lab_orders
  • StringType schema (11 col)                (Delta, 13 kolumn)
  • metadata: _load_ts, _source_file
        │
        ▼
lab_task_02_silver   →  silver.lab_orders
  • recast: datetime, amount, pct, qty         (Delta, z net_amount)
  • enrich: net_amount, order_tier
  • filter: nulls out, drop _source_file
        │
        ▼
lab_task_03_gold     →  gold.lab_daily_orders
  • groupBy order_date                         (Delta, 4 kolumny)
  • agg: count, sum(net_amount), avg
        │
        ▼
Databricks Workflow Job  (schedule: 06:00 daily CRON)
```

### Slajd 34: Schemat tabeli Gold
| Kolumna | Typ | Opis |
|---------|-----|------|
| `order_date` | `DateType` | Dzień agregacji |
| `order_count` | `LongType` | Liczba zamówień w tym dniu |
| `total_revenue` | `DoubleType` | Suma `net_amount` (po rabacie) |
| `avg_order_value` | `DoubleType` | Średnia wartość zamówienia (2 miejsca) |

### Slajd 35: Weryfikacja po uruchomieniu joba
```sql
-- Czy dane trafiły do tabeli?
SELECT * FROM gold.lab_daily_orders ORDER BY order_date DESC LIMIT 10;

-- Ile wierszy?
SELECT COUNT(*) AS total_days FROM gold.lab_daily_orders;

-- Sanity check przychodów
SELECT SUM(total_revenue), MIN(order_date), MAX(order_date)
FROM gold.lab_daily_orders;

-- Historia zapisów
DESCRIBE HISTORY gold.lab_daily_orders;
```

---

## SEKCJA 9 — Zakończenie (15 min)

### Slajd 36: Co zbudowaliśmy dziś
| Warstwa | Notebook | Kluczowa technika |
|---------|----------|-------------------|
| Bronze | `lab_task_01_bronze` | `StructType`, `StringType`, metadata cols |
| Silver | `lab_task_02_silver` | `cast`, `to_timestamp`, `when`, `filter` |
| Gold | `lab_task_03_gold` | `groupBy`, `agg`, `to_date` |
| Orchestration | `WORKSHOP_final_project` | Workflow Job, CRON, `notebook.exit` |

### Slajd 37: Kluczowe pojęcia do zapamiętania
- **Lakehouse** — nie wybieraj między DWH a Data Lake; masz oba
- **Medallion** — trzy warstwy = trzy kontrakty jakości danych
- **Delta** — ACID + time travel to nie opcja, to standard
- **Explicit schema** — inferred schema = dług techniczny
- **Job Cluster** — produkcja zawsze na Job Cluster, nie All-purpose
- **Unity Catalog** — governance na poziomie kolumny, nie tylko tabeli

### Slajd 38: Co dalej — ścieżka rozwoju
- **Databricks Explorer** (następny poziom): Structured Streaming, Delta Live Tables, MLflow
- **Certyfikacja:** Databricks Certified Associate Developer for Apache Spark
- **Dokumentacja i kursy:** `databricks.com/learn/training`
- **Community Edition:** darmowe środowisko do samodzielnych eksperymentów

### Slajd 39: Q&A i feedback
- Czas na pytania otwarte
- Ankieta zwrotna (link / QR kod)
- Kontakt do prowadzącego
