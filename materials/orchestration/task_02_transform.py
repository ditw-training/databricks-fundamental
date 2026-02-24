# Databricks notebook source
# MAGIC %md
# MAGIC # Task 2: Transform Data
# MAGIC Reads previous task result via `taskValues`, applies transformations  
# MAGIC (duration, cost per mile). Returns row count.

# COMMAND ----------

from pyspark.sql.functions import *
from datetime import date
import json

# Parameters
dbutils.widgets.text("source_table", "samples.nyctaxi.trips")
dbutils.widgets.text("run_date", "")

source_table = dbutils.widgets.get("source_table")
run_date = dbutils.widgets.get("run_date") or str(date.today())

# COMMAND ----------

# Get result from previous task (optional)
try:
    prev_result = dbutils.jobs.taskValues.get(
        taskKey="validate",
        key="returnValue",
        default="{}"
    )
    prev_data = json.loads(prev_result)
    print(f"Previous task result: {prev_data}")
except:
    print("Running standalone (no previous task)")

# COMMAND ----------

# Transformation
print(f"Transforming: {source_table}")

df = spark.table(source_table)

df_transformed = (
    df
    .withColumn("trip_duration_minutes", 
                round((col("tpep_dropoff_datetime").cast("long") - 
                       col("tpep_pickup_datetime").cast("long")) / 60, 2))
    .withColumn("cost_per_mile", 
                when(col("trip_distance") > 0, 
                     round(col("fare_amount") / col("trip_distance"), 2))
                .otherwise(0))
    .withColumn("processing_date", lit(run_date))
)

row_count = df_transformed.count()
print(f"Transformed {row_count} rows")

df_transformed.select(
    "trip_distance", "fare_amount", "trip_duration_minutes", "cost_per_mile"
).show(5)

# COMMAND ----------

# Return result
dbutils.notebook.exit(json.dumps({
    "status": "SUCCESS",
    "rows_transformed": row_count
}))
