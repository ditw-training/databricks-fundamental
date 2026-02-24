-- 3. Create the target SCD2 table
CREATE OR REFRESH STREAMING TABLE silver_customers (
  customer_id        STRING,
  first_name         STRING,
  last_name          STRING,
  email              STRING,
  phone              STRING,
  city               STRING,
  state              STRING,
  country            STRING,
  registration_date  DATE,
  customer_segment   STRING,
  source_file_path   STRING,
  ingestion_ts       TIMESTAMP,
  load_ts            TIMESTAMP,
  __START_AT         TIMESTAMP,
  __END_AT           TIMESTAMP
);

-- 4. Create the AUTO CDC flow for SCD2
CREATE FLOW silver_customers_scd2_flow
AS AUTO CDC INTO silver_customers
FROM STREAM bronze_customers
KEYS (customer_id)
SEQUENCE BY ingestion_ts
STORED AS SCD TYPE 2;