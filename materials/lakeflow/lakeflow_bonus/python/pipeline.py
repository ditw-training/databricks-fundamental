# ============================================================
# Lakeflow SDP Pipeline - Workshop Solution
# ============================================================
# This pipeline demonstrates the new Lakeflow Streaming Data Platform API
# using the pyspark.pipelines module (dp)

from pyspark import pipelines as dp
from pyspark.sql.functions import *

# Configuration
source_path = spark.conf.get("source_path")

# ============================================================
# BRONZE LAYER - Streaming Tables with Auto Loader
# ============================================================

# Bronze Customers
dp.create_streaming_table(
    name="bronze_customers",
    comment="Raw customers data from CSV"
)

@dp.append_flow(target="bronze_customers")
def bronze_customers_flow():
    return (
        spark.readStream.format("cloudFiles")
        .option("cloudFiles.format", "csv")
        .option("header", "true")
        .option("inferSchema", "true")
        .load(f"{source_path}/Customers.csv")
    )

# Bronze Products
dp.create_streaming_table(
    name="bronze_products",
    comment="Raw products data from CSV"
)

@dp.append_flow(target="bronze_products")
def bronze_products_flow():
    return (
        spark.readStream.format("cloudFiles")
        .option("cloudFiles.format", "csv")
        .option("header", "true")
        .option("inferSchema", "true")
        .load(f"{source_path}/Product.csv")
    )

# Bronze Product Categories
dp.create_streaming_table(
    name="bronze_product_categories",
    comment="Raw product categories data from CSV"
)

@dp.append_flow(target="bronze_product_categories")
def bronze_product_categories_flow():
    return (
        spark.readStream.format("cloudFiles")
        .option("cloudFiles.format", "csv")
        .option("header", "true")
        .option("inferSchema", "true")
        .load(f"{source_path}/ProductCategory.csv")
    )

# Bronze Orders Header
dp.create_streaming_table(
    name="bronze_orders_header",
    comment="Raw orders data from CSV"
)

@dp.append_flow(target="bronze_orders_header")
def bronze_orders_header_flow():
    return (
        spark.readStream.format("cloudFiles")
        .option("cloudFiles.format", "csv")
        .option("header", "true")
        .option("inferSchema", "true")
        .load(f"{source_path}/SalesOrderHeader.csv")
    )

# Bronze Orders Details
dp.create_streaming_table(
    name="bronze_orders_detail",
    comment="Raw orders details data from CSV"
)

@dp.append_flow(target="bronze_orders_detail")
def bronze_orders_detail_flow():
    return (
        spark.readStream.format("cloudFiles")
        .option("cloudFiles.format", "csv")
        .option("header", "true")
        .option("inferSchema", "true")
        .load(f"{source_path}/SalesOrderDetail.csv")
    )

# ============================================================
# SILVER LAYER - SCD with AUTO CDC
# ============================================================

# Silver Customers: SCD Type 2 (History Tracking)
dp.create_streaming_table(
    name="silver_customers",
    comment="Cleaned customers with SCD Type 2"
)

dp.create_auto_cdc_flow(
    target="silver_customers",
    source="bronze_customers",
    keys=["CustomerID"],
    sequence_by=col("ModifiedDate"),
    stored_as_scd_type=2
)

# Silver Products: SCD Type 1 (Overwrite)
dp.create_streaming_table(
    name="silver_products",
    comment="Cleaned products with SCD Type 1"
)

dp.create_auto_cdc_flow(
    target="silver_products",
    source="bronze_products",
    keys=["ProductID"],
    sequence_by=col("ModifiedDate"),
    stored_as_scd_type=1
)

# Silver Product Categories: SCD Type 1 (Overwrite)
dp.create_streaming_table(
    name="silver_product_categories",
    comment="Cleaned product categories with SCD Type 1"
)

dp.create_auto_cdc_flow(
    target="silver_product_categories",
    source="bronze_product_categories",
    keys=["ProductCategoryID"],
    sequence_by=col("ModifiedDate"),
    stored_as_scd_type=1
)

dp.create_streaming_table(
    name="silver_orders",
    comment="Cleaned orders data",
    expect_all_or_drop={"valid_amount": "TotalDue > 0"}
)

# Silver Orders: Streaming Table with Data Quality
@dp.append_flow(
    target="silver_orders",
    name="silver_orders_ingest_flow"
)
def silver_orders():
    return (
        spark.readStream.table("bronze_orders_header")
        .select(
            "SalesOrderID",
            "CustomerID",
            "TotalDue",
            "OrderDate",
            "Status",
            current_timestamp().alias("processed_at")
        )
    )

# Silver Order Details: Streaming Table
@dp.table(
    name="silver_order_details",
    comment="Cleaned order details"
)
def silver_order_details():
    return (
        spark.readStream.table("bronze_orders_detail")
        .select(
            "SalesOrderID",
            "SalesOrderDetailID",
            "OrderQty",
            "ProductID",
            "UnitPrice",
            "UnitPriceDiscount",
            "LineTotal",
            "ModifiedDate",
            current_timestamp().alias("processed_at")
        )
    )

# ============================================================
# GOLD LAYER - Star Schema
# ============================================================

# 1. Dimension: Customers
@dp.materialized_view(
    name="dim_customer",
    comment="Customer Dimension (Current State)"
)
def dim_customer():
    return (
        spark.read.table("silver_customers")
        .filter(col("__END_AT").isNull())
        .select(
            "CustomerID",
            "FirstName",
            "LastName",
            "CompanyName",
            "EmailAddress",
            "Phone"
        )
    )

# 2. Dimension: Products
@dp.materialized_view(
    name="dim_product",
    comment="Product Dimension enriched with Category"
)
def dim_product():
    p = spark.read.table("silver_products")
    pc = spark.read.table("silver_product_categories")
    
    return (
        p.join(pc, "ProductCategoryID", "left")
        .select(
            p["ProductID"],
            p["Name"].alias("ProductName"),
            p["ProductNumber"],
            p["Color"],
            p["StandardCost"],
            p["ListPrice"],
            pc["Name"].alias("CategoryName")
        )
    )

# 3. Dimension: Date
@dp.materialized_view(
    name="dim_date",
    comment="Date Dimension generated from Order Dates"
)
def dim_date():
    return (
        spark.read.table("silver_orders")
        .select(col("OrderDate").cast("date").alias("DateKey"))
        .distinct()
        .select(
            col("DateKey"),
            year("DateKey").alias("Year"),
            month("DateKey").alias("Month"),
            dayofmonth("DateKey").alias("Day"),
            quarter("DateKey").alias("Quarter"),
            dayofweek("DateKey").alias("DayOfWeek"),
            date_format("DateKey", "MMMM").alias("MonthName"),
            date_format("DateKey", "EEEE").alias("DayName")
        )
    )

# 4. Fact: Sales
@dp.materialized_view(
    name="fact_sales",
    comment="Sales Fact Table"
)
def fact_sales():
    od = spark.read.table("silver_order_details")
    oh = spark.read.table("silver_orders")
    
    return (
        od.join(oh, "SalesOrderID", "inner")
        .select(
            od["SalesOrderID"],
            od["SalesOrderDetailID"],
            oh["OrderDate"],
            oh["CustomerID"],
            od["ProductID"],
            od["OrderQty"],
            od["UnitPrice"],
            od["UnitPriceDiscount"],
            od["LineTotal"],
            oh["Status"]
        )
    )
