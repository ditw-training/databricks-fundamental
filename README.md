# Databricks Fundamental

**Jednodniowe szkolenie z Databricks** — od zera do działającego potoku danych w architekturze Medallion (Bronze / Silver / Gold).

Scenariusz biznesowy: fikcyjna firma **RetailHub** — sklep odzieżowy online z danymi klientów, zamówień i produktów.

---

## Spis treści

- [O szkoleniu](#o-szkoleniu)
- [Wymagania wstępne](#wymagania-wstępne)
- [Szybki start](#szybki-start)
- [Program szkolenia](#program-szkolenia)
- [Struktura repozytorium](#struktura-repozytorium)
- [Datasety](#datasety)
- [Materiały dodatkowe](#materiały-dodatkowe)
- [Kolejne kroki](#kolejne-kroki)

---

## O szkoleniu

| | |
|---|---|
| **Czas trwania** | 1 dzien (ok. 7 godz.) |
| **Poziom** | Podstawowy |
| **Jezyk notebookow** | Python (PySpark) + SQL |
| **Srodowisko** | Databricks na Azure (Unity Catalog) |
| **Scenariusz** | RetailHub — klienci, zamowienia, produkty |

### Cele szkolenia

Po ukonczeniu szkolenia uczestnik bedzie potrafil:

- Nawigowac po srodowisku Databricks — notebooki, klastry, SQL Warehouse, Catalog Explorer
- Wyjasnic roznice miedzy Serverless a klasycznym compute oraz kiedy uzywac SQL Warehouse
- Rozumiec architekture Lakehouse — Medallion (Bronze/Silver/Gold) z Delta Lake
- Ladowac dane z CSV i JSON (`spark.read`) i zapisywac do tabel Delta
- Eksplorowac dane z `display()`, `show()`, `describe()` i wizualizacjami GUI
- Stosowac podstawowe transformacje PySpark: `withColumn`, `when`, `cast`, `filter`
- Rozumiec Delta Lake: ACID, Time Travel, MERGE, Managed vs External Tables
- Zarzadzac kosztami — typy klastrow, autoscaling, auto-termination
- Tworzyc i uruchamiac prosty Workflow — parametryzacja, harmonogramowanie, Lakeflow
- Uzywac Unity Catalog — schematy, uprawnienia, Lineage, Delta Sharing
- Budowac AI/BI Dashboard i Genie Space na danych Gold

---

## Wymagania wstępne

- Podstawowa znajomosc SQL
- Ogolne rozumienie baz danych i analizy danych
- Dostep do srodowiska Databricks (trainer konfiguruje przed szkoleniem)

---

## Szybki start

### 1. Konfiguracja srodowiska (trener)

```
notebooks/setup/00_pre_config.ipynb
```

Uruchom raz przed szkoleniem — tworzy katalogi Unity Catalog dla uczestnikow.

### 2. Setup uczestnika

```
notebooks/setup/00_setup.ipynb
```

Uruchom na poczatku szkolenia — waliduje katalog, schematy i Volume.

### 3. Weryfikacja srodowiska

W notebooku `notebooks/modules/00_intro.ipynb` uruchom komórke weryfikacyjna:

```python
username = spark.sql("SELECT current_user()").first()[0].split("@")[0].replace(".", "_")
catalog  = f"retailhub_{username}"
spark.sql(f"USE CATALOG {catalog}")
```

Oczekiwany wynik: katalog `retailhub_<twoj_uzytkownik>` z trzema schematami: `bronze`, `silver`, `gold`.

---

## Program szkolenia

| Czas | Modul | Tematy |
|------|-------|--------|
| 09:00 - 09:15 | **M00** Intro & Setup | Agenda, weryfikacja srodowiska, katalog |
| 09:15 - 10:30 | **M01** Platform & Workspace | Workspace, notebooki, Serverless, SQL Warehouse, DBFS vs Volumes, koszty |
| 10:30 - 10:45 | Przerwa | |
| 10:45 - 11:15 | **M02** Spark Architecture | Driver & Executors, Lazy Evaluation, DAG, Catalyst Optimizer |
| 11:15 - 12:00 | **M03** ELT & Ingestion | Architektura Medallion, ladowanie CSV/JSON/Parquet, transformacje, `display()` + GUI Viz |
| 12:00 - 12:45 | Lunch | |
| 12:45 - 13:30 | **Workshop: Ingestion** | Nawigacja po platformie, pierwsze komórki, dbutils, Catalog Explorer, ladowanie danych |
| 13:30 - 14:15 | **M04** Delta Lake | ACID, Time Travel, MERGE, Managed vs External, VACUUM |
| 14:15 - 14:45 | **Workshop: Delta Lake** | Time Travel, MERGE, VACUUM — cwiczenia |
| 14:45 - 15:00 | Przerwa | |
| 15:00 - 15:20 | **M05** Orchestration + Lakeflow | Workflows (Jobs), parametryzacja, harmonogramowanie, Lakeflow Pipelines |
| 15:20 - 15:30 | **M06** Unity Catalog | 3-poziomowa przestrzen nazw, uprawnienia, Row/Column Security, Lineage, Delta Sharing |
| 15:30 - 16:00 | **Final Workshop** | Potok end-to-end: Bronze → Silver → Gold |
| *(jesli czas)* | **Wrap-up + M07 BONUS** | Podsumowanie, kolejne kroki, AI/BI Dashboards, Genie Space |

---

## Struktura repozytorium

```
Databricks-Fundamental/
|
| notebooks/
|   modules/                      # Notebooki demonstracyjne (prowadzacy)
|   |   00_intro.ipynb            # Agenda, harmonogram, weryfikacja srodowiska
|   |   01_platform_workspace.ipynb  # Workspace, Serverless, SQL Warehouse, koszty
|   |   02_spark_architecture.ipynb  # Driver/Executors, Lazy Eval, DAG, Catalyst
|   |   03_medallion_ingestion.ipynb # Architektura Medallion, CSV/JSON/Parquet
|   |   04_delta_fundamentals.ipynb  # ACID, Time Travel, MERGE, VACUUM
|   |   05_orchestration_jobs.ipynb  # Workflows, CRON, Lakeflow Pipelines
|   |   06_unity_catalog.ipynb       # UC, uprawnienia, Lineage, Delta Sharing
|   |   07_aibi_dashboards.ipynb     # BONUS: Dashboards, Genie Space
|   |
|   workshops/                    # Cwiczenia praktyczne (uczestnicy)
|   |   WORKSHOP_ingestion.ipynb  # Po M03
|   |   WORKSHOP_delta.ipynb      # Po M04
|   |   final_labs/
|   |       WORKSHOP_final_project.ipynb  # Po M06 - projekt koncowy
|   |       tasks/
|   |           lab_task_01_bronze.ipynb  # Zadanie: warstwa Bronze
|   |           lab_task_02_silver.ipynb  # Zadanie: warstwa Silver
|   |           lab_task_03_gold.ipynb    # Zadanie: warstwa Gold
|   |
|   setup/
|       00_pre_config.ipynb       # Konfiguracja przed szkoleniem (trener)
|       00_setup.ipynb            # Setup srodowiska uczestnika
|       99_test_runner.ipynb      # Automatyczne testy notebookow
|
| dataset/                        # Dane wejsciowe do cwiczen
|   customers/
|   |   customers.csv             # 10 000 rekordow — dane historyczne klientow
|   |   customers_new.csv         # 114 rekordow — batch aktualizacji (MERGE demo)
|   orders/
|   |   orders_batch.json         # Zamowienia — format JSON (batch)
|   |   stream/                   # Zamowienia — format JSON (3 pliki strumieniowe)
|   products/
|       products.csv              # 2 000 rekordow — katalog produktow
|
| docs/                           # Materialy PDF do pobrania
|   ENG-Databricks-Fundamentals.pdf        # Materialy szkoleniowe (EN)
|   cheatsheet_databricks_fundamental.pdf  # Sciagawka: PySpark, Delta SQL, Workflows
|   quiz_databricks_fundamental.pdf        # Quiz samooceny (10 pytan)
|   external_connection_guide.pdf          # Polaczenie: Power BI, VS Code, ADF
|   next_steps.pdf                         # Przewodnik po dalszej nauce
|
| materials/
|   orchestration/                # Notebooki przykladowe do Workflows
|       task_01_validate.ipynb
|       task_02_transform.ipynb
|       task_03_report.ipynb
|
| assets/
|   images/                       # Zrzuty ekranu uzywane w notebookach
|
| scripts/                        # Skrypty pomocnicze (generowanie, naprawa)
|
| utilization/                    # Dokumentacja wewnetrzna projektu
```

---

## Datasety

Wszystkie dane dotycza fikcyjnej firmy **RetailHub**.

| Plik | Format | Rekordy | Opis |
|------|--------|---------|------|
| `dataset/customers/customers.csv` | CSV | 10 000 | Klienci (ID, imie, email, miasto, segment) |
| `dataset/customers/customers_new.csv` | CSV | 114 | Nowi/zaktualizowani klienci — uzycie w MERGE |
| `dataset/orders/orders_batch.json` | JSON | ok. 10 000 | Zamowienia (ID, klient, produkt, kwota, platnosc) |
| `dataset/orders/stream/*.json` | JSON | 3 pliki | Symulacja strumieniowania zamowien |
| `dataset/products/products.csv` | CSV | 2 000 | Katalog produktow (ID, nazwa, cena, marka) |

### Schemat danych

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

## Materiały dodatkowe

### docs/

| Plik | Kiedy uzywac |
|------|-------------|
| `cheatsheet_databricks_fundamental.pdf` | Sciana — komendy PySpark, Delta SQL, kroki Workflow |
| `quiz_databricks_fundamental.pdf` | Samoocena po szkoleniu — 10 pytan z 6 sekcji |
| `external_connection_guide.pdf` | Polaczenie Databricks z Power BI, VS Code, Azure Data Factory |
| `next_steps.pdf` | Przewodnik po dalszej nauce: AutoLoader, Lakeflow, Streaming, MLflow |

### materials/orchestration/

Trzy notebooki przykladowe uzycia w Workflows (M05):
- `task_01_validate.ipynb` — walidacja danych wejsciowych
- `task_02_transform.ipynb` — transformacja Bronze → Silver
- `task_03_report.ipynb` — generowanie raportu Gold

---

## Kolejne kroki

Po ukonczeniu szkolenia:

| Krok | Co | Kiedy |
|------|----|-------|
| 1 | Powtorz warsztaty na wlasnym klastrze | Tydzien 1-2 |
| 2 | Kurs **Databricks Explorer** (AutoLoader, DLT, advanced UC) | Miesiac 1 |
| 3 | **Databricks Academy** — sciezka Data Engineer | Miesiac 2 |
| 4 | Egzamin: **Databricks Certified Data Engineer Associate** | Miesiac 3 |
| 5 | Sciezka specjalizacyjna: ML, Professional lub SQL Analytics | Miesiac 4-6 |

[databricks.com/learn/training](https://www.databricks.com/learn/training) — bezplatne kursy + testy probne

### Tematy czekajace

| Temat | Co robi |
|-------|---------|
| **AutoLoader** | Inkrementalne wczytywanie plikow z cloud storage |
| **Lakeflow Pipelines** | Deklaratywne ETL z regułami jakosci danych (formerly Delta Live Tables) |
| **Structured Streaming** | Potoki real-time z micro-batch lub continuous processing |
| **Unity Catalog (advanced)** | Row-level security, column masking, automatyczny lineage |
| **MLflow** | Sledzenie eksperymentow i rejestr modeli wbudowany w Databricks |
| **OPTIMIZE + ZORDER** | Kompaktowanie plikow i co-location — nawet 10x szybsze zapytania |

---

## Informacje dla trenera

### Przygotowanie srodowiska

1. Uruchom `notebooks/setup/00_pre_config.ipynb` przed szkoleniem — tworzy katalogi Unity Catalog (`retailhub_<uzytkownik>`) dla kazdego uczestnika z trzema schematami: `bronze`, `silver`, `gold`.
2. Uploaduj pliki z katalogu `dataset/` do Volume `datasets` w kazdym katalogu uczestnika.
3. Na poczatku szkolenia: uczestnicy uruchamiaja `notebooks/setup/00_setup.ipynb`.

### Test notebookow

```
notebooks/setup/99_test_runner.ipynb
```

Uruchom po zmianach w notebookach — automatycznie waliduje poprawnosc struktury.

---

*Repozytorium przygotowane dla szkolenia Altcom — Databricks Fundamental.*
