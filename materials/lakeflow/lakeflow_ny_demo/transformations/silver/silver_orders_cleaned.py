from pyspark import pipelines as dp

@dp.table(
    name="silver_orders_cleaned",
    comment="Cleaned orders with comprehensive data quality expectations"
)
@dp.expect_or_fail("valid_order_key", "o_orderkey IS NOT NULL")
@dp.expect_or_drop("valid_customer_key", "o_custkey IS NOT NULL")
@dp.expect_all_or_drop({
    "valid_total_price": "o_totalprice >= 0",
    "valid_order_date": "o_orderdate IS NOT NULL"
})
@dp.expect_all({
    "reasonable_price": "o_totalprice < 1000000",
    "valid_order_status": "o_orderstatus IN ('O', 'F', 'P')",
    "valid_priority": "o_orderpriority IS NOT NULL"
})
def silver_orders_cleaned():
    """
    Silver layer: Clean orders with multiple data quality checks
    
    Expectations Demo:
    - expect_or_fail: Pipeline stops if order key is null (critical)
    - expect_or_drop: Drops records with null customer key
    - expect_all_or_drop: Drops records with invalid price or date
    - expect_all: Warns about suspicious data but keeps records
    
    This demonstrates all expectation types in a single table!
    """
    return (
        spark.readStream.table("bronze_orders")
        .selectExpr(
            "o_orderkey",
            "o_custkey",
            "o_orderstatus",
            "o_totalprice",
            "o_orderdate",
            "o_orderpriority"
        )
    )
