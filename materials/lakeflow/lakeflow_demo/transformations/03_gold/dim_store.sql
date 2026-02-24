------------------------------------------------------------------
-- GOLD – DIM STORE (MV)
------------------------------------------------------------------

CREATE OR REFRESH MATERIALIZED VIEW dim_store
AS
SELECT
  row_number() OVER (ORDER BY store_id) AS store_key,
  store_id,
  store_id AS store_code
FROM (
  SELECT DISTINCT store_id
  FROM silver_orders
  
  UNION ALL
  
  SELECT 'UNKNOWN' AS store_id
);
