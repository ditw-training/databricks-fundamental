from pyspark import pipelines as dp

@dp.table(
    name="bronze_orders",
    comment="Raw orders data ingested from TPC-H sample dataset - simulates real-time order events"
)
def bronze_orders():
    """
    Bronze layer: Ingest orders data from samples.tpch.orders
    This simulates a streaming source of order events for quality checks and aggregations
    """
    return (
        spark.readStream.table("samples.tpch.orders")
    )
