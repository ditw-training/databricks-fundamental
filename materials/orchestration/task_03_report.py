# Databricks notebook source
# MAGIC %md
# MAGIC # Task 3: Generate Report
# MAGIC Aggregates metrics (total trips, revenue, avg fare/distance).  
# MAGIC Prints summary report.

# COMMAND ----------

from pyspark.sql.functions import *
import json
from datetime import datetime

# Parameters
dbutils.widgets.text("source_table", "samples.nyctaxi.trips")

source_table = dbutils.widgets.get("source_table")

# COMMAND ----------

# Aggregations
df = spark.table(source_table)

report = df.agg(
    count("*").alias("total_trips"),
    round(sum("fare_amount"), 2).alias("total_revenue"),
    round(avg("fare_amount"), 2).alias("avg_fare"),
    round(avg("trip_distance"), 2).alias("avg_distance"),
    round(max("fare_amount"), 2).alias("max_fare")
).collect()[0]

# COMMAND ----------

# Display report
print("\n" + "="*50)
print("DAILY REPORT")
print("="*50)
print(f"Total Trips:    {report.total_trips:,}")
print(f"Total Revenue:  ${report.total_revenue:,.2f}")
print(f"Avg Fare:       ${report.avg_fare:.2f}")
print(f"Avg Distance:   {report.avg_distance:.2f} miles")
print(f"Max Fare:       ${report.max_fare:.2f}")
print("="*50)
print(f"Generated at:   {datetime.now()}")
print("="*50 + "\n")

# COMMAND ----------

# Return result
dbutils.notebook.exit(json.dumps({
    "status": "SUCCESS",
    "total_trips": report.total_trips,
    "total_revenue": float(report.total_revenue)
}))
