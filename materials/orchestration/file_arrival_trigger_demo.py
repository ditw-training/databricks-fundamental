# Databricks notebook source
# MAGIC %md
# MAGIC # File Arrival Trigger — Demo
# MAGIC 
# MAGIC This notebook creates a random file in a Unity Catalog Volume to simulate  
# MAGIC a **File Arrival Trigger** for a Lakeflow Job.
# MAGIC
# MAGIC **How it works:**
# MAGIC 1. Job is configured with **File Arrival** trigger pointing to a Volume path
# MAGIC 2. When a new file appears in that path, the Job is triggered automatically
# MAGIC 3. This notebook simulates the "arrival" by writing a signal file

# COMMAND ----------

dbutils.widgets.text("catalog", "", "Catalog")
dbutils.widgets.text("volume_path", "", "Volume Path")

catalog = dbutils.widgets.get("catalog")
volume_path = dbutils.widgets.get("volume_path")

# Default: /Volumes/<catalog>/default/landing_zone/trigger/
if not volume_path:
    volume_path = f"/Volumes/{catalog}/default/landing_zone/trigger"

# COMMAND ----------

import uuid
from datetime import datetime
import json

# Generate unique signal file
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
file_id = str(uuid.uuid4())[:8]
file_name = f"signal_{timestamp}_{file_id}.json"
file_path = f"{volume_path}/{file_name}"

# Signal content
signal = {
    "event": "data_ready",
    "timestamp": timestamp,
    "source": "file_arrival_demo",
    "id": file_id
}

# COMMAND ----------

# Ensure directory exists
dbutils.fs.mkdirs(volume_path)

# Write signal file — this triggers the Job!
dbutils.fs.put(file_path, json.dumps(signal, indent=2), overwrite=True)

print(f"Signal file created: {file_path}")
print(f"Content: {json.dumps(signal, indent=2)}")
print(f"\nAny Job with File Arrival trigger on '{volume_path}' will now run.")

# COMMAND ----------

# Verify file exists
files = dbutils.fs.ls(volume_path)
print(f"\nFiles in {volume_path}:")
for f in files:
    print(f"  {f.name} ({f.size} bytes)")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Job Configuration — File Arrival Trigger (JSON)
# MAGIC 
# MAGIC ```json
# MAGIC {
# MAGIC   "trigger": {
# MAGIC     "file_arrival": {
# MAGIC       "url": "/Volumes/<catalog>/default/landing_zone/trigger",
# MAGIC       "min_time_between_triggers_seconds": 60,
# MAGIC       "wait_after_last_change_seconds": 15
# MAGIC     }
# MAGIC   }
# MAGIC }
# MAGIC ```
# MAGIC 
# MAGIC **UI Path:** Job → Triggers → Add trigger → File arrival  
# MAGIC - URL: Volume path  
# MAGIC - Min time between triggers: 60s  
# MAGIC - Wait after last change: 15s
