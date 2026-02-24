# Databricks notebook source
# MAGIC %md
# MAGIC # Validation Task: Check Pipeline Results
# MAGIC 
# MAGIC Runs after all medallion tasks complete.  
# MAGIC Validates that every table was created with rows.  
# MAGIC Logs result to `event_log` table.

# COMMAND ----------

import json
from datetime import datetime

dbutils.widgets.text("catalog", "", "Catalog")
dbutils.widgets.text("schema_bronze", "bronze", "Bronze Schema")
dbutils.widgets.text("schema_silver", "silver", "Silver Schema")
dbutils.widgets.text("schema_gold", "gold", "Gold Schema")
dbutils.widgets.text("job_run_id", "", "Job Run ID")

catalog = dbutils.widgets.get("catalog")
schema_bronze = dbutils.widgets.get("schema_bronze")
schema_silver = dbutils.widgets.get("schema_silver")
schema_gold = dbutils.widgets.get("schema_gold")
job_run_id = dbutils.widgets.get("job_run_id") or "manual"

# COMMAND ----------

# Tables to validate
tables_to_check = [
    f"{catalog}.{schema_bronze}.bronze_customers",
    f"{catalog}.{schema_bronze}.bronze_orders",
    f"{catalog}.{schema_silver}.silver_customers",
    f"{catalog}.{schema_silver}.silver_orders_cleaned",
    f"{catalog}.{schema_gold}.gold_customer_orders_summary",
    f"{catalog}.{schema_gold}.gold_daily_orders",
]

# COMMAND ----------

# Validate each table
results = []
all_passed = True

for table_name in tables_to_check:
    try:
        row_count = spark.table(table_name).count()
        status = "PASS" if row_count > 0 else "FAIL"
        if row_count == 0:
            all_passed = False
        results.append({
            "table": table_name,
            "status": status,
            "row_count": row_count,
            "error": None
        })
        print(f"  {status}  {table_name}: {row_count:,} rows")
    except Exception as e:
        all_passed = False
        results.append({
            "table": table_name,
            "status": "FAIL",
            "row_count": 0,
            "error": str(e)[:200]
        })
        print(f"  FAIL  {table_name}: {str(e)[:100]}")

print(f"\nOverall: {'ALL PASSED' if all_passed else 'SOME FAILED'}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Log result to event_log table

# COMMAND ----------

# Create event_log table if not exists
event_log_table = f"{catalog}.default.pipeline_event_log"

spark.sql(f"""
    CREATE TABLE IF NOT EXISTS {event_log_table} (
        event_id STRING,
        event_timestamp TIMESTAMP,
        job_run_id STRING,
        event_type STRING,
        status STRING,
        details STRING
    )
    COMMENT 'Pipeline execution event log for monitoring and auditing'
""")

# COMMAND ----------

# Log validation result
import uuid

event_id = str(uuid.uuid4())[:12]
overall_status = "SUCCESS" if all_passed else "FAILURE"
details = json.dumps(results, default=str)

spark.sql(f"""
    INSERT INTO {event_log_table}
    VALUES (
        '{event_id}',
        current_timestamp(),
        '{job_run_id}',
        'PIPELINE_VALIDATION',
        '{overall_status}',
        '{details}'
    )
""")

print(f"\nEvent logged: {event_id} → {overall_status}")

# COMMAND ----------

# If validation failed, raise error to mark task as failed
if not all_passed:
    failed_tables = [r["table"] for r in results if r["status"] == "FAIL"]
    raise Exception(f"Validation FAILED for: {', '.join(failed_tables)}")

# COMMAND ----------

dbutils.notebook.exit(json.dumps({
    "status": "SUCCESS",
    "tables_checked": len(tables_to_check),
    "all_passed": all_passed,
    "event_id": event_id
}))
