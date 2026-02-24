------------------------------------------------------------------
-- GOLD – FACT FCT_SALES (STREAMING TABLE)
------------------------------------------------------------------

CREATE OR REFRESH STREAMING TABLE fact_sales
(
  CONSTRAINT valid_order_id EXPECT (order_id IS NOT NULL) 
    ON VIOLATION FAIL UPDATE,
  CONSTRAINT valid_store_key EXPECT (store_key IS NOT NULL AND store_key >= -1),
  CONSTRAINT valid_customer_key EXPECT (customer_key IS NOT NULL AND customer_key >= -1),
  CONSTRAINT valid_product_key EXPECT (product_key IS NOT NULL AND product_key >= -1),
  CONSTRAINT valid_payment_key EXPECT (payment_method_key IS NOT NULL AND payment_method_key >= -1),
  CONSTRAINT valid_date_key EXPECT (order_date_key IS NOT NULL),
  CONSTRAINT valid_amounts EXPECT (gross_amount >= 0 AND net_amount >= 0),
  CONSTRAINT valid_quantity EXPECT (quantity IS NOT NULL AND quantity <> 0)
)
AS
SELECT
  -- klucze surogatowe do wymiarów
  o.order_id,
  COALESCE(s.store_key, -1)               AS store_key,
  COALESCE(c.customer_key, -1)            AS customer_key,
  COALESCE(p.product_key, -1)             AS product_key,
  COALESCE(pm.payment_method_key, -1)     AS payment_method_key,
  COALESCE(d.date_key, o.order_date_key)  AS order_date_key,
  o.order_ts,

  -- miary sprzedażowe
  o.quantity,
  o.unit_price,
  o.discount_percent,
  o.gross_amount,
  o.discount_amount,
  o.net_amount,

  -- miary kosztowe i rentowności
  COALESCE(p.unit_cost, 0) * o.quantity                           AS total_cost,
  o.net_amount - (COALESCE(p.unit_cost, 0) * o.quantity)         AS profit_amount,
  CASE 
    WHEN o.net_amount > 0 
      THEN ((o.net_amount - (COALESCE(p.unit_cost, 0) * o.quantity)) / o.net_amount) * 100
    ELSE 0 
  END                                                             AS margin_percent,

  -- flagi
  o.is_return,
  o.is_future_dated,
  o.is_unknown_customer,
  o.is_unknown_product,

  -- lineage
  o.source_system
FROM STREAM(silver_orders) o
LEFT JOIN dim_customer c
  ON o.customer_id = c.customer_id
LEFT JOIN dim_product p
  ON o.product_id = p.product_id
LEFT JOIN dim_store s
  ON o.store_id = s.store_id
LEFT JOIN dim_payment_method pm
  ON o.payment_method_code = pm.payment_method_code
LEFT JOIN dim_date d
  ON o.order_date_key = d.date_key;
