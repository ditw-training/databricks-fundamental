
-- Silver Layer: Cleaning and SCD (Slowly Changing Dimensions)
-- Lakeflow SDP Syntax with AUTO CDC


-- 1. Customers: SCD Type 2 (History Tracking)
CREATE OR REFRESH STREAMING TABLE silver_customers;

CREATE FLOW silver_customers_scd2_flow
AS AUTO CDC INTO silver_customers
FROM STREAM bronze_customers
KEYS (CustomerID)
SEQUENCE BY ModifiedDate
STORED AS SCD TYPE 2;

-- 2. Products: SCD Type 1 (Overwrite)
CREATE OR REFRESH STREAMING TABLE silver_products;

CREATE FLOW silver_products_scd1_flow
AS AUTO CDC INTO silver_products
FROM STREAM bronze_products
KEYS (ProductID)
SEQUENCE BY ModifiedDate
STORED AS SCD TYPE 1;

-- 3. Product Categories: SCD Type 1 (Overwrite)
CREATE OR REFRESH STREAMING TABLE silver_product_categories;

CREATE FLOW silver_product_categories_scd1_flow
AS AUTO CDC INTO silver_product_categories
FROM STREAM bronze_product_categories
KEYS (ProductCategoryID)
SEQUENCE BY ModifiedDate
STORED AS SCD TYPE 1;

-- 4. Orders Header: Streaming Table with Data Quality Expectations
CREATE OR REFRESH STREAMING TABLE silver_orders
(
  CONSTRAINT valid_amount EXPECT (TotalDue > 0) ON VIOLATION DROP ROW,
  CONSTRAINT valid_customer EXPECT (CustomerID IS NOT NULL) ON VIOLATION FAIL UPDATE
)
COMMENT 'Cleaned orders data with quality constraints'
AS SELECT 
  SalesOrderID,
  CustomerID,
  TotalDue,
  OrderDate,
  Status,
  current_timestamp() as processed_at
FROM STREAM(bronze_orders_header);

-- 5. Orders Detail: Streaming Table
CREATE OR REFRESH STREAMING TABLE silver_order_details
COMMENT 'Cleaned order details'
AS SELECT 
  SalesOrderID,
  SalesOrderDetailID,
  OrderQty,
  ProductID,
  UnitPrice,
  UnitPriceDiscount,
  LineTotal,
  ModifiedDate,
  current_timestamp() as processed_at
FROM STREAM(bronze_orders_detail);
