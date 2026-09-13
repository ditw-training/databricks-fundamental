# ─────────────────────────────────────────────────────────────────────────────
# Training cluster: single node in standard (shared) access mode, used by the
# trainer and all participants, auto-terminating. Unity Catalog isolates users,
# and every group member can restart the cluster after auto-termination.
# ─────────────────────────────────────────────────────────────────────────────

data "databricks_spark_version" "lts" {
  long_term_support = true
}

moved {
  from = databricks_cluster.trainer
  to   = databricks_cluster.training
}

resource "databricks_cluster" "training" {
  cluster_name            = "training-${local.name}"
  spark_version           = data.databricks_spark_version.lts.id
  node_type_id            = var.cluster_node_type
  autotermination_minutes = var.cluster_autotermination_minutes

  kind               = "CLASSIC_PREVIEW"
  is_single_node     = true
  data_security_mode = "DATA_SECURITY_MODE_STANDARD"

  custom_tags = local.tags

  # Terraform waits for the cluster to start on create; it then terminates on its own.
  depends_on = [databricks_catalog.training]

  # Databricks adds the single-node spark_conf and a ResourceClass tag on its own,
  # and returns our custom tags with an x_ prefix. Without this every plan would
  # show an in-place update that restarts the cluster.
  lifecycle {
    ignore_changes = [custom_tags, spark_conf]
  }
}

resource "databricks_permissions" "training_cluster" {
  cluster_id = databricks_cluster.training.id

  access_control {
    group_name       = databricks_group.training.display_name
    permission_level = "CAN_RESTART"
  }
}
