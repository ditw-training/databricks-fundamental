-- SILVER ORDERS – oczyszczone i policzone miary
CREATE OR REFRESH STREAMING TABLE silver_orders
(
  CONSTRAINT valid_order_id EXPECT (order_id IS NOT NULL)
    ON VIOLATION DROP ROW,
  CONSTRAINT valid_customer EXPECT (customer_id IS NOT NULL)
    ON VIOLATION DROP ROW,
  CONSTRAINT valid_product EXPECT (product_id IS NOT NULL)
    ON VIOLATION DROP ROW,
  CONSTRAINT valid_quantity EXPECT (quantity IS NOT NULL AND quantity <> 0)
    ON VIOLATION DROP ROW,
  CONSTRAINT valid_unit_price EXPECT (unit_price IS NOT NULL AND unit_price >= 0)
    ON VIOLATION DROP ROW
)
AS
SELECT
  o.order_id,
  o.customer_id,
  o.product_id,
  o.store_id,

  CAST(o.order_datetime AS TIMESTAMP)        AS order_ts,
  CAST(o.order_datetime AS DATE)             AS order_date,
  CAST(date_format(o.order_datetime, 'yyyyMMdd') AS INT) AS order_date_key,

  o.quantity,
  o.unit_price,
  o.discount_percent,

  (o.quantity * o.unit_price)                                   AS gross_amount,
  (o.quantity * o.unit_price * o.discount_percent / 100.0)      AS discount_amount,
  (o.quantity * o.unit_price)
    - (o.quantity * o.unit_price * o.discount_percent / 100.0)  AS net_amount,

  COALESCE(o.payment_method, 'Unknown')                         AS payment_method_code,
  o.source_system,

  CASE 
    WHEN o.quantity < 0 OR o.total_amount < 0 
      THEN 1 ELSE 0 
  END AS is_return,

  CASE 
    WHEN CAST(o.order_datetime AS DATE) > current_date() 
      THEN 1 ELSE 0 
  END AS is_future_dated,

  CASE 
    WHEN o.customer_id IS NULL OR o.customer_id IN ('CUST999999') 
      THEN 1 ELSE 0 
  END AS is_unknown_customer,

  CASE 
    WHEN o.product_id IS NULL OR o.product_id IN ('PROD999999') 
      THEN 1 ELSE 0 
  END AS is_unknown_product
FROM STREAM(bronze_orders) o;