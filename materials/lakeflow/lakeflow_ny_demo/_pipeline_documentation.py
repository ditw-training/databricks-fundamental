"""
=============================================================================
LAKEFLOW DEMO PIPELINE - COMPREHENSIVE FEATURE SHOWCASE
=============================================================================

This pipeline demonstrates all major Lakeflow (Spark Declarative Pipelines) 
features using Databricks sample datasets (TPC-H).

ARCHITECTURE: Medallion Pattern (Bronze → Silver → Gold)

=============================================================================
BRONZE LAYER - Data Ingestion
=============================================================================

1. bronze_customers (transformations/bronze/bronze_customers.py)
   - Streaming ingestion from samples.tpch.customer
   - Simulates real-time customer data updates
   - Source for SCD demonstrations

2. bronze_orders (transformations/bronze/bronze_orders.py)
   - Streaming ingestion from samples.tpch.orders
   - Simulates real-time order events
   - Source for expectations and aggregations

=============================================================================
SILVER LAYER - Data Quality & CDC
=============================================================================

3. silver_customers_scd1 (transformations/silver/silver_customers_scd1.py)
    SCD TYPE 1 DEMO
   - Maintains CURRENT STATE only
   - Updates overwrite previous values
   - No historical tracking
   - Uses dp.create_auto_cdc_flow() with stored_as_scd_type=1

4. silver_customers_scd2 (transformations/silver/silver_customers_scd2.py)
    SCD TYPE 2 DEMO
   - Maintains FULL HISTORY of changes
   - Adds __START_AT and __END_AT columns
   - Perfect for auditing and time-travel queries
   - Uses dp.create_auto_cdc_flow() with stored_as_scd_type=2

5. silver_orders_cleaned (transformations/silver/silver_orders_cleaned.py)
    EXPECTATIONS DEMO
   - @dp.expect_or_fail: Critical validation (pipeline stops on failure)
   - @dp.expect_or_drop: Data cleansing (drops invalid records)
   - @dp.expect_all_or_drop: Multiple drop rules
   - @dp.expect_all: Monitoring (warns but keeps records)
   - Demonstrates ALL expectation types in one table!

=============================================================================
GOLD LAYER - Analytics & Aggregations
=============================================================================

6. gold_customer_orders_summary (transformations/gold/gold_customer_orders_summary.py)
    MATERIALIZED VIEW DEMO
   - Batch processing with @dp.materialized_view()
   - Joins SCD1 customers with cleaned orders
   - Aggregates order metrics per customer
   - Analytics-ready table for reporting

7. gold_daily_orders (transformations/gold/gold_daily_orders.py)
    FLOWS & BACKFILL DEMO
   - Multiple flows targeting the same table
   - Flow 1: Continuous streaming (once=False)
     * Processes new orders in real-time
     * Uses spark.readStream
   - Flow 2: One-time backfill (once=True)
     * Processes historical data once
     * Uses spark.read
     * Perfect for retroactive data loading

=============================================================================
FEATURES DEMONSTRATED
=============================================================================

 SCD Type 1 - Current state tracking
 SCD Type 2 - Historical change tracking with validity periods
 Auto CDC - Change data capture with dp.create_auto_cdc_flow()
 Expectations - All types (warn, drop, fail)
 Streaming Tables - Real-time incremental processing
 Materialized Views - Batch aggregations
 Multiple Flows - Multiple sources to one target
 Backfill - One-time historical data processing (once=True)
 Medallion Architecture - Bronze → Silver → Gold pattern

=============================================================================
HOW TO RUN
=============================================================================

1. Dry Run (Validation):
   - Click "Validate" to check syntax and dependencies
   - No data processing, just validation

2. Full Pipeline Run:
   - Click "Start" to run the entire pipeline
   - Processes all datasets from Bronze to Gold

3. Selective Refresh:
   - Select specific datasets to refresh
   - More efficient for testing individual tables

=============================================================================
"""

# This file is for documentation only and doesn't define any datasets
pass
