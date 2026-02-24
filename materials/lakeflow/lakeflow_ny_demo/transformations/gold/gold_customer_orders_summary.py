from pyspark import pipelines as dp
from pyspark.sql import functions as F

@dp.materialized_view(
    name="gold_customer_orders_summary",
    comment="Aggregated customer order statistics - demonstrates materialized view with batch processing"
)
def gold_customer_orders_summary():
    """
    Gold layer: Customer order summary with aggregations
    
    Materialized View Demo:
    - Uses spark.read for batch processing
    - Joins SCD1 customer data with cleaned orders
    - Aggregates order metrics per customer
    - Perfect for analytics and reporting
    """
    customers = spark.read.table("silver_customers_scd1")
    orders = spark.read.table("silver_orders_cleaned")
    
    return (
        orders
        .join(customers, orders.o_custkey == customers.c_custkey, "left")
        .groupBy(
            "o_custkey",
            "c_name",
            "c_mktsegment"
        )
        .agg(
            F.count("o_orderkey").alias("total_orders"),
            F.sum("o_totalprice").alias("total_revenue"),
            F.avg("o_totalprice").alias("avg_order_value"),
            F.max("o_orderdate").alias("last_order_date")
        )
    )
