# Databricks notebook source
# MAGIC %md
# MAGIC # Table Update Trigger — Demo
# MAGIC 
# MAGIC This notebook inserts a record into an **orchestration_update** table  
# MAGIC to simulate a **Table Update Trigger** for a Lakeflow Job.
# MAGIC
# MAGIC **How it works:**
# MAGIC 1. Job is configured with trigger: **"table updated"** on a specific Delta table
# MAGIC 2. When new rows are inserted (or table is modified), the Job is triggered
# MAGIC 3. This notebook simulates the trigger by inserting a signal record

# COMMAND ----------

dbutils.widgets.text("catalog", "", "Catalog")
dbutils.widgets.text("schema", "default", "Schema")

catalog = dbutils.widgets.get("catalog")
schema = dbutils.widgets.get("schema")

trigger_table = f"{catalog}.{schema}.orchestration_trigger"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 1: Create the trigger table (one-time setup)

# COMMAND ----------

spark.sql(f"""
    CREATE TABLE IF NOT EXISTS {trigger_table} (
        trigger_id STRING,
        trigger_timestamp TIMESTAMP,
        trigger_source STRING,
        payload STRING,
        processed BOOLEAN DEFAULT false
    )
    COMMENT 'Table used as trigger source for Table Update Trigger in Lakeflow Jobs'
""")

print(f"Trigger table ready: {trigger_table}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 2: Insert signal record — this triggers the Job!

# COMMAND ----------

import uuid
from datetime import datetime
import json

trigger_id = str(uuid.uuid4())[:8]
payload = json.dumps({
    "event": "data_ready",
    "source": "table_update_demo",
    "batch_id": trigger_id
})

spark.sql(f"""
    INSERT INTO {trigger_table} 
    VALUES (
        '{trigger_id}',
        current_timestamp(),
        'table_update_trigger_demo',
        '{payload}',
        false
    )
""")

print(f"Signal record inserted: trigger_id = {trigger_id}")
print(f"Any Job watching '{trigger_table}' will now trigger.")

# COMMAND ----------

# Verify
display(spark.sql(f"SELECT * FROM {trigger_table} ORDER BY trigger_timestamp DESC LIMIT 5"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Job Configuration — Table Update Trigger (JSON)
# MAGIC
# MAGIC ```json
# MAGIC {
# MAGIC   "trigger": {
# MAGIC     "table": {
# MAGIC       "table_name": "<catalog>.<schema>.orchestration_trigger",
# MAGIC       "condition": "inserted_count > 0",
# MAGIC       "min_time_between_triggers_seconds": 60,
# MAGIC       "wait_after_last_change_seconds": 15
# MAGIC     }
# MAGIC   }
# MAGIC }
# MAGIC ```
# MAGIC
# MAGIC **UI Path:** Job → Triggers → Add trigger → Table updated  
# MAGIC - Table: `<catalog>.<schema>.orchestration_trigger`  
# MAGIC - Condition: Any new rows  
# MAGIC - Min time between triggers: 60s  
# MAGIC - Wait after last change: 15s
# MAGIC
# MAGIC **Use Cases:**
# MAGIC - Pipeline B triggers after Pipeline A writes silver layer
# MAGIC - Gold aggregation starts when silver table is updated
# MAGIC - Downstream notifications after upstream ETL completes
