------------------------------------------------------------------
-- GOLD – DIM CUSTOMER (snapshot z SCD2) jako MATERIALIZED VIEW
------------------------------------------------------------------

CREATE OR REFRESH MATERIALIZED VIEW dim_customer
AS
SELECT
  row_number() OVER (ORDER BY customer_id) AS customer_key,
  customer_id,
  first_name,
  last_name,
  email,
  phone,
  city,
  state,
  country,
  registration_date,
  customer_segment
FROM silver_customers
WHERE __END_AT IS NULL

UNION ALL

SELECT
  -1                   AS customer_key,
  'UNKNOWN'            AS customer_id,
  'Unknown'            AS first_name,
  'Unknown'            AS last_name,
  'unknown@unknown.com' AS email,
  'Unknown'            AS phone,
  'Unknown'            AS city,
  'Unknown'            AS state,
  'Unknown'            AS country,
  CAST(NULL AS DATE)   AS registration_date,
  'Unknown'            AS customer_segment;
