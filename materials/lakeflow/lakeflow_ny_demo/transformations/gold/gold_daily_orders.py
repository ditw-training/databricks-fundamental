from pyspark import pipelines as dp
from pyspark.sql import functions as F

# Create target streaming table for multiple flows
dp.create_streaming_table(
    name="gold_daily_orders",
    comment="Daily order aggregations - demonstrates multiple flows (streaming + backfill)"
)

# Flow 1: Continuous streaming flow for new orders (simplified - no aggregation)
@dp.append_flow(
    target="gold_daily_orders",
    name="live_daily_orders",
    comment="Continuous flow processing new orders in real-time"
)
def live_daily_orders():
    """
    Streaming Flow Demo:
    - Processes new orders continuously as they arrive
    - Uses spark.readStream for streaming semantics
    - Passes through order data for downstream aggregation
    """
    return (
        spark.readStream.table("silver_orders_cleaned")
        .select(
            F.to_date("o_orderdate").alias("order_date"),
            "o_orderstatus",
            "o_orderkey",
            "o_totalprice"
        )
    )

# Flow 2: One-time backfill flow for historical data
@dp.append_flow(
    target="gold_daily_orders",
    name="backfill_historical_orders",
    once=True,
    comment="One-time backfill of historical orders from archive"
)
def backfill_historical_orders():
    """
    Backfill Flow Demo:
    - Runs ONCE to process historical data
    - Uses spark.read for batch processing (once=True)
    - Simulates loading from historical archive
    - Perfect for retroactively processing old data
    """
    return (
        spark.read.table("silver_orders_cleaned")
        .filter("o_orderdate < '1995-01-01'")  # Simulate historical data
        .select(
            F.to_date("o_orderdate").alias("order_date"),
            "o_orderstatus",
            "o_orderkey",
            "o_totalprice"
        )
    )

# Materialized View: Aggregated daily orders
@dp.materialized_view(
    name="gold_daily_orders_aggregated",
    comment="Aggregated daily order statistics - materialized view for analytics"
)
def gold_daily_orders_aggregated():
    """
    Materialized View Demo:
    - Reads from the streaming table using batch processing
    - Performs aggregations on the collected data
    - Perfect for analytics and reporting
    - No watermark issues since it's batch processing
    """
    return (
        spark.read.table("gold_daily_orders")
        .groupBy("order_date", "o_orderstatus")
        .agg(
            F.count("o_orderkey").alias("order_count"),
            F.sum("o_totalprice").alias("total_revenue"),
            F.avg("o_totalprice").alias("avg_order_value")
        )
    )
