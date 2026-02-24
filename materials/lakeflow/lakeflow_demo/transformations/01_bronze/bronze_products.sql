CREATE OR REPLACE MATERIALIZED VIEW bronze_products
AS
SELECT
  product_id,
  product_name,
  subcategory_code,
  brand,
  unit_cost,
  list_price,
  weight_kg,
  status,
    -- METADATA
  _metadata.file_path                AS source_file_path,
  _metadata.file_modification_time   AS ingestion_ts,
  current_timestamp()                AS load_ts
FROM read_files(
  '${product_path}',
  format => 'parquet'
);