# Databricks Fundamental – Syllabus szkolenia

## Cel szkolenia

Szkolenie przeznaczone jest dla osób rozpoczynających pracę z Databricks: analityków danych, inżynierów danych, specjalistów BI oraz kadry technicznej, która chce poznać podstawowe funkcje środowiska.

## Korzyści z ukończenia szkolenia

- rozumieją podstawowe składniki środowiska Databricks
- mają wiedzę o Unity Catalog i Delta Lake jako fundamentach Databricks
- potrafią wczytać dane, wykonać proste transformacje i eksplorację
- potrafią używać Workflows do podstawowej automatyzacji
- mają świadomość podstawowych praktyk zarządzania kosztami w chmurze
- są przygotowani do kolejnego etapu ścieżki szkoleniowej – Databricks Explorer

## Wymagania wstępne

- Podstawowa znajomość SQL
- Ogólne rozumienie baz danych i analizy danych
- Podstawowa znajomość koncepcji chmury (opcjonalnie)

---

## Program szkolenia

### 1. Poznanie platformy Databricks

- Workspace, notebooks, clusters, DBFS
- Podstawowe koncepcje i architektura platformy
- Unity Catalog – katalogi, schematy, podstawowe uprawnienia
- Delta Lake jako domyślny format

### 2. Zarządzanie kosztami

- Typy klastrów: Jobs vs All-purpose
- Autoscaling i jego wpływ na koszty
- Podstawowe zasady efektywnego wykorzystania zasobów

### 3. GUI i narzędzia

- Interfejs Databricks – praca z notebookami, markdown, mieszanie SQL i Python
- Tworzenie prostych wizualizacji w GUI
- AI Assistant w notebookach – jak wspiera użytkownika

### 4. Podstawowe operacje na danych

- Wczytywanie danych z plików CSV i JSON
- Eksploracja danych: `display()`, `show()`, `describe()`, `summary()`
- Podstawowe transformacje w PySpark (`withColumn`, `when`, `cast`)

### 5. Workflows i automatyzacja

- Tworzenie prostych zadań w GUI Workflows
- Parametryzacja, harmonogramowanie, cykliczne zadania

### 6. Projekt końcowy

- Wczytanie danych do Delta Lake, wykonanie podstawowych transformacji i uruchomienie ich w zaplanowanym workflow
