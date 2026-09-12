# ─────────────────────────────────────────────────────────────────────────────
# Trainer's cluster: single node, dedicated to the trainer, auto-terminating.
# Participants create their own compute during the course.
# ─────────────────────────────────────────────────────────────────────────────

data "databricks_spark_version" "lts" {
  long_term_support = true
}

resource "databricks_cluster" "trainer" {
  cluster_name            = "trainer-${local.name}"
  spark_version           = data.databricks_spark_version.lts.id
  node_type_id            = var.trainer_cluster_node_type
  autotermination_minutes = var.trainer_cluster_autotermination_minutes

  kind               = "CLASSIC_PREVIEW"
  is_single_node     = true
  data_security_mode = "SINGLE_USER"
  single_user_name   = data.databricks_current_user.trainer.user_name

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
