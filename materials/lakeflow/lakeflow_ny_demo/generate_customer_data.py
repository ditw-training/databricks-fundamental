"""
Data Generator for Customer SCD Demo

Usage:
1. Run generate_batch_0() once to create initial historical data
2. Run generate_batch_1() through generate_batch_5() sequentially to simulate changes
3. Each batch creates a new JSON file in /Volumes/retailhub_trener/lakeflow_demo/dataset/tpch_customer/

The pipeline's Auto Loader will automatically detect and process new files.
"""

from pyspark.sql.functions import col, when, concat, lit, current_timestamp, to_json, struct
import json

# Target path for JSON files
TARGET_PATH = "/Volumes/retailhub_trener/lakeflow_demo/dataset/tpch_customer/"


def generate_batch_0():
    """
    Generate Batch 0: Historical/Original Customer Data
    
    This creates the initial dataset from samples.tpch.customer.
    All records are marked as 'original' type.
    """
    print("Generating Batch 0: Historical customer data...")
    
    df = (
        spark.read.table("samples.tpch.customer")
        .withColumn("record_type", lit("original"))
        .withColumn("processing_timestamp", current_timestamp())
    )
    
    output_path = f"{TARGET_PATH}batch_0_original.json"
    df.write.mode("overwrite").json(output_path)
    
    count = df.count()
    print(f"✓ Batch 0 complete: {count} records written to {output_path}")
    return df


def generate_batch_1():
    """
    Generate Batch 1: First Wave of Updates
    
    Simulates address and phone changes for every 1000th customer.
    """
    print("Generating Batch 1: Address and phone updates...")
    
    df = (
        spark.read.table("samples.tpch.customer")
        .filter((col("c_custkey") % 1000) == 0)
        .withColumn("c_address", concat(lit("UPDATED_V1: "), col("c_address")))
        .withColumn("c_phone", concat(lit("99-"), col("c_phone")))
        .withColumn("record_type", lit("modified"))
        .withColumn("processing_timestamp", current_timestamp())
    )
    
    output_path = f"{TARGET_PATH}batch_1_updates.json"
    df.write.mode("overwrite").json(output_path)
    
    count = df.count()
    print(f"✓ Batch 1 complete: {count} records written to {output_path}")
    return df


def generate_batch_2():
    """
    Generate Batch 2: Market Segment and Balance Changes
    
    Simulates market segment switches and account balance increases for every 500th customer.
    """
    print("Generating Batch 2: Market segment and balance updates...")
    
    df = (
        spark.read.table("samples.tpch.customer")
        .filter((col("c_custkey") % 500) == 0)
        .withColumn("c_mktsegment", 
            when(col("c_mktsegment") == "BUILDING", "AUTOMOBILE")
            .when(col("c_mktsegment") == "AUTOMOBILE", "FURNITURE")
            .when(col("c_mktsegment") == "MACHINERY", "HOUSEHOLD")
            .otherwise("BUILDING")
        )
        .withColumn("c_acctbal", col("c_acctbal") + 1500)
        .withColumn("record_type", lit("modified"))
        .withColumn("processing_timestamp", current_timestamp())
    )
    
    output_path = f"{TARGET_PATH}batch_2_updates.json"
    df.write.mode("overwrite").json(output_path)
    
    count = df.count()
    print(f"✓ Batch 2 complete: {count} records written to {output_path}")
    return df


def generate_batch_3():
    """
    Generate Batch 3: Comprehensive Updates
    
    Simulates comprehensive changes (address, phone, segment, balance, comment) for every 750th customer.
    """
    print("Generating Batch 3: Comprehensive updates...")
    
    df = (
        spark.read.table("samples.tpch.customer")
        .filter((col("c_custkey") % 750) == 0)
        .withColumn("c_address", concat(lit("UPDATED_V2: "), col("c_address")))
        .withColumn("c_phone", concat(lit("88-"), col("c_phone")))
        .withColumn("c_mktsegment", lit("MACHINERY"))
        .withColumn("c_acctbal", col("c_acctbal") - 800)
        .withColumn("c_comment", concat(lit("[MODIFIED_V3] "), col("c_comment")))
        .withColumn("record_type", lit("modified"))
        .withColumn("processing_timestamp", current_timestamp())
    )
    
    output_path = f"{TARGET_PATH}batch_3_updates.json"
    df.write.mode("overwrite").json(output_path)
    
    count = df.count()
    print(f"✓ Batch 3 complete: {count} records written to {output_path}")
    return df


def generate_batch_4():
    """
    Generate Batch 4: Different Customer Set
    
    Simulates updates for every 333rd customer (different set than previous batches).
    """
    print("Generating Batch 4: New customer set updates...")
    
    df = (
        spark.read.table("samples.tpch.customer")
        .filter((col("c_custkey") % 333) == 0)
        .withColumn("c_address", concat(lit("NEW_ADDR_V4: "), col("c_address")))
        .withColumn("c_phone", concat(lit("77-"), col("c_phone")))
        .withColumn("c_acctbal", col("c_acctbal") + 2500)
        .withColumn("record_type", lit("modified"))
        .withColumn("processing_timestamp", current_timestamp())
    )
    
    output_path = f"{TARGET_PATH}batch_4_updates.json"
    df.write.mode("overwrite").json(output_path)
    
    count = df.count()
    print(f"✓ Batch 4 complete: {count} records written to {output_path}")
    return df


def generate_batch_5():
    """
    Generate Batch 5: Re-updates (Overlapping with Batch 1)
    
    Simulates re-updating the same customers from Batch 1 (every 1000th customer).
    This demonstrates how SCD handles multiple updates to the same records.
    """
    print("Generating Batch 5: Re-updates (overlapping with Batch 1)...")
    
    df = (
        spark.read.table("samples.tpch.customer")
        .filter((col("c_custkey") % 1000) == 0)
        .withColumn("c_address", concat(lit("FINAL_UPDATE: "), col("c_address")))
        .withColumn("c_phone", concat(lit("66-"), col("c_phone")))
        .withColumn("c_mktsegment", lit("HOUSEHOLD"))
        .withColumn("c_acctbal", col("c_acctbal") + 5000)
        .withColumn("c_comment", concat(lit("[FINAL_VERSION] "), col("c_comment")))
        .withColumn("record_type", lit("modified"))
        .withColumn("processing_timestamp", current_timestamp())
    )
    
    output_path = f"{TARGET_PATH}batch_5_updates.json"
    df.write.mode("overwrite").json(output_path)
    
    count = df.count()
    print(f"✓ Batch 5 complete: {count} records written to {output_path}")
    return df


def generate_all_batches():
    """
    Generate all batches sequentially.
    """
    print("=" * 60)
    print("Generating ALL batches for SCD Demo")
    print("=" * 60)
    
    generate_batch_0()
    generate_batch_1()
    generate_batch_2()
    generate_batch_3()
    generate_batch_4()
    generate_batch_5()
    
    print("=" * 60)
    print("✓ All batches generated successfully!")
    print(f"Files location: {TARGET_PATH}")
    print("=" * 60)


# Example usage (uncomment to run):
generate_batch_0()  # Start with historical data
# generate_batch_1()  # Then run incremental batches one by one
# generate_batch_2()
# generate_batch_3()
# generate_batch_4()
# generate_batch_5()
