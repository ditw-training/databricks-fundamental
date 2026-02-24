-- ============================================================
-- Gold Layer: Star Schema
-- Lakeflow SDP Syntax with Materialized Views
-- ============================================================

-- 1. Dimension: Customers
CREATE OR REFRESH MATERIALIZED VIEW dim_customer
COMMENT 'Customer Dimension (Current State)'
AS SELECT 
  CustomerID,
  FirstName,
  LastName,
  CompanyName,
  EmailAddress,
  Phone
FROM silver_customers
WHERE __END_AT IS NULL;

-- 2. Dimension: Products
CREATE OR REFRESH MATERIALIZED VIEW dim_product
COMMENT 'Product Dimension enriched with Category'
AS SELECT 
  p.ProductID,
  p.Name as ProductName,
  p.ProductNumber,
  p.Color,
  p.StandardCost,
  p.ListPrice,
  pc.Name as CategoryName
FROM silver_products p
LEFT JOIN silver_product_categories pc ON p.ProductCategoryID = pc.ProductCategoryID;

-- 3. Dimension: Date
CREATE OR REFRESH MATERIALIZED VIEW dim_date
COMMENT 'Date Dimension generated from Order Dates'
AS SELECT DISTINCT
  cast(OrderDate as date) as DateKey,
  year(OrderDate) as Year,
  month(OrderDate) as Month,
  day(OrderDate) as Day,
  quarter(OrderDate) as Quarter,
  dayofweek(OrderDate) as DayOfWeek,
  date_format(OrderDate, 'MMMM') as MonthName,
  date_format(OrderDate, 'EEEE') as DayName
FROM silver_orders;

-- 4. Fact: Sales
CREATE OR REFRESH MATERIALIZED VIEW fact_sales
COMMENT 'Sales Fact Table'
AS SELECT 
  od.SalesOrderID,
  od.SalesOrderDetailID,
  oh.OrderDate,
  oh.CustomerID,
  od.ProductID,
  od.OrderQty,
  od.UnitPrice,
  od.UnitPriceDiscount,
  od.LineTotal,
  oh.Status
FROM silver_order_details od
JOIN silver_orders oh ON od.SalesOrderID = oh.SalesOrderID;
