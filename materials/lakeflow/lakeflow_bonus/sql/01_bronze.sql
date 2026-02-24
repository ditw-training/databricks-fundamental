-- ============================================================
-- Bronze Layer: Ingestion using Auto Loader (cloud_files)
-- Lakeflow SDP Syntax
-- ============================================================
-- Configuration: source_path must be set in Pipeline Settings

-- Bronze Customers
CREATE OR REFRESH STREAMING TABLE bronze_customers
COMMENT 'Raw customers data from CSV'
AS SELECT * FROM STREAM read_files('${source_path}/Customers/*', format => 'csv', header => 'true');

-- Bronze Products
CREATE OR REFRESH STREAMING TABLE bronze_products
COMMENT 'Raw products data from CSV'
AS SELECT * FROM STREAM read_files('${source_path}/Product/*', format => 'csv', header => 'true');

-- Bronze Orders
CREATE OR REFRESH STREAMING TABLE bronze_orders_header
COMMENT 'Raw orders data from CSV'
AS SELECT * FROM STREAM read_files('${source_path}/SalesOrderHeader/*', format => 'csv', header => 'true');

-- Bronze Orders
CREATE OR REFRESH STREAMING TABLE bronze_orders_detail
COMMENT 'Raw orders data from CSV'
AS SELECT * FROM STREAM read_files('${source_path}/SalesOrderDetail/*', format => 'csv', header => 'true');

-- Bronze Product Categories
CREATE OR REFRESH STREAMING TABLE bronze_product_categories
COMMENT 'Raw product categories data from CSV'
AS SELECT * FROM STREAM read_files('${source_path}/ProductCategory/*', format => 'csv', header => 'true');