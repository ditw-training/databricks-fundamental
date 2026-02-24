-- SILVER PRODUCTS
CREATE OR REPLACE MATERIALIZED VIEW silver_products
AS
WITH base AS (
  SELECT
    product_id,
    product_name,
    subcategory_code,
    brand,
    CAST(unit_cost  AS DOUBLE) AS unit_cost,
    CAST(list_price AS DOUBLE) AS list_price,
    CAST(weight_kg  AS DOUBLE) AS weight_kg,
    status,
    CASE 
      WHEN UPPER(status) IN ('ACTIVE', 'AVAILABLE') THEN 1 
      ELSE 0 
    END AS is_active,
    0 AS is_unknown
    --,row_number() OVER(PARTITION BY product_id ORDER BY ingestion_ts desc) AS rn
  FROM bronze_products
)
SELECT
  product_id,
  product_name,
  subcategory_code,
  brand,
  unit_cost,
  list_price,
  weight_kg,
  status,
  is_active,
  is_unknown
FROM base
--where rn = 1

UNION ALL

SELECT
  'UNKNOWN'            AS product_id,
  'Unknown product'    AS product_name,
  'UNKNOWN'            AS subcategory_code,
  'Unknown'            AS brand,
  CAST(NULL AS DOUBLE) AS unit_cost,
  CAST(NULL AS DOUBLE) AS list_price,
  CAST(NULL AS DOUBLE) AS weight_kg,
  'Unknown'            AS status,
  0                    AS is_active,
  1                    AS is_unknown;





