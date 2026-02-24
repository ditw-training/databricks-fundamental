from pyspark import pipelines as dp

# Create target streaming table for SCD Type 1
dp.create_streaming_table(
    name="silver_customers_scd1",
    comment="SCD Type 1: Current state of customers - updates overwrite previous values. Includes record_type and processing_timestamp from bronze layer."
)

# Define Auto CDC flow for SCD Type 1
dp.create_auto_cdc_flow(
    target="silver_customers_scd1",
    source="bronze_customers",
    keys=["c_custkey"],
    sequence_by="processing_timestamp",  # Use processing_timestamp to track changes over time
    stored_as_scd_type=1,  # SCD Type 1: Only current state
    ignore_null_updates=True
)

"""
SCD Type 1 Demo:
- Tracks ONLY the current state of each customer
- Updates overwrite previous values (no history)
- Efficient for scenarios where historical changes don't matter
- Uses c_custkey as primary key and processing_timestamp as sequence column
- record_type column shows whether the current state came from 'original' or 'modified' record
- Latest record (by processing_timestamp) wins

Query examples:
- See current state: SELECT * FROM silver_customers_scd1
- See which customers have modified state: SELECT * FROM silver_customers_scd1 WHERE record_type = 'modified'
- Compare with bronze: SELECT * FROM bronze_customers WHERE c_custkey IN (SELECT c_custkey FROM silver_customers_scd1 WHERE record_type = 'modified')
"""
