--SET order_path = '/Volumes/training_catalog/default/datasets/orders';

-- 1. RAW ORDERS (BRONZE) – docelowa streaming table
CREATE OR REFRESH STREAMING TABLE bronze_orders;

-- 1a. Backfill z historycznego pliku orders (batch, jednorazowo)
CREATE FLOW bronze_orders_backfill
AS 
INSERT INTO ONCE bronze_orders BY NAME
SELECT
  order_id,
  customer_id,
  product_id,
  store_id,
  CAST(order_datetime AS TIMESTAMP)  AS order_datetime,
  CAST(quantity AS INT)           AS quantity,
  CAST(unit_price AS DOUBLE)         AS unit_price,
  CAST(discount_percent AS INT)   AS discount_percent,
  CAST(total_amount AS DOUBLE)       AS total_amount,
  payment_method,
  'batch'                            AS source_system,
      -- METADATA
  _metadata.file_path                AS source_file_path,
  _metadata.file_modification_time   AS ingestion_ts,
  current_timestamp()                AS load_ts
FROM read_files(
  '${order_path}/orders_batch.json',
  format           => 'json',
  inferColumnTypes => true
);

-- 1b. Stream z orders_stream_*.json (ciągły dopływ danych)
CREATE FLOW bronze_orders_stream
AS INSERT INTO bronze_orders BY NAME
SELECT
  order_id,
  customer_id,
  product_id,
  store_id,
  CAST(order_datetime AS TIMESTAMP)  AS order_datetime,
  CAST(quantity AS INT)           AS quantity,
  CAST(unit_price AS DOUBLE)         AS unit_price,
  CAST(discount_percent AS INT)   AS discount_percent,
  CAST(total_amount AS DOUBLE)       AS total_amount,
  payment_method,
  'stream'                           AS source_system,
        -- METADATA
  _metadata.file_path                AS source_file_path,
  _metadata.file_modification_time   AS ingestion_ts,
  current_timestamp()                AS load_ts
FROM STREAM read_files(
  '${order_path}/stream/orders_stream_*.json',
  format           => 'json',
  inferColumnTypes => true
);