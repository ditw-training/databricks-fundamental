from pyspark import pipelines as dp

# Create target streaming table for SCD Type 2
dp.create_streaming_table(
    name="silver_customers_scd2",
    comment="SCD Type 2: Full history of customer changes with validity periods (__START_AT, __END_AT). Includes record_type and processing_timestamp from bronze layer."
)

# Define Auto CDC flow for SCD Type 2
dp.create_auto_cdc_flow(
    target="silver_customers_scd2",
    source="bronze_customers",
    keys=["c_custkey"],
    sequence_by="processing_timestamp",  # Use processing_timestamp to track changes over time
    stored_as_scd_type=2,  # SCD Type 2: Full history tracking
    ignore_null_updates=True
)

"""
SCD Type 2 Demo:
- Tracks FULL HISTORY of customer changes
- Each change creates a new row with validity period
- Adds __START_AT and __END_AT columns automatically
- Current records have __END_AT = NULL
- Perfect for auditing and historical analysis
- Uses c_custkey as primary key and processing_timestamp as sequence column
- record_type column shows whether each historical version came from 'original' or 'modified' record

Query examples:
- See full history: SELECT * FROM silver_customers_scd2 ORDER BY c_custkey, __START_AT
- See current records only: SELECT * FROM silver_customers_scd2 WHERE __END_AT IS NULL
- See historical changes for a customer: SELECT * FROM silver_customers_scd2 WHERE c_custkey = 1000 ORDER BY __START_AT
- Count versions per customer: SELECT c_custkey, COUNT(*) as version_count FROM silver_customers_scd2 GROUP BY c_custkey ORDER BY version_count DESC
- See which changes were from modifications: SELECT * FROM silver_customers_scd2 WHERE record_type = 'modified' ORDER BY __START_AT DESC
- Compare original vs modified for same customer: 
    SELECT c_custkey, record_type, c_address, c_phone, c_mktsegment, __START_AT, __END_AT 
    FROM silver_customers_scd2 
    WHERE c_custkey = 1000 
    ORDER BY __START_AT
"""
