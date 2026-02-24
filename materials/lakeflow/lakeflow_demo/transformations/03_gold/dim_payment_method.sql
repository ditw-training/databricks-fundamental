CREATE OR REFRESH MATERIALIZED VIEW dim_payment_method
AS
SELECT
  row_number() OVER (ORDER BY payment_method_code) AS payment_method_key,
  payment_method_code,
  CASE
    WHEN payment_method_code IN ('Credit Card', 'Debit Card') THEN 'Card'
    WHEN payment_method_code = 'Cash' THEN 'Cash'
    WHEN payment_method_code = 'PayPal' THEN 'Digital wallet'
    ELSE 'Other'
  END AS payment_method_group
FROM (
  SELECT DISTINCT payment_method_code
  FROM silver_orders
  
  UNION ALL
  
  SELECT 'Unknown' AS payment_method_code
);
